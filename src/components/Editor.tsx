import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FileText, AlertCircle, Save } from "lucide-react";

interface EditorProps {
  path: string | null;
  name: string | null;
}

// Global caches to persist during the session (tab switching)
const contentCache = new Map<string, string>();
const lastSavedContentCache = new Map<string, string>();
const scrollCache = new Map<string, { top: number; left: number }>();

export function Editor({ path, name }: EditorProps) {
  const [content, setContent] = React.useState<string | null>(() =>
    path ? contentCache.get(path) || null : null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(() =>
    path ? !contentCache.has(path) : false
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [lastSavedContent, setLastSavedContent] = React.useState<string | null>(
    () => (path ? lastSavedContentCache.get(path) || null : null)
  );
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Load file content
  React.useEffect(() => {
    if (!path || contentCache.has(path)) {
      return;
    }

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<string>("read_file_content", { path });
        setContent(result);
        setLastSavedContent(result);
        // Initial cache population
        contentCache.set(path, result);
        lastSavedContentCache.set(path, result);
      } catch (e) {
        console.error("Failed to read file", e);
        setError(
          "Unable to open: This file might be binary or use an unsupported encoding."
        );
        setContent(null);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [path]);

  // Update caches when content changes
  React.useEffect(() => {
    if (path && content !== null) {
      contentCache.set(path, content);
    }
  }, [content, path]);

  React.useEffect(() => {
    if (path && lastSavedContent !== null) {
      lastSavedContentCache.set(path, lastSavedContent);
    }
  }, [lastSavedContent, path]);

  // Scroll restoration and persistence
  React.useEffect(() => {
    if (path && content !== null && textareaRef.current) {
      const el = textareaRef.current;
      const restore = (top: number, left: number) => {
        el.scrollTop = top;
        el.scrollLeft = left;
      };

      // Try session cache first (instant)
      const cached = scrollCache.get(path);
      if (cached) {
        restore(cached.top, cached.left);
        return;
      }

      // Fallback to localStorage
      const savedScroll = localStorage.getItem(`editor_scroll_${path}`);
      if (savedScroll) {
        try {
          const { top, left } = JSON.parse(savedScroll);
          restore(top, left);
        } catch (e) {
          console.error("Failed to restore scroll position", e);
        }
      }
    }
  }, [path, content]);

  const saveScrollPosition = React.useCallback(() => {
    if (path && textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      // Don't save if it's just 0/0 and we haven't checked if it was intentional
      // (Simplified: always save to session cache, only persist to localStorage if needed)
      scrollCache.set(path, { top: scrollTop, left: scrollLeft });
    }
  }, [path]);

  // Persist scroll to localStorage occasionally or on unmount
  React.useEffect(() => {
    return () => {
      if (path) {
        const cached = scrollCache.get(path);
        if (cached) {
          localStorage.setItem(`editor_scroll_${path}`, JSON.stringify(cached));
        }
      }
    };
  }, [path]);

  // Auto-save logic
  React.useEffect(() => {
    if (path === null || content === null || content === lastSavedContent)
      return;

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
          const newContent = await invoke<string>("read_file_content", {
            path,
          });
          // Only update if content is actually different to avoid unnecessary re-renders
          // and avoid overwriting if we just saved it (though read_file_content should match lastSavedContent then)
          setContent((prev) => {
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
      unlistenPromise.then((unlisten) => unlisten());
      invoke("unwatch_file").catch(console.error);
    };
  }, [path]);

  if (!path) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center select-none">
        <FileText className="mb-4 h-12 w-12 opacity-20" />
        <p className="text-sm">Select a file to start editing</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center select-none">
        <p className="animate-pulse text-sm">Loading {name}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive flex flex-1 flex-col items-center justify-center p-4 text-center select-none">
        <AlertCircle className="mb-4 h-12 w-12 opacity-50" />
        <h3 className="mb-1 font-semibold">Cannot Open File</h3>
        <p className="max-w-xs text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-0 flex-1 overflow-hidden">
      <div className="flex h-full w-full flex-col">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={content || ""}
            onChange={(e) => setContent(e.target.value)}
            onScroll={saveScrollPosition}
            className="selection:bg-primary/20 absolute inset-0 h-full w-full resize-none bg-transparent px-[max(2rem,calc((100%-48rem)/2+2rem))] py-10 font-mono text-sm leading-relaxed outline-none"
            spellCheck={false}
            autoFocus
          />
        </div>
        <div className="bg-background flex items-center justify-end px-[max(2rem,calc((100%-48rem)/2+2rem))] py-1">
          <div className="flex items-center gap-2">
            {isSaving ? (
              <span className="text-muted-foreground flex animate-pulse items-center gap-1 text-[10px]">
                <Save className="h-3 w-3" /> Saving...
              </span>
            ) : content !== lastSavedContent ? (
              <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                Modified
              </span>
            ) : (
              <span className="text-muted-foreground/50 text-[10px]">
                Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
