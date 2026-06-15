"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FolderPlus } from "lucide-react";
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
  createdAt: string;
  _count: { issues: number };
};

type OrganizationClientProps = {
  organizationId: string;
};

export function OrganizationClient({ organizationId }: OrganizationClientProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const organization = useMemo(
    () => organizations.find((item) => item.id === organizationId),
    [organizations, organizationId],
  );

  async function loadOrganization() {
    const [orgResponse, projectResponse] = await Promise.all([
      fetch("/api/organizations"),
      fetch(`/api/projects?organizationId=${organizationId}`),
    ]);

    if (!orgResponse.ok || !projectResponse.ok) {
      setError("Could not load organization data.");
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

    Promise.all([
      fetch("/api/organizations"),
      fetch(`/api/projects?organizationId=${organizationId}`),
    ])
      .then(async ([orgResponse, projectResponse]) => {
        if (!orgResponse.ok || !projectResponse.ok) {
          throw new Error("Could not load organization data.");
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
          setError("Could not load organization data.");
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [organizationId]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        name,
        key,
        description: description || undefined,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create project.");
      setIsCreating(false);
      return;
    }

    setName("");
    setKey("");
    setDescription("");
    setIsCreating(false);
    setIsLoading(true);
    await loadOrganization();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <section className="rounded-lg border bg-background p-5 shadow-sm">
          <h2 className="text-base font-semibold">Create project</h2>
          <form onSubmit={createProject} className="mt-4 space-y-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Core Platform"
            />
            <input
              value={key}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              required
              minLength={2}
              maxLength={12}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="CORE"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="What this project owns"
            />
            <Button type="submit" className="w-full" disabled={isCreating}>
              <FolderPlus className="mr-2 size-4" />
              {isCreating ? "Creating..." : "Create project"}
            </Button>
          </form>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </section>
      </aside>

      <section className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Organization</p>
            <h2 className="text-xl font-semibold">
              {organization?.name ?? (isLoading ? "Loading..." : "Organization")}
            </h2>
          </div>
          {organization ? (
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
              {organization.memberships[0]?.role ?? "MEMBER"}
            </span>
          ) : null}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet. Create one to start tracking issues.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-lg border p-4 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">
                      {project.key} · {project.name}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {project.description || "No description"}
                    </p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs">
                    {project._count.issues} issues
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
