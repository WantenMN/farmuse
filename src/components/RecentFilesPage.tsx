import * as React from "react";
import { FileText, Trash2, X } from "lucide-react";
import { cn } from "../lib/utils";

interface RecentFilesPageProps {
  onOpenFile: (path: string, name: string) => void;
  activeFilePath: string | null;
}

export function RecentFilesPage({
  onOpenFile,
  activeFilePath,
}: RecentFilesPageProps) {
  const [files, setFiles] = React.useState<string[]>([]);
  const [confirmingPath, setConfirmingPath] = React.useState<string | null>(
    null
  );
  const [confirmClear, setConfirmClear] = React.useState(false);

  const loadFiles = React.useCallback((isInitial = false) => {
    const saved = JSON.parse(
      localStorage.getItem("farmuse_recent_files") || "[]"
    ) as string[];

    if (isInitial) {
      setFiles(saved);
    } else {
      setFiles((prev) => {
        const existing = prev.filter((p) => saved.includes(p));
        const added = saved.filter((p) => !prev.includes(p));
        return [...added, ...existing];
      });
    }
  }, []);

  React.useEffect(() => {
    loadFiles(true);

    const handleStorage = () => loadFiles(false);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("recent-files-updated", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("recent-files-updated", handleStorage);
    };
  }, [loadFiles]);

  const handleRemove = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    if (confirmingPath !== path) {
      setConfirmingPath(path);
      return;
    }

    const saved = JSON.parse(
      localStorage.getItem("farmuse_recent_files") || "[]"
    ) as string[];
    const updated = saved.filter((p) => p !== path);
    localStorage.setItem("farmuse_recent_files", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("recent-files-updated"));
    setConfirmingPath(null);
  };

  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    localStorage.setItem("farmuse_recent_files", "[]");
    window.dispatchEvent(new CustomEvent("recent-files-updated"));
    setConfirmClear(false);
  };

  // Reset confirmation state when clicking elsewhere
  React.useEffect(() => {
    const handleClickOutside = () => {
      setConfirmingPath(null);
      setConfirmClear(false);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const getName = (path: string) =>
    path.split(/[/\\]/).filter(Boolean).pop() || path;

  return (
    <div className="bg-background flex-1 overflow-auto p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Recent Files</h1>
          {files.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                confirmClear
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
              )}
            >
              {confirmClear ? (
                <>
                  <Trash2 className="h-4 w-4" />
                  Confirm Clear
                </>
              ) : (
                <>
                  <X className="h-4 w-4" />
                  Clear All
                </>
              )}
            </button>
          )}
        </div>

        {files.length === 0 ? (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
            <FileText className="text-muted-foreground mb-4 h-12 w-12 opacity-20" />
            <p className="text-muted-foreground">No recent files yet.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map((path) => (
              <div
                key={path}
                onClick={() => onOpenFile(path, getName(path))}
                className={cn(
                  "group hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors",
                  activeFilePath === path && "bg-muted"
                )}
              >
                <FileText
                  className={cn(
                    "h-4 w-4 shrink-0",
                    activeFilePath === path
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {getName(path).replace(/\.md$/, "")}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {path}
                  </div>
                </div>
                <button
                  onClick={(e) => handleRemove(e, path)}
                  className={cn(
                    "cursor-pointer rounded p-1 transition-all",
                    confirmingPath === path
                      ? "bg-destructive text-destructive-foreground opacity-100"
                      : "text-muted-foreground hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100"
                  )}
                  title={
                    confirmingPath === path
                      ? "Confirm removal"
                      : "Remove from recent"
                  }
                >
                  {confirmingPath === path ? (
                    <Trash2 className="h-3.5 w-3.5" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
