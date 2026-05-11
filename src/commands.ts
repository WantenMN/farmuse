import { commandManager } from "./systems/commandManager";

/**
 * Register global commands that don't depend on specific component state
 */
export function registerGlobalCommands() {
  commandManager.register({
    id: "reload-app",
    name: "Reload Application",
    description: "Force refresh the current page",
    handler: () => window.location.reload(),
  });

  commandManager.register({
    id: "toggle-theme",
    name: "Toggle Dark Mode",
    description: "Switch between light and dark themes",
    handler: () => {
      document.documentElement.classList.toggle("dark");
      console.log("Theme toggled");
    },
  });

  commandManager.register({
    id: "go-home",
    name: "Go to Home",
    description: "Navigate to the home dashboard",
    handler: () => console.log("Navigating home..."),
  });

  commandManager.register({
    id: "show-help",
    name: "Show Help",
    description: "View documentation and keyboard shortcuts",
    handler: () =>
      alert(
        "Help: Alt+X opens the command palette. Use Arrows or Tab to navigate."
      ),
  });

  commandManager.register({
    id: "quit-app",
    name: "Quit Application",
    description: "Close and exit the program",
    handler: async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().close();
      } catch {
        window.close();
      }
    },
  });

  commandManager.register({
    id: "new-window",
    name: "New Window",
    description: "Open a new application window",
    handler: async () => {
      try {
        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        new WebviewWindow(`main-${Math.random().toString(36).slice(2, 9)}`, {
          url: "index.html",
        });
      } catch (e) {
        console.error("Failed to open new window", e);
      }
    },
  });
}

/**
 * Commands specifically for the App component that require its state
 */
export function registerAppCommands(handlers: {
  toggleExplorer: () => void;
  closeFolder: () => void;
  closeFile: () => void;
  openFolder: () => void;
  openRecentFolders: () => void;
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

  commandManager.register({
    id: "open-folder",
    name: "Open Folder",
    description: "Open a directory to view its contents",
    handler: handlers.openFolder,
  });

  commandManager.register({
    id: "open-recent-folders",
    name: "Open Recent Folders",
    description: "Show recently opened folders",
    handler: handlers.openRecentFolders,
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
  OPEN_RECENT_FOLDERS: {
    id: "open-recent-folders",
    name: "Open Recent Folders",
    description: "Show recently opened folders",
  },
};

/**
 * Unregister app commands
 */
export function unregisterAppCommands() {
  commandManager.unregister("toggle-explorer");
  commandManager.unregister("close-folder");
  commandManager.unregister("close-file");
  commandManager.unregister("open-folder");
  commandManager.unregister("open-recent-folders");
}
