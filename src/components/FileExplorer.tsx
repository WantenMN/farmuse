import * as React from "react";
import { cn } from "@/lib/utils";
import { FileEntry as RawFileEntry } from "../types";
import { useFileExplorer, FileExplorerEntry } from "../hooks/useFileExplorer";
import { useFileExplorerCommands } from "../hooks/useFileExplorerCommands";
import { FileExplorerHeader } from "./FileExplorer/FileExplorerHeader";
import { FileExplorerItem } from "./FileExplorer/FileExplorerItem";
import {
  FilePlus,
  FolderPlus,
  ChevronsDownUp,
  ListTree,
  Edit2,
  Copy,
  FileCode,
  FolderTree,
  ExternalLink,
  Scissors,
  ClipboardPaste,
  Trash2,
  UnfoldVertical,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { commandManager } from "../systems/commandManager";
import { Virtuoso } from "react-virtuoso";
import { CustomScrollbar } from "./CustomScrollbar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  useFileStore,
  encodeMultiPaths,
  decodeMultiPaths,
} from "../store/fileStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useDragDrop } from "../hooks/useDragDrop";
import { DragOverlay } from "./FileExplorer/DragOverlay";

interface FileExplorerProps {
  currentPath: string | null;
  entries: RawFileEntry[];
  isVisible: boolean;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onOpenFile: (path: string, name: string) => void;
  onFileDeleted?: (path: string) => void;
  onFileMoved?: (oldPath: string, newPath: string) => void;
  activeFilePath?: string | null;
  onCloseFolder?: () => void;
  focusNewFilePath?: React.MutableRefObject<string | null>;
}

export function NewItemInput({
  depth,
  initialValue,
  onSubmit,
  onCancel,
}: {
  depth: number;
  initialValue: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (inputRef.current) {
      const input = inputRef.current;
      const timer = setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div
      className="flex items-center gap-1 py-0.5"
      style={{ paddingLeft: `${depth * 12 + 6}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        className="bg-background border-primary w-full border px-1 text-sm outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSubmit(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit(value);
          if (e.key === "Escape") onCancel();
        }}
      />
    </div>
  );
}

export function FileExplorer({
  currentPath,
  entries: rootEntries,
  isVisible,
  width,
  onResizeStart,
  onOpenFile,
  onFileDeleted,
  onFileMoved,
  activeFilePath,
  onCloseFolder,
  focusNewFilePath,
}: FileExplorerProps) {
  const {
    entries,
    expandedPaths,
    focusedIndex,
    setFocusedPath: setFocusedPathRaw,
    selectedPaths,
    setSelectedPaths,
    anchorPathRef,
    isActive,
    setIsActive,
    toggleFolder,
    expandFolderAll,
    refreshTree,
    setExpandedPaths,
  } = useFileExplorer(currentPath, rootEntries);

  const setFocusedPath = React.useCallback(
    (path: string | null) => {
      setFocusedPathRaw(path);
      if (path) anchorPathRef.current = path;
    },
    [setFocusedPathRaw, anchorPathRef]
  );

  const { cutPath, setCutPath, copyPath, setCopyPath } = useFileStore();

  React.useEffect(() => {
    if (!entries.length) return;
    const paths = new Set(entries.map((e) => normalizePath(e.path)));
    if (copyPath) {
      const cps = decodeMultiPaths(copyPath);
      if (cps.some((p) => !paths.has(normalizePath(p)))) setCopyPath(null);
    }
    if (cutPath) {
      const cts = decodeMultiPaths(cutPath);
      if (cts.some((p) => !paths.has(normalizePath(p)))) setCutPath(null);
    }
  }, [entries, copyPath, cutPath, setCopyPath, setCutPath]);

  const [isExpanded, setIsExpanded] = React.useState(true);
  const prevFocusedIndexRef = React.useRef<number>(-1);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const virtuosoRef = React.useRef(null);
  const scrollerElRef = React.useRef<HTMLElement | null>(null);

  const [isAutoReveal, setIsAutoReveal] = React.useState(() => {
    const saved = localStorage.getItem("explorer_auto_reveal");
    return saved !== null ? saved === "true" : true;
  });

  React.useEffect(() => {
    localStorage.setItem("explorer_auto_reveal", String(isAutoReveal));
  }, [isAutoReveal]);

  const [newItem, setNewItem] = React.useState<{
    type: "file" | "folder";
    parentPath: string;
    depth: number;
    insertIndex: number;
  } | null>(null);
  const [newName, setNewName] = React.useState("");

  const [editingItem, setEditingItem] = React.useState<{
    path: string;
    name: string;
  } | null>(null);
  const [editName, setEditName] = React.useState("");

  const [deleteConfirmItem, setDeleteConfirmItem] =
    React.useState<FileExplorerEntry | null>(null);
  const [multiDeleteItems, setMultiDeleteItems] = React.useState<
    FileExplorerEntry[]
  >([]);

  const normalizePath = (path: string) => path.replace(/\\/g, "/");

  const cutPathSet = React.useMemo(
    () => new Set(decodeMultiPaths(cutPath).map(normalizePath)),
    [cutPath]
  );

  const deletePendingRef = React.useRef(false);

  const expandedPathsRef = React.useRef(expandedPaths);
  expandedPathsRef.current = expandedPaths;

  const refreshTreeRef = React.useRef(refreshTree);
  refreshTreeRef.current = refreshTree;

  const revealAndFocus = React.useCallback(
    async (path: string) => {
      if (!currentPath) return;
      const normalizedCurrent = normalizePath(currentPath);
      const normalizedTarget = normalizePath(path);

      if (!normalizedTarget.startsWith(normalizedCurrent)) return;

      const relativePath = normalizedTarget.substring(normalizedCurrent.length);
      const parts = relativePath.split("/").filter(Boolean);
      const currentExpanded = expandedPathsRef.current;
      const newExpanded = new Set(currentExpanded);
      let current = normalizedCurrent;
      let changed = false;

      for (let i = 0; i < parts.length - 1; i++) {
        current = current.endsWith("/")
          ? `${current}${parts[i]}`
          : `${current}/${parts[i]}`;
        if (!newExpanded.has(current)) {
          newExpanded.add(current);
          changed = true;
        }
      }

      if (changed) {
        setExpandedPaths(newExpanded);
        await refreshTreeRef.current(newExpanded);
      } else {
        await refreshTreeRef.current(currentExpanded);
      }
      setFocusedPath(normalizedTarget);
      setIsActive(true);
    },
    [currentPath, setExpandedPaths, setFocusedPath, setIsActive]
  );

  const handleDragMove = React.useCallback(
    async (sourcePaths: string[], targetDir: string) => {
      const finalTargetDir = targetDir || currentPath || "";
      const normalizedTarget = normalizePath(finalTargetDir);

      const pathsToMove = sourcePaths.filter((sourcePath) => {
        const normalizedSource = normalizePath(sourcePath);
        const sourceParent = normalizedSource.substring(
          0,
          normalizedSource.lastIndexOf("/")
        );
        return sourceParent !== normalizedTarget;
      });

      if (pathsToMove.length === 0) return;

      try {
        const resultPaths: string[] = [];
        for (const sourcePath of pathsToMove) {
          const resultPath = await invoke<string>("move_item", {
            at: sourcePath,
            toDir: finalTargetDir,
          });
          onFileMoved?.(sourcePath, resultPath);
          resultPaths.push(resultPath);
        }
        if (resultPaths.length > 0) {
          resultPaths.sort((a, b) =>
            a.replace(/\\/g, "/").localeCompare(b.replace(/\\/g, "/"))
          );

          let currentExpanded = expandedPathsRef.current;
          if (!currentExpanded.has(normalizedTarget)) {
            currentExpanded = new Set(currentExpanded);
            currentExpanded.add(normalizedTarget);
            setExpandedPaths(currentExpanded);
          }

          await revealAndFocus(resultPaths[0]);
          setSelectedPaths(new Set(resultPaths));
        }
      } catch (e) {
        console.error("Failed to move via drag", e);
      }
    },
    [
      onFileMoved,
      revealAndFocus,
      currentPath,
      setExpandedPaths,
      setSelectedPaths,
    ]
  );

  const { dragState, handleMouseDown } = useDragDrop({
    entries,
    expandedPaths,
    onMove: handleDragMove,
    scrollContainerRef,
  });

  React.useEffect(() => {
    const handleDragExpand = async (e: Event) => {
      if (!dragState?.isDragging) return;

      const customEvent = e as CustomEvent<{ path: string }>;
      const path = customEvent.detail?.path;
      if (path && !expandedPaths.has(path)) {
        const newExpanded = new Set(expandedPaths);
        newExpanded.add(path);
        setExpandedPaths(newExpanded);
        await refreshTree(newExpanded);
      }
    };

    window.addEventListener("drag-expand-folder", handleDragExpand);
    return () => {
      window.removeEventListener("drag-expand-folder", handleDragExpand);
    };
  }, [dragState?.isDragging, expandedPaths, setExpandedPaths, refreshTree]);

  const revealFile = React.useCallback(
    async (path: string, isManualTabSwitch: boolean = false) => {
      if (!currentPath || !path || !isAutoReveal) return;
      if (!isManualTabSwitch) return;
      const normalizedCurrent = normalizePath(currentPath);
      const normalizedTarget = normalizePath(path);

      if (!normalizedTarget.startsWith(normalizedCurrent)) return;

      const relativePath = normalizedTarget.substring(normalizedCurrent.length);
      const parts = relativePath.split("/").filter(Boolean);
      const newExpanded = new Set(expandedPaths);
      let current = normalizedCurrent;
      let changed = false;

      for (let i = 0; i < parts.length - 1; i++) {
        const nextPart = parts[i];
        current = current.endsWith("/")
          ? `${current}${nextPart}`
          : `${current}/${nextPart}`;
        if (!newExpanded.has(current)) {
          newExpanded.add(current);
          changed = true;
        }
      }

      if (changed) {
        await refreshTree(newExpanded);
        setExpandedPaths(newExpanded);
      }
      if (!selectedPaths.has(normalizedTarget)) {
        setSelectedPaths(new Set());
      }
      setFocusedPath(normalizedTarget);
    },
    [
      currentPath,
      expandedPaths,
      refreshTree,
      setExpandedPaths,
      setFocusedPath,
      isAutoReveal,
      selectedPaths,
      setSelectedPaths,
    ]
  );

  const handleCreateNew = async (overrideName?: string) => {
    const nameToUse = overrideName || newName;
    if (!newItem || !nameToUse.trim()) {
      setNewItem(null);
      setNewName("");
      return;
    }

    const name = nameToUse.trim();
    const isFile = newItem.type === "file";
    const fullName = isFile && !name.endsWith(".md") ? `${name}.md` : name;
    const parentPath = normalizePath(newItem.parentPath);
    const path = parentPath.endsWith("/")
      ? `${parentPath}${fullName}`
      : `${parentPath}/${fullName}`;

    setNewItem(null);
    setNewName("");

    try {
      if (isFile) {
        await invoke("write_file_content", { path, content: "" });
      } else {
        await invoke("create_directory", { path });
      }

      const newExpanded = new Set(expandedPaths);
      newExpanded.add(parentPath);
      await refreshTree(newExpanded);
      setExpandedPaths(newExpanded);

      if (isFile) {
        onOpenFile(path, fullName);
        setFocusedPath(path);
        if (focusNewFilePath) focusNewFilePath.current = path;
      } else {
        setFocusedPath(path);
      }
    } catch (e) {
      console.error("Failed to create", e);
    }
  };

  const startCreate = (type: "file" | "folder", entry?: FileExplorerEntry) => {
    if (!currentPath) return;

    let parentPath = normalizePath(currentPath);
    let depth = 0;
    let insertIndex = 0;

    const targetEntry =
      entry || (focusedIndex !== -1 ? entries[focusedIndex] : undefined);

    if (targetEntry) {
      if (targetEntry.is_dir) {
        parentPath = normalizePath(targetEntry.path);
        depth = targetEntry.depth + 1;
        const index = entries.findIndex((e) => e.path === targetEntry.path);
        insertIndex = index + 1;
      } else {
        const path = normalizePath(targetEntry.path);
        const lastSlash = path.lastIndexOf("/");
        if (lastSlash !== -1) {
          parentPath = path.substring(0, lastSlash);
        }
        depth = targetEntry.depth;
        const index = entries.findIndex((e) => e.path === targetEntry.path);
        insertIndex = index + 1;
      }
    }

    setNewItem({ type, parentPath, depth, insertIndex });
    setNewName("");
    setIsExpanded(true);
  };

  const handleRename = async () => {
    if (!editingItem || !editName.trim()) {
      setEditingItem(null);
      return;
    }

    const isFile = !entries.find((e) => e.path === editingItem.path)?.is_dir;
    const finalName = isFile ? `${editName.trim()}.md` : editName.trim();

    if (finalName === editingItem.name) {
      setEditingItem(null);
      return;
    }

    try {
      const newPath = await invoke<string>("rename_item", {
        at: editingItem.path,
        newName: finalName,
      });
      onFileMoved?.(editingItem.path, newPath);
      setEditingItem(null);
      await refreshTree(expandedPaths);
      setFocusedPath(newPath);
    } catch (e) {
      console.error("Failed to rename", e);
    }
  };

  const handleDuplicate = async (entry: FileExplorerEntry) => {
    try {
      const newPath = await invoke<string>("duplicate_item", {
        path: entry.path,
      });
      await refreshTree(expandedPaths);
      setFocusedPath(newPath);
    } catch (e) {
      console.error("Failed to duplicate", e);
    }
  };

  const handleDelete = async () => {
    const items =
      multiDeleteItems.length > 0
        ? multiDeleteItems
        : deleteConfirmItem
          ? [deleteConfirmItem]
          : [];
    if (items.length === 0) return;
    try {
      for (const item of items) {
        await invoke("remove_to_trash", { path: item.path });
        if (!item.is_dir) {
          onFileDeleted?.(item.path);
        }
        if (copyPath === item.path) setCopyPath(null);
        if (cutPath === item.path) setCutPath(null);
      }
      deletePendingRef.current = false;
      setDeleteConfirmItem(null);
      setMultiDeleteItems([]);
      setSelectedPaths(new Set());
      await refreshTree(expandedPaths);
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handlePaste = async (targetDir: string) => {
    const normalizedTargetDir = normalizePath(targetDir);

    let currentExpanded = expandedPaths;
    if (!expandedPaths.has(normalizedTargetDir)) {
      currentExpanded = new Set(expandedPaths);
      currentExpanded.add(normalizedTargetDir);
      setExpandedPaths(currentExpanded);
    }

    if (cutPath) {
      const paths = decodeMultiPaths(cutPath);
      const validPaths = paths.filter((p) => {
        const normalized = normalizePath(p);
        const lastSlash = normalized.lastIndexOf("/");
        const parentDir =
          lastSlash !== -1 ? normalized.substring(0, lastSlash) : "";
        return (
          normalized !== normalizedTargetDir &&
          parentDir !== normalizedTargetDir
        );
      });

      if (validPaths.length === 0) {
        setCutPath(null);
        return;
      }

      try {
        const resultPaths: string[] = [];
        for (const p of validPaths) {
          const result = await invoke<string>("move_item", {
            at: p,
            toDir: targetDir,
          });
          onFileMoved?.(p, result);
          resultPaths.push(result);
        }
        setCutPath(null);
        await refreshTree(currentExpanded);
        setSelectedPaths(new Set(resultPaths));
        setFocusedPath(resultPaths[resultPaths.length - 1]);
      } catch (e) {
        console.error("Failed to paste", e);
      }
    } else if (copyPath) {
      try {
        const paths = decodeMultiPaths(copyPath);
        const resultPaths: string[] = [];
        for (const p of paths) {
          const result = await invoke<string>("copy_item", {
            at: p,
            toDir: targetDir,
          });
          resultPaths.push(result);
        }
        await refreshTree(currentExpanded);
        setSelectedPaths(new Set(resultPaths));
        setFocusedPath(resultPaths[resultPaths.length - 1]);
      } catch (e) {
        console.error("Failed to copy", e);
      }
    }
  };

  const handleCopyPath = async (path: string, relative: boolean) => {
    let textToCopy = path;
    if (relative && currentPath) {
      const normalizedRoot = normalizePath(currentPath);
      const normalizedPath = normalizePath(path);
      if (normalizedPath.startsWith(normalizedRoot)) {
        textToCopy = normalizedPath.substring(normalizedRoot.length);
        if (textToCopy.startsWith("/")) textToCopy = textToCopy.substring(1);
      }
    }

    const isWindows = navigator.userAgent.includes("Windows");
    if (isWindows) {
      textToCopy = textToCopy.replace(/\//g, "\\");
    }

    await writeText(textToCopy);
  };

  const expandAll = async () => {
    if (!currentPath) return;
    try {
      const allDirs = await invoke<string[]>("list_all_subdirs", {
        path: currentPath,
      });
      const newExpanded = new Set(allDirs.map(normalizePath));
      setExpandedPaths(newExpanded);
      await refreshTree(newExpanded, true);
    } catch (e) {
      console.error("Failed to expand all", e);
    }
  };

  const collapseAll = async () => {
    setExpandedPaths(new Set());
    await refreshTree(new Set());
  };

  const handleEmptyAreaClick = () => {
    if (deletePendingRef.current) return;
    setFocusedPath(null);
    setSelectedPaths(new Set());
    anchorPathRef.current = null;
  };

  const handleEmptyAreaContextMenu = () => {
    if (deletePendingRef.current) return;
    setFocusedPath(null);
    setSelectedPaths(new Set());
    anchorPathRef.current = null;
  };

  useFileExplorerCommands({
    isActive,
    setIsActive,
    entries,
    focusedIndex,
    setFocusedPath,
    expandedPaths,
    toggleFolder,
    scrollContainerRef,
    onOpenFile,
    onRename: () => {
      if (focusedIndex !== -1) {
        const entry = entries[focusedIndex];
        const nameWithoutExt = entry.is_dir
          ? entry.name
          : entry.name.replace(/\.md$/, "");
        setEditingItem({ path: entry.path, name: entry.name });
        setEditName(nameWithoutExt);
      }
    },
    onDelete: () => {
      if (selectedPaths.size > 1) {
        const items = entries.filter((e) => selectedPaths.has(e.path));
        if (items.length > 0) setMultiDeleteItems(items);
      } else if (focusedIndex !== -1) {
        setDeleteConfirmItem(entries[focusedIndex]);
      }
    },
    onCut: () => {
      if (selectedPaths.size > 1) {
        const paths = entries
          .filter((e) => selectedPaths.has(e.path))
          .map((e) => e.path);
        setCutPath(encodeMultiPaths(paths));
      } else if (focusedIndex !== -1) {
        setCutPath(entries[focusedIndex].path);
      }
    },
    onCopy: () => {
      if (selectedPaths.size > 1) {
        const paths = entries
          .filter((e) => selectedPaths.has(e.path))
          .map((e) => e.path);
        setCopyPath(encodeMultiPaths(paths));
      } else if (focusedIndex !== -1) {
        setCopyPath(entries[focusedIndex].path);
      }
    },
    onPaste: () => {
      const entry = focusedIndex !== -1 ? entries[focusedIndex] : undefined;
      const targetDir =
        entry?.is_dir || !entry
          ? entry?.path || currentPath || ""
          : entry.path.substring(0, entry.path.lastIndexOf("/"));
      handlePaste(targetDir);
    },
  });

  React.useEffect(() => {
    const handler = (args?: unknown) => {
      const targetPath = (args as { path?: string })?.path || activeFilePath;
      if (targetPath && isAutoReveal) {
        revealFile(targetPath, true);
      }
    };
    commandManager.register({
      id: "explorer.revealActiveFile",
      name: "Explorer: Reveal Active File",
      description: "Reveal the active file in the explorer",
      handler,
      visible: false,
    });
    return () => commandManager.unregister("explorer.revealActiveFile");
  }, [activeFilePath, isAutoReveal, revealFile]);

  React.useEffect(() => {
    if (isAutoReveal && activeFilePath) {
      revealFile(activeFilePath, true);
    }
  }, [isAutoReveal]);

  React.useEffect(() => {
    if (
      focusedIndex !== -1 &&
      virtuosoRef.current &&
      focusedIndex !== prevFocusedIndexRef.current
    ) {
      prevFocusedIndexRef.current = focusedIndex;
      // @ts-expect-error virtuoso type issues
      virtuosoRef.current.scrollIntoView({
        index: focusedIndex,
        behavior: "auto",
      });
    }
  }, [focusedIndex]);

  const renderContextMenuContent = (entry?: FileExplorerEntry) => {
    const isFolder = entry && entry.is_dir;
    const isEmpty = !entry;
    const hasPaste = !!((cutPath || copyPath) && (isFolder || isEmpty));
    const isMulti =
      entry && selectedPaths.size > 1 && selectedPaths.has(entry.path);

    if (isMulti) {
      const selectedEntries = entries.filter((e) => selectedPaths.has(e.path));
      return (
        <ContextMenuContent className="w-56">
          <ContextMenuGroup key="clipboard">
            <ContextMenuItem
              onClick={() =>
                setCopyPath(
                  encodeMultiPaths(selectedEntries.map((e) => e.path))
                )
              }
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                setCutPath(encodeMultiPaths(selectedEntries.map((e) => e.path)))
              }
            >
              <Scissors className="mr-2 h-4 w-4" />
              Cut
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup key="delete">
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                deletePendingRef.current = true;
                setMultiDeleteItems(selectedEntries);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      );
    }

    const items: React.ReactNode[] = [];

    if (isFolder || isEmpty) {
      items.push(
        <ContextMenuGroup key="new">
          <ContextMenuItem onClick={() => startCreate("file", entry)}>
            <FilePlus className="mr-2 h-4 w-4" />
            New File
          </ContextMenuItem>
          <ContextMenuItem onClick={() => startCreate("folder", entry)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </ContextMenuItem>
        </ContextMenuGroup>
      );
    }

    if (isFolder || isEmpty) {
      if (items.length > 0) items.push(<ContextMenuSeparator key="sep0.5" />);
      items.push(
        <ContextMenuGroup key="expandAll">
          <ContextMenuItem
            onClick={() =>
              isFolder ? expandFolderAll(entry.path) : expandAll()
            }
          >
            <UnfoldVertical className="mr-2 h-4 w-4" />
            {isFolder ? "Expand All Subfolders" : "Expand All"}
          </ContextMenuItem>
        </ContextMenuGroup>
      );
    }

    if (entry) {
      if (items.length > 0) items.push(<ContextMenuSeparator key="sep1" />);
      items.push(
        <ContextMenuGroup key="edit">
          <ContextMenuItem
            onClick={() => {
              const nameWithoutExt = entry.is_dir
                ? entry.name
                : entry.name.replace(/\.md$/, "");
              setEditingItem({ path: entry.path, name: entry.name });
              setEditName(nameWithoutExt);
            }}
          >
            <Edit2 className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleDuplicate(entry)}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </ContextMenuItem>
        </ContextMenuGroup>
      );
    }

    if (items.length > 0) items.push(<ContextMenuSeparator key="sep2" />);
    items.push(
      <ContextMenuGroup key="paths">
        <ContextMenuItem
          onClick={() => handleCopyPath(entry?.path || currentPath || "", true)}
        >
          <FileCode className="mr-2 h-4 w-4" />
          Copy Relative Path
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() =>
            handleCopyPath(entry?.path || currentPath || "", false)
          }
        >
          <FolderTree className="mr-2 h-4 w-4" />
          Copy Absolute Path
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => revealItemInDir(entry?.path || currentPath || "")}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in File Manager
        </ContextMenuItem>
      </ContextMenuGroup>
    );

    if (entry || hasPaste) {
      if (items.length > 0) items.push(<ContextMenuSeparator key="sep3" />);
      items.push(
        <ContextMenuGroup key="clipboard">
          {entry && (
            <>
              <ContextMenuItem onClick={() => setCopyPath(entry.path)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setCutPath(entry.path)}>
                <Scissors className="mr-2 h-4 w-4" />
                Cut
              </ContextMenuItem>
            </>
          )}
          {hasPaste && (
            <ContextMenuItem
              onClick={() => handlePaste(entry?.path || currentPath || "")}
            >
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Paste
            </ContextMenuItem>
          )}
        </ContextMenuGroup>
      );
    }

    if (entry) {
      if (items.length > 0) items.push(<ContextMenuSeparator key="sep4" />);
      items.push(
        <ContextMenuGroup key="delete">
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteConfirmItem(entry)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuGroup>
      );
    }

    if (isEmpty) {
      if (items.length > 0) items.push(<ContextMenuSeparator key="sep5" />);
      items.push(
        <ContextMenuGroup key="close">
          <ContextMenuItem onClick={() => onCloseFolder?.()}>
            Close Folder
          </ContextMenuItem>
        </ContextMenuGroup>
      );
    }

    return <ContextMenuContent className="w-56">{items}</ContextMenuContent>;
  };

  return (
    <aside
      className={cn(
        "group relative flex h-full shrink-0 flex-col overflow-hidden border-r",
        !isVisible && "hidden"
      )}
      style={{ width: `${width}px` }}
    >
      <div
        className="hover:bg-primary/30 active:bg-primary/50 absolute top-0 right-0 z-50 h-full w-1 cursor-col-resize transition-colors"
        onMouseDown={(e) => {
          if (e.button === 0) {
            e.preventDefault();
            onResizeStart(e);
          }
        }}
      />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex h-full flex-col"
            onContextMenu={(_e) => {
              handleEmptyAreaContextMenu();
            }}
          >
            <FileExplorerHeader
              currentPath={currentPath}
              isExpanded={isExpanded}
              onToggle={() => setIsExpanded(!isExpanded)}
              onClick={() => {
                handleEmptyAreaClick();
              }}
              onContextMenu={() => {
                handleEmptyAreaContextMenu();
              }}
            >
              <div className="flex items-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startCreate("file");
                  }}
                  className="text-muted-foreground hover:bg-accent cursor-pointer rounded p-1 transition-colors"
                  title="New File"
                >
                  <FilePlus className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startCreate("folder");
                  }}
                  className="text-muted-foreground hover:bg-accent cursor-pointer rounded p-1 transition-colors"
                  title="New Folder"
                >
                  <FolderPlus className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAutoReveal(!isAutoReveal);
                  }}
                  className={cn(
                    "hover:bg-accent cursor-pointer rounded p-1 transition-colors",
                    isAutoReveal
                      ? "bg-accent text-primary"
                      : "text-muted-foreground"
                  )}
                  title="Auto Reveal File"
                >
                  <ListTree className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    collapseAll();
                  }}
                  className="text-muted-foreground hover:bg-accent cursor-pointer rounded p-1 transition-colors"
                  title="Collapse All"
                >
                  <ChevronsDownUp className="h-4 w-4" />
                </button>
              </div>
            </FileExplorerHeader>
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden py-1",
                !isExpanded && "hidden"
              )}
              onClick={handleEmptyAreaClick}
            >
              <div
                ref={scrollContainerRef}
                className="relative flex-1 overflow-hidden pr-0 pl-1 outline-none"
                tabIndex={0}
                onFocus={() => setIsActive(true)}
                onBlur={() => setIsActive(false)}
                onClick={handleEmptyAreaClick}
                onContextMenu={handleEmptyAreaContextMenu}
              >
                {!currentPath ? (
                  <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                    <p className="text-muted-foreground text-xs tracking-tight italic">
                      Open a folder to start
                    </p>
                  </div>
                ) : entries.length === 0 && !newItem ? (
                  <p className="text-muted-foreground p-2 text-xs italic">
                    Empty
                  </p>
                ) : (
                  <>
                    {entries.length === 0 && newItem && (
                      <NewItemInput
                        depth={newItem.depth}
                        initialValue={newName}
                        onSubmit={(val) => {
                          handleCreateNew(val);
                        }}
                        onCancel={() => setNewItem(null)}
                      />
                    )}
                    <Virtuoso
                      ref={virtuosoRef}
                      scrollerRef={(el) => {
                        scrollerElRef.current = el as HTMLElement | null;
                      }}
                      data={entries}
                      className="hide-native-scrollbar h-full"
                      itemContent={(index, entry) => (
                        <div className="space-y-px">
                          {newItem && newItem.insertIndex === index && (
                            <NewItemInput
                              depth={newItem.depth}
                              initialValue={newName}
                              onSubmit={(val) => {
                                handleCreateNew(val);
                              }}
                              onCancel={() => setNewItem(null)}
                            />
                          )}
                          <ContextMenu
                            onOpenChange={(open) => {
                              if (open) {
                                setFocusedPath(entry.path);
                                if (!selectedPaths.has(entry.path)) {
                                  setSelectedPaths(new Set([entry.path]));
                                }
                                setIsActive(true);
                              }
                            }}
                          >
                            <ContextMenuTrigger asChild>
                              <div
                                onContextMenu={(e) => {
                                  e.stopPropagation();
                                  setFocusedPath(entry.path);
                                  if (!selectedPaths.has(entry.path)) {
                                    setSelectedPaths(new Set([entry.path]));
                                  }
                                  setIsActive(true);
                                }}
                              >
                                <FileExplorerItem
                                  entry={entry}
                                  isFocused={index === focusedIndex}
                                  isSelected={selectedPaths.has(entry.path)}
                                  isExpanded={expandedPaths.has(entry.path)}
                                  isCut={cutPathSet.has(
                                    normalizePath(entry.path)
                                  )}
                                  isDragging={
                                    dragState?.isDragging &&
                                    dragState.sourceEntries.some(
                                      (s) => s.path === entry.path
                                    )
                                  }
                                  isEditing={editingItem?.path === entry.path}
                                  editName={editName}
                                  onEditChange={setEditName}
                                  onEditSubmit={handleRename}
                                  onEditCancel={() => setEditingItem(null)}
                                  onMouseDown={(e) => {
                                    const paths =
                                      selectedPaths.size > 1 &&
                                      selectedPaths.has(entry.path)
                                        ? Array.from(selectedPaths)
                                        : [entry.path];
                                    const sources = paths
                                      .map((p) =>
                                        entries.find((en) => en.path === p)
                                      )
                                      .filter(
                                        (en): en is FileExplorerEntry =>
                                          en !== undefined
                                      );
                                    handleMouseDown(e, sources);
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsActive(true);
                                    if (e.ctrlKey || e.metaKey) {
                                      setSelectedPaths((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(entry.path)) {
                                          next.delete(entry.path);
                                        } else {
                                          next.add(entry.path);
                                        }
                                        return next;
                                      });
                                      setFocusedPath(entry.path);
                                    } else if (
                                      e.shiftKey &&
                                      anchorPathRef.current
                                    ) {
                                      const startIdx = entries.findIndex(
                                        (en) =>
                                          en.path.replace(/\\/g, "/") ===
                                          anchorPathRef.current!.replace(
                                            /\\/g,
                                            "/"
                                          )
                                      );
                                      const endIdx = index;
                                      if (startIdx !== -1) {
                                        const [lo, hi] =
                                          startIdx < endIdx
                                            ? [startIdx, endIdx]
                                            : [endIdx, startIdx];
                                        const range = new Set<string>();
                                        for (let i = lo; i <= hi; i++) {
                                          range.add(entries[i].path);
                                        }
                                        setSelectedPaths(range);
                                      }
                                      setFocusedPathRaw(entry.path);
                                    } else {
                                      setSelectedPaths(new Set([entry.path]));
                                      setFocusedPath(entry.path);
                                      if (entry.is_dir) {
                                        toggleFolder(index);
                                      } else {
                                        onOpenFile(entry.path, entry.name);
                                      }
                                    }
                                  }}
                                />
                              </div>
                            </ContextMenuTrigger>
                            {renderContextMenuContent(entry)}
                          </ContextMenu>
                          {newItem &&
                            newItem.insertIndex === index + 1 &&
                            index === entries.length - 1 && (
                              <NewItemInput
                                depth={newItem.depth}
                                initialValue={newName}
                                onSubmit={(val) => {
                                  handleCreateNew(val);
                                }}
                                onCancel={() => setNewItem(null)}
                              />
                            )}
                        </div>
                      )}
                    />
                    <CustomScrollbar containerRef={scrollerElRef} />
                  </>
                )}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        {renderContextMenuContent()}
      </ContextMenu>

      <Dialog
        open={!!deleteConfirmItem || multiDeleteItems.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            deletePendingRef.current = false;
            setDeleteConfirmItem(null);
            setMultiDeleteItems([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              {multiDeleteItems.length > 0 ? (
                <>
                  This will move{" "}
                  <span className="text-foreground font-semibold">
                    {multiDeleteItems.length}
                  </span>{" "}
                  items to the trash.
                </>
              ) : (
                <>
                  This will move{" "}
                  <span className="text-foreground font-semibold">
                    {deleteConfirmItem?.name}
                  </span>{" "}
                  to the trash.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                deletePendingRef.current = false;
                setDeleteConfirmItem(null);
                setMultiDeleteItems([]);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dragState?.isDragging && (
        <DragOverlay
          dragState={dragState}
          scrollContainerRef={scrollContainerRef}
          entries={entries}
        />
      )}
    </aside>
  );
}
