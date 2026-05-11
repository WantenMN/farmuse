import { renderToStaticMarkup } from "react-dom/server";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  EditorView,
  lineNumbers,
  dropCursor,
  highlightActiveLine,
  keymap,
} from "@codemirror/view";
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { closeBrackets } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";

import { markdownHighlightStyle, getEditorTheme } from "./extensions/theme";
import { blockDecorationsPlugin } from "./extensions/block-decorations";
import { hoveredLineField, sourceModeImageField } from "./extensions/state";
import { hoverPlugin, gutterHoverPlugin } from "./extensions/hover";
import { livePreviewPlugin } from "./extensions/live-preview";

export { getEditorTheme, markdownHighlightStyle };

export const getDefaultExtensions = (
  onDocChange: (newContent: string, view: EditorView) => void,
  mode: "source" | "live" = "source",
  fontSize: number = 18,
  showLineNumbers: boolean = true
) => {
  const extensions = [
    history(),
    foldGutter({
      markerDOM: (open) => {
        const iconContainer = document.createElement("div");
        iconContainer.className = "cm-fold-marker";
        iconContainer.innerHTML = renderToStaticMarkup(
          open ? (
            <ChevronDown size={14} strokeWidth={2.5} />
          ) : (
            <ChevronRight size={14} strokeWidth={2.5} />
          )
        );
        return iconContainer;
      },
    }),
    dropCursor(),
    indentOnInput(),
    syntaxHighlighting(markdownHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    closeBrackets(),
    highlightActiveLine(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown({ extensions: [GFM] }),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onDocChange(update.state.doc.toString(), update.view);
      }
    }),
    getEditorTheme(fontSize),
    EditorView.editorAttributes.of({
      class: mode === "live" ? "cm-mode-live" : "cm-mode-source",
    }),
    blockDecorationsPlugin,
    hoveredLineField,
    sourceModeImageField,
    hoverPlugin,
    gutterHoverPlugin,
  ];

  if (showLineNumbers) {
    extensions.push(lineNumbers());
  }

  if (mode === "live") {
    extensions.push(livePreviewPlugin);
  }

  return extensions;
};
