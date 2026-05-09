interface EditorLoadingStateProps {
  name: string | null;
}

export function EditorLoadingState({ name }: EditorLoadingStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center select-none">
      <p className="animate-pulse text-sm">Loading {name}...</p>
    </div>
  );
}
