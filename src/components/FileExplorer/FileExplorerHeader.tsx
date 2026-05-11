import { ChevronDown, ChevronRight } from "lucide-react";

interface FileExplorerHeaderProps {
  currentPath: string | null;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export function FileExplorerHeader({
  currentPath,
  isExpanded,
  onToggle,
  children,
}: FileExplorerHeaderProps) {
  return (
    <div
      className="hover:bg-accent/30 text-muted-foreground group/header flex h-8 cursor-pointer items-center gap-1 px-1 transition-colors select-none"
      onClick={onToggle}
    >
      <div className="flex w-4 items-center justify-center">
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </div>
      <h2
        className="flex-1 truncate text-xs font-bold tracking-wider uppercase"
        title={currentPath || "No Folder"}
      >
        {currentPath
          ? currentPath.split(/[/\\]/).filter(Boolean).pop() || "Root"
          : "NO FOLDER"}
      </h2>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
