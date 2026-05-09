import * as React from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { useEditor } from "../hooks/useEditor";
import { EditorEmptyState } from "./Editor/EditorEmptyState";
import { EditorUnsupportedState } from "./Editor/EditorUnsupportedState";
import { EditorLoadingState } from "./Editor/EditorLoadingState";
import { EditorErrorState } from "./Editor/EditorErrorState";
import { EditorStatusBar } from "./Editor/EditorStatusBar";
import { getDefaultExtensions } from "./Editor/CodeMirrorConfig";

interface EditorProps {
  path: string | null;
  name: string | null;
}

export function Editor({ path, name }: EditorProps) {
  const {
    content,
    setContent,
    error,
    loading,
    isSaving,
    lastSavedContent,
    isMarkdown,
  } = useEditor({ path, name });

  const editorRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
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
      extensions: getDefaultExtensions((newContent, view) => {
        setContent(newContent);
        view.dispatch({
          effects: EditorView.scrollIntoView(view.state.selection.main, {
            y: "nearest",
            yMargin: 5 * view.defaultLineHeight,
          }),
        });
      }),
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
  if (!isMarkdown) return <EditorUnsupportedState />;
  if (loading) return <EditorLoadingState name={name} />;
  if (error) return <EditorErrorState error={error} />;

  return (
    <div className="bg-background flex min-h-0 flex-1 overflow-hidden">
      <div className="relative h-full w-full" ref={editorRef}>
        <EditorStatusBar
          isSaving={isSaving}
          isModified={content !== lastSavedContent}
        />
      </div>
    </div>
  );
}
