import * as React from "react";
import { cn } from "@/lib/utils";
import { FileEntry as RawFileEntry } from "../types";
import { useFileExplorer } from "../hooks/useFileExplorer";
import { useFileExplorerCommands } from "../hooks/useFileExplorerCommands";
import { FileExplorerHeader } from "./FileExplorer/FileExplorerHeader";
import { FileExplorerItem } from "./FileExplorer/FileExplorerItem";
import {
  FilePlus,
  FolderPlus,
  ChevronsDownUp,
  ChevronsUpDown,
  ListTree,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { commandManager } from "../systems/commandManager";

interface FileExplorerProps {
  currentPath: string | null;
  entries: RawFileEntry[];
  isVisible: boolean;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onOpenFile: (path: string, name: string) => void;
  activeFilePath?: string | null;
}

export function FileExplorer({
  currentPath,
  entries: rootEntries,
  isVisible,
  width,
  onResizeStart,
  onOpenFile,
  activeFilePath,
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

  const [isExpanded, setIsExpanded] = React.useState(true);
  const [prevFocusedIndex, setPrevFocusedIndex] = React.useState<number>(-1);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

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

  const handleCreateNew = async () => {
    if (!newItem || !newName.trim()) {
      setNewItem(null);
      setNewName("");
      return;
    }

    const name = newName.trim();
    const isFile = newItem.type === "file";
    const fullName = isFile && !name.endsWith(".md") ? `${name}.md` : name;
    const parentPath = normalizePath(newItem.parentPath);
    const path = parentPath.endsWith("/")
      ? `${parentPath}${fullName}`
      : `${parentPath}/${fullName}`;

    setNewItem(null); // Close input early to avoid double submission
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
        // Open the file. useTabs will handle deduplication if path is same.
        onOpenFile(path, fullName);
        setFocusedPath(path);
      } else {
        setFocusedPath(path);
      }
    } catch (e) {
      console.error("Failed to create", e);
    }
  };

  const startCreate = (type: "file" | "folder") => {
    if (!currentPath) return;

    let parentPath = normalizePath(currentPath);
    let depth = 0;
    let insertIndex = 0;

    const focusedEntry =
      focusedIndex !== -1 ? entries[focusedIndex] : undefined;

    if (focusedEntry) {
      if (focusedEntry.is_dir) {
        parentPath = normalizePath(focusedEntry.path);
        depth = focusedEntry.depth + 1;
        insertIndex = focusedIndex + 1;
      } else {
        const path = normalizePath(focusedEntry.path);
        const lastSlash = path.lastIndexOf("/");
        if (lastSlash !== -1) {
          parentPath = path.substring(0, lastSlash);
        }
        depth = focusedEntry.depth;
        insertIndex = focusedIndex + 1;
      }
    }

    setNewItem({ type, parentPath, depth, insertIndex });
    setNewName("");
    setIsExpanded(true);
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
        await refreshTree(newExpanded);
      } catch (e) {
        console.error("Failed to expand all", e);
      }
    }
  };

  const handleEmptyAreaClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setFocusedIndex(-1);
      setFocusedPath(null);
    }
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
      scrollContainerRef.current &&
      focusedIndex !== prevFocusedIndex
    ) {
      const index = focusedIndex;
      const container = scrollContainerRef.current;

      requestAnimationFrame(() => {
        const list = container.children[0];
        if (!list || !list.children[index]) return;

        const isMovingDown =
          prevFocusedIndex === -1 || index > prevFocusedIndex;
        const targetIndex = isMovingDown
          ? Math.min(index + 2, entries.length - 1)
          : Math.max(index - 2, 0);

        const targetElement = list.children[targetIndex] as HTMLElement;
        if (targetElement) {
          targetElement.scrollIntoView({ block: "nearest", behavior: "auto" });
        }
      });
      setPrevFocusedIndex(focusedIndex);
    }
  }, [focusedIndex, entries.length, prevFocusedIndex]);

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
      <FileExplorerHeader
        currentPath={currentPath}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
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
          className="flex-1 overflow-y-auto px-1 outline-none"
          tabIndex={0}
          onFocus={() => setIsActive(true)}
          onBlur={() => setIsActive(false)}
          onClick={handleEmptyAreaClick}
        >
          {!currentPath ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <p className="text-muted-foreground text-xs tracking-tight italic">
                Open a folder to start
              </p>
            </div>
          ) : entries.length === 0 && !newItem ? (
            <p className="text-muted-foreground p-2 text-xs italic">Empty</p>
          ) : (
            <div className="space-y-px">
              {entries.map((entry, index) => (
                <React.Fragment key={entry.path}>
                  {newItem && newItem.insertIndex === index && (
                    <div
                      className="flex items-center gap-1 py-0.5"
                      style={{ paddingLeft: `${newItem.depth * 12 + 6}px` }}
                    >
                      <input
                        autoFocus
                        className="bg-background border-primary w-full border px-1 text-sm outline-none"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={handleCreateNew}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateNew();
                          if (e.key === "Escape") setNewItem(null);
                        }}
                      />
                    </div>
                  )}
                  <FileExplorerItem
                    entry={entry}
                    isFocused={index === focusedIndex}
                    isExpanded={expandedPaths.has(entry.path)}
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
                </React.Fragment>
              ))}
              {newItem && newItem.insertIndex >= entries.length && (
                <div
                  className="flex items-center gap-1 py-0.5"
                  style={{ paddingLeft: `${newItem.depth * 12 + 6}px` }}
                >
                  <input
                    autoFocus
                    className="bg-background border-primary w-full border px-1 text-sm outline-none"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={handleCreateNew}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateNew();
                      if (e.key === "Escape") setNewItem(null);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
