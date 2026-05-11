import { AlertCircle } from "lucide-react";

interface EditorErrorStateProps {
  error: string;
}

export function EditorErrorState({ error }: EditorErrorStateProps) {
  return (
    <div className="text-destructive flex flex-1 flex-col items-center justify-center p-4 text-center select-none">
      <AlertCircle className="mb-4 h-12 w-12 opacity-50" />
      <h3 className="mb-1 font-semibold">Cannot Open File</h3>
      <p className="max-w-xs text-sm">{error}</p>
    </div>
  );
}
