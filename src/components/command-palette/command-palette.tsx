"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CommandRegistry } from "@/components/command-palette/command-registry";
import type {
  Command,
  CommandContext,
  CommandContextState,
} from "@/components/command-palette/types";

type CommandPage = {
  title: string;
  source: Command;
};

type CommandPaletteProps = {
  registry: CommandRegistry;
  registryVersion: number;
  currentUserId: string;
  commandContext: CommandContextState;
  onClose: () => void;
  notify: (message: string, variant?: "success" | "error") => void;
};

export function CommandPalette({
  registry,
  registryVersion,
  currentUserId,
  commandContext,
  onClose,
  notify,
}: CommandPaletteProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<CommandPage[]>([]);
  const [remoteResult, setRemoteResult] = useState<{
    key: string;
    commands: Command[];
  }>({ key: "", commands: [] });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const context = useMemo<CommandContext>(
    () => ({
      router,
      currentUserId,
      currentProjectId: commandContext.currentProjectId,
      currentIssueId: commandContext.currentIssueId,
      notify,
    }),
    [
      commandContext.currentIssueId,
      commandContext.currentProjectId,
      currentUserId,
      notify,
      router,
    ],
  );

  const currentPage = pages.at(-1);
  const registeredCommands = useMemo(() => {
    void registryVersion;
    return registry.getAll(undefined, context);
  }, [context, registry, registryVersion]);
  const sources = useMemo(
    () =>
      currentPage
        ? [currentPage.source]
        : registeredCommands.filter((command) => command.getSubCommands),
    [currentPage, registeredCommands],
  );
  const shouldResolve = sources.length > 0 && (Boolean(currentPage) || Boolean(query.trim()));
  const requestKey = `${currentPage?.source.id ?? "root"}:${query}:${registryVersion}`;
  const remoteCommands = useMemo(
    () =>
      shouldResolve && remoteResult.key === requestKey ? remoteResult.commands : [],
    [remoteResult, requestKey, shouldResolve],
  );
  const isResolving = shouldResolve && remoteResult.key !== requestKey;
  const visibleCommands = useMemo(
    () =>
      rankCommands(
        deduplicateCommands([
          ...(currentPage ? [] : registeredCommands),
          ...remoteCommands,
        ]),
        query,
      ),
    [currentPage, query, registeredCommands, remoteCommands],
  );

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (!shouldResolve) {
      return;
    }

    let isActive = true;

    const handle = window.setTimeout(() => {
      Promise.all(
        sources.map((command) =>
          command.getSubCommands?.(context, query).catch(() => []) ?? [],
        ),
      ).then((groups) => {
        if (isActive) {
          setRemoteResult({
            key: requestKey,
            commands: groups.flat(),
          });
        }
      });
    }, 200);

    return () => {
      isActive = false;
      window.clearTimeout(handle);
    };
  }, [context, query, requestKey, shouldResolve, sources]);

  function popPage() {
    setPages((current) => current.slice(0, -1));
    setQuery("");
    setSelectedIndex(0);
  }

  async function selectCommand(command: Command) {
    if (command.getSubCommands) {
      setPages((current) => [...current, { title: command.label, source: command }]);
      setQuery("");
      setSelectedIndex(0);
      return;
    }

    try {
      await command.run(context);
      onClose();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "The command could not be completed",
        "error",
      );
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "Backspace" && query.length === 0 && pages.length > 0) {
      event.preventDefault();
      popPage();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) =>
        visibleCommands.length === 0 ? 0 : (index + 1) % visibleCommands.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) =>
        visibleCommands.length === 0
          ? 0
          : (index - 1 + visibleCommands.length) % visibleCommands.length,
      );
      return;
    }

    if (event.key === "Enter") {
      const command = visibleCommands[selectedIndex];
      if (command) {
        event.preventDefault();
        void selectCommand(command);
      }
      return;
    }

    if (event.key === "Tab") {
      trapFocus(event, dialogRef.current);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 px-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-2xl overflow-hidden rounded-lg border bg-background shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        <div className="flex h-14 items-center gap-3 border-b px-4">
          {currentPage ? (
            <button
              type="button"
              onClick={popPage}
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
              aria-label="Back to previous commands"
            >
              <ArrowLeft className="size-4" />
            </button>
          ) : (
            <Search className="size-4 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder={currentPage ? `Search ${currentPage.title.toLowerCase()}` : "Type a command or search..."}
            aria-label="Search commands"
          />
          <kbd className="rounded border bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        {currentPage ? (
          <div className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">
            {currentPage.title}
          </div>
        ) : null}

        <div className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
          {visibleCommands.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              {isResolving ? "Searching..." : "No matching commands"}
            </div>
          ) : (
            visibleCommands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                role="option"
                aria-selected={selectedIndex === index}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => void selectCommand(command)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left ${
                  selectedIndex === index ? "bg-muted" : "hover:bg-muted/60"
                }`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                  {command.icon ?? <Search className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{command.label}</span>
                  {command.subtitle ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {command.subtitle}
                    </span>
                  ) : null}
                </span>
                {command.shortcut ? (
                  <span className="flex gap-1">
                    {command.shortcut.map((key) => (
                      <kbd
                        key={key}
                        className="rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {key}
                      </kbd>
                    ))}
                  </span>
                ) : null}
                {command.getSubCommands ? (
                  <ChevronRight className="size-4 text-muted-foreground" />
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span>Use ↑ ↓ to navigate</span>
          <span>Enter to select</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function deduplicateCommands(commands: Command[]) {
  return Array.from(new Map(commands.map((command) => [command.id, command])).values());
}

function rankCommands(commands: Command[], query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return commands;
  }

  return commands
    .map((command) => ({
      command,
      score: fuzzyScore(
        `${command.label} ${command.subtitle ?? ""} ${command.keywords.join(" ")}`,
        normalizedQuery,
      ),
    }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.command);
}

function fuzzyScore(value: string, query: string) {
  const haystack = normalize(value);
  const terms = query.split(/\s+/).filter(Boolean);
  let score = 0;

  for (const term of terms) {
    const directIndex = haystack.indexOf(term);
    if (directIndex >= 0) {
      score += 100 - Math.min(directIndex, 50);
      continue;
    }

    let termIndex = 0;
    let gapPenalty = 0;
    let previousMatch = -1;

    for (let index = 0; index < haystack.length && termIndex < term.length; index += 1) {
      if (haystack[index] === term[termIndex]) {
        if (previousMatch >= 0) {
          gapPenalty += index - previousMatch - 1;
        }
        previousMatch = index;
        termIndex += 1;
      }
    }

    if (termIndex !== term.length) {
      return -1;
    }

    if (gapPenalty > Math.max(term.length * 3, 6)) {
      return -1;
    }

    score += 40 - Math.min(gapPenalty, 30);
  }

  return score;
}

function normalize(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function trapFocus(
  event: React.KeyboardEvent<HTMLDivElement>,
  container: HTMLDivElement | null,
) {
  if (!container) {
    return;
  }

  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );

  if (focusable.length === 0) {
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
