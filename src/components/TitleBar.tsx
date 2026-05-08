import * as React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Copy } from "lucide-react";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = React.useState(false);
  const appWindow = getCurrentWindow();

  React.useEffect(() => {
    const updateMaximized = async () => {
      setIsMaximized(await appWindow.isMaximized());
    };

    updateMaximized();

    const unlisten = appWindow.onResized(() => {
      updateMaximized();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div
      data-tauri-drag-region
      className="bg-background border-border flex h-8 items-center justify-between border-b select-none"
    >
      <div className="pointer-events-none flex items-center gap-2 px-3">
        <span className="text-muted-foreground text-xs font-medium">
          Farmuse
        </span>
      </div>
      <div className="flex h-full">
        <button
          onClick={handleMinimize}
          className="hover:bg-muted flex h-full w-10 items-center justify-center transition-colors"
          title="Minimize"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="hover:bg-muted flex h-full w-10 items-center justify-center transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Copy className="h-3.5 w-3.5" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="hover:bg-destructive hover:text-destructive-foreground flex h-full w-10 items-center justify-center transition-colors"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
