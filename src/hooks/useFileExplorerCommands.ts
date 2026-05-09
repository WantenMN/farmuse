import * as React from "react";
import { commandManager } from "../systems/commandManager";
import { FileExplorerEntry } from "./useFileExplorer";

interface UseFileExplorerCommandsProps {
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  entries: FileExplorerEntry[];
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  setFocusedPath: (path: string | null) => void;
  expandedPaths: Set<string>;
  toggleFolder: (index: number) => Promise<void>;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

export function useFileExplorerCommands({
  isActive,
  setIsActive,
  entries,
  focusedIndex,
  setFocusedIndex,
  setFocusedPath,
  expandedPaths,
  toggleFolder,
  scrollContainerRef,
}: UseFileExplorerCommandsProps) {
  React.useEffect(() => {
    commandManager.register({
      id: "explorer.focus",
      name: "Explorer: Focus",
      description: "Set keyboard focus to the file explorer",
      handler: () => {
        setIsActive(true);
        scrollContainerRef.current?.focus();
        if (focusedIndex === -1 && entries.length > 0) {
          const newIndex = 0;
          setFocusedIndex(newIndex);
          setFocusedPath(entries[newIndex].path);
        }
      },
    });

    commandManager.register({
      id: "explorer.moveDown",
      name: "Explorer: Move Selection Down",
      description: "Focus the next item in the explorer",
      handler: () => {
        if (!isActive || entries.length === 0) return;
        setFocusedIndex((prev) => {
          const next = prev < entries.length - 1 ? prev + 1 : 0;
          setFocusedPath(entries[next].path);
          return next;
        });
      },
      visible: true,
    });

    commandManager.register({
      id: "explorer.moveUp",
      name: "Explorer: Move Selection Up",
      description: "Focus the previous item in the explorer",
      handler: () => {
        if (!isActive || entries.length === 0) return;
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : entries.length - 1;
          setFocusedPath(entries[next].path);
          return next;
        });
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

        for (let i = focusedIndex - 1; i >= 0; i--) {
          if (entries[i].depth < currentEntry.depth) {
            setFocusedIndex(i);
            setFocusedPath(entries[i].path);
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
          toggleFolder(focusedIndex);
        } else {
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
  }, [
    entries,
    focusedIndex,
    isActive,
    expandedPaths,
    toggleFolder,
    setIsActive,
    setFocusedIndex,
    setFocusedPath,
    scrollContainerRef,
  ]);
}
