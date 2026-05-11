import * as React from "react";
import { useEditor } from "../hooks/useEditor";
import { useCodeMirror } from "../hooks/useCodeMirror";
import { useSettingsStore } from "../store/settingsStore";
import { EditorEmptyState } from "./Editor/EditorEmptyState";
import { EditorLoadingState } from "./Editor/EditorLoadingState";
import { EditorErrorState } from "./Editor/EditorErrorState";
import { EditorStatusBar, type EditorMode } from "./Editor/EditorStatusBar";
import { getDefaultExtensions } from "./Editor/CodeMirrorConfig";

interface EditorProps {
  path: string | null;
  name: string | null;
  isActive?: boolean;
}

export function Editor({ path, name, isActive = false }: EditorProps) {
  const { content, setContent, error, loading, isSaving, lastSavedContent } =
    useEditor({ path, name });
  const fontSize = useSettingsStore((state) => state.fontSize);
  const showLineNumbers = useSettingsStore((state) => state.showLineNumbers);

  const [mode, setMode] = React.useState<EditorMode>("live");
  const editorRef = React.useRef<HTMLDivElement>(null);

  const hasContent = content !== null;
  const extensions = React.useMemo(() => {
    if (!hasContent) return [];
    return getDefaultExtensions(
      (newContent) => {
        setContent(newContent);
      },
      mode,
      fontSize,
      showLineNumbers
    );
  }, [setContent, mode, fontSize, showLineNumbers, hasContent]);

  useCodeMirror({
    container: editorRef,
    value: content || "",
    extensions,
    autoFocus: isActive,
  });

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
