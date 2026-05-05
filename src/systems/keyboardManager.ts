import { commandManager } from "./commandManager";

class KeyboardManager {
  private bindings: Map<string, string> = new Map();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.handleKeyDown.bind(this));
    }
  }

  bind(keyCombo: string, commandId: string) {
    // Normalize keyCombo to "alt+x", "ctrl+shift+p", etc.
    this.bindings.set(keyCombo.toLowerCase(), commandId);
  }

  private handleKeyDown(event: KeyboardEvent) {
    const keys = [];
    if (event.ctrlKey) keys.push("ctrl");
    if (event.altKey) keys.push("alt");
    if (event.shiftKey) keys.push("shift");
    if (event.metaKey) keys.push("meta");

    // Avoid adding modifier keys themselves
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
