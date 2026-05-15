import * as React from "react";
import { FileExplorerEntry } from "./useFileExplorer";

export interface DropTarget {
  entry: FileExplorerEntry | null;
  position: "inside" | "root";
  isExpanded?: boolean;
}

export interface DragState {
  sourceEntry: FileExplorerEntry;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  dropTarget: DropTarget | null;
}

interface UseDragDropProps {
  entries: FileExplorerEntry[];
  expandedPaths: Set<string>;
  onMove: (sourcePath: string, targetDir: string) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const DRAG_THRESHOLD = 5;
const FOLDER_EXPAND_DELAY = 800;
const SCROLL_ZONE = 40;
const SCROLL_SPEED = 8;

export function useDragDrop({
  entries,
  expandedPaths,
  onMove,
  scrollContainerRef,
}: UseDragDropProps) {
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  const expandTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const expandTargetRef = React.useRef<string | null>(null);
  const animFrameRef = React.useRef<number | null>(null);
  const lastMouseYRef = React.useRef<number>(0);
  const pendingMouseRef = React.useRef<{ x: number; y: number } | null>(null);
  const dragStateRef = React.useRef<DragState | null>(null);
  const onMoveRef = React.useRef(onMove);

  // Keep refs in sync
  dragStateRef.current = dragState;
  onMoveRef.current = onMove;

  const clearExpandTimer = React.useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    expandTargetRef.current = null;
  }, []);

  const clearAutoScroll = React.useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const calculateDropTarget = React.useCallback(
    (clientY: number): DropTarget | null => {
      const container = scrollContainerRef.current;
      if (!container) return null;

      const allItems = container.querySelectorAll("[data-entry-path]");

      for (const item of allItems) {
        const rect = item.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          const path = item.getAttribute("data-entry-path");
          const entry = entries.find((e) => e.path === path);
          if (!entry) continue;

          if (entry.is_dir) {
            const isExpanded = expandedPaths.has(entry.path);
            return { entry, position: "inside", isExpanded };
          } else {
            const lastSlash = entry.path.lastIndexOf("/");
            const parentPath =
              lastSlash !== -1 ? entry.path.substring(0, lastSlash) : null;
            if (parentPath) {
              const parentEntry = entries.find((e) => e.path === parentPath);
              if (parentEntry) {
                const isExpanded = expandedPaths.has(parentEntry.path);
                return {
                  entry: parentEntry,
                  position: "inside",
                  isExpanded,
                };
              }
              const ancestorEntry = entries.find(
                (e) =>
                  e.is_dir &&
                  parentPath.startsWith(e.path + "/") &&
                  expandedPaths.has(e.path)
              );
              if (ancestorEntry) {
                return {
                  entry: ancestorEntry,
                  position: "inside",
                  isExpanded: true,
                };
              }
            }
            return { entry: null, position: "root" };
          }
        }
      }

      return { entry: null, position: "root" };
    },
    [entries, expandedPaths, scrollContainerRef]
  );

  const isValidMove = React.useCallback(
    (source: FileExplorerEntry, target: DropTarget): boolean => {
      const sourcePath = source.path;
      const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf("/"));

      if (target.position === "root") {
        if (!sourceParent || sourceParent === "") return false;
        return true;
      }

      const targetEntry = target.entry;
      if (!targetEntry) return true;

      if (sourcePath === targetEntry.path) return false;

      if (source.is_dir && targetEntry.path.startsWith(sourcePath + "/")) {
        return false;
      }

      if (sourceParent === targetEntry.path) return false;

      return true;
    },
    []
  );

  const getTargetDir = React.useCallback((target: DropTarget): string => {
    if (target.position === "root") {
      return "";
    }
    if (target.entry) {
      return target.entry.path;
    }
    return "";
  }, []);

  // Auto scroll logic
  const startAutoScroll = React.useCallback(
    (clientY: number) => {
      clearAutoScroll();

      const scroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const y = lastMouseYRef.current;

        if (y - rect.top < SCROLL_ZONE) {
          container.scrollTop -= SCROLL_SPEED;
        } else if (rect.bottom - y < SCROLL_ZONE) {
          container.scrollTop += SCROLL_SPEED;
        }

        animFrameRef.current = requestAnimationFrame(scroll);
      };

      lastMouseYRef.current = clientY;
      animFrameRef.current = requestAnimationFrame(scroll);
    },
    [scrollContainerRef, clearAutoScroll]
  );

  // Folder expand logic
  const handleFolderExpand = React.useCallback(
    (target: DropTarget | null) => {
      if (
        !target ||
        !target.entry ||
        !target.entry.is_dir ||
        target.position !== "inside"
      ) {
        clearExpandTimer();
        return;
      }

      const targetPath = target.entry.path;
      if (expandTargetRef.current === targetPath) return;

      clearExpandTimer();
      expandTargetRef.current = targetPath;

      expandTimerRef.current = setTimeout(() => {
        const event = new CustomEvent("drag-expand-folder", {
          detail: { path: targetPath },
        });
        window.dispatchEvent(event);
        expandTargetRef.current = null;
      }, FOLDER_EXPAND_DELAY);
    },
    [clearExpandTimer]
  );

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent, entry: FileExplorerEntry) => {
      if (e.button !== 0) return;

      const initial: DragState = {
        sourceEntry: entry,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: false,
        dropTarget: null,
      };
      setDragState(initial);
      pendingMouseRef.current = { x: e.clientX, y: e.clientY };
    },
    []
  );

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    // Only store the latest mouse position; RAF will process it
    pendingMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = React.useCallback(() => {
    const current = dragStateRef.current;
    if (current?.isDragging && current.dropTarget) {
      if (isValidMove(current.sourceEntry, current.dropTarget)) {
        const targetDir = getTargetDir(current.dropTarget);
        onMoveRef.current(current.sourceEntry.path, targetDir);
      }
    }

    setDragState(null);
    pendingMouseRef.current = null;
    clearAutoScroll();
    clearExpandTimer();
  }, [isValidMove, getTargetDir, clearAutoScroll, clearExpandTimer]);

  // RAF-based drag update loop
  React.useEffect(() => {
    if (!dragState) return;

    let rafId: number;

    const tick = () => {
      const pending = pendingMouseRef.current;
      if (!pending) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      setDragState((prev) => {
        if (!prev) return null;

        const dx = pending.x - prev.startX;
        const dy = pending.y - prev.startY;
        const isDragging =
          prev.isDragging || Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD;

        if (!isDragging) {
          return { ...prev, currentX: pending.x, currentY: pending.y };
        }

        const dropTarget = calculateDropTarget(pending.y);
        lastMouseYRef.current = pending.y;

        return {
          ...prev,
          currentX: pending.x,
          currentY: pending.y,
          isDragging,
          dropTarget,
        };
      });

      pendingMouseRef.current = null;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [dragState !== null, calculateDropTarget]);

  // Register global mouse events when dragging
  React.useEffect(() => {
    if (dragState) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      if (dragState.isDragging) {
        document.body.style.userSelect = "none";
        startAutoScroll(dragState.currentY);
      }

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp, startAutoScroll]);

  // Handle folder expand when dropTarget changes
  React.useEffect(() => {
    if (dragState?.isDragging) {
      handleFolderExpand(dragState.dropTarget);
    }
  }, [dragState?.isDragging, dragState?.dropTarget, handleFolderExpand]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      clearAutoScroll();
      clearExpandTimer();
    };
  }, [clearAutoScroll, clearExpandTimer]);

  return {
    dragState,
    handleMouseDown,
  };
}
