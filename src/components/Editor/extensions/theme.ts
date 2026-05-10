import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

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

export const getEditorTheme = (fontSize: number) =>
  EditorView.theme({
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
      fontSize: `${fontSize}px`,
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
    ".cm-blockquote-line": {
      borderLeft: "2px solid var(--border)",
      marginLeft: "0.5rem",
      paddingLeft: "0.5rem !important",
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
    ".cm-image-container": {
      display: "inline-block",
      maxWidth: "100%",
      verticalAlign: "middle",
    },
    ".cm-image-container.cm-image-selected": {
      outline: "2px solid var(--primary)",
      outlineOffset: "2px",
    },
    ".cm-image-resize-handle": {
      position: "absolute",
      right: "-4px",
      bottom: "-4px",
      width: "100%",
      height: "100%",
      cursor: "default",
      pointerEvents: "none",
    },
    ".cm-image-resize-handle::after": {
      content: '""',
      position: "absolute",
      right: "-4px",
      bottom: "-4px",
      width: "12px",
      height: "12px",
      backgroundColor: "var(--primary)",
      borderRadius: "2px",
      cursor: "nwse-resize",
      pointerEvents: "auto",
      zIndex: "10",
    },
    ".cm-task-checkbox": {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "1.1rem",
      height: "1.1rem",
      border: "1.5px solid var(--muted-foreground)",
      borderRadius: "4px",
      marginRight: "0.5rem",
      cursor: "pointer",
      verticalAlign: "middle",
      backgroundColor: "var(--muted)",
      position: "relative",
      top: "-1.5px",
      transition:
        "border-color 0.1s ease-in-out, background-color 0.1s ease-in-out",
    },
    ".cm-task-checkbox:hover": {
      borderColor: "#3b82f6",
    },
    ".cm-task-checkbox-checked": {
      backgroundColor: "#3b82f6 !important",
      borderColor: "#3b82f6 !important",
    },
    ".cm-task-checkbox-checked:hover": {
      backgroundColor: "#2563eb !important",
      borderColor: "#2563eb !important",
    },
    ".cm-task-checkbox-checked::after": {
      content: '""',
      position: "absolute",
      width: "0.3rem",
      height: "0.6rem",
      border: "solid white",
      borderWidth: "0 2px 2px 0",
      transform: "rotate(45deg)",
      top: "1px",
    },
    ".cm-table-container": {
      display: "block",
      margin: "0",
      width: "100%",
      overflowX: "auto",
    },
    ".cm-table": {
      borderCollapse: "collapse",
      width: "100%",
      fontSize: "0.875rem",
      border: "1px solid var(--border)",
    },
    ".cm-table th": {
      backgroundColor: "var(--muted)",
      fontWeight: "600",
      textAlign: "left",
      height: "1.75rem",
      padding: "0 0.5rem",
      border: "1px solid var(--border)",
      verticalAlign: "middle",
    },
    ".cm-table td": {
      border: "1px solid var(--border)",
      padding: "0.5rem",
      minWidth: "100px",
    },
    ".cm-table-cell": {
      outline: "none",
    },
    ".cm-table-cell:focus": {
      backgroundColor: "var(--accent)",
    },
  });
