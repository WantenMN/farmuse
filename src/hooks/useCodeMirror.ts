import * as React from "react";
import { EditorView } from "@codemirror/view";
import { EditorState, Extension } from "@codemirror/state";

interface UseCodeMirrorProps {
  container: React.RefObject<HTMLDivElement | null>;
  value: string;
  extensions: Extension[];
  autoFocus?: boolean;
}

export function useCodeMirror({
  container,
  value,
  extensions,
  autoFocus = false,
}: UseCodeMirrorProps) {
  const [view, setView] = React.useState<EditorView | null>(null);

  React.useEffect(() => {
    if (!container.current) return;

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const v = new EditorView({
      state,
      parent: container.current,
    });

    setView(v);

    if (autoFocus) {
      v.focus();
    }

    return () => {
      v.destroy();
      setView(null);
    };
    // We only want to initialize once per container mount/extensions change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensions, container]);

  // Focus when autoFocus becomes true
  React.useEffect(() => {
    if (autoFocus && view) {
      view.focus();
    }
  }, [autoFocus, view]);

  // Sync value from outside to editor
  React.useEffect(() => {
    if (view && value !== null) {
      const currentDoc = view.state.doc.toString();
      if (value !== currentDoc) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
        });
      }
    }
  }, [value, view]);

  return { view };
}
