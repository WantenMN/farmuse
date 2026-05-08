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
      className="flex items-center justify-between h-8 bg-background border-b border-border select-none"
    >
      <div className="flex items-center px-3 gap-2 pointer-events-none">
        <span className="text-xs font-medium text-muted-foreground">Farmuse</span>
      </div>
      <div className="flex h-full">
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-10 h-full hover:bg-muted transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-10 h-full hover:bg-muted transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Copy className="w-3.5 h-3.5" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-10 h-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
