"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type IssueStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Project = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  organization: { id: string; name: string; slug: string };
};

type Issue = {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  reporterId: string;
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

export function ProjectClient({ projectId }: ProjectClientProps) {
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
  const [filterStatus, setFilterStatus] = useState<IssueStatus | "ALL">("ALL");
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

  async function loadProject() {
    const issueParams = new URLSearchParams();
    if (filterStatus !== "ALL") issueParams.set("status", filterStatus);
    if (query) issueParams.set("q", query);

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
  }

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
    const issueParams = new URLSearchParams();
    if (filterStatus !== "ALL") issueParams.set("status", filterStatus);

    Promise.all([
      fetch("/api/projects"),
      fetch(`/api/projects/${projectId}/issues?${issueParams.toString()}`),
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

        if (isActive) {
          setProjects(projectBody.projects);
          setIssues(issueBody.issues);
          setActivity(activityBody.activity);
          setAnalytics(analyticsBody.analytics);
          setIsLoading(false);
        }
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
  }, [projectId, filterStatus]);

  useEffect(() => {
    let isActive = true;
    const socket = io();

    async function refreshFromRealtime(issueId?: string) {
      const issueParams = new URLSearchParams();
      if (filterStatus !== "ALL") issueParams.set("status", filterStatus);
      if (query) issueParams.set("q", query);

      const [projectResponse, issueResponse, activityResponse, analyticsResponse] =
        await Promise.all([
          fetch("/api/projects"),
          fetch(`/api/projects/${projectId}/issues?${issueParams.toString()}`),
          fetch(`/api/projects/${projectId}/activity`),
          fetch(`/api/projects/${projectId}/analytics`),
        ]);

      if (
        !isActive ||
        !projectResponse.ok ||
        !issueResponse.ok ||
        !activityResponse.ok ||
        !analyticsResponse.ok
      ) {
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
  }, [filterStatus, projectId, query, selectedIssueId]);

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
    setIsCreating(false);
    setIsLoading(true);
    await loadProject();
  }

  async function moveIssue(issue: Issue) {
    const status = nextStatus[issue.status];
    if (!status) return;

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

  async function assignToMe(issue: Issue) {
    const response = await fetch(`/api/issues/${issue.id}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId: issue.reporterId }),
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
    if (!selectedIssue || !commentBody.trim()) return;

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

      <div className="grid gap-6 2xl:grid-cols-[360px_1fr_360px]">
        <aside className="space-y-6">
          <section className="rounded-lg border bg-background p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Project</p>
            <h2 className="mt-1 text-xl font-semibold">
              {project ? `${project.key} · ${project.name}` : "Loading project..."}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {project?.description || "No project description"}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs font-medium">
              <Wifi className="size-3.5" />
              {realtimeStatus}
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
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Issue title"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Describe the work"
              />
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as IssuePriority)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <Button type="submit" className="w-full" disabled={isCreating}>
                <Plus className="mr-2 size-4" />
                {isCreating ? "Creating..." : "Create issue"}
              </Button>
            </form>
          </section>
        </aside>

        <section className="space-y-4">
          <div className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadProject();
                }}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {columns.map((column) => {
              const columnIssues = issues.filter((issue) => issue.status === column.status);
              return (
                <section
                  key={column.status}
                  className="min-h-80 rounded-lg border bg-background p-3 shadow-sm"
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
                        <article
                          key={issue.id}
                          className="rounded-lg border p-3 transition-colors hover:bg-muted/60"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedIssueId(issue.id)}
                            className="w-full text-left"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-medium leading-5">{issue.title}</h4>
                              <Priority priority={issue.priority} />
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                              {issue.description || "No description"}
                            </p>
                          </button>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {nextStatus[issue.status] ? (
                              <Button size="sm" variant="outline" onClick={() => void moveIssue(issue)}>
                                Move
                              </Button>
                            ) : null}
                            {!issue.assignee ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void assignToMe(issue)}
                              >
                                Assign
                              </Button>
                            ) : null}
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            {issue.assignee ? `Assigned to ${issue.assignee.name}` : "Unassigned"}
                          </p>
                        </article>
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
            <h2 className="text-base font-semibold">Issue detail</h2>
            {selectedIssue ? (
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="font-medium">{selectedIssue.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedIssue.description || "No description"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Detail label="Status" value={selectedIssue.status} />
                  <Detail label="Priority" value={selectedIssue.priority} />
                  <Detail label="Reporter" value={selectedIssue.reporter.name} />
                  <Detail label="Assignee" value={selectedIssue.assignee?.name ?? "Unassigned"} />
                </div>
                <form onSubmit={addComment} className="space-y-3">
                  <textarea
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Add a comment"
                  />
                  <Button type="submit" className="w-full">
                    <MessageSquare className="mr-2 size-4" />
                    Add comment
                  </Button>
                </form>
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No comments yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="rounded-lg border p-3">
                        <p className="text-sm">{comment.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {comment.author.name}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Select an issue to view details and comments.
              </p>
            )}
          </section>

          <section className="rounded-lg border bg-background p-5 shadow-sm">
            <h2 className="text-base font-semibold">Activity feed</h2>
            <div className="mt-4 space-y-3">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                activity.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{formatAction(item.action)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.actor.name}
                      {item.issue ? ` · ${item.issue.title}` : ""}
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

function Priority({ priority }: { priority: IssuePriority }) {
  const className =
    priority === "URGENT"
      ? "bg-red-100 text-red-700"
      : priority === "HIGH"
        ? "bg-amber-100 text-amber-700"
        : priority === "MEDIUM"
          ? "bg-blue-100 text-blue-700"
          : "bg-emerald-100 text-emerald-700";

  return <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${className}`}>{priority}</span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function AnalyticsPanel({ analytics }: { analytics: Analytics }) {
  return (
    <section className="space-y-4 rounded-lg border bg-background p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">Analytics</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Metric label="Total" value={analytics.totalIssues} />
          <Metric label="Done" value={analytics.completedIssues} />
          <Metric label="Overdue" value={analytics.overdueIssues} />
        </div>
      </div>

      <ChartCard title="Issues by status">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={analytics.issuesByStatus}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="status" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#18181b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Issues by priority">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={analytics.issuesByPriority}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="priority" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Member workload">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={analytics.memberWorkload}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted p-3 text-center">
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
