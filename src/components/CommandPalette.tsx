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

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    commandManager.register({
      id: "open-command-palette",
      name: "Open Command Palette",
      description: "Show the command input box",
      handler: () => setOpen(true),
      visible: false
    })

    return () => {
      commandManager.unregister("open-command-palette")
    }
  }, [])

  const commands = React.useMemo(() => {
    return commandManager.getAllCommands().filter(cmd => cmd.visible !== false)
  }, [open])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Commands">
          {commands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              onSelect={() => {
                commandManager.execute(cmd.id)
                setOpen(false)
              }}
              className="flex flex-col items-start py-3 cursor-pointer"
            >
              <div className="font-medium text-sm">{cmd.name}</div>
              <div className="text-xs text-muted-foreground">
                {cmd.description}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <CommandInput placeholder="Type a command or search..." />
    </CommandDialog>
  )
}
