import * as React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Copy } from "lucide-react";
import icon from "../assets/icon.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { commandManager } from "../systems/commandManager";

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
      <div className="flex items-center gap-0.5 px-3">
        <img src={icon} alt="App Icon" className="mr-2 h-4 w-4" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hover:bg-muted rounded px-2 py-1 text-xs font-medium transition-colors focus:outline-none">
              File
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem
              onClick={() => commandManager.execute("open-folder")}
            >
              Open Folder
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Recent Folders</DropdownMenuItem>
            <DropdownMenuItem disabled>Folder Management</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => commandManager.execute("close-folder")}
            >
              Close Folder
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => commandManager.execute("new-window")}
            >
              New Window
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => commandManager.execute("quit-app")}
            >
              Exit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
