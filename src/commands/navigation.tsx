"use client";

import { LayoutDashboard, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import type { Command } from "@/components/command-palette/types";

export const navigationCommands: Command[] = [
  {
    id: "navigation.dashboard",
    label: "Go to dashboard",
    subtitle: "Open your organizations and recent projects",
    icon: <LayoutDashboard className="size-4" />,
    keywords: ["home", "organizations", "workspace"],
    scope: "global",
    shortcut: ["G", "D"],
    run: ({ router }) => {
      router.push("/dashboard");
    },
  },
  {
    id: "navigation.logout",
    label: "Sign out",
    subtitle: "End the current DevBoard session",
    icon: <LogOut className="size-4" />,
    keywords: ["logout", "exit", "session"],
    scope: "global",
    run: async ({ router }) => {
      await signOut({ redirect: false });
      router.push("/login");
      router.refresh();
    },
  },
];
