import * as React from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { commandManager } from "../systems/commandManager"
import { invoke } from "@tauri-apps/api/core"
import { Folder } from "lucide-react"
import { fuzzyFilter } from "@/lib/search"

interface FolderPaletteProps {
  onFolderSelect: (path: string) => void;
}

export function FolderPalette({ onFolderSelect }: FolderPaletteProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("~/")
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [selectedValue, setSelectedValue] = React.useState<string>("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    commandManager.register({
      id: "open-folder",
      name: "Open Folder",
      description: "Open a directory to view its contents",
      handler: () => {
        setOpen(true)
        setInputValue("~/")
        // Delay setting selection to end of text to ensure it happens after mount/focus
        setTimeout(() => {
            if (inputRef.current) {
                const len = inputRef.current.value.length;
                inputRef.current.setSelectionRange(len, len);
            }
        }, 0);
      },
    })

    return () => {
      commandManager.unregister("open-folder")
    }
  }, [])

  const fetchSuggestions = React.useCallback(async (path: string) => {
    try {
      // Determine which directory to list subdirs for
      let dirToList = path;
      if (!path.endsWith("/") && path.includes("/")) {
          dirToList = path.substring(0, path.lastIndexOf("/") + 1);
      }

      const subdirs = await invoke<string[]>("list_subdirs", { path: dirToList });
      setSuggestions(subdirs);
    } catch (e) {
      console.error("Failed to fetch subdirs", e);
      setSuggestions([]);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchSuggestions(inputValue);
    }
  }, [open, inputValue, fetchSuggestions]);

  const handleSelect = (suggestion: string) => {
    let newPath = inputValue;
    if (newPath.endsWith("/")) {
        newPath += suggestion;
    } else {
        const lastSlash = newPath.lastIndexOf("/");
        newPath = newPath.substring(0, lastSlash + 1) + suggestion;
    }
    if (!newPath.endsWith("/")) {
        newPath += "/";
    }
    setInputValue(newPath);
  };

  const handleConfirm = () => {
    if (inputValue) {
        onFolderSelect(inputValue);
        setOpen(false);
    }
  };

  const lastPart = inputValue.split('/').pop() || "";
  const filteredSuggestions = React.useMemo(() => {
    return fuzzyFilter(suggestions, lastPart, (s) => s).slice(0, 10);
  }, [suggestions, lastPart]);

  // Sync selectedValue with list changes
  React.useEffect(() => {
    if (filteredSuggestions.length > 0) {
      if (!selectedValue || !filteredSuggestions.includes(selectedValue)) {
        setSelectedValue(filteredSuggestions[0]);
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
            onValueChange: setSelectedValue
        }}
    >
      <CommandList>
        <CommandEmpty>No directories found.</CommandEmpty>
        <CommandGroup heading="Directories">
          {filteredSuggestions.map((dir) => (
            <CommandItem
              key={dir}
              value={dir}
              onSelect={() => handleSelect(dir)}
              className="py-3 cursor-pointer"
            >
              <Folder className="mr-2 h-4 w-4 opacity-50" />
              <div className="font-medium text-sm">{dir}</div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <CommandInput
        ref={inputRef}
        placeholder="Enter directory path..."
        value={inputValue}
        onValueChange={setInputValue}
        onKeyDown={(e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                if (selectedValue) {
                    handleSelect(selectedValue);
                }
            } else if (e.key === "Enter") {
                // If there's a suggestion and it's a partial match (not empty, not exact), autocomplete it
                if (selectedValue && lastPart !== "" && lastPart !== selectedValue) {
                    handleSelect(selectedValue);
                } else {
                    handleConfirm();
                }
            }
        }}
      />
    </CommandDialog>
  )
}
