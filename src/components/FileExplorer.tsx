import * as React from "react";
import { cn } from "@/lib/utils";
import { Folder, ChevronRight, ChevronDown } from "lucide-react";
import { commandManager } from "../systems/commandManager";
import { invoke } from "@tauri-apps/api/core";
import { FileEntry as RawFileEntry } from "../types";

interface FileEntry extends RawFileEntry {
  depth: number;
}

interface FileExplorerProps {
  currentPath: string | null;
  entries: RawFileEntry[];
  isVisible: boolean;
}

export function FileExplorer({
  currentPath,
  entries: rootEntries,
  isVisible,
}: FileExplorerProps) {
  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(
    new Set()
  );
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
  const [prevFocusedIndex, setPrevFocusedIndex] = React.useState<number>(-1);
  const [isActive, setIsActive] = React.useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Initialize entries from rootEntries
  React.useEffect(() => {
    setEntries(rootEntries.map((e) => ({ ...e, depth: 0 })));
    setExpandedPaths(new Set());
    setFocusedIndex(rootEntries.length > 0 ? 0 : -1);
  }, [rootEntries]);

  const toggleFolder = React.useCallback(
    async (index: number) => {
      const entry = entries[index];
      if (!entry || !entry.is_dir) return;

      const isExpanded = expandedPaths.has(entry.path);
      const newExpandedPaths = new Set(expandedPaths);

      if (isExpanded) {
        newExpandedPaths.delete(entry.path);
        // Remove all descendants
        const newEntries = [...entries];
        let removeCount = 0;
        for (let i = index + 1; i < newEntries.length; i++) {
          if (newEntries[i].depth > entry.depth) {
            removeCount++;
          } else {
            break;
          }
        }
        newEntries.splice(index + 1, removeCount);
        setEntries(newEntries);
        setExpandedPaths(newExpandedPaths);
      } else {
        newExpandedPaths.add(entry.path);
        try {
          const children = await invoke<RawFileEntry[]>(
            "list_directory_contents",
            { path: entry.path }
          );
          const newEntries = [...entries];
          const childrenWithDepth = children.map((c) => ({
            ...c,
            depth: entry.depth + 1,
          }));
          newEntries.splice(index + 1, 0, ...childrenWithDepth);
          setEntries(newEntries);
          setExpandedPaths(newExpandedPaths);
        } catch (e) {
          console.error("Failed to expand folder", e);
        }
      }
    },
    [entries, expandedPaths]
  );

  // Scroll focused item into view
  React.useEffect(() => {
    if (focusedIndex !== -1 && scrollContainerRef.current) {
      const list = scrollContainerRef.current.children[0];
      if (!list || !list.children[focusedIndex]) return;

      const isMovingDown =
        prevFocusedIndex === -1 || focusedIndex > prevFocusedIndex;
      const targetIndex = isMovingDown
        ? Math.min(focusedIndex + 2, entries.length - 1)
        : Math.max(focusedIndex - 2, 0);

      const targetElement = list.children[targetIndex] as HTMLElement;
      if (targetElement) {
        targetElement.scrollIntoView({ block: "nearest" });
      }
      setPrevFocusedIndex(focusedIndex);
    }
  }, [focusedIndex, entries.length, prevFocusedIndex]);

  React.useEffect(() => {
    commandManager.register({
      id: "explorer.focus",
      name: "Explorer: Focus",
      description: "Set keyboard focus to the file explorer",
      handler: () => {
        setIsActive(true);
        scrollContainerRef.current?.focus();
        if (focusedIndex === -1 && entries.length > 0) {
          setFocusedIndex(0);
        }
      },
    });

    commandManager.register({
      id: "explorer.moveDown",
      name: "Explorer: Move Selection Down",
      description: "Focus the next item in the explorer",
      handler: () => {
        if (!isActive || entries.length === 0) return;
        setFocusedIndex((prev) => (prev < entries.length - 1 ? prev + 1 : 0));
      },
      visible: true,
    });

    commandManager.register({
      id: "explorer.moveUp",
      name: "Explorer: Move Selection Up",
      description: "Focus the previous item in the explorer",
      handler: () => {
        if (!isActive || entries.length === 0) return;
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : entries.length - 1));
      },
      visible: true,
    });

    commandManager.register({
      id: "explorer.expand",
      name: "Explorer: Expand or Open",
      description: "Expand the folder or open the file",
      handler: () => {
        if (!isActive || focusedIndex === -1) return;
        const entry = entries[focusedIndex];
        if (entry.is_dir) {
          if (!expandedPaths.has(entry.path)) {
            toggleFolder(focusedIndex);
          }
        } else {
          commandManager.execute("open-file", {
            path: entry.path,
            name: entry.name,
          });
        }
      },
      visible: true,
    });

    commandManager.register({
      id: "explorer.focusParent",
      name: "Explorer: Focus Parent Folder",
      description: "Focus the parent folder of the currently selected item",
      handler: () => {
        if (!isActive || focusedIndex === -1) return;
        const currentEntry = entries[focusedIndex];
        if (currentEntry.depth === 0) return;

        // Find the first item above with a smaller depth
        for (let i = focusedIndex - 1; i >= 0; i--) {
          if (entries[i].depth < currentEntry.depth) {
            setFocusedIndex(i);
            break;
          }
        }
      },
      visible: true,
    });

    commandManager.register({
      id: "explorer.collapse",
      name: "Explorer: Collapse or Focus Parent",
      description: "Collapse the folder or focus its parent",
      handler: () => {
        if (!isActive || focusedIndex === -1) return;
        const entry = entries[focusedIndex];

        if (entry.is_dir && expandedPaths.has(entry.path)) {
          // If it's an expanded folder, collapse it
          toggleFolder(focusedIndex);
        } else {
          // Otherwise, focus the parent
          commandManager.execute("explorer.focusParent");
        }
      },
      visible: true,
    });

    commandManager.register({
      id: "explorer.open",
      name: "Explorer: Open Item",
      description: "Open the focused file or toggle the focused folder",
      handler: () => {
        if (!isActive || focusedIndex === -1) return;
        const entry = entries[focusedIndex];
        if (entry.is_dir) {
          toggleFolder(focusedIndex);
        } else {
          commandManager.execute("open-file", {
            path: entry.path,
            name: entry.name,
          });
        }
      },
      visible: true,
    });

    return () => {
      commandManager.unregister("explorer.focus");
      commandManager.unregister("explorer.moveDown");
      commandManager.unregister("explorer.moveUp");
      commandManager.unregister("explorer.expand");
      commandManager.unregister("explorer.collapse");
      commandManager.unregister("explorer.open");
    };
  }, [entries, focusedIndex, isActive, expandedPaths, toggleFolder]);

  if (!isVisible) return null;

  return (
    <aside
      className={cn(
        "bg-muted/30 focus-within:ring-primary/20 focus-within:bg-muted/50 flex h-full w-64 shrink-0 flex-col overflow-hidden border-r focus-within:ring-1 focus-within:ring-inset",
        isActive && "bg-muted/50"
      )}
    >
      <div className="bg-background/50 flex min-h-[48px] items-center gap-2 overflow-hidden border-b p-3">
        <Folder className="text-primary/70 h-4 w-4 shrink-0" />
        <h2
          className="text-muted-foreground truncate text-xs font-bold tracking-wider uppercase"
          title={currentPath || "No Folder"}
        >
          {currentPath
            ? currentPath.split("/").filter(Boolean).pop() || "Root"
            : "No folder"}
        </h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col py-1">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-1 outline-none"
          tabIndex={0}
          onFocus={() => setIsActive(true)}
          onBlur={() => setIsActive(false)}
        >
          {!currentPath ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <p className="text-muted-foreground text-xs tracking-tight italic">
                Open a folder to start
              </p>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground p-2 text-xs italic">Empty</p>
          ) : (
            <div className="space-y-px">
              {entries.map((entry, index) => {
                const isFocused = index === focusedIndex;
                const isExpanded = expandedPaths.has(entry.path);

                return (
                  <div
                    key={entry.path}
                    className={cn(
                      "group relative flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm transition-none",
                      isFocused &&
                        isActive &&
                        "bg-accent text-accent-foreground ring-primary/30 z-10 ring-1",
                      isFocused &&
                        !isActive &&
                        "bg-accent/50 text-accent-foreground/80 ring-muted-foreground/20 z-10 ring-1",
                      !isFocused && "hover:bg-accent/30"
                    )}
                    style={{ paddingLeft: `${entry.depth * 12 + 6}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFocusedIndex(index);
                      setIsActive(true);
                      if (entry.is_dir) {
                        toggleFolder(index);
                      } else {
                        commandManager.execute("open-file", {
                          path: entry.path,
                          name: entry.name,
                        });
                      }
                    }}
                  >
                    {/* Vertical line for expanded scope */}
                    {entry.depth > 0 &&
                      Array.from({ length: entry.depth }).map((_, i) => (
                        <div
                          key={i}
                          className="border-muted-foreground/20 absolute h-full border-l"
                          style={{ left: `${i * 12 + 12}px` }}
                        />
                      ))}

                    <div className="z-10 flex w-4 shrink-0 items-center justify-center">
                      {entry.is_dir ? (
                        isExpanded ? (
                          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                        )
                      ) : null}
                    </div>
                    <span
                      className="z-10 truncate tracking-tight"
                      title={entry.name}
                    >
                      {entry.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
