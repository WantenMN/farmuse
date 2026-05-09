import * as React from "react";
import { FileText } from "lucide-react";

export function EditorUnsupportedState() {
  return (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center select-none">
      <FileText className="mb-4 h-12 w-12 opacity-20" />
      <p className="text-sm">Only markdown files are supported for editing</p>
    </div>
  );
}
