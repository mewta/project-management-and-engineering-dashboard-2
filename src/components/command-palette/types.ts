import type { ReactNode } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export type CommandScope = "global" | "project" | "issue";

export type CommandContext = {
  router: AppRouterInstance;
  currentProjectId?: string;
  currentIssueId?: string;
  currentUserId: string;
  notify: (message: string, variant?: "success" | "error") => void;
};

export type Command = {
  id: string;
  label: string;
  subtitle?: string;
  icon?: ReactNode;
  keywords: string[];
  scope: CommandScope;
  shortcut?: string[];
  run: (ctx: CommandContext, input?: unknown) => void | Promise<void>;
  getSubCommands?: (ctx: CommandContext, query: string) => Promise<Command[]>;
};

export type CommandContextState = Pick<
  CommandContext,
  "currentProjectId" | "currentIssueId"
>;
