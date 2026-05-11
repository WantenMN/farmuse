import * as React from "react";

interface TabFile {
  path: string;
  name: string;
}

interface TabsState {
  openFiles: TabFile[];
  activeFilePath: string | null;
}

export function useTabs(initialState: TabsState | null) {
  const [openFiles, setOpenFiles] = React.useState<TabFile[]>(
    initialState?.openFiles || []
  );
  const [activeFilePath, setActiveFilePath] = React.useState<string | null>(
    initialState?.activeFilePath || null
  );

  const activeFile = React.useMemo(
    () => openFiles.find((f) => f.path === activeFilePath) || null,
    [openFiles, activeFilePath]
  );

  const openFile = React.useCallback((path: string, name: string) => {
    const normalizedPath = path.replace(/\\/g, "/");
    setOpenFiles((prev) => {
      if (prev.some((f) => f.path.replace(/\\/g, "/") === normalizedPath))
        return prev;
      return [...prev, { path: normalizedPath, name }];
    });
    setActiveFilePath(normalizedPath);
  }, []);

  const closeFile = React.useCallback(
    (path: string) => {
      setOpenFiles((prev) => {
        const newFiles = prev.filter((f) => f.path !== path);
        if (activeFilePath === path) {
          setActiveFilePath(newFiles.length > 0 ? newFiles[0].path : null);
        }
        return newFiles;
      });
    },
    [activeFilePath]
  );

  const closeOthers = React.useCallback((path: string) => {
    setOpenFiles((prev) => {
      const fileToKeep = prev.find((f) => f.path === path);
      if (fileToKeep) {
        setActiveFilePath(path);
        return [fileToKeep];
      }
      return prev;
    });
  }, []);

  const closeAll = React.useCallback(() => {
    setOpenFiles([]);
    setActiveFilePath(null);
  }, []);

  const clearTabs = React.useCallback(() => {
    setOpenFiles([]);
    setActiveFilePath(null);
  }, []);

  return {
    openFiles,
    setOpenFiles,
    activeFilePath,
    setActiveFilePath,
    activeFile,
    openFile,
    closeFile,
    closeOthers,
    closeAll,
    clearTabs,
  };
}
