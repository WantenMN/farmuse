import { keyboardManager } from "./keyboardManager";
import { commandManager } from "./commandManager";

/**
 * Initialize global system bindings and commands
 */
export function setupSystems() {
  // Global Keybindings
  keyboardManager.bind("alt+x", "open-command-palette");
  keyboardManager.bind("alt+1", "explorer.focus");
  keyboardManager.bind("j", "explorer.moveDown");
  keyboardManager.bind("k", "explorer.moveUp");
  keyboardManager.bind("h", "explorer.collapse");
  keyboardManager.bind("l", "explorer.expand");
  keyboardManager.bind("arrowdown", "explorer.moveDown");
  keyboardManager.bind("arrowup", "explorer.moveUp");
  keyboardManager.bind("arrowleft", "explorer.collapse");
  keyboardManager.bind("arrowright", "explorer.expand");

  // Example Global Commands
  commandManager.register({
    id: "reload-app",
    name: "Reload Application",
    description: "Force refresh the current page",
    handler: () => window.location.reload()
  });

  commandManager.register({
    id: "toggle-theme",
    name: "Toggle Dark Mode",
    description: "Switch between light and dark themes",
    handler: () => {
      document.documentElement.classList.toggle("dark");
      console.log("Theme toggled");
    }
  });

  commandManager.register({
    id: "go-home",
    name: "Go to Home",
    description: "Navigate to the home dashboard",
    handler: () => console.log("Navigating home...")
  });

  commandManager.register({
    id: "show-help",
    name: "Show Help",
    description: "View documentation and keyboard shortcuts",
    handler: () => alert("Help: Alt+X opens the command palette. Use Arrows or Tab to navigate.")
  });

  commandManager.register({
    id: "quit-app",
    name: "Quit Application",
    description: "Close and exit the program",
    handler: async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().close();
      } catch (e) {
        window.close();
      }
    }
  });
}
