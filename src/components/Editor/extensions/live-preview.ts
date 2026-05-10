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

/**
 * State and Effect to track active pointer (mouse) interaction.
 * This is used to suppress source-mode rendering during selection dragging,
 * providing a stable preview and avoiding layout shifts.
 */
const setPointerActive = StateEffect.define<{
  active: boolean;
  selection: SelectionRange | null;
}>();

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

/**
 * Robustly tracks pointer down/up states across the entire window.
 */
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

        const onUp = () => {
          const sel = view.state.selection.main;
          let newSel = sel;

          // Essential fix: If a link is selected in preview mode, expand the selection
          // to include hidden source markers once pointer is released.
          if (!sel.empty) {
            syntaxTree(view.state).iterate({
              from: sel.from,
              to: sel.to,
              enter: (node) => {
                if (node.name === "Link") {
                  const firstMark = node.node.firstChild;
                  if (firstMark && firstMark.name === "LinkMark") {
                    let secondMark = null;
                    let child = firstMark.nextSibling;
                    while (child) {
                      if (child.name === "LinkMark") {
                        secondMark = child;
                        break;
                      }
                      child = child.nextSibling;
                    }

                    if (secondMark) {
                      let from = sel.from;
                      let to = sel.to;
                      if (from === firstMark.to) from = node.from;
                      if (to === secondMark.from) to = node.to;

                      if (from !== sel.from || to !== sel.to) {
                        newSel = EditorSelection.range(from, to);
                      }
                    }
                  }
                  return false;
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

/**
 * Handle Table rendering
 */
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

/**
 * Handle Image rendering and source mode toggle
 */
function handleImage(
  node: SyntaxNodeRef,
  state: EditorState,
  selection: SelectionRange | null,
  builder: RangeSetBuilder<Decoration>
): number | null {
  if (node.name !== "Image") return null;

  const sourceMode = state.field(sourceModeImageField);
  if (sourceMode && node.from >= sourceMode.from && node.to <= sourceMode.to) {
    return node.to;
  }

  const isSelected =
    selection && selection.from <= node.to && selection.to >= node.from;

  const fullText = state.doc.sliceString(node.from, node.to);
  const match = fullText.match(/^!\[(.*?)\]\((.*?)\)$/);
  if (!match) return null;

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
        isSelected ?? false
      ),
    })
  );
  return node.to;
}

/**
 * Handle Horizontal Rule rendering
 */
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

/**
 * Handle Link and URL decorations (mark as clickable)
 */
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

/**
 * Common marks handling (Header, Emphasis, List, etc.)
 */
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

  // 1. Handle Headings
  if (node.name === "HeaderMark") {
    return handleHeader(node, state, isSelected ?? false, builder);
  }

  // 2. Handle Lists and Tasks
  if (node.name === "ListMark" || node.name === "TaskMarker") {
    const listResult = handleListAndTask(node, state, selection, builder);
    if (listResult !== null) return listResult;

    if (!isSelected) {
      return handleListFallback(node, state, builder);
    }
  }

  // 3. Handle Code marks
  if (node.name === "CodeMark" || node.name === "CodeInfo") {
    return handleCodeMark(node, isSelected ?? false, builder);
  }

  // 4. Handle Emphasis marks
  if (
    node.name === "EmphasisMark" ||
    node.name === "StrongEmphasisMark" ||
    node.name === "StrikethroughMark"
  ) {
    return handleEmphasisMark(node, isSelected ?? false, builder);
  }

  // 5. Handle Other marks (Quote, Link, etc.)
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

/**
 * Handle Header markers
 */
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

/**
 * Fallback for ListMark if not a task list or task not handled
 */
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

/**
 * Handle Code marks
 */
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

/**
 * Handle Emphasis marks
 */
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

/**
 * Handle List markers and Task checkboxes
 */
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
  const builder = new RangeSetBuilder<Decoration>();
  const linkBuilder = new RangeSetBuilder<Decoration>();
  const selection = interaction.active
    ? interaction.selection
    : state.selection.main;
  let lastPos = -1;

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter: (node) => {
      if (node.from < lastPos) return;

      // Try Table
      const tablePos = handleTable(node, state, builder);
      if (tablePos !== null) {
        lastPos = tablePos;
        return;
      }

      // Try Image
      const imagePos = handleImage(node, state, selection, builder);
      if (imagePos !== null) {
        lastPos = imagePos;
        return;
      }

      // Try Horizontal Rule
      const hrPos = handleHorizontalRule(node, selection, builder);
      if (hrPos !== null) {
        lastPos = hrPos;
        return;
      }

      // Handle Link/URL marks
      handleLinkAndURL(node, state, selection, linkBuilder);

      // Handle common marks (Header, List, etc.)
      const markPos = handleMarks(node, state, selection, builder);
      if (markPos !== null) {
        lastPos = markPos;
        return;
      }
    },
  });
  return RangeSet.join([builder.finish(), linkBuilder.finish()]);
}

/**
 * The main Live Preview plugin extension.
 * Consists of the interaction tracker, state field, and the decoration logic.
 */
const livePreviewStateField = StateField.define<DecorationSet>({
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

export const livePreviewPlugin = [
  pointerActiveField,
  pointerInteractionPlugin,
  livePreviewStateField,
];
