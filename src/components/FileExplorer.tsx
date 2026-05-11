import * as React from "react";
import { cn } from "@/lib/utils";
import { FileEntry as RawFileEntry } from "../types";
import { useFileExplorer } from "../hooks/useFileExplorer";
import { useFileExplorerCommands } from "../hooks/useFileExplorerCommands";
import { FileExplorerHeader } from "./FileExplorer/FileExplorerHeader";
import { FileExplorerItem } from "./FileExplorer/FileExplorerItem";

interface FileExplorerProps {
  currentPath: string | null;
  entries: RawFileEntry[];
  isVisible: boolean;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onOpenFile: (path: string, name: string) => void;
}

export function FileExplorer({
  currentPath,
  entries: rootEntries,
  isVisible,
  width,
  onResizeStart,
  onOpenFile,
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
  } = useFileExplorer(currentPath, rootEntries);

  const [prevFocusedIndex, setPrevFocusedIndex] = React.useState<number>(-1);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

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

  return (
    <aside
      className={cn(
        "bg-muted/30 focus-within:ring-primary/20 focus-within:bg-muted/50 group relative flex h-full shrink-0 flex-col overflow-hidden border-r focus-within:ring-1 focus-within:ring-inset",
        isActive && "bg-muted/50",
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
      <FileExplorerHeader currentPath={currentPath} />
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
              {entries.map((entry, index) => (
                <FileExplorerItem
                  key={entry.path}
                  entry={entry}
                  isFocused={index === focusedIndex}
                  isActive={isActive}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
