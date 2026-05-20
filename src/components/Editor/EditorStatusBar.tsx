import { ChevronUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export type EditorMode = "source" | "live";

interface EditorStatusBarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

export function EditorStatusBar({ mode, onModeChange }: EditorStatusBarProps) {
  return (
    <div className="border-border bg-background flex h-6 w-full shrink-0 items-center justify-end border-t px-4 select-none">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="text-muted-foreground hover:text-foreground hover:bg-muted/80 flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors outline-none">
            {mode === "source" ? "Source Mode" : "Live Preview"}
            <ChevronUp className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-32">
          <DropdownMenuItem
            onClick={() => onModeChange("source")}
            className="text-[11px]"
          >
            Source Mode
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onModeChange("live")}
            className="text-[11px]"
          >
            Live Preview
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
