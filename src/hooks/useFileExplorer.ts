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
  const [focusedPath, setFocusedPath] = React.useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = React.useState<Set<string>>(
    new Set()
  );
  const [isActive, setIsActive] = React.useState(false);
  const lastRootPath = React.useRef<string | null>(null);
  const hasRestored = React.useRef(false);
  const expandedPathsRef = React.useRef(expandedPaths);
  const watcherDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Derive focusedIndex from focusedPath (single source of truth)
  const focusedIndex = React.useMemo(() => {
    if (!focusedPath || entries.length === 0) return -1;
    const normalized = focusedPath.replace(/\\/g, "/");
    return entries.findIndex((e) => e.path.replace(/\\/g, "/") === normalized);
  }, [entries, focusedPath]);

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
        hasRestored.current = true;
      }
    } else if (rootEntries.length > 0) {
      refreshTree(expandedPathsRef.current);
    }
  }, [rootEntries, currentPath, refreshTree]);

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

  // Listen for refresh events (debounced, no suppress)
  React.useEffect(() => {
    const debouncedRefresh = () => {
      if (watcherDebounceRef.current) {
        clearTimeout(watcherDebounceRef.current);
      }
      watcherDebounceRef.current = setTimeout(() => {
        if (currentPath) {
          refreshTree(expandedPathsRef.current);
        }
      }, 300);
    };

    const unlistenRefresh = listen<string>("explorer-refresh", () => {
      debouncedRefresh();
    });

    const unlistenIndex = listen("index-updated", () => {
      debouncedRefresh();
    });

    return () => {
      if (watcherDebounceRef.current) {
        clearTimeout(watcherDebounceRef.current);
      }
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
    focusedPath,
    setFocusedPath,
    selectedPaths,
    setSelectedPaths,
    isActive,
    setIsActive,
    toggleFolder,
    refreshTree,
    setExpandedPaths,
    setEntries,
  };
}
