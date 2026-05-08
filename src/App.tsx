import * as React from "react";
import { TitleBar } from "./components/TitleBar";
import { CommandPalette } from "./components/CommandPalette";
import { PathPalette } from "./components/PathPalette";
import { FileExplorer } from "./components/FileExplorer";
import { Editor } from "./components/Editor";
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
  const [showExplorer, setShowExplorer] = React.useState(
    savedState?.showExplorer !== undefined ? savedState.showExplorer : true
  );
  const [activeFile, setActiveFile] = React.useState<{
    path: string;
    name: string;
  } | null>(savedState?.activeFile || null);

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
    []
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
      activeFile,
      showExplorer,
    };
    localStorage.setItem("farmuse_state", JSON.stringify(state));
  }, [currentPath, activeFile, showExplorer]);

  React.useEffect(() => {
    registerAppCommands({
      toggleExplorer: () => setShowExplorer((prev: boolean) => !prev),
      closeFolder: () => {
        setCurrentPath(null);
        setEntries([]);
        setActiveFile(null);
      },
      closeFile: () => setActiveFile(null),
    });

    return () => {
      unregisterAppCommands();
    };
  }, []);

  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <FileExplorer
          currentPath={currentPath}
          entries={entries}
          isVisible={showExplorer}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {activeFile ? (
            <Editor path={activeFile.path} name={activeFile.name} />
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
        onSelect={(path, name) => setActiveFile({ path, name })}
      />
    </div>
  );
}

export default App;
