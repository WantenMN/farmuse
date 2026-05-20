import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface UseEditorProps {
  path: string | null;
  name: string | null;
}

const contentCache = new Map<string, string>();
const lastSavedContentCache = new Map<string, string>();

export function clearEditorCache(path: string) {
  contentCache.delete(path);
  lastSavedContentCache.delete(path);
}

export function useEditor({ path, name }: UseEditorProps) {
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
    }, 1000);

    return () => clearTimeout(timer);
  }, [content, path, lastSavedContent, name]);

  React.useEffect(() => {
    if (!path) return;

    invoke("watch_file", { path }).catch(console.error);

    const unlistenPromise = listen<string>("file-changed", async (event) => {
      if (event.payload === path) {
        try {
          const newContent = await invoke<string>("read_file_content", {
            path,
          });
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

  return {
    content,
    setContent,
    error,
    loading,
    isSaving,
    lastSavedContent,
  };
}
