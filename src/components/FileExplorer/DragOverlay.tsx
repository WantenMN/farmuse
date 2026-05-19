import * as React from "react";
import { DropTarget } from "../../hooks/useDragDrop";
import { FileExplorerEntry } from "../../hooks/useFileExplorer";

interface DragOverlayProps {
  dragState: {
    isDragging: boolean;
    sourceEntries: FileExplorerEntry[];
    dropTarget: DropTarget | null;
    currentX: number;
    currentY: number;
  };
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  entries: FileExplorerEntry[];
}

export function DragOverlay({
  dragState,
  scrollContainerRef,
  entries,
}: DragOverlayProps) {
  if (!dragState.isDragging) return null;

  const { sourceEntries, dropTarget, currentX, currentY } = dragState;
  const count = sourceEntries.length;
  const label =
    count === 1 ? sourceEntries[0].name.replace(/\.md$/, "") : `${count} items`;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <div
        className="bg-background/90 border-primary/50 absolute flex items-center gap-1.5 rounded border px-2 py-0.5 text-sm shadow-lg"
        style={{
          left: currentX + 12,
          top: currentY - 12,
        }}
      >
        <span className="truncate">{label}</span>
      </div>

      {dropTarget && (
        <DropIndicator
          dropTarget={dropTarget}
          scrollContainerRef={scrollContainerRef}
          entries={entries}
        />
      )}
    </div>
  );
}

function getFolderRangePaths(
  folderPath: string,
  entries: FileExplorerEntry[]
): string[] {
  const paths: string[] = [folderPath];
  const folderEntry = entries.find((e) => e.path === folderPath);
  if (!folderEntry) return paths;

  const folderDepth = folderEntry.depth;
  const folderIndex = entries.indexOf(folderEntry);

  for (let i = folderIndex + 1; i < entries.length; i++) {
    if (entries[i].depth > folderDepth) {
      paths.push(entries[i].path);
    } else {
      break;
    }
  }

  return paths;
}

function DropIndicator({
  dropTarget,
  scrollContainerRef,
  entries,
}: {
  dropTarget: DropTarget;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  entries: FileExplorerEntry[];
}) {
  const container = scrollContainerRef.current;

  const rangePaths = React.useMemo(
    () =>
      dropTarget?.entry
        ? getFolderRangePaths(dropTarget.entry.path, entries)
        : [],
    [dropTarget?.entry?.path, entries]
  );

  const containerRect = React.useMemo(() => {
    if (!container) return null;
    return container.getBoundingClientRect();
  }, [container]);

  const [rect, setRect] = React.useState<{
    top: number;
    bottom: number;
  } | null>(null);

  React.useEffect(() => {
    if (!container || !dropTarget?.entry || dropTarget.position === "root") {
      setRect(null);
      return;
    }

    const rafId = requestAnimationFrame(() => {
      const allItems = Array.from(
        container.querySelectorAll("[data-entry-path]")
      );
      let firstElement: Element | null = null;
      let lastElement: Element | null = null;

      for (const item of allItems) {
        const itemPath = item.getAttribute("data-entry-path");
        if (itemPath && rangePaths.includes(itemPath)) {
          if (!firstElement) firstElement = item;
          lastElement = item;
        }
      }

      if (!firstElement || !lastElement) {
        setRect(null);
        return;
      }

      const firstRect = firstElement.getBoundingClientRect();
      const lastRect = lastElement.getBoundingClientRect();
      setRect({ top: firstRect.top, bottom: lastRect.bottom });
    });

    return () => cancelAnimationFrame(rafId);
  }, [rangePaths, container, dropTarget?.entry, dropTarget?.position]);

  if (!dropTarget || !container || !containerRect) return null;

  if (dropTarget.position === "root") {
    return (
      <div
        className="border-primary/50 pointer-events-none absolute rounded border-2"
        style={{
          left: containerRect.left + 2,
          top: containerRect.top,
          width: containerRect.width - 4,
          height: containerRect.height,
        }}
      />
    );
  }

  if (!rect) return null;

  return (
    <div
      className="border-primary/50 pointer-events-none absolute rounded border-2"
      style={{
        left: containerRect.left + 2,
        top: rect.top - 1,
        width: containerRect.width - 4,
        height: rect.bottom - rect.top + 2,
      }}
    />
  );
}
