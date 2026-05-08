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
import { fuzzyFilter } from "@/lib/search";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState("");

  React.useEffect(() => {
    commandManager.register({
      id: "open-command-palette",
      name: "Open Command Palette",
      description: "Show the command input box",
      handler: () => {
        setOpen(true);
        setSearch("");
      },
      visible: false,
    });

    return () => {
      commandManager.unregister("open-command-palette");
    };
  }, []);

  const allCommands = React.useMemo(() => {
    return commandManager
      .getAllCommands()
      .filter((cmd) => cmd.visible !== false);
  }, []);

  const filteredCommands = React.useMemo(() => {
    return fuzzyFilter(allCommands, search, (cmd) => cmd.name);
  }, [allCommands, search]);

  // Auto-select first item when search changes
  React.useEffect(() => {
    if (filteredCommands.length > 0) {
      if (!selectedId || !filteredCommands.find((c) => c.id === selectedId)) {
        setSelectedId(filteredCommands[0].id);
      }
    } else {
      setSelectedId("");
    }
  }, [filteredCommands, selectedId]);

  // Auto-scroll to selected item
  React.useEffect(() => {
    if (open && selectedId) {
      const timer = setTimeout(() => {
        // cmdk lowercases the value attribute
        const selectedElement = document.querySelector(
          `[cmdk-item][data-value="${selectedId.toLowerCase()}"]`
        );
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: "nearest" });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedId, open]);

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
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Commands">
          {filteredCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={cmd.id}
              onSelect={() => {
                commandManager.execute(cmd.id);
                setOpen(false);
              }}
              className="flex cursor-pointer flex-col items-start py-3"
            >
              <div className="text-sm font-medium">{cmd.name}</div>
              <div className="text-muted-foreground text-xs">
                {cmd.description}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
    </CommandDialog>
  );
}
