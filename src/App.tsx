import * as React from "react";
import { CommandPalette } from "./components/CommandPalette";
import { FolderPalette } from "./components/FolderPalette";
import { FileExplorer } from "./components/FileExplorer";
import { invoke } from "@tauri-apps/api/core";
import { commandManager } from "./systems/commandManager";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

function App() {
  const [currentPath, setCurrentPath] = React.useState<string | null>(null);
  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [showExplorer, setShowExplorer] = React.useState(true);

  const loadDirectory = React.useCallback(async (path: string) => {
    try {
      const result = await invoke<FileEntry[]>("list_directory_contents", { path });
      setEntries(result);
      setCurrentPath(path);
      setShowExplorer(true);
    } catch (e) {
      console.error("Failed to load directory", e);
      alert("Failed to open directory: " + e);
    }
  }, []);

  React.useEffect(() => {
    commandManager.register({
      id: "toggle-explorer",
      name: "Toggle Explorer",
      description: "Show or hide the file explorer sidebar",
      handler: () => setShowExplorer(prev => !prev),
    });

    return () => {
      commandManager.unregister("toggle-explorer");
    };
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <FileExplorer
        currentPath={currentPath}
        entries={entries}
        isVisible={showExplorer}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <div className="container mx-auto p-4 flex-1 flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-2">Farmuse</h1>
            <p className="text-muted-foreground text-lg">
              Manage your project with speed.
            </p>
          </div>

          <div className="max-w-md w-full space-y-4">
            <div className="bg-muted/50 p-6 rounded-xl border border-border/50 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Global Shortcuts
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Command Palette</span>
                  <kbd className="bg-background px-2 py-1 rounded border shadow-sm text-xs font-sans font-medium">Alt + X</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Toggle Explorer</span>
                  <kbd className="bg-background px-2 py-1 rounded border shadow-sm text-xs font-sans font-medium">Inside Palette</kbd>
                </div>
              </div>
            </div>

            {!currentPath && (
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Type "Open Folder" in palette to get started
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Global Overlays */}
      <CommandPalette />
      <FolderPalette onFolderSelect={loadDirectory} />
    </div>
  );
}

export default App;
