import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import {
  RangeSet,
  RangeSetBuilder,
  StateField,
  EditorState,
  SelectionRange,
  StateEffect,
  EditorSelection,
} from "@codemirror/state";
import { SyntaxNodeRef } from "@lezer/common";
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

const setPointerActive = StateEffect.define<{
  active: boolean;
  selection: SelectionRange | null;
}>();

const setComposing = StateEffect.define<boolean>();

const pointerActiveField = StateField.define<{
  active: boolean;
  selection: SelectionRange | null;
}>({
  create: () => ({ active: false, selection: null }),
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setPointerActive)) return effect.value;
    }
    return value;
  },
});

const composingField = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setComposing)) return effect.value;
    }
    return value;
  },
});

const setFocused = StateEffect.define<boolean>();

const focusedField = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setFocused)) return effect.value;
    }
    return value;
  },
});

const focusPlugin = ViewPlugin.fromClass(
  class {
    mouseDown = false;

    constructor(public view: EditorView) {
      if (view.hasFocus) {
        view.dispatch({ effects: setFocused.of(true) });
      }
    }
  },
  {
    eventHandlers: {
      mousedown(_event, view) {
        const plugin = view.plugin(focusPlugin);
        if (plugin) plugin.mouseDown = true;
      },
      mouseup(_event, view) {
        const plugin = view.plugin(focusPlugin);
        if (plugin) {
          plugin.mouseDown = false;
          if (view.hasFocus) {
            view.dispatch({ effects: setFocused.of(true) });
          }
        }
      },
      focus(_event, view) {
        const plugin = view.plugin(focusPlugin);
        if (plugin?.mouseDown) return;
        view.dispatch({ effects: setFocused.of(true) });
      },
      blur(_event, view) {
        view.dispatch({ effects: setFocused.of(false) });
      },
    },
  }
);

const compositionPlugin = ViewPlugin.fromClass(
  class {
    constructor(public view: EditorView) {}
  },
  {
    eventHandlers: {
      compositionstart(_event, view) {
        view.dispatch({ effects: setComposing.of(true) });
      },
      compositionend(_event, view) {
        view.dispatch({ effects: setComposing.of(false) });
      },
    },
  }
);

const pointerInteractionPlugin = ViewPlugin.fromClass(
  class {
    constructor(public view: EditorView) {}
  },
  {
    eventHandlers: {
      mousedown(event, view) {
        if (event.button !== 0) return;

        view.dispatch({
          effects: setPointerActive.of({
            active: true,
            selection: view.state.selection.main,
          }),
        });

        const onUp = (e: Event) => {
          const sel = view.state.selection.main;
          let newSel = sel;

          const isCheckableAsClick =
            sel.empty || Math.abs(sel.to - sel.from) <= 2;

          if (e instanceof MouseEvent && isCheckableAsClick) {
            const pos = sel.from;
            const line = view.state.doc.lineAt(pos);
            try {
              const rect = view.coordsAtPos(pos);
              if (rect) {
                const endRect = view.coordsAtPos(line.to);
                if (endRect && pos < line.to) {
                  const isAtVisualEnd =
                    Math.abs(rect.left - endRect.left) < 1 &&
                    Math.abs(rect.top - endRect.top) < 1;
                  if (isAtVisualEnd && e.clientX > rect.right + 2) {
                    newSel = EditorSelection.cursor(line.to);
                  }
                }

                const startRect = view.coordsAtPos(line.from);
                if (startRect && pos > line.from) {
                  const isAtVisualStart =
                    Math.abs(rect.left - startRect.left) < 1 &&
                    Math.abs(rect.top - startRect.top) < 1;
                  if (isAtVisualStart && e.clientX < rect.left - 2) {
                    newSel = EditorSelection.cursor(line.from);
                  }
                }
              }
            } catch {}
          }

          if (newSel.empty && !sel.empty && !isCheckableAsClick) {
          } else if (!newSel.empty) {
            syntaxTree(view.state).iterate({
              from: newSel.from,
              to: newSel.to,
              enter: (node) => {
                const isLinkOrImage =
                  node.name === "Link" || node.name === "Image";
                const isFormatting = [
                  "Emphasis",
                  "StrongEmphasis",
                  "InlineCode",
                  "Strikethrough",
                ].includes(node.name);

                if (isLinkOrImage || isFormatting) {
                  const children = [];
                  let c = node.node.firstChild;
                  while (c) {
                    children.push(c);
                    c = c.nextSibling;
                  }

                  const firstMark = children.find((c) =>
                    c.name.endsWith("Mark")
                  );
                  let snapEndMark = null;

                  if (isLinkOrImage) {
                    snapEndMark = children.find(
                      (c) =>
                        c.name.endsWith("Mark") &&
                        view.state.doc.sliceString(c.from, c.to) === "]"
                    );
                  } else {
                    const marks = children.filter((c) =>
                      c.name.endsWith("Mark")
                    );
                    if (marks.length >= 2)
                      snapEndMark = marks[marks.length - 1];
                  }

                  if (firstMark && snapEndMark) {
                    let { from, to } = newSel;
                    let changed = false;

                    if (from >= node.from && from <= firstMark.to) {
                      from = node.from;
                      changed = true;
                    }
                    if (to >= snapEndMark.from && to <= node.to) {
                      if (from < snapEndMark.from || Math.abs(to - from) > 2) {
                        to = node.to;
                        changed = true;
                      }
                    }
                    if (changed) {
                      newSel = EditorSelection.range(from, to);
                    }
                  }
                  if (isLinkOrImage) return false;
                }
              },
            });
          }

          view.dispatch({
            effects: setPointerActive.of({ active: false, selection: null }),
            selection:
              newSel !== sel ? EditorSelection.create([newSel]) : undefined,
          });
          window.removeEventListener("mouseup", onUp);
          window.removeEventListener("blur", onUp);
        };

        window.addEventListener("mouseup", onUp);
        window.addEventListener("blur", onUp);
      },
    },
  }
);

function handleTable(
  node: SyntaxNodeRef,
  state: EditorState,
  builder: RangeSetBuilder<Decoration>
): number | null {
  if (node.name !== "Table") return null;

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
  return node.to;
}

function handleImage(
  node: SyntaxNodeRef,
  state: EditorState,
  selection: SelectionRange | null,
  builder: RangeSetBuilder<Decoration>
): number | null {
  if (node.name !== "Image") return null;

  const fullText = state.doc.sliceString(node.from, node.to);
  const match = fullText.match(/^!\[(.*?)\]\((.*?)\)$/);
  if (!match) return null;

  const alt = match[1];
  const url = match[2];

  if (!url || url.trim() === "") return null;

  const sourceMode = state.field(sourceModeImageField);
  const isEditing =
    sourceMode && node.from >= sourceMode.from && node.to <= sourceMode.to;

  const isCaretInside =
    selection &&
    selection.empty &&
    selection.from >= node.from &&
    selection.from < node.to;
  const isEntirelySelected =
    selection &&
    !selection.empty &&
    selection.from <= node.from &&
    selection.to >= node.to;

  const shouldShowSource = isEditing || isCaretInside || isEntirelySelected;

  const isSelectedForResize =
    selection &&
    ((selection.empty && selection.from === node.to) ||
      (!selection.empty &&
        selection.from <= node.from &&
        selection.to >= node.to));

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

  if (shouldShowSource) {
    builder.add(
      node.to,
      node.to,
      Decoration.widget({
        widget: new ImageWidget(
          url,
          displayAlt,
          width,
          node.from,
          node.to,
          isSelectedForResize ?? false
        ),
        block: true,
        side: 1,
      })
    );
    return node.to;
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
        isSelectedForResize ?? false
      ),
    })
  );
  return node.to;
}

function handleHorizontalRule(
  node: SyntaxNodeRef,
  selection: SelectionRange | null,
  builder: RangeSetBuilder<Decoration>
): number | null {
  if (node.name !== "HorizontalRule") return null;

  const isSelected =
    selection && selection.from <= node.to && selection.to >= node.from;
  if (!isSelected) {
    builder.add(node.from, node.to, hrDecoration);
    return node.to;
  }
  return null;
}

function handleLinkAndURL(
  node: SyntaxNodeRef,
  state: EditorState,
  selection: SelectionRange | null,
  linkBuilder: RangeSetBuilder<Decoration>
): void {
  if (
    node.name === "Link" ||
    (node.name === "URL" && node.node.parent?.name !== "Link")
  ) {
    const isSelected =
      selection && selection.from <= node.to && selection.to >= node.from;
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
}

function handleMarks(
  node: SyntaxNodeRef,
  state: EditorState,
  selection: SelectionRange | null,
  builder: RangeSetBuilder<Decoration>
): number | null {
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

  if (!marks.includes(node.name)) return null;

  const container = node.node.parent;
  if (!container) return null;

  const line = selection ? state.doc.lineAt(selection.from) : null;
  const isOnSameLine = line
    ? node.from >= line.from && node.to <= line.to
    : false;

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
    selection &&
    formattingContainers.includes(container.name) &&
    selection.from <= container.to &&
    selection.to >= container.from;

  const isSelected =
    selection &&
    (isInsideContainer ||
      (selection.from <= node.to && selection.to >= node.from) ||
      (isOnSameLine &&
        (node.name === "HeaderMark" ||
          node.name === "ListMark" ||
          node.name === "QuoteMark")));

  if (node.name === "HeaderMark") {
    return handleHeader(node, state, isSelected ?? false, builder);
  }

  if (node.name === "ListMark" || node.name === "TaskMarker") {
    const listResult = handleListAndTask(node, state, selection, builder);
    if (listResult !== null) return listResult;

    if (!isSelected) {
      return handleListFallback(node, state, builder);
    }
  }

  if (node.name === "CodeMark" || node.name === "CodeInfo") {
    return handleCodeMark(node, isSelected ?? false, builder);
  }

  if (
    node.name === "EmphasisMark" ||
    node.name === "StrongEmphasisMark" ||
    node.name === "StrikethroughMark"
  ) {
    return handleEmphasisMark(node, isSelected ?? false, builder);
  }

  if (!isSelected) {
    const markTo = node.to;
    if (node.name === "URL") {
      if (container.name === "Link") {
        builder.add(node.from, markTo, hideDecoration);
        return markTo;
      }
    } else {
      builder.add(node.from, markTo, hideDecoration);
      return markTo;
    }
  }

  return null;
}

function handleHeader(
  node: SyntaxNodeRef,
  state: EditorState,
  isSelected: boolean,
  builder: RangeSetBuilder<Decoration>
): number | null {
  if (!isSelected) {
    let markTo = node.to;
    const nextChar = state.doc.sliceString(node.to, node.to + 1);
    if (nextChar === " ") {
      markTo += 1;
    }
    builder.add(node.from, markTo, hideDecoration);
    return markTo;
  }
  return null;
}

function handleListFallback(
  node: SyntaxNodeRef,
  state: EditorState,
  builder: RangeSetBuilder<Decoration>
): number | null {
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
    return node.to;
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
    return node.to;
  }
  return null;
}

function handleCodeMark(
  node: SyntaxNodeRef,
  isSelected: boolean,
  builder: RangeSetBuilder<Decoration>
): number | null {
  if (!isSelected) {
    builder.add(node.from, node.to, hideDecoration);
    return node.to;
  }
  return null;
}

function handleEmphasisMark(
  node: SyntaxNodeRef,
  isSelected: boolean,
  builder: RangeSetBuilder<Decoration>
): number | null {
  if (!isSelected) {
    builder.add(node.from, node.to, hideDecoration);
    return node.to;
  }
  return null;
}

function handleListAndTask(
  node: SyntaxNodeRef,
  state: EditorState,
  selection: SelectionRange | null,
  builder: RangeSetBuilder<Decoration>
): number | null {
  const line = state.doc.lineAt(node.from);
  const lineText = line.text;
  const isTaskList = /^[-*+]\s+\[[ xX]\]/.test(lineText.trim());

  if (isTaskList) {
    const taskMatch = lineText.match(/\[[ xX]\]/);
    if (taskMatch) {
      const taskStart = line.from + lineText.indexOf(taskMatch[0]);
      const taskEnd = taskStart + taskMatch[0].length;

      const isTaskSelected =
        selection && selection.from <= taskEnd && selection.to >= taskStart;

      if (isTaskSelected) {
        return null;
      }

      if (node.name === "ListMark") {
        let markTo = node.to;
        if (state.doc.sliceString(node.to, node.to + 1) === " ") {
          markTo++;
        }
        builder.add(node.from, markTo, hideDecoration);
        return markTo;
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
        return node.to;
      }
    }
  }
  return null;
}

function computeDecorations(state: EditorState) {
  const interaction = state.field(pointerActiveField);
  const focused = state.field(focusedField);
  const builder = new RangeSetBuilder<Decoration>();
  const linkBuilder = new RangeSetBuilder<Decoration>();
  const selection =
    interaction.active && focused
      ? interaction.selection
      : focused
        ? state.selection.main
        : null;
  let lastPos = -1;

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter: (node) => {
      if (node.from < lastPos) return;

      const tablePos = handleTable(node, state, builder);
      if (tablePos !== null) {
        lastPos = tablePos;
        return;
      }

      const imagePos = handleImage(node, state, selection, builder);
      if (imagePos !== null) {
        lastPos = imagePos;
        return;
      }

      const hrPos = handleHorizontalRule(node, selection, builder);
      if (hrPos !== null) {
        lastPos = hrPos;
        return;
      }

      handleLinkAndURL(node, state, selection, linkBuilder);

      const markPos = handleMarks(node, state, selection, builder);
      if (markPos !== null) {
        lastPos = markPos;
        return;
      }
    },
  });
  return RangeSet.join([builder.finish(), linkBuilder.finish()]);
}

const livePreviewStateField = StateField.define<DecorationSet>({
  create(state) {
    return computeDecorations(state);
  },
  update(decorations, tr) {
    const isComposing = tr.state.field(composingField);
    if (isComposing) {
      return decorations.map(tr.changes);
    }
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
        if (link && event.button === 0 && !event.altKey) {
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

export const livePreviewPlugin = [
  pointerActiveField,
  composingField,
  focusedField,
  pointerInteractionPlugin,
  compositionPlugin,
  focusPlugin,
  livePreviewStateField,
];
