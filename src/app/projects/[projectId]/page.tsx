import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectClient } from "@/components/projects/project-client";
import { authOptions } from "@/lib/auth";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { projectId } = await params;

  return (
    <AppShell
      title="Project"
      description="Create issues, move work across the board, comment, and inspect recent activity."
    >
      <ProjectClient projectId={projectId} />
    </AppShell>
  );
}
