import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { commandManager } from "../systems/commandManager";
import { invoke } from "@tauri-apps/api/core";
import { FileIcon, Clock } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

interface MarkdownFile {
  id: number;
  path: string;
  filename: string;
}

interface QuickOpenProps {
  onOpenFile: (path: string, name: string) => void;
  currentPath: string | null;
}

function getName(path: string) {
  return path.split(/[/\\]/).filter(Boolean).pop() || path;
}

export function QuickOpen({ onOpenFile, currentPath }: QuickOpenProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<MarkdownFile[]>([]);
  const [recentFiles, setRecentFiles] = React.useState<string[]>([]);
  const [selectedId, setSelectedId] = React.useState("");

  React.useEffect(() => {
    commandManager.register({
      id: "open-quick-open",
      name: "Quick Open File",
      description: "Search and open markdown files",
      handler: () => {
        setOpen(true);
        setSearch("");
      },
      visible: true,
    });

    return () => {
      commandManager.unregister("open-quick-open");
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      const saved = JSON.parse(
        localStorage.getItem("farmuse_recent_files") || "[]"
      ) as string[];
      setRecentFiles(saved);
    }
  }, [open]);

  React.useEffect(() => {
    const fetchResults = async () => {
      if (!search) {
        setResults([]);
        return;
      }
      try {
        const files = await invoke<MarkdownFile[]>("search_markdown_files", {
          query: search,
          rootPath: currentPath,
        });
        setResults(files);
        if (files.length > 0) {
          setSelectedId(files[0].path);
        } else {
          setSelectedId("");
        }
      } catch (e) {
        console.error("Failed to search files", e);
      }
    };

    if (open) {
      fetchResults();
    }
  }, [search, open, currentPath]);

  const showRecent = !search && recentFiles.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      commandProps={{
        shouldFilter: false,
        value: selectedId,
        onValueChange: setSelectedId,
      }}
    >
      <VisuallyHidden.Root>
        <DialogTitle>Quick Open Markdown Files</DialogTitle>
      </VisuallyHidden.Root>
      <CommandList className="h-[300px]">
        {search && results.length === 0 && (
          <CommandEmpty>No files found.</CommandEmpty>
        )}
        {showRecent && (
          <CommandGroup heading="Recent Files">
            {recentFiles.map((path) => (
              <CommandItem
                key={path}
                value={path}
                onSelect={() => {
                  onOpenFile(path, getName(path));
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 py-3"
              >
                <Clock className="text-muted-foreground h-4 w-4" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {getName(path).replace(/\.md$/, "")}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {path}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {search && (
          <CommandGroup>
            {results.map((file) => (
              <CommandItem
                key={file.path}
                value={file.path}
                onSelect={() => {
                  onOpenFile(file.path, file.filename);
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 py-3"
              >
                <FileIcon className="text-muted-foreground h-4 w-4" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{file.filename}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {file.path}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <CommandInput
        placeholder="Type to search files..."
        value={search}
        onValueChange={setSearch}
      />
    </CommandDialog>
  );
}
