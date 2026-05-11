import * as React from "react";
import { cn } from "./lib/utils";
import { TitleBar } from "./components/TitleBar";
import { ResizeHandles } from "./components/ResizeHandles";
import { CommandPalette } from "./components/CommandPalette";
import { FileExplorer } from "./components/FileExplorer";
import { SideBar } from "./components/SideBar";
import { Editor } from "./components/Editor";
import { SettingsPage } from "./components/SettingsPage";
import { Tabs } from "./components/Tabs";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useWorkspace } from "./hooks/useWorkspace";
import { useTabs } from "./hooks/useTabs";
import { registerAppCommands, unregisterAppCommands } from "./commands";

function App() {
  const [savedState] = React.useState(() => {
    const saved = localStorage.getItem("farmuse_state");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
    return null;
  });

  const {
    currentPath,
    entries,
    explorerWidth,
    showExplorer,
    setShowExplorer,
    startResizing,
    loadDirectory,
    closeFolder: closeWorkspaceFolder,
  } = useWorkspace(savedState);

  const {
    openFiles,
    setOpenFiles,
    activeFilePath,
    setActiveFilePath,
    openFile,
    closeFile,
    closeOthers,
    closeAll,
    clearTabs,
  } = useTabs(savedState);

  const hasRestoredEntries = React.useRef(false);

  const handleLoadDirectory = React.useCallback(
    async (path: string, _shouldFocus = true) => {
      // Save current state before switching
      if (currentPath && currentPath !== path) {
        localStorage.setItem(
          `tabs_state_${currentPath}`,
          JSON.stringify({ openFiles, activeFilePath })
        );
      }

      await loadDirectory(path, undefined, () => {
        // If switching folders, load saved state for the new path
        if (path !== currentPath) {
          const saved = localStorage.getItem(`tabs_state_${path}`);
          if (saved) {
            try {
              const { openFiles: savedFiles, activeFilePath: savedActive } =
                JSON.parse(saved);
              setOpenFiles(savedFiles);
              setActiveFilePath(savedActive);
            } catch (e) {
              console.error("Failed to parse saved tabs state", e);
            }
          } else {
            clearTabs();
          }
        }
      });
    },
    [
      currentPath,
      openFiles,
      activeFilePath,
      loadDirectory,
      setOpenFiles,
      setActiveFilePath,
      clearTabs,
    ]
  );

  // Restore directory entries on mount
  React.useEffect(() => {
    if (currentPath && !hasRestoredEntries.current) {
      hasRestoredEntries.current = true;
      handleLoadDirectory(currentPath, false);
    }
  }, [currentPath, handleLoadDirectory]);

  // Save state on changes
  React.useEffect(() => {
    const state = {
      currentPath,
      openFiles,
      activeFilePath,
      showExplorer,
      explorerWidth,
    };
    localStorage.setItem("farmuse_state", JSON.stringify(state));

    if (currentPath) {
      localStorage.setItem(
        `tabs_state_${currentPath}`,
        JSON.stringify({ openFiles, activeFilePath })
      );
    }
  }, [currentPath, openFiles, activeFilePath, showExplorer, explorerWidth]);

  const closeFolder = React.useCallback(() => {
    if (currentPath) {
      localStorage.setItem(
        `tabs_state_${currentPath}`,
        JSON.stringify({ openFiles, activeFilePath })
      );
    }
    closeWorkspaceFolder();
    clearTabs();
  }, [currentPath, openFiles, activeFilePath, closeWorkspaceFolder, clearTabs]);

  const openFolder = React.useCallback(async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        handleLoadDirectory(selected);
      }
    } catch (e) {
      console.error("Failed to open folder dialog", e);
    }
  }, [handleLoadDirectory]);

  React.useEffect(() => {
    registerAppCommands({
      toggleExplorer: () => setShowExplorer((prev: boolean) => !prev),
      closeFolder,
      closeFile: () => {
        if (activeFilePath) {
          closeFile(activeFilePath);
        }
      },
      openFolder,
    });

    return () => {
      unregisterAppCommands();
    };
  }, [activeFilePath, closeFile, closeFolder, openFolder, setShowExplorer]);

  return (
    <div className="bg-background text-foreground border-border flex h-screen w-screen flex-col overflow-hidden border">
      <ResizeHandles />
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <SideBar
          showExplorer={showExplorer}
          onToggleExplorer={() => setShowExplorer(!showExplorer)}
          onOpenSettings={() => openFile("settings://", "Settings")}
          activePath={activeFilePath}
        />
        <FileExplorer
          currentPath={currentPath}
          entries={entries}
          isVisible={showExplorer}
          width={explorerWidth}
          onResizeStart={startResizing}
          onOpenFile={openFile}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {openFiles.length > 0 && (
            <Tabs
              files={openFiles}
              activePath={activeFilePath}
              onSelect={setActiveFilePath}
              onClose={closeFile}
              onCloseOthers={closeOthers}
              onCloseAll={closeAll}
            />
          )}

          {openFiles.length > 0 ? (
            openFiles.map((file) => (
              <div
                key={file.path}
                className={cn(
                  "flex min-h-0 flex-1 flex-col",
                  file.path !== activeFilePath && "hidden"
                )}
              >
                {file.path === "settings://" ? (
                  <SettingsPage />
                ) : (
                  <Editor
                    path={file.path}
                    name={file.name}
                    isActive={file.path === activeFilePath}
                  />
                )}
              </div>
            ))
          ) : (
            <WelcomeScreen currentPath={currentPath} />
          )}
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}

export default App;
