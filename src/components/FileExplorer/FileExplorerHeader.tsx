import { ChevronDown, ChevronRight } from "lucide-react";

interface FileExplorerHeaderProps {
  currentPath: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}

export function FileExplorerHeader({
  currentPath,
  isExpanded,
  onToggle,
}: FileExplorerHeaderProps) {
  return (
    <div
      className="hover:bg-accent/50 flex h-8 cursor-pointer items-center gap-1 px-1 transition-colors select-none"
      onClick={onToggle}
    >
      <div className="flex w-4 items-center justify-center">
        {isExpanded ? (
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
        )}
      </div>
      <h2
        className="text-muted-foreground flex-1 truncate text-xs font-bold tracking-wider uppercase"
        title={currentPath || "No Folder"}
      >
        {currentPath
          ? currentPath.split(/[/\\]/).filter(Boolean).pop() || "Root"
          : "NO FOLDER"}
      </h2>
    </div>
  );
}
