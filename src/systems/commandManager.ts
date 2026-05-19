type CommandHandler = (args?: unknown) => void;

export interface Command {
  id: string;
  name: string;
  description: string;
  handler: CommandHandler;
  visible?: boolean;
}

class CommandManager {
  private commands: Map<string, Command> = new Map();
  private usageHistory: string[] = [];

  register(command: Command) {
    this.commands.set(command.id, command);
  }

  unregister(id: string) {
    this.commands.delete(id);
  }

  execute(id: string, args?: unknown) {
    const command = this.commands.get(id);
    if (command) {
      command.handler(args);
      this.usageHistory = [id, ...this.usageHistory.filter((h) => h !== id)];
      return true;
    }
    return false;
  }

  getAllCommands(): Command[] {
    const all = Array.from(this.commands.values());
    return all.sort((a, b) => {
      const indexA = this.usageHistory.indexOf(a.id);
      const indexB = this.usageHistory.indexOf(b.id);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
  }
}

export const commandManager = new CommandManager();
