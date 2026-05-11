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

        const onUp = (e: Event) => {
          const sel = view.state.selection.main;
          let newSel = sel;

          // Handle clicks on empty space around rendered content
          // We allow a tiny tolerance (2 chars) for accidental micro-drags during click
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
            } catch {
              // Ignore errors during potential rapid re-renders
            }
          }

          // If we didn't jump to end/start, and we have a real selection, do snapping
          if (newSel.empty && !sel.empty && !isCheckableAsClick) {
            // Skip snap if we already decided to cursor-jump
          } else if (!newSel.empty) {
            // Snap selection to hidden markers for links, images, and formatting
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

                    // If selection starts within the leading markers, snap to node start
                    if (from >= node.from && from <= firstMark.to) {
                      from = node.from;
                      changed = true;
                    }
                    // If selection ends within or after the trailing hidden markers, snap to node end
                    if (to >= snapEndMark.from && to <= node.to) {
                      // Only snap if we've actually selected some content or it's a deliberate wide selection
                      // This prevents accidental 1px drags from highlighting the trailing stars
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
  pointerInteractionPlugin,
  compositionPlugin,
  livePreviewStateField,
];
