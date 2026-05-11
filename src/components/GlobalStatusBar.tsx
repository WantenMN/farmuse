import * as React from "react";
import { listen } from "@tauri-apps/api/event";
import { Loader2, Database } from "lucide-react";

export function GlobalStatusBar() {
  const [status, setStatus] = React.useState<"idle" | "indexing">("idle");
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const unlistenStatus = listen<string>("index-status", (event) => {
      setStatus(event.payload as "idle" | "indexing");
      if (event.payload === "indexing") {
        setCount(0);
      }
    });

    const unlistenProgress = listen<number>("index-progress", (event) => {
      setCount(event.payload);
    });

    return () => {
      unlistenStatus.then((u) => u());
      unlistenProgress.then((u) => u());
    };
  }, []);

  if (status === "idle") return null;

  return (
    <div className="bg-background animate-in fade-in slide-in-from-bottom-2 fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border p-3 shadow-lg">
      <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="text-xs font-medium">Indexing Files...</div>
        <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
          <Database className="h-3 w-3" />
          <span>{count} markdown files indexed</span>
        </div>
      </div>
    </div>
  );
}
