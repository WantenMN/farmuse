import * as React from "react";
import { CommandPalette } from "./components/CommandPalette";
import { FolderPalette } from "./components/FolderPalette";
import { invoke } from "@tauri-apps/api/core";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

function App() {
  const [currentPath, setCurrentPath] = React.useState<string | null>(null);
  const [entries, setEntries] = React.useState<FileEntry[]>([]);

  const loadDirectory = React.useCallback(async (path: string) => {
    try {
      const result = await invoke<FileEntry[]>("list_directory_contents", { path });
      setEntries(result);
      setCurrentPath(path);
    } catch (e) {
      console.error("Failed to load directory", e);
      alert("Failed to open directory: " + e);
    }
  }, []);

  return (
    <main className="container mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold underline">Farmuse</h1>
        <p className="mt-4 text-gray-600">
          Press <kbd className="bg-gray-200 px-1 rounded shadow-sm border">Alt + X</kbd> to open command palette
        </p>
      </div>

      {currentPath && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-left">Contents of {currentPath}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map((entry) => (
              <div
                key={entry.path}
                className="flex items-center p-3 border rounded shadow-sm hover:bg-gray-50 transition-colors"
              >
                <span className="mr-2">
                  {entry.is_dir ? "📁" : "📄"}
                </span>
                <span className="truncate text-sm" title={entry.path}>
                  {entry.name}
                </span>
              </div>
            ))}
          </div>
          {entries.length === 0 && (
            <p className="text-gray-500 italic">This directory is empty.</p>
          )}
        </div>
      )}

      {/* The Command Palette is always available globally */}
      <CommandPalette />
      <FolderPalette onFolderSelect={loadDirectory} />
    </main>
  );
}

export default App;
