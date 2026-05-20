import * as React from "react";
import { cn } from "../lib/utils";
import { useEditor } from "../hooks/useEditor";
import { useCodeMirror } from "../hooks/useCodeMirror";
import { useSettingsStore } from "../store/settingsStore";
import { EditorEmptyState } from "./Editor/EditorEmptyState";
import { EditorLoadingState } from "./Editor/EditorLoadingState";
import { EditorErrorState } from "./Editor/EditorErrorState";
import { EditorStatusBar, type EditorMode } from "./Editor/EditorStatusBar";
import { getDefaultExtensions } from "./Editor/CodeMirrorConfig";
import { CustomScrollbar } from "./CustomScrollbar";

interface EditorProps {
  path: string | null;
  name: string | null;
  isActive?: boolean;
  focusNewFilePath?: React.MutableRefObject<string | null>;
}

export function Editor({
  path,
  name,
  isActive: _isActive = false,
  focusNewFilePath,
}: EditorProps) {
  const { content, setContent, error, loading } = useEditor({ path, name });
  const fontSize = useSettingsStore((state) => state.fontSize);
  const showLineNumbers = useSettingsStore((state) => state.showLineNumbers);

  const [mode, setMode] = React.useState<EditorMode>("live");
  const editorRef = React.useRef<HTMLDivElement>(null);
  const scrollDomRef = React.useRef<HTMLElement | null>(null);

  const extensions = React.useMemo(() => {
    return getDefaultExtensions(
      (newContent) => {
        setContent(newContent);
      },
      mode,
      fontSize,
      showLineNumbers
    );
  }, [setContent, mode, fontSize, showLineNumbers]);

  const { view } = useCodeMirror({
    container: editorRef,
    value: content || "",
    extensions,
    autoFocus: false,
  });

  React.useEffect(() => {
    if (view) {
      scrollDomRef.current = view.scrollDOM;
    } else {
      scrollDomRef.current = null;
    }
  }, [view]);

  const wasActive = React.useRef(false);
  const wasLoading = React.useRef(loading);
  const hasBeenFocused = React.useRef(false);
  React.useEffect(() => {
    if (view && !loading) {
      const onFocus = () => {
        hasBeenFocused.current = true;
      };
      view.dom.addEventListener("focusin", onFocus);
      return () => view.dom.removeEventListener("focusin", onFocus);
    }
  }, [view, loading]);
  React.useEffect(() => {
    const justLoaded = wasLoading.current && !loading;
    if (_isActive && view && justLoaded && focusNewFilePath?.current === path) {
      focusNewFilePath.current = null;
      view.focus();
    }
    wasLoading.current = loading;
  }, [_isActive, view, loading, path, focusNewFilePath]);
  React.useEffect(() => {
    if (_isActive && !wasActive.current && view && !loading) {
      if (hasBeenFocused.current) {
        view.focus();
      }
    }
    wasActive.current = _isActive;
  }, [_isActive, view, loading]);

  if (!path) return <EditorEmptyState />;

  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative flex-1 overflow-hidden">
        <div
          className={cn("h-full w-full", (loading || !!error) && "hidden")}
          ref={editorRef}
        />
        {loading && <EditorLoadingState name={name} />}
        {error && <EditorErrorState error={error} />}
        <CustomScrollbar containerRef={scrollDomRef} />
      </div>
      <EditorStatusBar mode={mode} onModeChange={setMode} />
    </div>
  );
}
