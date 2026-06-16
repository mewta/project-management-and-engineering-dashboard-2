"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Plus, RefreshCw, Wifi } from "lucide-react";
import { io } from "socket.io-client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";

type MembershipRole = "OWNER" | "ADMIN" | "DEVELOPER" | "VIEWER";
type IssueStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type ProjectMember = {
  id: string;
  role: MembershipRole;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type Project = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    memberships: ProjectMember[];
  };
};

type Issue = {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  reporterId: string;
  dueDate: string | null;
  labels: string[];
  assignee: { id: string; name: string; email: string } | null;
  reporter: { id: string; name: string; email: string };
  _count?: { comments: number };
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
};

type Activity = {
  id: string;
  action: string;
  createdAt: string;
  metadata: Record<string, string | null>;
  actor: { id: string; name: string; email: string };
  issue: { id: string; title: string; status: IssueStatus; priority: IssuePriority } | null;
};

type Analytics = {
  totalIssues: number;
  completedIssues: number;
  overdueIssues: number;
  issuesByStatus: { status: IssueStatus; count: number }[];
  issuesByPriority: { priority: IssuePriority; count: number }[];
  memberWorkload: {
    assigneeId: string | null;
    name: string;
    email: string | null;
    count: number;
  }[];
};

type ProjectClientProps = {
  projectId: string;
  currentUserId: string;
};

const columns: { status: IssueStatus; label: string }[] = [
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "IN_REVIEW", label: "In review" },
  { status: "DONE", label: "Done" },
];

const nextStatus: Partial<Record<IssueStatus, IssueStatus>> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "IN_REVIEW",
  IN_REVIEW: "DONE",
};

const roleRank: Record<MembershipRole, number> = {
  VIEWER: 1,
  DEVELOPER: 2,
  ADMIN: 3,
  OWNER: 4,
};

function hasMinimumRole(role: MembershipRole | undefined, minimumRole: MembershipRole) {
  if (!role) {
    return false;
  }

  return roleRank[role] >= roleRank[minimumRole];
}

function formatDate(date: string | null) {
  if (!date) {
    return "No due date";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function parseLabels(input: string) {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  ).slice(0, 10);
}

export function ProjectClient({ projectId, currentUserId }: ProjectClientProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("MEDIUM");
  const [createAssigneeId, setCreateAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [labelsInput, setLabelsInput] = useState("");
  const [filterStatus, setFilterStatus] = useState<IssueStatus | "ALL">("ALL");
  const [filterAssigneeId, setFilterAssigneeId] = useState("ALL");
  const [filterLabel, setFilterLabel] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("Connecting");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const project = useMemo(
    () => projects.find((item) => item.id === projectId),
    [projects, projectId],
  );

  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.id === selectedIssueId) ?? null,
    [issues, selectedIssueId],
  );

  const members = project?.organization.memberships ?? [];
  const currentMembership = members.find((member) => member.user.id === currentUserId);
  const currentRole = currentMembership?.role;
  const canCreateIssue = hasMinimumRole(currentRole, "DEVELOPER");
  const canMoveIssue = hasMinimumRole(currentRole, "DEVELOPER");
  const canAssignIssue = hasMinimumRole(currentRole, "ADMIN");
  const canComment = hasMinimumRole(currentRole, "DEVELOPER");

  const loadProject = useCallback(async () => {
    const issueParams = new URLSearchParams();
    if (filterStatus !== "ALL") issueParams.set("status", filterStatus);
    if (filterAssigneeId !== "ALL") issueParams.set("assigneeId", filterAssigneeId);
    if (filterLabel.trim()) issueParams.set("label", filterLabel.trim());
    if (query.trim()) issueParams.set("q", query.trim());

    const [projectResponse, issueResponse, activityResponse, analyticsResponse] =
      await Promise.all([
        fetch("/api/projects"),
        fetch(`/api/projects/${projectId}/issues?${issueParams.toString()}`),
        fetch(`/api/projects/${projectId}/activity`),
        fetch(`/api/projects/${projectId}/analytics`),
      ]);

    if (
      !projectResponse.ok ||
      !issueResponse.ok ||
      !activityResponse.ok ||
      !analyticsResponse.ok
    ) {
      setError("Could not load project data.");
      setIsLoading(false);
      return;
    }

    const projectBody = (await projectResponse.json()) as { projects: Project[] };
    const issueBody = (await issueResponse.json()) as { issues: Issue[] };
    const activityBody = (await activityResponse.json()) as { activity: Activity[] };
    const analyticsBody = (await analyticsResponse.json()) as { analytics: Analytics };

    setProjects(projectBody.projects);
    setIssues(issueBody.issues);
    setActivity(activityBody.activity);
    setAnalytics(analyticsBody.analytics);
    setIsLoading(false);

    if (selectedIssueId && !issueBody.issues.some((issue) => issue.id === selectedIssueId)) {
      setSelectedIssueId(null);
      setComments([]);
    }
  }, [filterAssigneeId, filterLabel, filterStatus, projectId, query, selectedIssueId]);

  async function loadComments(issueId: string) {
    const response = await fetch(`/api/issues/${issueId}/comments`);
    if (!response.ok) {
      setComments([]);
      return;
    }

    const body = (await response.json()) as { comments: Comment[] };
    setComments(body.comments);
  }

  useEffect(() => {
    let isActive = true;

    Promise.all([
      fetch("/api/projects"),
      fetch(
        `/api/projects/${projectId}/issues?${new URLSearchParams(
          Object.fromEntries(
            Object.entries({
              status: filterStatus !== "ALL" ? filterStatus : "",
              assigneeId: filterAssigneeId !== "ALL" ? filterAssigneeId : "",
              label: filterLabel.trim(),
            }).filter(([, value]) => value),
          ),
        ).toString()}`,
      ),
      fetch(`/api/projects/${projectId}/activity`),
      fetch(`/api/projects/${projectId}/analytics`),
    ])
      .then(async ([projectResponse, issueResponse, activityResponse, analyticsResponse]) => {
        if (
          !projectResponse.ok ||
          !issueResponse.ok ||
          !activityResponse.ok ||
          !analyticsResponse.ok
        ) {
          throw new Error("Could not load project data.");
        }

        const projectBody = (await projectResponse.json()) as { projects: Project[] };
        const issueBody = (await issueResponse.json()) as { issues: Issue[] };
        const activityBody = (await activityResponse.json()) as { activity: Activity[] };
        const analyticsBody = (await analyticsResponse.json()) as { analytics: Analytics };

        if (!isActive) {
          return;
        }

        setProjects(projectBody.projects);
        setIssues(issueBody.issues);
        setActivity(activityBody.activity);
        setAnalytics(analyticsBody.analytics);
        setIsLoading(false);
      })
      .catch(() => {
        if (isActive) {
          setError("Could not load project data.");
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [projectId, filterStatus, filterAssigneeId, filterLabel]);

  useEffect(() => {
    let isActive = true;
    const socket = io();

    async function refreshFromRealtime(issueId?: string) {
      if (!isActive) {
        return;
      }

      await loadProject();

      if (issueId && issueId === selectedIssueId) {
        await loadComments(issueId);
      }
    }

    socket.on("connect", () => {
      setRealtimeStatus("Live");
      socket.emit("project:join", projectId);
    });

    socket.on("disconnect", () => {
      setRealtimeStatus("Offline");
    });

    socket.on("issue:created", (payload: { issueId?: string }) => {
      void refreshFromRealtime(payload.issueId);
    });

    socket.on("issue:updated", (payload: { issueId?: string }) => {
      void refreshFromRealtime(payload.issueId);
    });

    socket.on("issue:commented", (payload: { issueId?: string }) => {
      void refreshFromRealtime(payload.issueId);
    });

    return () => {
      isActive = false;
      socket.emit("project:leave", projectId);
      socket.disconnect();
    };
  }, [loadProject, projectId, selectedIssueId]);

  useEffect(() => {
    if (!selectedIssueId) {
      return;
    }

    let isActive = true;

    fetch(`/api/issues/${selectedIssueId}/comments`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load comments.");
        }

        const body = (await response.json()) as { comments: Comment[] };
        if (isActive) {
          setComments(body.comments);
        }
      })
      .catch(() => {
        if (isActive) {
          setComments([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedIssueId]);

  async function createIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);

    const response = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        description: description || undefined,
        priority,
        assigneeId: createAssigneeId || undefined,
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined,
        labels: parseLabels(labelsInput),
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create issue.");
      setIsCreating(false);
      return;
    }

    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setCreateAssigneeId("");
    setDueDate("");
    setLabelsInput("");
    setIsCreating(false);
    setIsLoading(true);
    await loadProject();
  }

  async function moveIssue(issue: Issue) {
    const status = nextStatus[issue.status];
    if (!status) {
      return;
    }

    const response = await fetch(`/api/issues/${issue.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not move issue.");
      return;
    }

    setIsLoading(true);
    await loadProject();
  }

  async function updateAssignee(issueId: string, assigneeId: string | null) {
    const response = await fetch(`/api/issues/${issueId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not assign issue.");
      return;
    }

    setIsLoading(true);
    await loadProject();
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIssue || !commentBody.trim()) {
      return;
    }

    const response = await fetch(`/api/issues/${selectedIssue.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not add comment.");
      return;
    }

    setCommentBody("");
    setIsLoading(true);
    await Promise.all([loadComments(selectedIssue.id), loadProject()]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={project ? `/organizations/${project.organization.id}` : "/dashboard"}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to organization
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsLoading(true);
            void loadProject();
          }}
        >
          <RefreshCw className="mr-2 size-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <aside className="space-y-6">
          <section className="rounded-lg border bg-background p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Project</p>
            <h2 className="mt-1 text-xl font-semibold">
              {project ? `${project.key} · ${project.name}` : "Loading project..."}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {project?.description || "No project description"}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs font-medium">
                <Wifi className="size-3.5" />
                {realtimeStatus}
              </span>
              {currentRole ? (
                <span className="rounded-md border px-2 py-1 text-xs font-medium">
                  {currentRole}
                </span>
              ) : null}
            </div>
          </section>

          {analytics ? <AnalyticsPanel analytics={analytics} /> : null}

          <section className="rounded-lg border bg-background p-5 shadow-sm">
            <h2 className="text-base font-semibold">Create issue</h2>
            <form onSubmit={createIssue} className="mt-4 space-y-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                minLength={2}
                disabled={!canCreateIssue}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                placeholder="Issue title"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!canCreateIssue}
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                placeholder="Describe the work"
              />
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as IssuePriority)}
                disabled={!canCreateIssue}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <select
                value={createAssigneeId}
                onChange={(event) => setCreateAssigneeId(event.target.value)}
                disabled={!canCreateIssue}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.user.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={!canCreateIssue}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              <input
                value={labelsInput}
                onChange={(event) => setLabelsInput(event.target.value)}
                disabled={!canCreateIssue}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                placeholder="labels: bug, backend, urgent"
              />
              <Button type="submit" className="w-full" disabled={isCreating || !canCreateIssue}>
                <Plus className="mr-2 size-4" />
                {isCreating ? "Creating..." : "Create issue"}
              </Button>
              {!canCreateIssue ? (
                <p className="text-xs text-muted-foreground">
                  Developers and above can create issues.
                </p>
              ) : null}
            </form>
          </section>
        </aside>

        <section className="space-y-4">
          <div className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setIsLoading(true);
                    void loadProject();
                  }
                }}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring md:col-span-2"
                placeholder="Search issues"
              />
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as IssueStatus | "ALL")}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">All statuses</option>
                {columns.map((column) => (
                  <option key={column.status} value={column.status}>
                    {column.label}
                  </option>
                ))}
              </select>
              <select
                value={filterAssigneeId}
                onChange={(event) => setFilterAssigneeId(event.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">All assignees</option>
                {members.map((member) => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <input
                value={filterLabel}
                onChange={(event) => setFilterLabel(event.target.value)}
                className="h-10 min-w-52 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Filter by label"
              />
              <Button
                variant="outline"
                onClick={() => {
                  setIsLoading(true);
                  void loadProject();
                }}
              >
                Search
              </Button>
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {columns.map((column) => {
              const columnIssues = issues.filter((issue) => issue.status === column.status);

              return (
                <section
                  key={column.status}
                  className="min-h-[28rem] rounded-lg border bg-background p-3 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{column.label}</h3>
                    <span className="rounded-md bg-muted px-2 py-1 text-xs">
                      {columnIssues.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {isLoading ? (
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : columnIssues.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No issues</p>
                    ) : (
                      columnIssues.map((issue) => (
                        <button
                          key={issue.id}
                          type="button"
                          onClick={() => setSelectedIssueId(issue.id)}
                          className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{issue.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {issue.priority} · {issue.assignee?.name ?? "Unassigned"}
                              </p>
                            </div>
                            <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium">
                              {issue._count?.comments ?? 0}
                            </span>
                          </div>
                          {issue.description ? (
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                              {issue.description}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {issue.labels.map((label) => (
                              <span
                                key={label}
                                className="rounded-md border px-2 py-1 text-[11px] font-medium"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>{formatDate(issue.dueDate)}</span>
                            {nextStatus[issue.status] && canMoveIssue ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void moveIssue(issue);
                                }}
                              >
                                Move to {nextStatus[issue.status]?.replaceAll("_", " ")}
                              </Button>
                            ) : null}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border bg-background p-5 shadow-sm">
            <h2 className="text-base font-semibold">Issue details</h2>
            {!selectedIssue ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Select an issue to review comments, labels, and assignment.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedIssue.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedIssue.description || "No description"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem label="Status" value={selectedIssue.status.replaceAll("_", " ")} />
                  <DetailItem label="Priority" value={selectedIssue.priority} />
                  <DetailItem label="Reporter" value={selectedIssue.reporter.name} />
                  <DetailItem label="Due date" value={formatDate(selectedIssue.dueDate)} />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Assignee
                  </p>
                  {canAssignIssue ? (
                    <select
                      value={selectedIssue.assigneeId ?? ""}
                      onChange={(event) =>
                        void updateAssignee(selectedIssue.id, event.target.value || null)
                      }
                      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Unassigned</option>
                      {members.map((member) => (
                        <option key={member.user.id} value={member.user.id}>
                          {member.user.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-2 text-sm">{selectedIssue.assignee?.name ?? "Unassigned"}</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Labels
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedIssue.labels.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No labels</span>
                    ) : (
                      selectedIssue.labels.map((label) => (
                        <span
                          key={label}
                          className="rounded-md border px-2 py-1 text-xs font-medium"
                        >
                          {label}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <MessageSquare className="size-4" />
                    <h3 className="text-sm font-semibold">Comments</h3>
                  </div>
                  <div className="space-y-3">
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No comments yet.</p>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{comment.author.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(comment.createdAt)}
                            </p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{comment.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={addComment} className="mt-4 space-y-3">
                    <textarea
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      disabled={!canComment}
                      className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                      placeholder="Add context, updates, or blockers"
                    />
                    <Button type="submit" className="w-full" disabled={!canComment}>
                      Post comment
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-lg border bg-background p-5 shadow-sm">
            <h2 className="text-base font-semibold">Recent activity</h2>
            <div className="mt-4 space-y-3">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                activity.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{describeActivity(entry)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function describeActivity(activity: Activity) {
  const issueTitle = activity.metadata.issueTitle ?? activity.issue?.title ?? "issue";

  switch (activity.action) {
    case "ISSUE_CREATED":
      return `${activity.actor.name} created "${issueTitle}"`;
    case "ISSUE_STATUS_CHANGED":
      return `${activity.actor.name} moved "${issueTitle}" to ${activity.metadata.toStatus?.replaceAll("_", " ") ?? "a new state"}`;
    case "ISSUE_ASSIGNED":
      return `${activity.actor.name} updated assignment for "${issueTitle}"`;
    case "COMMENT_CREATED":
      return `${activity.actor.name} commented on "${issueTitle}"`;
    case "PROJECT_CREATED":
      return `${activity.actor.name} created project ${activity.metadata.projectKey ?? ""}`.trim();
    default:
      return `${activity.actor.name} updated "${issueTitle}"`;
  }
}

function AnalyticsPanel({ analytics }: { analytics: Analytics }) {
  return (
    <section className="rounded-lg border bg-background p-5 shadow-sm">
      <h2 className="text-base font-semibold">Analytics</h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <MetricCard label="Total" value={analytics.totalIssues} />
        <MetricCard label="Done" value={analytics.completedIssues} />
        <MetricCard label="Overdue" value={analytics.overdueIssues} />
      </div>

      <div className="mt-5 space-y-5">
        <ChartBlock
          title="Issues by status"
          data={analytics.issuesByStatus.map((item) => ({
            name: item.status.replaceAll("_", " "),
            value: item.count,
          }))}
        />
        <ChartBlock
          title="Issues by priority"
          data={analytics.issuesByPriority.map((item) => ({
            name: item.priority,
            value: item.count,
          }))}
        />
        <div>
          <h3 className="text-sm font-semibold">Member workload</h3>
          <div className="mt-3 space-y-2">
            {analytics.memberWorkload.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open assignments yet.</p>
            ) : (
              analytics.memberWorkload.map((entry) => (
                <div
                  key={`${entry.assigneeId ?? "unassigned"}-${entry.name}`}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">{entry.email ?? "No email"}</p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    {entry.count} open
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ChartBlock({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
