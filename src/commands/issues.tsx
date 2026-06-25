"use client";

import { CircleDot, ListPlus, Tags } from "lucide-react";
import type { Command } from "@/components/command-palette/types";
import { searchCommandData, stripCommandTerms } from "@/commands/search";

type IssueStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

const statusLabels: Record<IssueStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

const allowedTransitions: Record<IssueStatus, IssueStatus[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["TODO", "IN_REVIEW"],
  IN_REVIEW: ["IN_PROGRESS", "DONE"],
  DONE: ["IN_REVIEW"],
};

export const issueNavigationCommands: Command[] = [
  {
    id: "issues.go-to",
    label: "Go to issue",
    subtitle: "Search issues you can access",
    icon: <CircleDot className="size-4" />,
    keywords: ["open", "navigate", "task", "ticket", "issue"],
    scope: "global",
    shortcut: ["G", "I"],
    run: () => undefined,
    getSubCommands: async (context, query) => {
      const searchQuery = stripCommandTerms(query, ["go", "to", "issue", "open"]);
      const results = await searchCommandData({
        query: searchQuery,
        scope: "issues",
        projectId: context.currentProjectId,
      });

      return results.issues.map((issue) => ({
        id: `issues.open.${issue.id}`,
        label: `${issue.key} · ${issue.title}`,
        subtitle: statusLabels[issue.status as IssueStatus] ?? issue.status,
        icon: <CircleDot className="size-4" />,
        keywords: ["issue", "task", "ticket", issue.status],
        scope: context.currentProjectId ? "project" : "global",
        run: ({ router }) => {
          router.push(`/projects/${issue.projectId}?issue=${issue.id}`);
          window.dispatchEvent(
            new CustomEvent("devboard:select-issue", {
              detail: {
                issueId: issue.id,
                projectId: issue.projectId,
              },
            }),
          );
        },
      }));
    },
  },
];

export function createProjectIssueCommands({
  focusCreateIssue,
}: {
  focusCreateIssue: () => void;
}): Command[] {
  return [
    {
      id: "issues.create",
      label: "Create issue",
      subtitle: "Focus the new issue form",
      icon: <ListPlus className="size-4" />,
      keywords: ["new", "task", "ticket", "add"],
      scope: "project",
      shortcut: ["C", "I"],
      run: focusCreateIssue,
    },
  ];
}

export function createMoveIssueCommand({
  issueId,
  status,
  onChanged,
}: {
  issueId: string;
  status: IssueStatus;
  onChanged: () => void | Promise<void>;
}): Command {
  return {
    id: `issues.move.${issueId}`,
    label: "Move to...",
    subtitle: "Change the active issue status",
    icon: <CircleDot className="size-4" />,
    keywords: ["status", "progress", "review", "done", "todo"],
    scope: "issue",
    run: () => undefined,
    getSubCommands: async () =>
      allowedTransitions[status].map((nextStatus) => ({
        id: `issues.move.${issueId}.${nextStatus}`,
        label: `Move to ${statusLabels[nextStatus]}`,
        subtitle: "Update issue status",
        icon: <CircleDot className="size-4" />,
        keywords: ["status", nextStatus, statusLabels[nextStatus]],
        scope: "issue",
        run: async ({ notify }) => {
          const response = await fetch(`/api/issues/${issueId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          });

          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(body?.error ?? "Could not move issue");
          }

          notify(`Issue moved to ${statusLabels[nextStatus]}`);
          await onChanged();
        },
      })),
  };
}

export function createAddLabelCommand({
  issueId,
  labels,
  availableLabels,
  onChanged,
}: {
  issueId: string;
  labels: string[];
  availableLabels: string[];
  onChanged: () => void | Promise<void>;
}): Command {
  return {
    id: `issues.labels.${issueId}`,
    label: "Add label...",
    subtitle: "Apply a project label to the active issue",
    icon: <Tags className="size-4" />,
    keywords: ["tag", "label", "categorize"],
    scope: "issue",
    run: () => undefined,
    getSubCommands: async (_context, query) => {
      const normalizedQuery = stripCommandTerms(query, ["add", "label", "tag"]);
      const candidateLabels = Array.from(
        new Set([
          ...availableLabels,
          ...(normalizedQuery ? [normalizedQuery.toLowerCase()] : []),
        ]),
      )
        .filter((label) => !labels.includes(label))
        .slice(0, 10);

      return candidateLabels.map((label) => ({
        id: `issues.labels.${issueId}.${label}`,
        label: `Add label "${label}"`,
        subtitle: normalizedQuery === label ? "Create and apply label" : "Apply label",
        icon: <Tags className="size-4" />,
        keywords: ["tag", "label", label],
        scope: "issue",
        run: async ({ notify }) => {
          const response = await fetch(`/api/issues/${issueId}/labels`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              labels: [...labels, label],
            }),
          });

          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(body?.error ?? "Could not add label");
          }

          notify(`Added label "${label}"`);
          await onChanged();
        },
      }));
    },
  };
}
