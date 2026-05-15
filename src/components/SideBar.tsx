import { Files, Clock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SideBarProps {
  showExplorer: boolean;
  onToggleExplorer: () => void;
  onOpenRecentFiles: () => void;
  onOpenSettings: () => void;
  activePath: string | null;
}

export function SideBar({
  showExplorer,
  onToggleExplorer,
  onOpenRecentFiles,
  onOpenSettings,
  activePath,
}: SideBarProps) {
  return (
    <aside className="bg-muted/10 flex w-12 flex-col items-center gap-2 border-r py-2">
      <button
        onClick={onToggleExplorer}
        className={cn(
          "hover:bg-muted group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
          showExplorer ? "text-primary" : "text-muted-foreground"
        )}
        title="Explorer"
      >
        <Files className="h-5 w-5" />
        {showExplorer && (
          <div className="bg-primary absolute left-0 h-6 w-0.5 rounded-r-full" />
        )}
      </button>

      <div className="mt-auto" />

      <button
        onClick={onOpenRecentFiles}
        className={cn(
          "hover:bg-muted group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
          activePath === "recent-files://"
            ? "text-primary"
            : "text-muted-foreground"
        )}
        title="Recent Files"
      >
        <Clock className="h-5 w-5" />
        {activePath === "recent-files://" && (
          <div className="bg-primary absolute left-0 h-6 w-0.5 rounded-r-full" />
        )}
      </button>

      <button
        onClick={onOpenSettings}
        className={cn(
          "hover:bg-muted group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
          activePath === "settings://"
            ? "text-primary"
            : "text-muted-foreground"
        )}
        title="Settings"
      >
        <Settings className="h-5 w-5" />
        {activePath === "settings://" && (
          <div className="bg-primary absolute left-0 h-6 w-0.5 rounded-r-full" />
        )}
      </button>
    </aside>
  );
}
