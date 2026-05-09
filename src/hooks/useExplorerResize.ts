import * as React from "react";

interface UseExplorerResizeProps {
  initialWidth: number;
  initialVisible: boolean;
  minWidth?: number;
  minEditorWidth?: number;
}

export function useExplorerResize({
  initialWidth,
  initialVisible,
  minWidth = 250,
  minEditorWidth = 50,
}: UseExplorerResizeProps) {
  const [width, setWidth] = React.useState(initialWidth);
  const [isVisible, setIsVisible] = React.useState(initialVisible);
  const [isResizing, setIsResizing] = React.useState(false);

  const startResizing = React.useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX;
        const windowWidth = window.innerWidth;
        const maxWidth = windowWidth - minEditorWidth;

        const hideThreshold = minWidth * 0.2;
        const showThreshold = minWidth * 0.5;

        if (isVisible) {
          if (newWidth < hideThreshold) {
            setIsVisible(false);
          } else {
            setWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
          }
        } else {
          if (newWidth > showThreshold) {
            setIsVisible(true);
            setWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
          }
        }
      }
    },
    [isResizing, isVisible, minWidth, minEditorWidth]
  );

  React.useEffect(() => {
    const handleWindowResize = () => {
      setWidth((prev) => {
        const maxWidth = window.innerWidth - minEditorWidth;
        return Math.min(prev, maxWidth);
      });
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [minEditorWidth]);

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, resize, stopResizing]);

  return {
    width,
    isVisible,
    setIsVisible,
    isResizing,
    startResizing,
  };
}
