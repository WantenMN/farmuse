import { EditorView, WidgetType } from "@codemirror/view";
import { setSourceModeImage } from "./state";

export class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.textContent = "•";
    return span;
  }
}

export class NumberWidget extends WidgetType {
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

export class HRWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("span");
    hr.className = "cm-hr";
    return hr;
  }
}

export class TaskWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number
  ) {
    super();
  }

  eq(other: TaskWidget) {
    return (
      other.checked === this.checked &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    span.className = "cm-task-checkbox";
    if (this.checked) {
      span.classList.add("cm-task-checkbox-checked");
    }

    span.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newText = this.checked ? "[ ]" : "[x]";
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: newText },
      });
    };

    return span;
  }
}

export class ImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
    readonly width: number | null,
    readonly from: number,
    readonly to: number,
    readonly isSelected: boolean
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return (
      other.url === this.url &&
      other.alt === this.alt &&
      other.width === this.width &&
      other.from === this.from &&
      other.to === this.to &&
      other.isSelected === this.isSelected
    );
  }

  toDOM(view: EditorView) {
    const container = document.createElement("div");
    container.className =
      "cm-image-container relative inline-block leading-none cursor-pointer";
    if (this.isSelected) {
      container.classList.add("cm-image-selected");
    }

    const img = document.createElement("img");
    img.src = this.url;
    img.alt = this.alt;
    img.draggable = false;
    img.className = "block max-w-full h-auto rounded-sm";

    const minWidth = 30;
    const maxWidth = view.contentDOM.clientWidth || 800;

    if (this.width) {
      let w = this.width;
      if (w < minWidth) w = minWidth;
      if (w > maxWidth) w = maxWidth;
      img.style.width = `${w}px`;
    } else {
      img.style.width = "100%";
    }

    container.appendChild(img);

    container.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        selection: { anchor: this.from, head: this.to },
      });
    };

    container.ondblclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        effects: setSourceModeImage.of({ from: this.from, to: this.to }),
        selection: { anchor: this.from, head: this.from },
      });
    };

    container.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Ensure the image is selected when right-clicking to have a consistent state
      view.dispatch({
        selection: { anchor: this.from, head: this.to },
      });

      document.querySelectorAll(".cm-image-menu").forEach((el) => el.remove());

      const menu = document.createElement("div");
      menu.className =
        "cm-image-menu fixed bg-popover text-popover-foreground border rounded-md shadow-md py-1 z-[100] text-sm min-w-[120px]";
      menu.style.left = `${e.clientX}px`;
      menu.style.top = `${e.clientY}px`;
      menu.style.backgroundColor = "var(--popover)";
      menu.style.color = "var(--popover-foreground)";
      menu.style.borderColor = "var(--border)";

      const resetItem = document.createElement("div");
      resetItem.className = "px-3 py-1.5 hover:bg-accent cursor-pointer";
      resetItem.textContent = "Reset size";
      resetItem.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.updateImage(view, this.alt, null);
        menu.remove();
      };

      const editSourceItem = document.createElement("div");
      editSourceItem.className = "px-3 py-1.5 hover:bg-accent cursor-pointer";
      editSourceItem.textContent = "Edit source";
      editSourceItem.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        view.dispatch({
          effects: setSourceModeImage.of({ from: this.from, to: this.to }),
          selection: { anchor: this.from, head: this.from },
        });
        menu.remove();
      };

      menu.appendChild(resetItem);
      menu.appendChild(editSourceItem);
      document.body.appendChild(menu);

      const closeMenu = () => {
        menu.remove();
        document.removeEventListener("mousedown", closeMenu);
      };
      setTimeout(() => document.addEventListener("mousedown", closeMenu), 0);
    };

    if (this.isSelected) {
      const handle = document.createElement("div");
      handle.className = "cm-image-resize-handle";
      container.appendChild(handle);

      handle.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidth = img.clientWidth;

        const onMouseMove = (e: MouseEvent) => {
          const deltaX = e.clientX - startX;
          let newWidth = startWidth + deltaX;
          if (newWidth < minWidth) newWidth = minWidth;
          if (newWidth > maxWidth) newWidth = maxWidth;
          img.style.width = `${newWidth}px`;
        };

        const onMouseUp = (e: MouseEvent) => {
          const deltaX = e.clientX - startX;
          let newWidth = startWidth + deltaX;
          if (newWidth < minWidth) newWidth = minWidth;
          if (newWidth > maxWidth) newWidth = maxWidth;

          this.updateImage(view, this.alt, Math.round(newWidth));

          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      };
    }

    return container;
  }

  updateImage(view: EditorView, alt: string, width: number | null) {
    let altContent = alt;
    if (width !== null) {
      altContent = alt ? `${alt}|${width}` : `${width}`;
    }

    const newText = `![${altContent}](${this.url})`;
    view.dispatch({
      changes: { from: this.from, to: this.to, insert: newText },
      selection: { anchor: this.from, head: this.from + newText.length },
    });
  }
}

export class TableWidget extends WidgetType {
  constructor(
    readonly content: string,
    readonly from: number,
    readonly to: number
  ) {
    super();
  }

  get estimatedHeight() {
    const lines = this.content.split("\n").length;
    return Math.max(lines * 35, 40);
  }

  eq(other: TableWidget) {
    return (
      other.content === this.content &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  toDOM(view: EditorView) {
    const container = document.createElement("div");
    container.className = "cm-table-container";

    const lines = this.content.split("\n");
    const table = document.createElement("table");
    table.className = "cm-table";

    let delimiterLine = "";
    const data: string[][] = [];

    lines.forEach((line) => {
      let cells = line.trim().split("|");
      if (cells[0] === "") cells.shift();
      if (cells[cells.length - 1] === "") cells.pop();
      cells = cells.map((c) => c.trim());

      if (cells.length > 0 && cells.every((c) => /^[ :-]+$/.test(c))) {
        delimiterLine = line;
      } else if (line.trim()) {
        data.push(cells);
      }
    });

    if (data.length === 0) {
      container.textContent = this.content;
      return container;
    }

    data.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      row.forEach((cell, colIndex) => {
        const el = document.createElement(rowIndex === 0 ? "th" : "td");
        el.contentEditable = "true";
        el.textContent = cell;
        el.className = "cm-table-cell";

        el.onblur = () => {
          const newText = el.textContent || "";
          if (newText !== cell) {
            const newData = data.map((r) => [...r].map((c) => c || " "));
            newData[rowIndex][colIndex] = newText;
            this.updateTable(view, newData, delimiterLine);
          }
        };

        el.onkeydown = (e) => {
          if (e.key === "Enter") {
            if (!e.shiftKey) {
              e.preventDefault();
              el.blur();
            }
          }
          e.stopPropagation();
        };

        tr.appendChild(el);
      });
      table.appendChild(tr);
    });

    container.appendChild(table);
    return container;
  }

  updateTable(view: EditorView, data: string[][], delimiterLine: string) {
    const header = data[0];
    const body = data.slice(1);

    let newContent = `| ${header.join(" | ")} |\n`;
    newContent += delimiterLine
      ? delimiterLine + "\n"
      : `| ${header.map(() => "---").join(" | ")} |\n`;
    body.forEach((row) => {
      newContent += `| ${row.join(" | ")} |\n`;
    });

    view.dispatch({
      changes: { from: this.from, to: this.to, insert: newContent.trim() },
    });
  }
}
