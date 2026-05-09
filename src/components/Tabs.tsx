import { cn } from "@/lib/utils";
import { X, FileText } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface Tab {
  path: string;
  name: string;
}

interface TabsProps {
  files: Tab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseOthers: (path: string) => void;
  onCloseAll: () => void;
}

export function Tabs({
  files,
  activePath,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
}: TabsProps) {
  if (files.length === 0) return null;

  return (
    <div className="bg-muted/10 no-scrollbar flex h-9 w-full items-stretch overflow-x-auto overflow-y-hidden border-b select-none">
      {files.map((file) => {
        const isActive = file.path === activePath;
        return (
          <ContextMenu key={file.path}>
            <ContextMenuTrigger asChild>
              <div
                className={cn(
                  "group relative flex max-w-[200px] min-w-[120px] cursor-pointer items-center gap-2 border-r px-3 text-xs transition-colors",
                  isActive
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:bg-muted/30"
                )}
                onClick={() => onSelect(file.path)}
              >
                <FileText
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isActive ? "text-primary" : "opacity-50"
                  )}
                />
                <span className="flex-1 truncate">{file.name}</span>
                <button
                  className={cn(
                    "cursor-pointer rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-100",
                    isActive
                      ? "hover:bg-muted-foreground/20 bg-transparent opacity-100"
                      : "hover:bg-muted-foreground/15"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(file.path);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
                {isActive && (
                  <div className="bg-primary absolute bottom-[-1px] left-0 h-[2px] w-full" />
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onClose(file.path)}>
                Close
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCloseOthers(file.path)}>
                Close Others
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCloseAll()}>
                Close All
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
