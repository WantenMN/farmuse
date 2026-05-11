import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FileEntry as RawFileEntry } from "../types";

export interface FileExplorerEntry extends RawFileEntry {
  depth: number;
}

export function useFileExplorer(
  currentPath: string | null,
  rootEntries: RawFileEntry[]
) {
  const [entries, setEntries] = React.useState<FileExplorerEntry[]>([]);
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(
    new Set()
  );
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
  const [focusedPath, setFocusedPath] = React.useState<string | null>(null);
  const [isActive, setIsActive] = React.useState(false);
  const lastRootPath = React.useRef<string | null>(null);
  const hasRestored = React.useRef(false);
  const expandedPathsRef = React.useRef(expandedPaths);

  // Keep ref in sync
  React.useEffect(() => {
    expandedPathsRef.current = expandedPaths;
  }, [expandedPaths]);

  const refreshTree = React.useCallback(
    async (currentExpanded: Set<string>, expandAll: boolean = false) => {
      if (!currentPath) return;

      try {
        const result = await invoke<FileExplorerEntry[]>(
          "get_explorer_entries",
          {
            rootPath: currentPath,
            expandedPaths: expandAll ? null : Array.from(currentExpanded),
            expandAll: expandAll,
          }
        );
        const normalized = result.map((entry) => ({
          ...entry,
          path: entry.path.replace(/\\/g, "/"),
        }));
        setEntries(normalized);
      } catch (e) {
        console.error("Failed to refresh tree", e);
      }
    },
    [currentPath]
  );

  // Initialize and restore state
  React.useEffect(() => {
    if (!currentPath) {
      setEntries([]);
      setExpandedPaths(new Set());
      setFocusedIndex(-1);
      setFocusedPath(null);
      hasRestored.current = false;
      lastRootPath.current = null;
      return;
    }

    if (currentPath !== lastRootPath.current) {
      hasRestored.current = false;
      lastRootPath.current = currentPath;
    }

    if (!hasRestored.current) {
      const saved = localStorage.getItem(`explorer_state_${currentPath}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const savedExpanded = new Set<string>(
            (parsed.expandedPaths || []).map((p: string) =>
              p.replace(/\\/g, "/")
            )
          );
          setExpandedPaths(savedExpanded);
          setEntries(
            (parsed.entries || []).map((e: FileExplorerEntry) => ({
              ...e,
              path: e.path.replace(/\\/g, "/"),
            }))
          );
          setFocusedPath(parsed.focusedPath?.replace(/\\/g, "/") || null);
          hasRestored.current = true;
          refreshTree(savedExpanded);
        } catch (e) {
          console.error("Failed to restore explorer state", e);
        }
      }

      if (!hasRestored.current) {
        setEntries(rootEntries.map((e) => ({ ...e, depth: 0 })));
        setExpandedPaths(new Set());
        setFocusedIndex(rootEntries.length > 0 ? 0 : -1);
        hasRestored.current = true;
      }
    } else if (rootEntries.length > 0) {
      refreshTree(expandedPathsRef.current);
    }
  }, [rootEntries, currentPath, refreshTree]);

  // Sync focusedIndex and focusedPath
  React.useEffect(() => {
    if (focusedPath) {
      const normalizedFocused = focusedPath.replace(/\\/g, "/");
      const index = entries.findIndex(
        (e) => e.path.replace(/\\/g, "/") === normalizedFocused
      );
      if (index !== -1) {
        if (index !== focusedIndex) {
          setFocusedIndex(index);
        }
      } else if (focusedIndex >= entries.length) {
        setFocusedIndex(entries.length > 0 ? 0 : -1);
      }
    } else if (focusedIndex !== -1 && entries[focusedIndex]) {
      setFocusedPath(entries[focusedIndex].path.replace(/\\/g, "/"));
    }
  }, [entries, focusedPath, focusedIndex]);

  // Persist state
  React.useEffect(() => {
    if (!currentPath || !hasRestored.current) return;

    const visibleExpanded = new Set<string>();
    for (const entry of entries) {
      if (entry.is_dir && expandedPaths.has(entry.path)) {
        visibleExpanded.add(entry.path);
      }
    }

    const state = {
      expandedPaths: Array.from(visibleExpanded),
      focusedPath: focusedIndex !== -1 ? entries[focusedIndex]?.path : null,
      entries: entries,
      currentPath: currentPath,
    };
    localStorage.setItem(
      `explorer_state_${currentPath}`,
      JSON.stringify(state)
    );
  }, [expandedPaths, focusedIndex, entries, currentPath]);

  // Watch expanded directories
  React.useEffect(() => {
    if (!currentPath) return;

    const pathsToWatch = [currentPath, ...Array.from(expandedPaths)];
    invoke("watch_explorer_directories", { paths: pathsToWatch }).catch(
      (err) => {
        console.error("Failed to watch explorer directories:", err);
      }
    );
  }, [expandedPaths, currentPath]);

  // Listen for refresh events
  React.useEffect(() => {
    const unlistenRefresh = listen<string>("explorer-refresh", (_event) => {
      if (currentPath) {
        refreshTree(expandedPathsRef.current);
      }
    });

    const unlistenIndex = listen("index-updated", () => {
      if (currentPath) {
        refreshTree(expandedPathsRef.current);
      }
    });

    return () => {
      unlistenRefresh.then((unlisten) => unlisten());
      unlistenIndex.then((unlisten) => unlisten());
    };
  }, [currentPath, refreshTree]);

  const toggleFolder = React.useCallback(
    async (index: number) => {
      const entry = entries[index];
      if (!entry || !entry.is_dir) return;

      const normalizedPath = entry.path.replace(/\\/g, "/");
      const isExpanded = expandedPaths.has(normalizedPath);
      const newExpandedPaths = new Set(expandedPaths);

      if (isExpanded) {
        newExpandedPaths.delete(normalizedPath);
      } else {
        newExpandedPaths.add(normalizedPath);
      }

      setExpandedPaths(newExpandedPaths);
      await refreshTree(newExpandedPaths);
    },
    [entries, expandedPaths, refreshTree]
  );

  return {
    entries,
    expandedPaths,
    focusedIndex,
    setFocusedIndex,
    focusedPath,
    setFocusedPath,
    isActive,
    setIsActive,
    toggleFolder,
    refreshTree,
    setExpandedPaths,
    setEntries,
  };
}
