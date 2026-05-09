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
    <div className="border-border bg-background flex h-6 w-full shrink-0 items-center justify-end border-t px-4 select-none">
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
    </div>
  );
}
