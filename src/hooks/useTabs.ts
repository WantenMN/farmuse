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
  const [state, setState] = React.useState<TabsState>({
    openFiles: initialState?.openFiles || [],
    activeFilePath: initialState?.activeFilePath || null,
  });

  const { openFiles, activeFilePath } = state;

  const activeFile = React.useMemo(
    () => openFiles.find((f) => f.path === activeFilePath) || null,
    [openFiles, activeFilePath]
  );

  const openFile = React.useCallback((path: string, name: string) => {
    const normalizedPath = path.replace(/\\/g, "/");
    setState((prev) => {
      const alreadyOpen = prev.openFiles.some(
        (f) => f.path.replace(/\\/g, "/") === normalizedPath
      );
      if (alreadyOpen) {
        return { ...prev, activeFilePath: normalizedPath };
      }
      return {
        ...prev,
        openFiles: [...prev.openFiles, { path: normalizedPath, name }],
        activeFilePath: normalizedPath,
      };
    });
  }, []);

  const closeFile = React.useCallback((path: string) => {
    setState((prev) => {
      const newFiles = prev.openFiles.filter((f) => f.path !== path);
      let newActive = prev.activeFilePath;
      if (prev.activeFilePath === path) {
        newActive = newFiles.length > 0 ? newFiles[0].path : null;
      }
      return {
        openFiles: newFiles,
        activeFilePath: newActive,
      };
    });
  }, []);

  const closeOthers = React.useCallback((path: string) => {
    setState((prev) => {
      const fileToKeep = prev.openFiles.find((f) => f.path === path);
      if (fileToKeep) {
        return {
          openFiles: [fileToKeep],
          activeFilePath: path,
        };
      }
      return prev;
    });
  }, []);

  const closeAll = React.useCallback(() => {
    setState({
      openFiles: [],
      activeFilePath: null,
    });
  }, []);

  const clearTabs = React.useCallback(() => {
    setState({
      openFiles: [],
      activeFilePath: null,
    });
  }, []);

  const updatePaths = React.useCallback((oldPath: string, newPath: string) => {
    setState((prev) => {
      let changed = false;
      const normalizedOld = oldPath.replace(/\\/g, "/");
      const normalizedNew = newPath.replace(/\\/g, "/");

      const nextFiles = prev.openFiles.map((f) => {
        const normalizedFilePath = f.path.replace(/\\/g, "/");
        if (normalizedFilePath === normalizedOld) {
          changed = true;
          return {
            ...f,
            path: normalizedNew,
            name: normalizedNew.split("/").pop() || f.name,
          };
        }
        if (normalizedFilePath.startsWith(normalizedOld + "/")) {
          changed = true;
          const relativePart = normalizedFilePath.substring(
            normalizedOld.length
          );
          return { ...f, path: normalizedNew + relativePart };
        }
        return f;
      });

      let nextActive = prev.activeFilePath
        ? prev.activeFilePath.replace(/\\/g, "/")
        : null;
      if (nextActive) {
        if (nextActive === normalizedOld) {
          nextActive = normalizedNew;
          changed = true;
        } else if (nextActive.startsWith(normalizedOld + "/")) {
          const relativePart = nextActive.substring(normalizedOld.length);
          nextActive = normalizedNew + relativePart;
          changed = true;
        }
      }

      if (!changed) return prev;
      return {
        openFiles: nextFiles,
        activeFilePath: nextActive,
      };
    });
  }, []);

  const setOpenFiles = React.useCallback(
    (updater: TabFile[] | ((prev: TabFile[]) => TabFile[])) => {
      setState((prev) => ({
        ...prev,
        openFiles:
          typeof updater === "function" ? updater(prev.openFiles) : updater,
      }));
    },
    []
  );

  const setActiveFilePath = React.useCallback(
    (updater: string | null | ((prev: string | null) => string | null)) => {
      setState((prev) => ({
        ...prev,
        activeFilePath:
          typeof updater === "function"
            ? updater(prev.activeFilePath)
            : updater,
      }));
    },
    []
  );

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
    updatePaths,
  };
}
