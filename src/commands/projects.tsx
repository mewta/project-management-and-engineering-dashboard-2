"use client";

import { FolderKanban } from "lucide-react";
import type { Command } from "@/components/command-palette/types";
import { searchCommandData, stripCommandTerms } from "@/commands/search";

export const projectCommands: Command[] = [
  {
    id: "projects.go-to",
    label: "Go to project",
    subtitle: "Search projects you can access",
    icon: <FolderKanban className="size-4" />,
    keywords: ["open", "navigate", "workspace", "project"],
    scope: "global",
    shortcut: ["G", "P"],
    run: () => undefined,
    getSubCommands: async (context, query) => {
      const searchQuery = stripCommandTerms(query, ["go", "to", "project", "open"]);
      const results = await searchCommandData({
        query: searchQuery,
        scope: "projects",
      });

      return results.projects.map((project) => ({
        id: `projects.open.${project.id}`,
        label: project.name,
        subtitle: "Open project",
        icon: <FolderKanban className="size-4" />,
        keywords: ["project", "navigate", "open"],
        scope: "global",
        run: ({ router }) => {
          router.push(`/projects/${project.id}`);
        },
      }));
    },
  },
];
