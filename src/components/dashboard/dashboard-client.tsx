"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Organization = {
  id: string;
  name: string;
  slug: string;
  memberships: { role: string }[];
  _count: { projects: number; memberships: number };
};

type Project = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  organization: { id: string; name: string; slug: string };
  _count: { issues: number };
};

export function DashboardClient() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const stats = useMemo(
    () => ({
      organizations: organizations.length,
      projects: projects.length,
      issues: projects.reduce((total, project) => total + project._count.issues, 0),
    }),
    [organizations, projects],
  );

  async function loadDashboard() {
    const [orgResponse, projectResponse] = await Promise.all([
      fetch("/api/organizations"),
      fetch("/api/projects"),
    ]);

    if (!orgResponse.ok || !projectResponse.ok) {
      setError("Could not load dashboard data.");
      setIsLoading(false);
      return;
    }

    const orgBody = (await orgResponse.json()) as { organizations: Organization[] };
    const projectBody = (await projectResponse.json()) as { projects: Project[] };
    setOrganizations(orgBody.organizations);
    setProjects(projectBody.projects);
    setIsLoading(false);
  }

  useEffect(() => {
    let isActive = true;

    Promise.all([fetch("/api/organizations"), fetch("/api/projects")])
      .then(async ([orgResponse, projectResponse]) => {
        if (!orgResponse.ok || !projectResponse.ok) {
          throw new Error("Could not load dashboard data.");
        }

        const orgBody = (await orgResponse.json()) as { organizations: Organization[] };
        const projectBody = (await projectResponse.json()) as { projects: Project[] };

        if (isActive) {
          setOrganizations(orgBody.organizations);
          setProjects(projectBody.projects);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isActive) {
          setError("Could not load dashboard data.");
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);

    const response = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: organizationName }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create organization.");
      setIsCreating(false);
      return;
    }

    setOrganizationName("");
    setIsCreating(false);
    setIsLoading(true);
    await loadDashboard();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-6">
        <section className="rounded-lg border bg-background p-5 shadow-sm">
          <h2 className="text-base font-semibold">Create organization</h2>
          <form onSubmit={createOrganization} className="mt-4 space-y-3">
            <input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              required
              minLength={2}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Engineering Team"
            />
            <Button type="submit" className="w-full" disabled={isCreating}>
              <Plus className="mr-2 size-4" />
              {isCreating ? "Creating..." : "Create organization"}
            </Button>
          </form>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </section>

        <section className="grid grid-cols-3 gap-3">
          <Stat label="Orgs" value={stats.organizations} />
          <Stat label="Projects" value={stats.projects} />
          <Stat label="Issues" value={stats.issues} />
        </section>
      </aside>

      <section className="space-y-6">
        <Panel title="Organizations" icon={<Building2 className="size-5" />}>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading organizations...</p>
          ) : organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create your first organization to start adding projects.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {organizations.map((organization) => (
                <Link
                  key={organization.id}
                  href={`/organizations/${organization.id}`}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted/60"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium">{organization.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {organization._count.projects} projects ·{" "}
                        {organization._count.memberships} members
                      </p>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                      {organization.memberships[0]?.role ?? "MEMBER"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent projects" icon={<FolderKanban className="size-5" />}>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading projects...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Projects will appear here after you create them inside an organization.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/60"
                >
                  <div>
                    <h3 className="font-medium">
                      {project.key} · {project.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {project.organization.name} · {project._count.issues} issues
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">Open</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-4 text-center shadow-sm">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-background p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
