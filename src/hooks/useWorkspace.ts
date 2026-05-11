import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileEntry } from "../types";
import { useExplorerResize } from "./useExplorerResize";
import { commandManager } from "../systems/commandManager";

interface WorkspaceState {
  currentPath: string | null;
  explorerWidth: number;
  showExplorer: boolean;
}

export function useWorkspace(savedState: WorkspaceState | null) {
  const [currentPath, setCurrentPath] = React.useState<string | null>(
    savedState?.currentPath ? savedState.currentPath.replace(/\\/g, "/") : null
  );
  const [entries, setEntries] = React.useState<FileEntry[]>([]);

  const {
    width: explorerWidth,
    isVisible: showExplorer,
    setIsVisible: setShowExplorer,
    startResizing,
  } = useExplorerResize({
    initialWidth: savedState?.explorerWidth || 256,
    initialVisible:
      savedState?.showExplorer !== undefined ? savedState.showExplorer : true,
  });

  const loadDirectory = React.useCallback(
    async (
      path: string,
      onBeforeLoad?: () => void | Promise<void>,
      onAfterLoad?: () => void | Promise<void>
    ) => {
      const normalizedPath = path.replace(/\\/g, "/");
      if (onBeforeLoad) await onBeforeLoad();

      try {
        const result = await invoke<FileEntry[]>("list_directory_contents", {
          path: normalizedPath,
        });

        if (onAfterLoad) await onAfterLoad();

        setEntries(
          result.map((e) => ({ ...e, path: e.path.replace(/\\/g, "/") }))
        );
        setCurrentPath(normalizedPath);
        setShowExplorer(true);

        // Focus the explorer after a short delay
        setTimeout(() => {
          commandManager.execute("explorer.focus");
        }, 50);
      } catch (e) {
        console.error("Failed to load directory", e);
        alert("Failed to open directory: " + e);
      }
    },
    [setShowExplorer]
  );

  const closeFolder = React.useCallback(() => {
    setCurrentPath(null);
    setEntries([]);
  }, []);

  return {
    currentPath,
    setCurrentPath,
    entries,
    setEntries,
    explorerWidth,
    showExplorer,
    setShowExplorer,
    startResizing,
    loadDirectory,
    closeFolder,
  };
}
