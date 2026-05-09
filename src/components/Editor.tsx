import * as React from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { useEditor } from "../hooks/useEditor";
import { useSettingsStore } from "../store/settingsStore";
import { EditorEmptyState } from "./Editor/EditorEmptyState";
import { EditorLoadingState } from "./Editor/EditorLoadingState";
import { EditorErrorState } from "./Editor/EditorErrorState";
import { EditorStatusBar, type EditorMode } from "./Editor/EditorStatusBar";
import { getDefaultExtensions } from "./Editor/CodeMirrorConfig";

interface EditorProps {
  path: string | null;
  name: string | null;
}

export function Editor({ path, name }: EditorProps) {
  const { content, setContent, error, loading, isSaving, lastSavedContent } =
    useEditor({ path, name });
  const fontSize = useSettingsStore((state) => state.fontSize);

  const [mode, setMode] = React.useState<EditorMode>("live");
  const editorRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const isInitialized = React.useRef(false);
  const hasContent = content !== null;

  // Initialize CodeMirror
  React.useEffect(() => {
    if (!editorRef.current || !hasContent) return;

    // Destroy existing view if path or mode changes to ensure fresh start with correct extensions
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
      isInitialized.current = false;
    }

    const state = EditorState.create({
      doc: content || "",
      extensions: getDefaultExtensions(
        (newContent, view) => {
          setContent(newContent);
          view.dispatch({
            effects: EditorView.scrollIntoView(view.state.selection.main, {
              y: "nearest",
              yMargin: 5 * view.defaultLineHeight,
            }),
          });
        },
        mode,
        fontSize
      ),
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
  }, [path, hasContent, mode, fontSize]);

  // Sync content from state to editor
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

  if (!path) return <EditorEmptyState />;

  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative flex-1 overflow-hidden">
        {loading ? (
          <EditorLoadingState name={name} />
        ) : error ? (
          <EditorErrorState error={error} />
        ) : (
          <div className="h-full w-full" ref={editorRef} />
        )}
      </div>
      <EditorStatusBar
        isSaving={isSaving}
        isModified={content !== lastSavedContent}
        mode={mode}
        onModeChange={setMode}
      />
    </div>
  );
}
