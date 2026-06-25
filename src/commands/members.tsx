"use client";

import { UserRoundCheck } from "lucide-react";
import type { Command } from "@/components/command-palette/types";
import { searchCommandData, stripCommandTerms } from "@/commands/search";
import { getMutationErrorMessage } from "@/lib/demo-client";

export function createAssignIssueCommand({
  issueId,
  onChanged,
}: {
  issueId: string;
  onChanged: () => void | Promise<void>;
}): Command {
  return {
    id: `members.assign.${issueId}`,
    label: "Assign to...",
    subtitle: "Choose a project member",
    icon: <UserRoundCheck className="size-4" />,
    keywords: ["assignee", "owner", "member", "assign"],
    scope: "issue",
    run: () => undefined,
    getSubCommands: async (context, query) => {
      const searchQuery = stripCommandTerms(query, ["assign", "to", "member"]);
      const results = await searchCommandData({
        query: searchQuery,
        scope: "members",
        projectId: context.currentProjectId,
      });

      return [
        {
          id: `members.assign.${issueId}.unassigned`,
          label: "Unassign issue",
          subtitle: "Remove the current assignee",
          icon: <UserRoundCheck className="size-4" />,
          keywords: ["none", "unassigned", "remove"],
          scope: "issue" as const,
          run: async ({ notify }) => {
            await assignIssue(issueId, null);
            notify("Issue unassigned");
            await onChanged();
          },
        },
        ...results.members.map((member) => ({
          id: `members.assign.${issueId}.${member.id}`,
          label: `Assign to ${member.name}`,
          subtitle: "Project member",
          icon: <UserRoundCheck className="size-4" />,
          keywords: ["assign", "member", member.name],
          scope: "issue" as const,
          run: async ({ notify }: Parameters<Command["run"]>[0]) => {
            await assignIssue(issueId, member.id);
            notify(`Assigned issue to ${member.name}`);
            await onChanged();
          },
        })),
      ];
    },
  };
}

async function assignIssue(issueId: string, assigneeId: string | null) {
  const response = await fetch(`/api/issues/${issueId}/assign`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assigneeId }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(
      getMutationErrorMessage(body?.error, "Could not assign issue"),
    );
  }
}
