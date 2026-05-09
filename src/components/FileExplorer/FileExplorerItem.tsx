import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown } from "lucide-react";
import { FileExplorerEntry } from "../../hooks/useFileExplorer";

interface FileExplorerItemProps {
  entry: FileExplorerEntry;
  isFocused: boolean;
  isActive: boolean;
  isExpanded: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function FileExplorerItem({
  entry,
  isFocused,
  isActive,
  isExpanded,
  onClick,
}: FileExplorerItemProps) {
  return (
    <div
      className={cn(
        "group relative flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm transition-none",
        isFocused &&
          isActive &&
          "bg-accent text-accent-foreground ring-primary/30 z-10 ring-1",
        isFocused &&
          !isActive &&
          "bg-accent/50 text-accent-foreground/80 ring-muted-foreground/20 z-10 ring-1",
        !isFocused && "hover:bg-accent/30"
      )}
      style={{ paddingLeft: `${entry.depth * 12 + 6}px` }}
      onClick={onClick}
    >
      {/* Vertical line for expanded scope */}
      {entry.depth > 0 &&
        Array.from({ length: entry.depth }).map((_, i) => (
          <div
            key={i}
            className="border-muted-foreground/20 absolute h-full border-l"
            style={{ left: `${i * 12 + 12}px` }}
          />
        ))}

      <div className="z-10 flex w-4 shrink-0 items-center justify-center">
        {entry.is_dir ? (
          isExpanded ? (
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
          )
        ) : null}
      </div>
      <span className="z-10 truncate tracking-tight" title={entry.name}>
        {entry.name}
      </span>
    </div>
  );
}
