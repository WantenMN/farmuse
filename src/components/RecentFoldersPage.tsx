import * as React from "react";
import { Folder, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";

interface RecentFoldersPageProps {
  onOpenFolder: (path: string) => void;
  currentPath: string | null;
  onRemoveFolder: (path: string) => void;
}

export function RecentFoldersPage({
  onOpenFolder,
  currentPath,
  onRemoveFolder,
}: RecentFoldersPageProps) {
  const [folders, setFolders] = React.useState<string[]>([]);

  const loadFolders = React.useCallback((isInitial = false) => {
    const saved = JSON.parse(
      localStorage.getItem("farmuse_recent_folders") || "[]"
    ) as string[];

    if (isInitial) {
      setFolders(saved);
    } else {
      setFolders((prev) => {
        // Keep existing ones in their order, but filter out removed ones
        const existing = prev.filter((p) => saved.includes(p));
        // Add truly new ones at the top
        const added = saved.filter((p) => !prev.includes(p));
        return [...added, ...existing];
      });
    }
  }, []);

  React.useEffect(() => {
    loadFolders(true);

    const handleStorage = () => loadFolders(false);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("recent-folders-updated", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("recent-folders-updated", handleStorage);
    };
  }, [loadFolders]);

  const handleRemove = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();

    // 1. Remove from database index
    try {
      await invoke("clear_root_index", { rootPath: path });
    } catch (e) {
      console.error("Failed to clear root index", e);
    }

    // 2. Clear localStorage state for this folder
    localStorage.removeItem(`tabs_state_${path}`);

    // 3. Update recent folders list
    const saved = JSON.parse(
      localStorage.getItem("farmuse_recent_folders") || "[]"
    ) as string[];
    const updated = saved.filter((p) => p !== path);
    localStorage.setItem("farmuse_recent_folders", JSON.stringify(updated));

    // Notify other components (and ourselves via the effect)
    window.dispatchEvent(new CustomEvent("recent-folders-updated"));

    // 4. Call parent handler to close if currently open
    onRemoveFolder(path);
  };

  return (
    <div className="bg-background flex-1 overflow-auto p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold">Recent Folders</h1>

        {folders.length === 0 ? (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
            <Folder className="text-muted-foreground mb-4 h-12 w-12 opacity-20" />
            <p className="text-muted-foreground">No recent folders found.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {folders.map((path) => (
              <div
                key={path}
                onClick={() => onOpenFolder(path)}
                className={cn(
                  "group bg-muted/30 border-border hover:border-primary relative flex cursor-pointer flex-col rounded-lg border p-4 transition-all hover:shadow-md",
                  currentPath === path && "ring-primary ring-2"
                )}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Folder
                      className={cn(
                        "h-8 w-8",
                        currentPath === path
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                    {currentPath === path && (
                      <div className="bg-primary rounded-full px-2 py-0.5 text-[10px] font-bold text-white">
                        CURRENT
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleRemove(e, path)}
                    className="hover:bg-destructive hover:text-destructive-foreground text-muted-foreground rounded p-1.5 opacity-0 transition-colors group-hover:opacity-100"
                    title="Remove and clear data"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {path.split(/[/\\]/).filter(Boolean).pop() || path}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {path}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
