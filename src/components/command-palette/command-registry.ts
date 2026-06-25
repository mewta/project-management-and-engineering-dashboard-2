import type {
  Command,
  CommandContext,
  CommandScope,
} from "@/components/command-palette/types";

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();
  private readonly listeners = new Set<() => void>();

  register(command: Command) {
    this.commands.set(command.id, command);
    this.emitChange();

    return () => {
      this.unregister(command.id);
    };
  }

  unregister(id: string) {
    if (this.commands.delete(id)) {
      this.emitChange();
    }
  }

  getAll(scope: CommandScope | undefined, context: CommandContext) {
    return Array.from(this.commands.values()).filter((command) => {
      if (scope && command.scope !== scope) {
        return false;
      }

      if (command.scope === "project" && !context.currentProjectId) {
        return false;
      }

      if (command.scope === "issue" && !context.currentIssueId) {
        return false;
      }

      return true;
    });
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
