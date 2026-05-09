import * as React from "react";
import { Folder } from "lucide-react";

interface FileExplorerHeaderProps {
  currentPath: string | null;
}

export function FileExplorerHeader({ currentPath }: FileExplorerHeaderProps) {
  return (
    <div className="bg-background/50 flex min-h-[48px] items-center gap-2 overflow-hidden border-b p-3">
      <Folder className="text-primary/70 h-4 w-4 shrink-0" />
      <h2
        className="text-muted-foreground truncate text-xs font-bold tracking-wider uppercase"
        title={currentPath || "No Folder"}
      >
        {currentPath
          ? currentPath.split("/").filter(Boolean).pop() || "Root"
          : "No folder"}
      </h2>
    </div>
  );
}
