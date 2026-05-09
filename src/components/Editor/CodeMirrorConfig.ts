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
  bracketMatching,
  HighlightStyle,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { closeBrackets } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";

export const markdownHighlightStyle = HighlightStyle.define([
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

export const editorTheme = EditorView.theme({
  "&": { height: "100%", width: "100%", backgroundColor: "transparent" },
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
    justifySelf: "flex-end",
  },
  ".cm-line": {
    paddingLeft: "0.5rem",
    paddingRight: "0.5rem",
    fontSize: "0.875rem",
    lineHeight: "1.625",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
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
});

export const getDefaultExtensions = (
  onDocChange: (newContent: string, view: EditorView) => void
) => [
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
      onDocChange(update.state.doc.toString(), update.view);
    }
  }),
  editorTheme,
];
