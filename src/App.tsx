import * as React from "react";
import { TitleBar } from "./components/TitleBar";
import { ResizeHandles } from "./components/ResizeHandles";
import { CommandPalette } from "./components/CommandPalette";
import { PathPalette } from "./components/PathPalette";
import { FileExplorer } from "./components/FileExplorer";
import { Editor } from "./components/Editor";
import { Tabs } from "./components/Tabs";
import { useExplorerResize } from "./hooks/useExplorerResize";
import { invoke } from "@tauri-apps/api/core";
import { commandManager } from "./systems/commandManager";
import {
  registerAppCommands,
  unregisterAppCommands,
  COMMAND_METADATA,
} from "./commands";
import { FileEntry } from "./types";

function App() {
  const [savedState] = React.useState(() => {
    const saved = localStorage.getItem("farmuse_state");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
    return null;
  });

  const [currentPath, setCurrentPath] = React.useState<string | null>(
    savedState?.currentPath || null
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

  const [openFiles, setOpenFiles] = React.useState<
    {
      path: string;
      name: string;
    }[]
  >(savedState?.openFiles || []);
  const [activeFilePath, setActiveFilePath] = React.useState<string | null>(
    savedState?.activeFilePath || null
  );

  const activeFile = React.useMemo(
    () => openFiles.find((f) => f.path === activeFilePath) || null,
    [openFiles, activeFilePath]
  );

  const hasRestoredEntries = React.useRef(false);

  const loadDirectory = React.useCallback(
    async (path: string, shouldFocus = true) => {
      try {
        const result = await invoke<FileEntry[]>("list_directory_contents", {
          path,
        });
        setEntries(result);
        setCurrentPath(path);
        if (shouldFocus) {
          setShowExplorer(true);
          // Focus the explorer after a short delay to allow it to render entries
          setTimeout(() => {
            commandManager.execute("explorer.focus");
          }, 50);
        }
      } catch (e) {
        console.error("Failed to load directory", e);
        alert("Failed to open directory: " + e);
      }
    },
    [setShowExplorer]
  );

  // Restore directory entries on mount if we have a path
  React.useEffect(() => {
    if (currentPath && !hasRestoredEntries.current) {
      hasRestoredEntries.current = true;
      loadDirectory(currentPath, false);
    }
  }, [currentPath, loadDirectory]);

  // Save state on changes
  React.useEffect(() => {
    const state = {
      currentPath,
      openFiles,
      activeFilePath,
      showExplorer,
      explorerWidth,
    };
    localStorage.setItem("farmuse_state", JSON.stringify(state));
  }, [currentPath, openFiles, activeFilePath, showExplorer, explorerWidth]);

  const openFile = React.useCallback((path: string, name: string) => {
    setOpenFiles((prev) => {
      if (prev.some((f) => f.path === path)) return prev;
      return [...prev, { path, name }];
    });
    setActiveFilePath(path);
  }, []);

  const closeFile = React.useCallback(
    (path: string) => {
      setOpenFiles((prev) => {
        const newFiles = prev.filter((f) => f.path !== path);
        if (activeFilePath === path) {
          setActiveFilePath(newFiles.length > 0 ? newFiles[0].path : null);
        }
        return newFiles;
      });
    },
    [activeFilePath]
  );

  const closeOthers = React.useCallback((path: string) => {
    setOpenFiles((prev) => {
      const fileToKeep = prev.find((f) => f.path === path);
      if (fileToKeep) {
        setActiveFilePath(path);
        return [fileToKeep];
      }
      return prev;
    });
  }, []);

  const closeAll = React.useCallback(() => {
    setOpenFiles([]);
    setActiveFilePath(null);
  }, []);

  React.useEffect(() => {
    registerAppCommands({
      toggleExplorer: () => setShowExplorer((prev: boolean) => !prev),
      closeFolder: () => {
        setCurrentPath(null);
        setEntries([]);
        setOpenFiles([]);
        setActiveFilePath(null);
      },
      closeFile: () => {
        if (activeFilePath) {
          closeFile(activeFilePath);
        }
      },
    });

    return () => {
      unregisterAppCommands();
    };
  }, [activeFilePath, closeFile, setShowExplorer]);

  return (
    <div className="bg-background text-foreground border-border flex h-screen w-screen flex-col overflow-hidden border">
      <ResizeHandles />
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <FileExplorer
          currentPath={currentPath}
          entries={entries}
          isVisible={showExplorer}
          width={explorerWidth}
          onResizeStart={startResizing}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {openFiles.length > 0 && (
            <Tabs
              files={openFiles}
              activePath={activeFilePath}
              onSelect={setActiveFilePath}
              onClose={closeFile}
              onCloseOthers={closeOthers}
              onCloseAll={closeAll}
            />
          )}

          {activeFile ? (
            <Editor
              key={activeFile.path}
              path={activeFile.path}
              name={activeFile.name}
            />
          ) : (
            <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
              <div className="mb-8 text-center">
                <h1 className="mb-2 text-4xl font-bold tracking-tight">
                  Farmuse
                </h1>
                <p className="text-muted-foreground text-lg">
                  Manage your project with speed.
                </p>
              </div>

              <div className="w-full max-w-md space-y-4">
                <div className="bg-muted/50 border-border/50 rounded-xl border p-6 text-center">
                  <p className="text-muted-foreground mb-4 text-sm">
                    Global Shortcuts
                  </p>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Command Palette</span>
                      <kbd className="bg-background rounded border px-2 py-1 font-sans text-xs font-medium shadow-sm">
                        Alt + X
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Toggle Explorer</span>
                      <kbd className="bg-background rounded border px-2 py-1 font-sans text-xs font-medium shadow-sm">
                        Inside Palette
                      </kbd>
                    </div>
                  </div>
                </div>

                {!currentPath && (
                  <p className="text-muted-foreground animate-pulse text-center text-sm">
                    Type &quot;Open Folder&quot; in palette to get started
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Global Overlays */}
      <CommandPalette />
      <PathPalette
        commandId={COMMAND_METADATA.OPEN_FOLDER.id}
        commandName={COMMAND_METADATA.OPEN_FOLDER.name}
        commandDescription={COMMAND_METADATA.OPEN_FOLDER.description}
        mode="folder"
        placeholder="Enter directory path..."
        onSelect={(path) => loadDirectory(path)}
      />
      <PathPalette
        commandId={COMMAND_METADATA.OPEN_FILE.id}
        commandName={COMMAND_METADATA.OPEN_FILE.name}
        commandDescription={COMMAND_METADATA.OPEN_FILE.description}
        mode="file"
        placeholder="Search for a file..."
        onSelect={openFile}
      />
    </div>
  );
}

export default App;
