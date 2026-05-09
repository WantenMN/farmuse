import {
  EditorView,
  lineNumbers,
  dropCursor,
  highlightActiveLine,
  keymap,
  Decoration,
  ViewPlugin,
  DecorationSet,
  ViewUpdate,
} from "@codemirror/view";
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  HighlightStyle,
  syntaxTree,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { closeBrackets } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { RangeSetBuilder } from "@codemirror/state";

export const markdownHighlightStyle = HighlightStyle.define([
  {
    tag: t.heading1,
    fontSize: "1.875rem",
    fontWeight: "700",
    color: "var(--foreground)",
  },
  {
    tag: t.heading2,
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "var(--foreground)",
  },
  {
    tag: t.heading3,
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "var(--foreground)",
  },
  {
    tag: t.heading4,
    fontSize: "1.125rem",
    fontWeight: "600",
    color: "var(--foreground)",
  },
  {
    tag: t.heading5,
    fontSize: "1rem",
    fontWeight: "600",
    color: "var(--foreground)",
  },
  {
    tag: t.heading6,
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "var(--foreground)",
  },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.link, color: "var(--primary)", textDecoration: "underline" },
  { tag: t.url, color: "var(--muted-foreground)" },
  {
    tag: t.monospace,
    color: "var(--foreground)",
    backgroundColor: "var(--muted)",
    borderRadius: "4px",
  },
]);

const hideDecoration = Decoration.replace({});
const codeBlockLineDecoration = Decoration.line({
  class: "cm-code-block-line",
});

const codeBlockPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.computeLineDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.geometryChanged
      ) {
        this.decorations = this.computeLineDecorations(update.view);
      }
    }

    computeLineDecorations(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const doc = view.state.doc;
      let lastAddedLine = -1;

      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.name === "FencedCode") {
              const startLine = doc.lineAt(Math.max(node.from, from)).number;
              const endLine = doc.lineAt(Math.min(node.to, to)).number;

              for (let i = startLine; i <= endLine; i++) {
                if (i <= lastAddedLine) continue;
                const line = doc.line(i);
                builder.add(line.from, line.from, codeBlockLineDecoration);
                lastAddedLine = i;
              }
            }
          },
        });
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.computeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        update.geometryChanged
      ) {
        this.decorations = this.computeDecorations(update.view);
      }
    }

    computeDecorations(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const selection = view.state.selection.main;
      let lastPos = -1;

      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.from < from || node.from < lastPos) return;

            const marks = [
              "HeaderMark",
              "EmphasisMark",
              "StrongEmphasisMark",
              "ListMark",
              "QuoteMark",
              "LinkMark",
              "CodeMark",
              "URL",
              "StrikethroughMark",
              "ImageMark",
              "CodeInfo",
            ];

            if (marks.includes(node.name)) {
              const container = node.node.parent;
              if (container) {
                const isSelected =
                  selection.from <= container.to &&
                  selection.to >= container.from;

                if (!isSelected) {
                  builder.add(node.from, node.to, hideDecoration);
                  lastPos = node.from;
                }
              }
            }
          },
        });
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export const editorTheme = EditorView.theme({
  "&": { height: "100%", width: "100%", backgroundColor: "transparent" },
  ".cm-scroller": {
    display: "grid !important",
    gridTemplateColumns: "1fr minmax(0, 48rem) 1fr",
    width: "100%",
    overflow: "auto",
    fontFamily:
      "var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif)",
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
  ".cm-line": {
    paddingLeft: "0.5rem",
    paddingRight: "0.5rem",
    fontSize: "1rem",
    lineHeight: "1.75",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
    opacity: "1",
  },
  ".cm-code-block-line": {
    backgroundColor: "var(--muted)",
  },
});

export const getDefaultExtensions = (
  onDocChange: (newContent: string, view: EditorView) => void,
  mode: "source" | "live" = "source"
) => {
  const extensions = [
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
    codeBlockPlugin,
  ];

  if (mode === "live") {
    extensions.push(livePreviewPlugin);
  }

  return extensions;
};
