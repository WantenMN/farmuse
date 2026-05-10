import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { setHoveredLine, hoveredLineField } from "./state";

export const hoverPlugin = EditorView.domEventHandlers({
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

export const gutterHoverPlugin = ViewPlugin.fromClass(
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
