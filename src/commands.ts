import { commandManager } from "./systems/commandManager";

/**
 * Register global commands that don't depend on specific component state
 */
export function registerGlobalCommands() {
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

/**
 * Commands specifically for the App component that require its state
 */
export function registerAppCommands(handlers: {
  toggleExplorer: () => void;
  closeFolder: () => void;
  closeFile: () => void;
}) {
  commandManager.register({
    id: "toggle-explorer",
    name: "Toggle Explorer",
    description: "Show or hide the file explorer sidebar",
    handler: handlers.toggleExplorer,
  });

  commandManager.register({
    id: "close-folder",
    name: "Close Folder",
    description: "Close the currently open folder and file",
    handler: handlers.closeFolder,
  });

  commandManager.register({
    id: "close-file",
    name: "Close File",
    description: "Close the currently open file",
    handler: handlers.closeFile,
  });
}

/**
 * Metadata for commands registered by components
 */
export const COMMAND_METADATA = {
  OPEN_FOLDER: {
    id: "open-folder",
    name: "Open Folder",
    description: "Open a directory to view its contents",
  },
  OPEN_FILE: {
    id: "open-file",
    name: "Open File",
    description: "Search and open a file",
  },
};

/**
 * Unregister app commands
 */
export function unregisterAppCommands() {
  commandManager.unregister("toggle-explorer");
  commandManager.unregister("close-folder");
  commandManager.unregister("close-file");
}
