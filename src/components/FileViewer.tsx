import * as React from "react"
import { invoke } from "@tauri-apps/api/core"
import { cn } from "@/lib/utils"
import { FileText, AlertCircle } from "lucide-react"

interface FileViewerProps {
  path: string | null;
  name: string | null;
}

export function FileViewer({ path, name }: FileViewerProps) {
  const [content, setContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!path) {
      setContent(null);
      setError(null);
      return;
    }

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<string>("read_file_content", { path });
        setContent(result);
      } catch (e) {
        console.error("Failed to read file", e);
        setError("Unable to open: This file might be binary or use an unsupported encoding.");
        setContent(null);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [path]);

  if (!path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-sm">Select a file to view its content</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm animate-pulse">Loading {name}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-destructive p-4 text-center">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
        <h3 className="font-semibold mb-1">Cannot Open File</h3>
        <p className="text-sm max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium truncate">{name}</span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="font-mono text-sm whitespace-pre-wrap break-all">
          {content}
        </pre>
      </div>
    </div>
  );
}
