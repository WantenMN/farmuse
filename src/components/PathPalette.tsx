import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { commandManager } from "../systems/commandManager";
import { invoke } from "@tauri-apps/api/core";
import { Folder, FileText } from "lucide-react";
import { fuzzyFilter } from "@/lib/search";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface PathPaletteProps {
  commandId: string;
  commandName: string;
  commandDescription: string;
  mode: "file" | "folder";
  onSelect: (path: string, name: string) => void;
  placeholder?: string;
}

export function PathPalette({
  commandId,
  commandName,
  commandDescription,
  mode,
  onSelect,
  placeholder = "Search path...",
}: PathPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("~/");
  const [suggestions, setSuggestions] = React.useState<FileEntry[]>([]);
  const [selectedValue, setSelectedValue] = React.useState<string>("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    commandManager.register({
      id: commandId,
      name: commandName,
      description: commandDescription,
      handler: (args?: unknown) => {
        const fileArgs = args as { path: string; name?: string } | undefined;
        if (fileArgs?.path) {
          onSelect(
            fileArgs.path,
            fileArgs.name || fileArgs.path.split("/").pop() || ""
          );
        } else {
          setOpen(true);
          setInputValue("~/");
          setTimeout(() => {
            if (inputRef.current) {
              const len = inputRef.current.value.length;
              inputRef.current.setSelectionRange(len, len);
            }
          }, 0);
        }
      },
    });

    return () => {
      commandManager.unregister(commandId);
    };
  }, [commandId, commandName, commandDescription, onSelect]);

  const fetchSuggestions = React.useCallback(
    async (path: string) => {
      try {
        let dirToList = path;
        if (!path.endsWith("/") && path.includes("/")) {
          dirToList = path.substring(0, path.lastIndexOf("/") + 1);
        }

        const items = await invoke<FileEntry[]>("list_directory_contents", {
          path: dirToList,
        });
        // If folder mode, only show directories
        const filteredItems =
          mode === "folder" ? items.filter((i) => i.is_dir) : items;
        setSuggestions(filteredItems);
      } catch (e) {
        console.error("Failed to fetch suggestions", e);
        setSuggestions([]);
      }
    },
    [mode]
  );

  React.useEffect(() => {
    if (open) {
      fetchSuggestions(inputValue);
    }
  }, [open, inputValue, fetchSuggestions]);

  const handleSelection = (item: FileEntry) => {
    let newPath = "";
    if (inputValue.includes("/")) {
      const lastSlashIndex = inputValue.lastIndexOf("/");
      newPath = inputValue.substring(0, lastSlashIndex + 1) + item.name;
    } else {
      newPath = item.name;
    }

    if (item.is_dir) {
      if (!newPath.endsWith("/")) {
        newPath += "/";
      }
      setInputValue(newPath);
    } else if (mode === "file") {
      onSelect(item.path, item.name);
      setOpen(false);
    }
  };

  const handleConfirm = () => {
    if (mode === "folder" && inputValue) {
      onSelect(
        inputValue,
        inputValue.split("/").filter(Boolean).pop() || "Root"
      );
      setOpen(false);
    } else {
      const selected = filteredSuggestions.find(
        (s) => s.name === selectedValue
      );
      if (selected) {
        handleSelection(selected);
      }
    }
  };

  const lastPart = inputValue.split("/").pop() || "";
  const filteredSuggestions = React.useMemo(() => {
    return fuzzyFilter(suggestions, lastPart, (s) => s.name).slice(0, 20);
  }, [suggestions, lastPart]);

  // Auto-scroll to selected item
  React.useEffect(() => {
    if (open && selectedValue) {
      // Small delay to ensure cmdk has updated the DOM attributes
      const timer = setTimeout(() => {
        const selectedElement = document.querySelector(
          `[cmdk-item][data-value="${selectedValue}"]`
        );
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: "nearest" });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedValue, open]);

  React.useEffect(() => {
    if (filteredSuggestions.length > 0) {
      const currentSelected = filteredSuggestions.find(
        (c) => c.name === selectedValue
      );
      if (!currentSelected) {
        setSelectedValue(filteredSuggestions[0].name);
      }
    } else {
      setSelectedValue("");
    }
  }, [filteredSuggestions, selectedValue]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      commandProps={{
        shouldFilter: false,
        value: selectedValue,
        onValueChange: setSelectedValue,
      }}
    >
      <VisuallyHidden.Root>
        <DialogTitle>{commandName}</DialogTitle>
      </VisuallyHidden.Root>
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup
          heading={mode === "file" ? "Files & Directories" : "Directories"}
        >
          {filteredSuggestions.map((item) => (
            <CommandItem
              key={item.path}
              value={item.name}
              onSelect={() => handleSelection(item)}
              className="cursor-pointer py-3"
            >
              {item.is_dir ? (
                <Folder className="mr-2 h-4 w-4 opacity-50" />
              ) : (
                <FileText className="mr-2 h-4 w-4 opacity-50" />
              )}
              <div className="text-sm font-medium">{item.name}</div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <CommandInput
        ref={inputRef}
        placeholder={placeholder}
        value={inputValue}
        onValueChange={setInputValue}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (filteredSuggestions.length > 0) {
              const currentIndex = filteredSuggestions.findIndex(
                (s) => s.name === selectedValue
              );
              const nextIndex = (currentIndex + 1) % filteredSuggestions.length;
              setSelectedValue(filteredSuggestions[nextIndex].name);
            }
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (filteredSuggestions.length > 0) {
              const currentIndex = filteredSuggestions.findIndex(
                (s) => s.name === selectedValue
              );
              const nextIndex =
                (currentIndex - 1 + filteredSuggestions.length) %
                filteredSuggestions.length;
              setSelectedValue(filteredSuggestions[nextIndex].name);
            }
          } else if (e.key === "Tab") {
            e.preventDefault();
            const selected = filteredSuggestions.find(
              (s) => s.name === selectedValue
            );
            if (selected) handleSelection(selected);
          } else if (e.key === "Enter") {
            const selected = filteredSuggestions.find(
              (s) => s.name === selectedValue
            );
            if (selected && lastPart !== "" && lastPart !== selected.name) {
              handleSelection(selected);
            } else {
              handleConfirm();
            }
          }
        }}
      />
    </CommandDialog>
  );
}
