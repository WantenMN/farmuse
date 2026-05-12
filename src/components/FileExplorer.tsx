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
  ChevronsUpDown,
  ListTree,
  Edit2,
  Copy,
  FileCode,
  FolderTree,
  ExternalLink,
  Scissors,
  ClipboardPaste,
  Trash2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { commandManager } from "../systems/commandManager";
import { Virtuoso } from "react-virtuoso";
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
import { useFileStore } from "../store/fileStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

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
}: FileExplorerProps) {
  const {
    entries,
    expandedPaths,
    focusedIndex,
    setFocusedIndex,
    setFocusedPath,
    isActive,
    setIsActive,
    toggleFolder,
    refreshTree,
    setExpandedPaths,
  } = useFileExplorer(currentPath, rootEntries);

  const { cutPath, setCutPath, copyPath, setCopyPath } = useFileStore();
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [prevFocusedIndex, setPrevFocusedIndex] = React.useState<number>(-1);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const virtuosoRef = React.useRef(null);

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

  const normalizePath = (path: string) => path.replace(/\\/g, "/");

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

      // Expand all parent directories
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
      setFocusedPath(normalizedTarget);
    },
    [
      currentPath,
      expandedPaths,
      refreshTree,
      setExpandedPaths,
      setFocusedPath,
      isAutoReveal,
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
        // Find insert index: after the directory and its children
        const index = entries.findIndex((e) => e.path === targetEntry.path);
        insertIndex = index + 1;
        // If it's expanded, we should ideally insert after all visible children,
        // but for simplicity we'll just refresh after creation.
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
    if (!deleteConfirmItem) return;
    try {
      await invoke("remove_to_trash", { path: deleteConfirmItem.path });
      if (!deleteConfirmItem.is_dir) {
        onFileDeleted?.(deleteConfirmItem.path);
      }
      setDeleteConfirmItem(null);
      await refreshTree(expandedPaths);
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handlePaste = async (targetDir: string) => {
    if (cutPath) {
      const normalizedCutPath = normalizePath(cutPath);
      const normalizedTargetDir = normalizePath(targetDir);
      const lastSlash = normalizedCutPath.lastIndexOf("/");
      const cutPathDir =
        lastSlash !== -1 ? normalizedCutPath.substring(0, lastSlash) : "";

      // If same directory or same item, do nothing
      if (
        normalizedCutPath === normalizedTargetDir ||
        cutPathDir === normalizedTargetDir
      ) {
        setCutPath(null);
        return;
      }

      try {
        const resultPath = await invoke<string>("move_item", {
          at: cutPath,
          toDir: targetDir,
        });
        onFileMoved?.(cutPath, resultPath);
        setCutPath(null);
        await refreshTree(expandedPaths);
        setFocusedPath(resultPath);
      } catch (e) {
        console.error("Failed to paste", e);
      }
    } else if (copyPath) {
      try {
        const resultPath = await invoke<string>("copy_item", {
          at: copyPath,
          toDir: targetDir,
        });
        await refreshTree(expandedPaths);
        setFocusedPath(resultPath);
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

    // Convert to platform specific path
    const isWindows = navigator.userAgent.includes("Windows");
    if (isWindows) {
      textToCopy = textToCopy.replace(/\//g, "\\");
    }

    await writeText(textToCopy);
  };

  const toggleExpandAll = async () => {
    if (!currentPath) return;
    if (expandedPaths.size > 0) {
      setExpandedPaths(new Set());
      await refreshTree(new Set());
    } else {
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
    }
  };

  const handleEmptyAreaClick = () => {
    setFocusedIndex(-1);
    setFocusedPath(null);
  };

  const handleEmptyAreaContextMenu = () => {
    setFocusedIndex(-1);
    setFocusedPath(null);
  };

  useFileExplorerCommands({
    isActive,
    setIsActive,
    entries,
    focusedIndex,
    setFocusedIndex,
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
      if (focusedIndex !== -1) {
        setDeleteConfirmItem(entries[focusedIndex]);
      }
    },
    onCut: () => {
      if (focusedIndex !== -1) {
        setCutPath(entries[focusedIndex].path);
      }
    },
    onCopy: () => {
      if (focusedIndex !== -1) {
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

  // Scroll focused item into view
  React.useEffect(() => {
    if (
      focusedIndex !== -1 &&
      virtuosoRef.current &&
      focusedIndex !== prevFocusedIndex
    ) {
      // @ts-expect-error virtuoso type issues
      virtuosoRef.current.scrollIntoView({
        index: focusedIndex,
        behavior: "auto",
        done: () => {
          setPrevFocusedIndex(focusedIndex);
        },
      });
    }
  }, [focusedIndex, entries.length, prevFocusedIndex]);

  const renderContextMenuContent = (entry?: FileExplorerEntry) => {
    const isFolder = entry && entry.is_dir;
    const isEmpty = !entry;
    const hasPaste = !!((cutPath || copyPath) && (isFolder || isEmpty));

    // Groups are rendered only if they have content.
    // Separators are rendered only if there's content before them.
    const items: React.ReactNode[] = [];

    // Group 1: New File/Folder
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

    // Group 2: Rename/Duplicate
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

    // Group 3: Paths/FileManager
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

    // Group 4: Cut/Copy/Paste
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

    // Group 5: Delete
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

    // Group 6: Close Folder
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
                  className="text-muted-foreground hover:bg-accent rounded p-1 transition-colors"
                  title="New File"
                >
                  <FilePlus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startCreate("folder");
                  }}
                  className="text-muted-foreground hover:bg-accent rounded p-1 transition-colors"
                  title="New Folder"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAutoReveal(!isAutoReveal);
                  }}
                  className={cn(
                    "hover:bg-accent rounded p-1 transition-colors",
                    isAutoReveal
                      ? "bg-accent/50 text-primary"
                      : "text-muted-foreground"
                  )}
                  title="Auto Reveal File"
                >
                  <ListTree className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpandAll();
                  }}
                  className="text-muted-foreground hover:bg-accent rounded p-1 transition-colors"
                  title={expandedPaths.size > 0 ? "Collapse All" : "Expand All"}
                >
                  {expandedPaths.size > 0 ? (
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                  )}
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
                className="flex-1 overflow-hidden px-1 outline-none"
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
                      data={entries}
                      className="scrollbar-hide virtuoso-scroller h-full"
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
                                setFocusedIndex(index);
                                setFocusedPath(entry.path);
                                setIsActive(true);
                              }
                            }}
                          >
                            <ContextMenuTrigger asChild>
                              <div
                                onContextMenu={(e) => {
                                  e.stopPropagation();
                                  setFocusedIndex(index);
                                  setFocusedPath(entry.path);
                                  setIsActive(true);
                                }}
                              >
                                <FileExplorerItem
                                  entry={entry}
                                  isFocused={index === focusedIndex}
                                  isExpanded={expandedPaths.has(entry.path)}
                                  isCut={cutPath === entry.path}
                                  isEditing={editingItem?.path === entry.path}
                                  editName={editName}
                                  onEditChange={setEditName}
                                  onEditSubmit={handleRename}
                                  onEditCancel={() => setEditingItem(null)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFocusedIndex(index);
                                    setFocusedPath(entry.path);
                                    setIsActive(true);
                                    if (entry.is_dir) {
                                      toggleFolder(index);
                                    } else {
                                      onOpenFile(entry.path, entry.name);
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
                  </>
                )}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        {renderContextMenuContent()}
      </ContextMenu>

      <Dialog
        open={!!deleteConfirmItem}
        onOpenChange={(open) => !open && setDeleteConfirmItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This will move{" "}
              <span className="text-foreground font-semibold">
                {deleteConfirmItem?.name}
              </span>{" "}
              to the trash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmItem(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
