import { Save, ChevronUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export type EditorMode = "source" | "live";

interface EditorStatusBarProps {
  isSaving: boolean;
  isModified: boolean;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

export function EditorStatusBar({
  isSaving,
  isModified,
  mode,
  onModeChange,
}: EditorStatusBarProps) {
  return (
    <div className="border-border bg-background flex h-6 w-full shrink-0 items-center justify-between border-t px-4 select-none">
      <div className="flex items-center gap-2">
        {isSaving ? (
          <span className="text-muted-foreground flex animate-pulse items-center gap-1 text-[11px] font-medium">
            <Save className="h-3.5 w-3.5" /> Saving...
          </span>
        ) : isModified ? (
          <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
            Modified
          </span>
        ) : (
          <span className="text-muted-foreground/50 text-[11px] font-medium">
            Saved
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] font-medium transition-colors outline-none">
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
    </div>
  );
}
