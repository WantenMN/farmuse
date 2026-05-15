import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown } from "lucide-react";
import { FileExplorerEntry } from "../../hooks/useFileExplorer";

interface FileExplorerItemProps {
  entry: FileExplorerEntry;
  isFocused: boolean;
  isExpanded: boolean;
  isCut?: boolean;
  isDragging?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  isEditing?: boolean;
  editName?: string;
  onEditChange?: (name: string) => void;
  onEditSubmit?: () => void;
  onEditCancel?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function FileExplorerItem({
  entry,
  isFocused,
  isExpanded,
  isCut,
  isDragging,
  onClick,
  onMouseDown,
  isEditing,
  editName,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  onContextMenu,
}: FileExplorerItemProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current;
      // Focus after a short delay to ensure the context menu doesn't steal focus
      const timer = setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  return (
    <div
      data-entry-path={entry.path}
      className={cn(
        "group relative flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm transition-none",
        isFocused && "bg-accent text-accent-foreground z-10",
        !isFocused && "hover:bg-accent/30",
        isCut && "opacity-50 grayscale-[0.5]",
        isDragging && "opacity-40"
      )}
      style={{ paddingLeft: `${entry.depth * 12 + 6}px` }}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
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
      {isEditing ? (
        <input
          ref={inputRef}
          className="bg-background border-primary z-20 w-full border px-1 text-sm outline-none"
          value={editName}
          onChange={(e) => onEditChange?.(e.target.value)}
          onBlur={onEditSubmit}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditSubmit?.();
            if (e.key === "Escape") onEditCancel?.();
          }}
        />
      ) : (
        <span className="z-10 truncate tracking-tight" title={entry.name}>
          {entry.name.replace(/\.md$/, "")}
        </span>
      )}
    </div>
  );
}
