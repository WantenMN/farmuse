import * as React from "react";
import { cn } from "@/lib/utils";

interface TabFile {
  path: string;
  name: string;
}

interface TabSwitcherProps {
  openFiles: TabFile[];
  activeFilePath: string | null;
  mruOrder: string[];
  onSelect: (path: string) => void;
}

export function TabSwitcher({
  openFiles,
  activeFilePath,
  mruOrder,
  onSelect,
}: TabSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const itemRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const el = itemRefs.current.get(selectedIndex);
    const container = scrollRef.current;
    if (!el || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const buffer = 2 * elRect.height;

    if (elRect.bottom > containerRect.bottom - buffer) {
      container.scrollTop += elRect.bottom - containerRect.bottom + buffer;
    } else if (elRect.top < containerRect.top + buffer) {
      container.scrollTop += elRect.top - containerRect.top - buffer;
    }
  }, [selectedIndex, isOpen]);

  const mruFiles = React.useMemo(() => {
    const files: TabFile[] = [];
    for (const path of mruOrder) {
      const file = openFiles.find((f) => f.path === path);
      if (file) files.push(file);
    }
    for (const file of openFiles) {
      if (!files.find((f) => f.path === file.path)) {
        files.push(file);
      }
    }
    return files;
  }, [mruOrder, openFiles]);

  const open = React.useCallback(() => {
    if (mruFiles.length < 2) return;
    setIsOpen(true);
    setSelectedIndex(1);
  }, [mruFiles.length]);

  const cycle = React.useCallback(
    (direction: 1 | -1) => {
      if (!isOpen) {
        open();
        return;
      }
      setSelectedIndex((prev) => {
        const next = prev + direction;
        if (next < 0) return mruFiles.length - 1;
        if (next >= mruFiles.length) return 0;
        return next;
      });
    },
    [isOpen, open, mruFiles.length]
  );

  const close = React.useCallback(
    (commit: boolean) => {
      if (!isOpen) return;
      setIsOpen(false);
      if (commit && mruFiles[selectedIndex]) {
        onSelect(mruFiles[selectedIndex].path);
      }
    },
    [isOpen, mruFiles, selectedIndex, onSelect]
  );

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.code !== "Tab") return;

      e.preventDefault();
      e.stopPropagation();

      if (e.shiftKey) {
        cycle(-1);
      } else {
        cycle(1);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        e.preventDefault();
        close(true);
      }
    };

    const handleBlur = () => close(false);

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("keyup", handleKeyUp, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("blur", handleBlur);
    };
  }, [cycle, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onKeyUp={() => close(true)}>
      <div className="bg-popover text-popover-foreground border-border absolute top-[12%] left-1/2 w-[480px] -translate-x-1/2 rounded-lg border shadow-xl">
        <div className="text-muted-foreground border-border border-b px-3 py-2 text-xs font-medium">
          Open Editors
        </div>
        <div ref={scrollRef} className="max-h-[400px] overflow-y-auto p-1">
          {mruFiles.map((file, i) => (
            <div
              key={file.path}
              ref={(el) => {
                if (el) itemRefs.current.set(i, el);
                else itemRefs.current.delete(i);
              }}
              className={cn(
                "flex items-center rounded-md px-3 py-1.5 text-sm",
                i === selectedIndex && "bg-accent text-accent-foreground"
              )}
            >
              <span className="truncate">{file.name.replace(/\.md$/, "")}</span>
              {file.path === activeFilePath && (
                <span className="text-muted-foreground ml-auto pl-2 text-xs">
                  current
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
