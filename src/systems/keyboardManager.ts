import { commandManager } from "./commandManager";

class KeyboardManager {
  private bindings: Map<string, string> = new Map();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.handleKeyDown.bind(this));
    }
  }

  bind(keyCombo: string, commandId: string) {
    this.bindings.set(keyCombo.toLowerCase(), commandId);
  }

  private handleKeyDown(event: KeyboardEvent) {
    const activeElement = document.activeElement;
    const isTyping =
      activeElement?.tagName === "INPUT" ||
      activeElement?.tagName === "TEXTAREA" ||
      (activeElement as HTMLElement)?.isContentEditable;

    const hasModifier = event.ctrlKey || event.altKey || event.metaKey;

    if (isTyping && !hasModifier) {
      return;
    }

    const keys = [];
    if (event.ctrlKey) keys.push("ctrl");
    if (event.altKey) keys.push("alt");
    if (event.shiftKey) keys.push("shift");
    if (event.metaKey) keys.push("meta");

    if (!["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
      keys.push(event.key.toLowerCase());
    }

    const combo = keys.join("+");
    const commandId = this.bindings.get(combo);

    if (commandId) {
      if (commandManager.execute(commandId)) {
        event.preventDefault();
      }
    }
  }
}

export const keyboardManager = new KeyboardManager();
