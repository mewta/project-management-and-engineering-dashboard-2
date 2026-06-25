"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FolderPlus, MailPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import { getMutationErrorMessage } from "@/lib/demo-client";

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

type Member = {
  id: string;
  role: "OWNER" | "ADMIN" | "DEVELOPER" | "VIEWER";
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type Invitation = {
  id: string;
  email: string;
  role: "ADMIN" | "DEVELOPER" | "VIEWER";
  status: "PENDING" | "ACCEPTED" | "EXPIRED";
  expiresAt: string;
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
};

type OrganizationClientProps = {
  organizationId: string;
};

export function OrganizationClient({ organizationId }: OrganizationClientProps) {
  const { notify } = useCommandPalette();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Invitation["role"]>("DEVELOPER");
  const [latestInviteLink, setLatestInviteLink] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const organization = useMemo(
    () => organizations.find((item) => item.id === organizationId),
    [organizations, organizationId],
  );

  const currentRole = organization?.memberships[0]?.role ?? "VIEWER";
  const canManageProjects = currentRole === "OWNER" || currentRole === "ADMIN";
  const canInviteMembers = currentRole === "OWNER" || currentRole === "ADMIN";
  const canManageRoles = currentRole === "OWNER" || currentRole === "ADMIN";

  async function loadOrganization() {
    const [orgResponse, projectResponse, memberResponse, invitationResponse] =
      await Promise.all([
        fetch("/api/organizations"),
        fetch(`/api/projects?organizationId=${organizationId}`),
        fetch(`/api/organizations/${organizationId}/members`),
        fetch(`/api/organizations/${organizationId}/invitations?status=PENDING`),
      ]);

    if (
      !orgResponse.ok ||
      !projectResponse.ok ||
      !memberResponse.ok ||
      !invitationResponse.ok
    ) {
      setError("Could not load organization data.");
      setIsLoading(false);
      return;
    }

    const orgBody = (await orgResponse.json()) as { organizations: Organization[] };
    const projectBody = (await projectResponse.json()) as { projects: Project[] };
    const memberBody = (await memberResponse.json()) as { members: Member[] };
    const invitationBody = (await invitationResponse.json()) as {
      invitations: Invitation[];
    };

    setOrganizations(orgBody.organizations);
    setProjects(projectBody.projects);
    setMembers(memberBody.members);
    setInvitations(invitationBody.invitations);
    setIsLoading(false);
  }

  useEffect(() => {
    let isActive = true;

    Promise.all([
      fetch("/api/organizations"),
      fetch(`/api/projects?organizationId=${organizationId}`),
      fetch(`/api/organizations/${organizationId}/members`),
      fetch(`/api/organizations/${organizationId}/invitations?status=PENDING`),
    ])
      .then(async ([orgResponse, projectResponse, memberResponse, invitationResponse]) => {
        if (
          !orgResponse.ok ||
          !projectResponse.ok ||
          !memberResponse.ok ||
          !invitationResponse.ok
        ) {
          throw new Error("Could not load organization data.");
        }

        const orgBody = (await orgResponse.json()) as { organizations: Organization[] };
        const projectBody = (await projectResponse.json()) as { projects: Project[] };
        const memberBody = (await memberResponse.json()) as { members: Member[] };
        const invitationBody = (await invitationResponse.json()) as {
          invitations: Invitation[];
        };

        if (isActive) {
          setOrganizations(orgBody.organizations);
          setProjects(projectBody.projects);
          setMembers(memberBody.members);
          setInvitations(invitationBody.invitations);
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
      showMutationError(body?.error, "Could not create project.");
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

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsInviting(true);

    const response = await fetch(`/api/organizations/${organizationId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        role: inviteRole,
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; inviteLink?: string }
      | null;

    if (!response.ok) {
      showMutationError(body?.error, "Could not send invitation.");
      setIsInviting(false);
      return;
    }

    setInviteEmail("");
    setInviteRole("DEVELOPER");
    setLatestInviteLink(body?.inviteLink ?? "");
    setIsInviting(false);
    setIsLoading(true);
    await loadOrganization();
  }

  async function updateRole(member: Member, role: Member["role"]) {
    setError("");

    const response = await fetch(`/api/organizations/${organizationId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        membershipId: member.id,
        role,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      showMutationError(body?.error, "Could not update role.");
      return;
    }

    setIsLoading(true);
    await loadOrganization();
  }

  function showMutationError(message: string | undefined, fallback: string) {
    const friendlyMessage = getMutationErrorMessage(message, fallback);
    setError(friendlyMessage);
    if (message === "Demo accounts are read-only") {
      notify(friendlyMessage, "error");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
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
              disabled={!canManageProjects}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              placeholder="Core Platform"
            />
            <input
              value={key}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              required
              minLength={2}
              maxLength={12}
              disabled={!canManageProjects}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              placeholder="CORE"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!canManageProjects}
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              placeholder="What this project owns"
            />
            <Button type="submit" className="w-full" disabled={isCreating || !canManageProjects}>
              <FolderPlus className="mr-2 size-4" />
              {isCreating ? "Creating..." : "Create project"}
            </Button>
          </form>
        </section>

        <section className="rounded-lg border bg-background p-5 shadow-sm">
          <h2 className="text-base font-semibold">Invite member</h2>
          <form onSubmit={inviteMember} className="mt-4 space-y-3">
            <input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              type="email"
              required
              disabled={!canInviteMembers}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              placeholder="teammate@example.com"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as Invitation["role"])}
              disabled={!canInviteMembers}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              <option value="ADMIN">Admin</option>
              <option value="DEVELOPER">Developer</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <Button type="submit" className="w-full" disabled={isInviting || !canInviteMembers}>
              <MailPlus className="mr-2 size-4" />
              {isInviting ? "Inviting..." : "Create invite link"}
            </Button>
          </form>
          {latestInviteLink ? (
            <p className="mt-3 break-all text-xs text-muted-foreground">{latestInviteLink}</p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </section>
      </aside>

      <section className="space-y-6">
        <section className="rounded-lg border bg-background p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Organization</p>
              <h2 className="text-xl font-semibold">
                {organization?.name ?? (isLoading ? "Loading..." : "Organization")}
              </h2>
            </div>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
              {currentRole}
            </span>
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

        <section className="rounded-lg border bg-background p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-5" />
            <h2 className="text-base font-semibold">Team members</h2>
          </div>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{member.user.name}</p>
                  <p className="text-sm text-muted-foreground">{member.user.email}</p>
                </div>
                <select
                  value={member.role}
                  disabled={!canManageRoles || member.role === "OWNER"}
                  onChange={(event) =>
                    void updateRole(member, event.target.value as Member["role"])
                  }
                  className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="DEVELOPER">DEVELOPER</option>
                  <option value="VIEWER">VIEWER</option>
                  {member.role === "OWNER" ? <option value="OWNER">OWNER</option> : null}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-background p-5 shadow-sm">
          <h2 className="text-base font-semibold">Pending invitations</h2>
          {invitations.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="rounded-lg border p-3">
                  <p className="font-medium">{invitation.email}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {invitation.role} · invited by {invitation.invitedBy.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
