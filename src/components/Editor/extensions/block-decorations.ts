import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";

const codeBlockLineDecoration = Decoration.line({
  class: "cm-code-block-line",
});
const blockquoteLineDecoration = Decoration.line({
  class: "cm-blockquote-line",
});

export const blockDecorationsPlugin = ViewPlugin.fromClass(
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
      const lines = new Map<number, { code?: boolean; quote?: boolean }>();

      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.name === "FencedCode" || node.name === "Blockquote") {
              const startLine = doc.lineAt(Math.max(node.from, from)).number;
              const endLine = doc.lineAt(Math.min(node.to, to)).number;

              for (let i = startLine; i <= endLine; i++) {
                let info = lines.get(i);
                if (!info) {
                  info = {};
                  lines.set(i, info);
                }
                if (node.name === "FencedCode") info.code = true;
                if (node.name === "Blockquote") info.quote = true;
              }
            }
          },
        });
      }

      const sortedLineNums = Array.from(lines.keys()).sort((a, b) => a - b);
      for (const lineNum of sortedLineNums) {
        const line = doc.line(lineNum);
        const info = lines.get(lineNum)!;
        if (info.code) {
          builder.add(line.from, line.from, codeBlockLineDecoration);
        }
        if (info.quote) {
          builder.add(line.from, line.from, blockquoteLineDecoration);
        }
      }
      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
