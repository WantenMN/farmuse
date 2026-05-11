import * as React from "react";
import { cn } from "./lib/utils";
import { TitleBar } from "./components/TitleBar";
import { ResizeHandles } from "./components/ResizeHandles";
import { CommandPalette } from "./components/CommandPalette";
import { QuickOpen } from "./components/QuickOpen";
import { GlobalStatusBar } from "./components/GlobalStatusBar";
import { FileExplorer } from "./components/FileExplorer";
import { SideBar } from "./components/SideBar";
import { Editor } from "./components/Editor";
import { SettingsPage } from "./components/SettingsPage";
import { RecentFoldersPage } from "./components/RecentFoldersPage";
import { Tabs } from "./components/Tabs";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspace } from "./hooks/useWorkspace";
import { useTabs } from "./hooks/useTabs";
import { commandManager } from "./systems/commandManager";
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
    activeFilePath: rawActiveFilePath,
    setActiveFilePath,
    openFile: baseOpenFile,
    closeFile,
    closeOthers,
    closeAll,
    clearTabs,
  } = useTabs(savedState);

  const activeFilePath = React.useMemo(
    () => (rawActiveFilePath ? rawActiveFilePath.replace(/\\/g, "/") : null),
    [rawActiveFilePath]
  );

  const openFile = React.useCallback(
    (path: string, name: string) => {
      const normalizedPath = path.replace(/\\/g, "/");
      baseOpenFile(normalizedPath, name);
      commandManager.execute("explorer.revealActiveFile", {
        path: normalizedPath,
      });
    },
    [baseOpenFile]
  );

  const hasRestoredEntries = React.useRef(false);

  const handleLoadDirectory = React.useCallback(
    async (path: string, force = false) => {
      const normalizedPath = path.replace(/\\/g, "/");

      if (normalizedPath === currentPath && !force) {
        return;
      }

      // Save current state before switching
      if (currentPath && currentPath !== normalizedPath) {
        localStorage.setItem(
          `tabs_state_${currentPath}`,
          JSON.stringify({ openFiles, activeFilePath })
        );
      }

      await loadDirectory(normalizedPath, undefined, async () => {
        // Handle tab switching and restoration
        // Only restore if we are actually switching folders
        if (normalizedPath !== currentPath) {
          const saved = localStorage.getItem(`tabs_state_${normalizedPath}`);
          let restoredFiles: { path: string; name: string }[] = [];
          let savedActive: string | null = null;

          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              restoredFiles = (parsed.openFiles || []).map(
                (f: { path: string; name: string }) => ({
                  ...f,
                  path: f.path.replace(/\\/g, "/"),
                })
              );
              savedActive = parsed.activeFilePath?.replace(/\\/g, "/") || null;
            } catch (e) {
              console.error("Failed to parse saved tabs state", e);
            }
          }

          setOpenFiles((prev) => {
            const internalTabs = prev.filter((f) => f.path.includes("://"));
            const merged = [...internalTabs];
            restoredFiles.forEach((f) => {
              if (!merged.find((m) => m.path === f.path)) {
                merged.push(f);
              }
            });
            return merged;
          });

          setActiveFilePath((prev) => {
            if (savedActive) return savedActive;
            if (restoredFiles.length > 0) return restoredFiles[0].path;
            return prev && prev.includes("://") ? prev : null;
          });
        }

        // Initialize indexer for the new folder
        try {
          await invoke("initialize_indexer", { rootPath: normalizedPath });
        } catch (e) {
          console.error("Failed to initialize indexer", e);
        }

        // Add to recent folders
        const recent = JSON.parse(
          localStorage.getItem("farmuse_recent_folders") || "[]"
        );
        const updated = [
          normalizedPath,
          ...recent.filter((p: string) => p !== normalizedPath),
        ].slice(0, 20);
        localStorage.setItem("farmuse_recent_folders", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("recent-folders-updated"));
      });
    },
    [
      currentPath,
      openFiles,
      activeFilePath,
      loadDirectory,
      setOpenFiles,
      setActiveFilePath,
    ]
  );

  // Restore directory entries on mount
  React.useEffect(() => {
    if (currentPath && !hasRestoredEntries.current) {
      hasRestoredEntries.current = true;
      handleLoadDirectory(currentPath, true);
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
      const isConsistent = openFiles.every(
        (f) =>
          f.path.includes("://") ||
          f.path.startsWith(currentPath + "/") ||
          f.path === currentPath
      );
      if (isConsistent) {
        localStorage.setItem(
          `tabs_state_${currentPath}`,
          JSON.stringify({ openFiles, activeFilePath })
        );
      }
    }
  }, [currentPath, openFiles, activeFilePath, showExplorer, explorerWidth]);

  const closeFolder = React.useCallback(() => {
    if (currentPath) {
      const isConsistent = openFiles.every(
        (f) =>
          f.path.includes("://") ||
          f.path.startsWith(currentPath + "/") ||
          f.path === currentPath
      );
      if (isConsistent) {
        localStorage.setItem(
          `tabs_state_${currentPath}`,
          JSON.stringify({ openFiles, activeFilePath })
        );
      }
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
      openRecentFolders: () => openFile("recent-folders://", "Recent Folders"),
    });

    return () => {
      unregisterAppCommands();
    };
  }, [
    activeFilePath,
    closeFile,
    closeFolder,
    openFolder,
    setShowExplorer,
    openFile,
  ]);

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
          activeFilePath={activeFilePath}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {openFiles.length > 0 && (
            <Tabs
              files={openFiles}
              activePath={activeFilePath}
              onSelect={(path) => {
                const normalizedPath = path.replace(/\\/g, "/");
                setActiveFilePath(normalizedPath);
                commandManager.execute("explorer.revealActiveFile", {
                  path: normalizedPath,
                });
              }}
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
                onMouseDownCapture={() => {
                  commandManager.execute("explorer.revealActiveFile", {
                    path: file.path,
                  });
                }}
              >
                {file.path === "settings://" ? (
                  <SettingsPage />
                ) : file.path === "recent-folders://" ? (
                  <RecentFoldersPage
                    onOpenFolder={handleLoadDirectory}
                    onNewFolder={openFolder}
                    currentPath={currentPath}
                    onRemoveFolder={(path) => {
                      if (currentPath === path) {
                        closeWorkspaceFolder();
                        setOpenFiles((prev) =>
                          prev.filter((f) => f.path.includes("://"))
                        );
                      }
                    }}
                  />
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
      <QuickOpen onOpenFile={openFile} currentPath={currentPath} />
      <GlobalStatusBar />
    </div>
  );
}

export default App;
