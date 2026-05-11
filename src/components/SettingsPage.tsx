import * as React from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const { fontSize, setFontSize, showLineNumbers, setShowLineNumbers } =
    useSettingsStore();

  const handleIncrement = () => setFontSize(Math.min(fontSize + 1, 72));
  const handleDecrement = () => setFontSize(Math.max(fontSize - 1, 8));

  return (
    <div className="bg-background flex-1 overflow-auto p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-3xl font-bold">Settings</h1>

        <section className="space-y-6">
          <div>
            <h2 className="text-primary mb-4 text-xl font-semibold">Editor</h2>
            <div className="space-y-4">
              <div className="bg-muted/30 border-border flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="font-medium">Font Size</div>
                  <div className="text-muted-foreground text-sm">
                    Adjust the font size of the editor.
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDecrement}
                      className="hover:bg-muted border-border flex h-8 w-8 items-center justify-center rounded border transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="range"
                      min="8"
                      max="72"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="accent-primary bg-muted h-1.5 w-32 cursor-pointer appearance-none rounded-lg"
                    />
                    <button
                      onClick={handleIncrement}
                      className="hover:bg-muted border-border flex h-8 w-8 items-center justify-center rounded border transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) =>
                        setFontSize(
                          Math.max(
                            8,
                            Math.min(72, parseInt(e.target.value) || 18)
                          )
                        )
                      }
                      className="bg-background border-border focus:ring-primary w-16 rounded border px-2 py-1 text-center focus:ring-2 focus:outline-none"
                      min="8"
                      max="72"
                    />
                    <span className="text-muted-foreground text-sm">px</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 border-border flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="font-medium">Show Line Numbers</div>
                  <div className="text-muted-foreground text-sm">
                    Display line numbers on the left side of the editor.
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => setShowLineNumbers(!showLineNumbers)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      showLineNumbers ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        showLineNumbers ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
