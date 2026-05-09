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
    async (currentExpanded: Set<string>) => {
      if (!currentPath) return;

      const fetchRecursive = async (
        path: string,
        depth: number
      ): Promise<FileExplorerEntry[]> => {
        try {
          const children = await invoke<RawFileEntry[]>(
            "list_directory_contents",
            { path }
          );
          const result: FileExplorerEntry[] = [];
          for (const child of children) {
            const childEntry = { ...child, depth };
            result.push(childEntry);
            if (child.is_dir && currentExpanded.has(child.path)) {
              const descendants = await fetchRecursive(child.path, depth + 1);
              result.push(...descendants);
            }
          }
          return result;
        } catch (e) {
          console.error("Failed to refresh folder", path, e);
          return [];
        }
      };

      try {
        const rootEntriesFetched = await invoke<RawFileEntry[]>(
          "list_directory_contents",
          { path: currentPath }
        );
        const newEntries: FileExplorerEntry[] = [];
        for (const rootEntry of rootEntriesFetched) {
          newEntries.push({ ...rootEntry, depth: 0 });
          if (rootEntry.is_dir && currentExpanded.has(rootEntry.path)) {
            const descendants = await fetchRecursive(rootEntry.path, 1);
            newEntries.push(...descendants);
          }
        }
        setEntries(newEntries);
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
          const savedExpanded = new Set<string>(parsed.expandedPaths);
          setExpandedPaths(savedExpanded);
          setEntries(parsed.entries);
          setFocusedPath(parsed.focusedPath);
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
      const index = entries.findIndex((e) => e.path === focusedPath);
      if (index !== -1) {
        if (index !== focusedIndex) {
          setFocusedIndex(index);
        }
      } else if (focusedIndex >= entries.length) {
        setFocusedIndex(entries.length > 0 ? 0 : -1);
      }
    } else if (focusedIndex !== -1 && entries[focusedIndex]) {
      setFocusedPath(entries[focusedIndex].path);
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
    const unlistenPromise = listen<string>("explorer-refresh", (_event) => {
      if (currentPath) {
        refreshTree(expandedPathsRef.current);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [currentPath, refreshTree]);

  const toggleFolder = React.useCallback(
    async (index: number) => {
      const entry = entries[index];
      if (!entry || !entry.is_dir) return;

      const isExpanded = expandedPaths.has(entry.path);
      const newExpandedPaths = new Set(expandedPaths);

      if (isExpanded) {
        newExpandedPaths.delete(entry.path);
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

        const fetchRecursive = async (
          path: string,
          depth: number
        ): Promise<FileExplorerEntry[]> => {
          const children = await invoke<RawFileEntry[]>(
            "list_directory_contents",
            { path }
          );
          const result: FileExplorerEntry[] = [];
          for (const child of children) {
            const childEntry = { ...child, depth };
            result.push(childEntry);
            if (child.is_dir && newExpandedPaths.has(child.path)) {
              const descendants = await fetchRecursive(child.path, depth + 1);
              result.push(...descendants);
            }
          }
          return result;
        };

        try {
          const childrenWithDescendants = await fetchRecursive(
            entry.path,
            entry.depth + 1
          );
          const newEntries = [...entries];
          newEntries.splice(index + 1, 0, ...childrenWithDescendants);
          setEntries(newEntries);
          setExpandedPaths(newExpandedPaths);
        } catch (e) {
          console.error("Failed to expand folder", e);
        }
      }
    },
    [entries, expandedPaths]
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
  };
}
