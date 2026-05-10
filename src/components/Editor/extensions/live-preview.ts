import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  BulletWidget,
  HRWidget,
  ImageWidget,
  NumberWidget,
  TaskWidget,
} from "./widgets";
import { sourceModeImageField } from "./state";

const hideDecoration = Decoration.replace({});
const hrDecoration = Decoration.replace({
  widget: new HRWidget(),
});

export const livePreviewPlugin = ViewPlugin.fromClass(
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

            if (node.name === "Image") {
              const sourceMode = view.state.field(sourceModeImageField);
              // Check for overlap to be more robust than exact match
              if (
                sourceMode &&
                node.from >= sourceMode.from &&
                node.to <= sourceMode.to
              ) {
                lastPos = node.to;
                return;
              }

              const isSelected =
                selection.from <= node.to && selection.to >= node.from;

              const fullText = view.state.doc.sliceString(node.from, node.to);
              const match = fullText.match(/^!\[(.*?)\]\((.*?)\)$/);
              if (!match) return;

              const alt = match[1];
              const url = match[2];

              let width: number | null = null;
              let displayAlt = alt;

              if (alt.includes("|")) {
                const parts = alt.split("|");
                displayAlt = parts[0];
                const w = parseInt(parts[1].trim());
                if (!isNaN(w)) width = w;
              } else if (/^\d+$/.test(alt.trim())) {
                width = parseInt(alt.trim());
                displayAlt = "";
              }

              builder.add(
                node.from,
                node.to,
                Decoration.replace({
                  widget: new ImageWidget(
                    url,
                    displayAlt,
                    width,
                    node.from,
                    node.to,
                    isSelected
                  ),
                })
              );
              lastPos = node.to;
              return;
            }

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
              "TaskMarker",
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

                if (node.name === "ListMark" || node.name === "TaskMarker") {
                  const line = view.state.doc.lineAt(node.from);
                  const lineText = line.text;
                  const isTaskList = /^[-*+]\s+\[[ xX]\]/.test(lineText.trim());

                  if (isTaskList) {
                    const taskMatch = lineText.match(/\[[ xX]\]/);
                    if (taskMatch) {
                      const taskStart =
                        line.from + lineText.indexOf(taskMatch[0]);
                      const taskEnd = taskStart + taskMatch[0].length;

                      const isTaskSelected =
                        selection.from <= taskEnd && selection.to >= taskStart;

                      if (isTaskSelected) {
                        lastPos = node.to;
                        return;
                      }

                      if (node.name === "ListMark") {
                        let markTo = node.to;
                        if (
                          view.state.doc.sliceString(node.to, node.to + 1) ===
                          " "
                        ) {
                          markTo++;
                        }
                        builder.add(node.from, markTo, hideDecoration);
                        lastPos = markTo;
                        return;
                      }

                      if (node.name === "TaskMarker") {
                        const text = view.state.doc.sliceString(
                          node.from,
                          node.to
                        );
                        const checked =
                          text.includes("x") || text.includes("X");
                        builder.add(
                          node.from,
                          node.to,
                          Decoration.replace({
                            widget: new TaskWidget(checked, node.from, node.to),
                          })
                        );
                        lastPos = node.to;
                        return;
                      }
                    }
                  }
                }

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
                  } else if (node.name === "TaskMarker") {
                    const text = view.state.doc.sliceString(node.from, node.to);
                    const checked = text.includes("x") || text.includes("X");
                    builder.add(
                      node.from,
                      node.to,
                      Decoration.replace({
                        widget: new TaskWidget(checked, node.from, node.to),
                      })
                    );
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
