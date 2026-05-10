import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import {
  RangeSet,
  RangeSetBuilder,
  StateField,
  EditorState,
} from "@codemirror/state";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  BulletWidget,
  HRWidget,
  ImageWidget,
  NumberWidget,
  TableWidget,
  TaskWidget,
} from "./widgets";
import { sourceModeImageField } from "./state";

const hideDecoration = Decoration.replace({});
const hrDecoration = Decoration.replace({
  widget: new HRWidget(),
});

function computeDecorations(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>();
  const linkBuilder = new RangeSetBuilder<Decoration>();
  const selection = state.selection.main;
  let lastPos = -1;

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter: (node) => {
      if (node.from < lastPos) return;

      if (node.name === "Table") {
        const line = state.doc.lineAt(node.from);
        const tableText = state.doc.sliceString(node.from, node.to);
        builder.add(
          line.from,
          node.to,
          Decoration.replace({
            widget: new TableWidget(tableText, line.from, node.to),
            block: true,
          })
        );
        lastPos = node.to;
        return;
      }

      if (node.name === "Image") {
        const sourceMode = state.field(sourceModeImageField);
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

        const fullText = state.doc.sliceString(node.from, node.to);
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
          lastPos = node.to;
        }
        return;
      }

      // Handle Link and Bare URL decorations (pointer cursor, click target)
      if (
        node.name === "Link" ||
        (node.name === "URL" && node.node.parent?.name !== "Link")
      ) {
        const isSelected =
          selection.from <= node.to && selection.to >= node.from;
        if (!isSelected) {
          let url = "";
          if (node.name === "Link") {
            const urlNode = node.node.getChild("URL");
            if (urlNode) {
              url = state.doc
                .sliceString(urlNode.from, urlNode.to)
                .replace(/^\((.*)\)$/, "$1");
            }
          } else {
            url = state.doc.sliceString(node.from, node.to);
          }

          if (url) {
            linkBuilder.add(
              node.from,
              node.to,
              Decoration.mark({
                attributes: {
                  class: "cm-link",
                  "data-url": url,
                  title: url,
                },
              })
            );
          }
        }
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
          const line = state.doc.lineAt(selection.from);
          const isOnSameLine = node.from >= line.from && node.to <= line.to;

          const formattingContainers = [
            "Emphasis",
            "StrongEmphasis",
            "InlineCode",
            "Strikethrough",
            "Link",
            "Image",
            "FencedCode",
          ];

          const isInsideContainer =
            formattingContainers.includes(container.name) &&
            selection.from <= container.to &&
            selection.to >= container.from;

          const isSelected =
            (isOnSameLine && container.name !== "Link") ||
            isInsideContainer ||
            (selection.from <= node.to && selection.to >= node.from);

          if (node.name === "ListMark" || node.name === "TaskMarker") {
            const line = state.doc.lineAt(node.from);
            const lineText = line.text;
            const isTaskList = /^[-*+]\s+\[[ xX]\]/.test(lineText.trim());

            if (isTaskList) {
              const taskMatch = lineText.match(/\[[ xX]\]/);
              if (taskMatch) {
                const taskStart = line.from + lineText.indexOf(taskMatch[0]);
                const taskEnd = taskStart + taskMatch[0].length;

                const isTaskSelected =
                  selection.from <= taskEnd && selection.to >= taskStart;

                if (isTaskSelected) {
                  return;
                }

                if (node.name === "ListMark") {
                  let markTo = node.to;
                  if (state.doc.sliceString(node.to, node.to + 1) === " ") {
                    markTo++;
                  }
                  builder.add(node.from, markTo, hideDecoration);
                  lastPos = markTo;
                  return;
                }

                if (node.name === "TaskMarker") {
                  const text = state.doc.sliceString(node.from, node.to);
                  const checked = text.includes("x") || text.includes("X");
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
              const nextChar = state.doc.sliceString(node.to, node.to + 1);
              if (nextChar === " ") {
                markTo += 1;
              }
            }

            if (node.name === "ListMark") {
              const text = state.doc.sliceString(node.from, node.to);
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
              lastPos = node.to;
            } else if (node.name === "TaskMarker") {
              const text = state.doc.sliceString(node.from, node.to);
              const checked = text.includes("x") || text.includes("X");
              builder.add(
                node.from,
                node.to,
                Decoration.replace({
                  widget: new TaskWidget(checked, node.from, node.to),
                })
              );
              lastPos = node.to;
            } else if (node.name === "URL") {
              if (container.name === "Link") {
                // Hide the URL part of a [text](url) link
                builder.add(node.from, markTo, hideDecoration);
                lastPos = markTo;
              }
              // Bare URLs are handled by the .cm-link mark above and should remain visible
            } else {
              builder.add(node.from, markTo, hideDecoration);
              lastPos = markTo;
            }
          }
        }
      }
    },
  });
  return RangeSet.join([builder.finish(), linkBuilder.finish()]);
}

export const livePreviewPlugin = StateField.define<DecorationSet>({
  create(state) {
    return computeDecorations(state);
  },
  update(decorations, tr) {
    if (tr.docChanged || tr.selection || tr.effects.length > 0) {
      return computeDecorations(tr.state);
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => [
    EditorView.decorations.from(f),
    EditorView.domEventHandlers({
      mousedown: (event, _view) => {
        const target = event.target as HTMLElement;
        const link = target.closest(".cm-link");
        if (link && event.button === 0) {
          const url = link.getAttribute("data-url");
          if (url) {
            openUrl(url).catch(console.error);
            return true;
          }
        }
        return false;
      },
    }),
  ],
});
