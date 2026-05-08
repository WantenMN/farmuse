import * as React from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { FileText, AlertCircle, Save } from "lucide-react"

interface EditorProps {
  path: string | null;
  name: string | null;
}

export function Editor({ path, name }: EditorProps) {
  const [content, setContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [lastSavedContent, setLastSavedContent] = React.useState<string | null>(null);

  // Load file content
  React.useEffect(() => {
    if (!path) {
      setContent(null);
      setError(null);
      return;
    }

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<string>("read_file_content", { path });
        setContent(result);
        setLastSavedContent(result);
      } catch (e) {
        console.error("Failed to read file", e);
        setError("Unable to open: This file might be binary or use an unsupported encoding.");
        setContent(null);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [path]);

  // Auto-save logic
  React.useEffect(() => {
    if (path === null || content === null || content === lastSavedContent) return;

    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        await invoke("write_file_content", { path, content });
        setLastSavedContent(content);
        console.log(`Saved ${name}`);
      } catch (e) {
        console.error("Failed to save file", e);
      } finally {
        setIsSaving(false);
      }
    }, 1000); // Save after 1 second of inactivity

    return () => clearTimeout(timer);
  }, [content, path, lastSavedContent, name]);

  // File watcher and external changes
  React.useEffect(() => {
    if (!path) return;

    invoke("watch_file", { path }).catch(console.error);

    const unlistenPromise = listen<string>("file-changed", async (event) => {
        if (event.payload === path) {
            try {
                const newContent = await invoke<string>("read_file_content", { path });
                // Only update if content is actually different to avoid unnecessary re-renders
                // and avoid overwriting if we just saved it (though read_file_content should match lastSavedContent then)
                setContent(prev => {
                    if (newContent !== prev) {
                        setLastSavedContent(newContent);
                        return newContent;
                    }
                    return prev;
                });
            } catch (e) {
                console.error("Failed to reload file on change", e);
            }
        }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
      invoke("unwatch_file").catch(console.error);
    };
  }, [path]);

  if (!path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground select-none">
        <FileText className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-sm">Select a file to start editing</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center select-none">
        <p className="text-sm animate-pulse">Loading {name}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-destructive p-4 text-center select-none">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
        <h3 className="font-semibold mb-1">Cannot Open File</h3>
        <p className="text-sm max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate select-none">{name}</span>
        </div>
        <div className="flex items-center gap-2 px-2">
            {isSaving ? (
                <span className="text-[10px] text-muted-foreground animate-pulse flex items-center gap-1">
                    <Save className="h-3 w-3" /> Saving...
                </span>
            ) : content !== lastSavedContent ? (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    Modified
                </span>
            ) : (
                <span className="text-[10px] text-muted-foreground/50">
                    Saved
                </span>
            )}
        </div>
      </div>
      <div className="flex-1 relative">
        <textarea
          value={content || ""}
          onChange={(e) => setContent(e.target.value)}
          className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-transparent outline-none resize-none selection:bg-primary/20"
          spellCheck={false}
          autoFocus
        />
      </div>
    </div>
  );
}
