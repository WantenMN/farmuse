import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown } from "lucide-react";
import { FileExplorerEntry } from "../../hooks/useFileExplorer";

interface FileExplorerItemProps {
  entry: FileExplorerEntry;
  isFocused: boolean;
  isExpanded: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function FileExplorerItem({
  entry,
  isFocused,
  isExpanded,
  onClick,
}: FileExplorerItemProps) {
  return (
    <div
      className={cn(
        "group relative flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm transition-none",
        isFocused && "bg-accent text-accent-foreground z-10",
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
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )
        ) : null}
      </div>
      <span className="z-10 truncate tracking-tight" title={entry.name}>
        {entry.name.replace(/\.md$/, "")}
      </span>
    </div>
  );
}
