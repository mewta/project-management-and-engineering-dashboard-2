import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AppShell } from "@/components/layout/app-shell";
import { OrganizationClient } from "@/components/dashboard/organization-client";
import { authOptions } from "@/lib/auth";

type OrganizationPageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { orgId } = await params;

  return (
    <AppShell
      title="Organization"
      description="Create projects and choose the workspace you want to manage."
    >
      <OrganizationClient organizationId={orgId} />
    </AppShell>
  );
}
