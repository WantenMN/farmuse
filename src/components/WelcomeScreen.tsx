interface WelcomeScreenProps {
  currentPath: string | null;
}

export function WelcomeScreen({ currentPath }: WelcomeScreenProps) {
  return (
    <div className="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">Farmuse</h1>
        <p className="text-muted-foreground text-lg">
          Manage your project with speed.
        </p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="bg-muted/50 border-border/50 rounded-xl border p-6 text-center">
          <p className="text-muted-foreground mb-4 text-sm">Global Shortcuts</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Command Palette</span>
              <kbd className="bg-background rounded border px-2 py-1 font-sans text-xs font-medium shadow-sm">
                Alt + X
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Toggle Explorer</span>
              <kbd className="bg-background rounded border px-2 py-1 font-sans text-xs font-medium shadow-sm">
                Inside Palette
              </kbd>
            </div>
          </div>
        </div>

        {!currentPath && (
          <p className="text-muted-foreground animate-pulse text-center text-sm">
            Type &quot;Open Folder&quot; in palette to get started
          </p>
        )}
      </div>
    </div>
  );
}
