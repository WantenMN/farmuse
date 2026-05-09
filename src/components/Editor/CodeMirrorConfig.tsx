import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChevronRight, ChevronDown } from "lucide-react";
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
  WidgetType,
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
import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";

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

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.textContent = "•";
    return span;
  }
}

class NumberWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-number";
    span.textContent = this.text;
    return span;
  }
}

class HRWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("span");
    hr.className = "cm-hr";
    return hr;
  }
}

const hrDecoration = Decoration.replace({
  widget: new HRWidget(),
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

const setHoveredLine = StateEffect.define<number | null>();
const hoveredLineField = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHoveredLine)) return effect.value;
    }
    return value;
  },
});

const hoverPlugin = EditorView.domEventHandlers({
  mousemove(event, view) {
    const rect = view.contentDOM.getBoundingClientRect();
    // Check vertical position relative to the center of the content to be more robust
    const x = rect.left + rect.width / 2;
    const pos = view.posAtCoords({ x, y: event.clientY });

    if (pos !== null) {
      try {
        const line = view.state.doc.lineAt(pos).number;
        if (view.state.field(hoveredLineField) !== line) {
          view.dispatch({ effects: setHoveredLine.of(line) });
        }
      } catch {
        // Position might be out of bounds
      }
    } else {
      if (view.state.field(hoveredLineField) !== null) {
        view.dispatch({ effects: setHoveredLine.of(null) });
      }
    }
  },
  mouseleave(_event, view) {
    view.dispatch({ effects: setHoveredLine.of(null) });
  },
});

const gutterHoverPlugin = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.startState.field(hoveredLineField) !==
          update.state.field(hoveredLineField)
      ) {
        this.apply(update.view);
      }
    }

    apply(view: EditorView) {
      const hoveredLineNum = view.state.field(hoveredLineField);
      const foldGutter = view.dom.querySelector(".cm-foldGutter");
      if (!foldGutter) return;

      const gutterElements = foldGutter.querySelectorAll(".cm-gutterElement");

      // Reset all
      gutterElements.forEach((el) => el.classList.remove("cm-hovered-gutter"));

      if (hoveredLineNum !== null) {
        try {
          const line = view.state.doc.line(hoveredLineNum);
          const lineBlock = view.lineBlockAt(line.from);
          // Find the gutter element at the same vertical position
          for (const el of gutterElements) {
            const htmlEl = el as HTMLElement;
            if (Math.abs(htmlEl.offsetTop - lineBlock.top) < 2) {
              htmlEl.classList.add("cm-hovered-gutter");
              break;
            }
          }
        } catch {
          // Line might not be in doc anymore
        }
      }
    }
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

            if (node.name === "HorizontalRule") {
              const isSelected =
                selection.from <= node.to && selection.to >= node.from;
              if (!isSelected) {
                builder.add(node.from, node.to, hrDecoration);
                lastPos = node.from;
              }
              return;
            }

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
                  let markTo = node.to;
                  if (node.name === "HeaderMark") {
                    const nextChar = view.state.doc.sliceString(
                      node.to,
                      node.to + 1
                    );
                    if (nextChar === " ") {
                      markTo += 1;
                    }
                  }

                  if (node.name === "ListMark") {
                    const text = view.state.doc.sliceString(node.from, node.to);
                    if (/[0-9]/.test(text)) {
                      builder.add(
                        node.from,
                        node.to,
                        Decoration.replace({
                          widget: new NumberWidget(text),
                        })
                      );
                    } else {
                      builder.add(
                        node.from,
                        node.to,
                        Decoration.replace({
                          widget: new BulletWidget(),
                        })
                      );
                    }
                  } else {
                    builder.add(node.from, markTo, hideDecoration);
                  }
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
    opacity: "0.8",
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
    lineHeight: "1.75rem",
  },
  ".cm-gutterElement": {
    fontSize: "0.8125rem",
    lineHeight: "1.75rem",
    display: "flex",
    alignItems: "flex-start",
    padding: "0 8px 0 16px",
    justifyContent: "flex-end",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
    opacity: "1",
  },
  ".cm-activeLineGutter .cm-fold-marker": {
    opacity: "1",
    color: "var(--foreground)",
  },
  ".cm-hovered-gutter .cm-fold-marker": {
    opacity: "0.5",
  },
  ".cm-foldGutter .cm-gutterElement": {
    padding: "0 4px",
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  ".cm-fold-marker": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "1.75rem",
    opacity: "0",
    transition: "opacity 0.2s, color 0.2s",
  },
  ".cm-gutters:hover .cm-fold-marker": {
    opacity: "0.5",
  },
  ".cm-fold-marker:hover": {
    opacity: "1 !important",
    color: "var(--foreground)",
  },
  ".cm-code-block-line": {
    backgroundColor: "var(--muted)",
  },
  ".cm-hr": {
    display: "inline-block",
    verticalAlign: "middle",
    borderTop: "2px solid var(--border)",
    width: "100%",
    height: "0",
    pointerEvents: "none",
  },
  ".cm-list-bullet": {
    color: "var(--primary)",
    fontWeight: "bold",
  },
  ".cm-list-number": {
    color: "var(--muted-foreground)",
  },
});

export const getDefaultExtensions = (
  onDocChange: (newContent: string, view: EditorView) => void,
  mode: "source" | "live" = "source"
) => {
  const extensions = [
    lineNumbers(),
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
    hoveredLineField,
    hoverPlugin,
    gutterHoverPlugin,
  ];

  if (mode === "live") {
    extensions.push(livePreviewPlugin);
  }

  return extensions;
};
