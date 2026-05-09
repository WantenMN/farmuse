import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FileText, AlertCircle, Save } from "lucide-react";
import {
  EditorView,
  lineNumbers,
  dropCursor,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  HighlightStyle,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { closeBrackets } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";

interface EditorProps {
  path: string | null;
  name: string | null;
}

// Global caches to persist during the session (tab switching)
const contentCache = new Map<string, string>();
const lastSavedContentCache = new Map<string, string>();

const markdownHighlightStyle = HighlightStyle.define([
  {
    tag: t.heading1,
    fontSize: "1.5rem",
    fontWeight: "700",
    textDecoration: "none",
    color: "var(--foreground)",
  },
  {
    tag: t.heading2,
    fontSize: "1.375rem",
    fontWeight: "700",
    textDecoration: "none",
    color: "var(--foreground)",
  },
  {
    tag: t.heading3,
    fontSize: "1.25rem",
    fontWeight: "600",
    textDecoration: "none",
    color: "var(--foreground)",
  },
  {
    tag: t.heading4,
    fontSize: "1.125rem",
    fontWeight: "600",
    textDecoration: "none",
    color: "var(--foreground)",
  },
  {
    tag: t.heading5,
    fontSize: "1rem",
    fontWeight: "600",
    textDecoration: "none",
    color: "var(--foreground)",
  },
  {
    tag: t.heading6,
    fontSize: "0.875rem",
    fontWeight: "600",
    textDecoration: "none",
    color: "var(--foreground)",
  },
]);

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

  const editorRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);

  const isMarkdown = React.useMemo(() => {
    return name?.toLowerCase().endsWith(".md") || false;
  }, [name]);

  // Load file content
  React.useEffect(() => {
    if (!path || contentCache.has(path)) {
      if (path && !isMarkdown) {
        setLoading(false);
        setContent(null);
      }
      return;
    }

    if (!isMarkdown) return;

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
  }, [path, isMarkdown]);

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

  const isInitialized = React.useRef(false);
  const hasContent = content !== null;

  // Initialize CodeMirror
  React.useEffect(() => {
    if (
      !editorRef.current ||
      !isMarkdown ||
      !hasContent ||
      isInitialized.current
    )
      return;

    const state = EditorState.create({
      doc: content || "",
      extensions: [
        lineNumbers(),
        history(),
        foldGutter(),
        dropCursor(),
        indentOnInput(),
        syntaxHighlighting(markdownHighlightStyle),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            setContent(newContent);

            update.view.dispatch({
              effects: EditorView.scrollIntoView(update.state.selection.main, {
                y: "nearest",
                yMargin: 5 * update.view.defaultLineHeight,
              }),
            });
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            width: "100%",
            backgroundColor: "transparent",
          },
          ".cm-scroller": {
            display: "grid !important",
            gridTemplateColumns: "1fr minmax(0, 48rem) 1fr",
            width: "100%",
            overflow: "auto",
            fontFamily:
              "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace)",
            scrollbarGutter: "stable",
            paddingTop: "2.5rem",
            paddingBottom: "50vh",
          },
          ".cm-gutters": {
            gridColumn: "1",
            justifySelf: "end",
            display: "flex",
            backgroundColor: "transparent",
            borderRight: "none",
            color: "var(--muted-foreground)",
            opacity: "0.5",
          },
          ".cm-content": {
            gridColumn: "2",
            width: "100%",
            maxWidth: "48rem",
            padding: "0",
          },
          ".cm-layer": {
            gridColumn: "1 / span 3",
            width: "100%",
            maxWidth: "none !important",
          },
          ".cm-gutterElement": {
            padding: "0 8px 0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          },
          ".cm-line": {
            paddingLeft: "0.5rem",
            paddingRight: "0.5rem",
            fontSize: "0.875rem", // text-sm
            lineHeight: "1.625", // leading-relaxed
          },
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-activeLine": {
            backgroundColor: "transparent",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "transparent",
            color: "var(--foreground)",
            opacity: "1",
          },
          ".cm-foldGutter span": {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    isInitialized.current = true;

    return () => {
      view.destroy();
      viewRef.current = null;
      isInitialized.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, isMarkdown, hasContent]);

  // Sync content from state to editor (for watcher or external changes)
  React.useEffect(() => {
    if (viewRef.current && content !== null) {
      const currentDoc = viewRef.current.state.doc.toString();
      if (content !== currentDoc) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: content },
        });
      }
    }
  }, [content]);

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
    }, 1000);

    return () => clearTimeout(timer);
  }, [content, path, lastSavedContent, name]);

  // File watcher
  React.useEffect(() => {
    if (!path || !isMarkdown) return;

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
  }, [path, isMarkdown]);

  if (!path) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center select-none">
        <FileText className="mb-4 h-12 w-12 opacity-20" />
        <p className="text-sm">Select a file to start editing</p>
      </div>
    );
  }

  if (!isMarkdown) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center select-none">
        <FileText className="mb-4 h-12 w-12 opacity-20" />
        <p className="text-sm">Only markdown files are supported for editing</p>
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
      <div className="relative h-full w-full" ref={editorRef}>
        <div className="pointer-events-none absolute right-[max(2rem,calc((100%-48rem)/2+2rem))] bottom-4 z-10 flex items-center gap-2">
          <div className="bg-background/60 rounded-md px-2 py-0.5 backdrop-blur-md">
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
