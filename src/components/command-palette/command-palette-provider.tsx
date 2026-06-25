"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { CommandRegistry } from "@/components/command-palette/command-registry";
import type {
  Command,
  CommandContextState,
} from "@/components/command-palette/types";
import { issueNavigationCommands } from "@/commands/issues";
import { navigationCommands } from "@/commands/navigation";
import { projectCommands } from "@/commands/projects";

type CommandPaletteContextValue = {
  registerCommand: (command: Command | Command[]) => () => void;
  open: () => void;
  close: () => void;
  setCommandContext: (context: CommandContextState) => void;
  notify: (message: string, variant?: "success" | "error") => void;
  isDemo: boolean;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({
  children,
  currentUserId,
  currentUserIsDemo,
}: {
  children: React.ReactNode;
  currentUserId: string | null;
  currentUserIsDemo: boolean;
}) {
  const [registry] = useState(() => new CommandRegistry());
  const [isOpen, setIsOpen] = useState(false);
  const [registryVersion, setRegistryVersion] = useState(0);
  const [commandContext, setCommandContextState] = useState<CommandContextState>({});
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  useEffect(
    () =>
      registry.subscribe(() => {
        setRegistryVersion((version) => version + 1);
      }),
    [registry],
  );

  useEffect(() => {
    const commands = [
      ...navigationCommands,
      ...projectCommands,
      ...issueNavigationCommands,
    ];
    const cleanups = commands.map((command) => registry.register(command));

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [registry]);

  const open = useCallback(() => {
    if (currentUserId) {
      setIsOpen(true);
    }
  }, [currentUserId]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    }

    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [open]);

  const registerCommand = useCallback(
    (command: Command | Command[]) => {
      const commands = Array.isArray(command) ? command : [command];
      const cleanups = commands.map((item) => registry.register(item));

      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    },
    [registry],
  );

  const setCommandContext = useCallback((context: CommandContextState) => {
    setCommandContextState(context);
  }, []);

  const notify = useCallback(
    (message: string, variant: "success" | "error" = "success") => {
      setToast({ message, variant });
      window.setTimeout(() => {
        setToast((current) => (current?.message === message ? null : current));
      }, 3500);
    },
    [],
  );

  const value = useMemo(
    () => ({
      registerCommand,
      open,
      close,
      setCommandContext,
      notify,
      isDemo: currentUserIsDemo,
    }),
    [
      close,
      currentUserIsDemo,
      notify,
      open,
      registerCommand,
      setCommandContext,
    ],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {currentUserId && isOpen ? (
        <CommandPalette
          registry={registry}
          registryVersion={registryVersion}
          currentUserId={currentUserId}
          commandContext={commandContext}
          onClose={close}
          notify={notify}
        />
      ) : null}
      {toast ? (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-[70] max-w-sm rounded-md border bg-background px-4 py-3 text-sm shadow-lg ${
            toast.variant === "error" ? "border-destructive text-destructive" : ""
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);

  if (!context) {
    throw new Error("useCommandPalette must be used inside CommandPaletteProvider");
  }

  return context;
}
