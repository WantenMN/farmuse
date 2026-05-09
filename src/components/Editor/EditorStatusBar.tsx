import * as React from "react";
import { Save } from "lucide-react";

interface EditorStatusBarProps {
  isSaving: boolean;
  isModified: boolean;
}

export function EditorStatusBar({
  isSaving,
  isModified,
}: EditorStatusBarProps) {
  return (
    <div className="pointer-events-none absolute right-[max(2rem,calc((100%-48rem)/2+2rem))] bottom-4 z-10 flex items-center gap-2">
      <div className="bg-background/60 rounded-md px-2 py-0.5 backdrop-blur-md">
        {isSaving ? (
          <span className="text-muted-foreground flex animate-pulse items-center gap-1 text-[10px]">
            <Save className="h-3 w-3" /> Saving...
          </span>
        ) : isModified ? (
          <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
            Modified
          </span>
        ) : (
          <span className="text-muted-foreground/50 text-[10px]">Saved</span>
        )}
      </div>
    </div>
  );
}
