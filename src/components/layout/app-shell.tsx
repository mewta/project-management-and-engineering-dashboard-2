"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutDashboard, LogOut, Search } from "lucide-react";
import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import { Button } from "@/components/ui/button";

type AppShellProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

export function AppShell({ children, title, description }: AppShellProps) {
  const router = useRouter();
  const { open } = useCommandPalette();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <LayoutDashboard className="size-5" />
            DevBoard
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={open}>
              <Search className="size-4" />
              <span className="hidden sm:inline">Command palette</span>
              <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
                ⌘K
              </kbd>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
      </section>
    </main>
  );
}
