import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { authOptions } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevBoard",
  description: "Real-time project management and engineering dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <CommandPaletteProvider
          currentUserId={session?.user?.id ?? null}
          currentUserIsDemo={session?.user?.isDemo ?? false}
        >
          {children}
        </CommandPaletteProvider>
      </body>
    </html>
  );
}
