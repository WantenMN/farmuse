import { keyboardManager } from "./keyboardManager";
import { registerGlobalCommands } from "../commands";

/**
 * Initialize global system bindings and commands
 */
export function setupSystems() {
  // Global Keybindings
  keyboardManager.bind("alt+x", "open-command-palette");
  keyboardManager.bind("ctrl+p", "open-quick-open");
  keyboardManager.bind("ctrl+shift+p", "open-recent-files");
  keyboardManager.bind("j", "explorer.moveDown");
  keyboardManager.bind("k", "explorer.moveUp");
  keyboardManager.bind("h", "explorer.collapse");
  keyboardManager.bind("l", "explorer.expand");
  keyboardManager.bind("enter", "explorer.open");
  keyboardManager.bind("arrowdown", "explorer.moveDown");
  keyboardManager.bind("arrowup", "explorer.moveUp");
  keyboardManager.bind("arrowleft", "explorer.collapse");
  keyboardManager.bind("arrowright", "explorer.expand");

  // Register all global commands from the unified command file
  registerGlobalCommands();
}
