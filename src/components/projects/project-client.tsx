"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Copy,
  ExternalLink,
  Globe2,
  Link2,
  MessageSquare,
  Plus,
  RefreshCw,
  Wifi,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import {
  createAddLabelCommand,
  createMoveIssueCommand,
  createProjectIssueCommands,
} from "@/commands/issues";
import { createAssignIssueCommand } from "@/commands/members";
import { getSocketClient } from "@/lib/socket-client";

type MembershipRole = "OWNER" | "ADMIN" | "DEVELOPER" | "VIEWER";
type IssueStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type WorkloadStatus = "UNDERLOADED" | "BALANCED" | "OVERLOADED";

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
  isPublic: boolean;
  publicSlug: string | null;
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
  estimatedHours: number;
  labels: string[];
  isBlocked: boolean;
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

type WorkloadAnalytics = {
  projectId: string;
  generatedAt: string;
  members: {
    userId: string;
    name: string;
    role: MembershipRole;
    openIssues: number;
    completedIssues: number;
    overdueIssues: number;
    highPriorityIssues: number;
    urgentIssues: number;
    blockedIssues: number;
    totalEstimatedHours: number;
    workloadScore: number;
    status: WorkloadStatus;
  }[];
  summary: {
    totalOpenIssues: number;
    totalCompletedIssues: number;
    totalOverdueIssues: number;
    totalBlockedIssues: number;
    overloadedMembers: number;
  };
};

type DependencyIssue = {
  dependencyId: string;
  id: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee: { id: string; name: string; email: string } | null;
};

type DependencySummary = {
  blockedBy: DependencyIssue[];
  blocking: DependencyIssue[];
  isBlocked: boolean;
};

type WeeklyReport = {
  id: string;
  projectId: string;
  organizationId: string;
  weekStart: string;
  weekEnd: string;
  summary: {
    weekStart: string;
    weekEnd: string;
    totalIssuesCreated: number;
    totalIssuesCompleted: number;
    totalIssuesMovedToReview: number;
    totalCommentsAdded: number;
    totalOverdueIssues: number;
    totalBlockedIssues: number;
    topContributors: {
      userId: string;
      name: string;
      completedIssues: number;
      commentsAdded: number;
    }[];
    priorityBreakdown: {
      low: number;
      medium: number;
      high: number;
      urgent: number;
    };
    statusBreakdown: {
      todo: number;
      inProgress: number;
      review: number;
      done: number;
    };
    workloadSummary: {
      userId: string;
      name: string;
      openIssues: number;
      completedIssues: number;
      overdueIssues: number;
    }[];
  };
  createdAt: string;
};

type ProjectClientProps = {
  projectId: string;
  currentUserId: string;
  publicBaseUrl: string;
};

type LivePayload = {
  projectId?: string;
  issueId?: string;
  updatedBy?: {
    id: string;
    name: string;
  };
  fromStatus?: string;
  toStatus?: string;
  comment?: {
    id: string;
    content: string;
    author: {
      id: string;
      name: string;
    };
    createdAt: string;
  };
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

const workloadBadgeClasses: Record<WorkloadStatus, string> = {
  UNDERLOADED: "border-sky-200 bg-sky-50 text-sky-700",
  BALANCED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OVERLOADED: "border-amber-200 bg-amber-50 text-amber-700",
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

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function getPublicRoadmapUrl(baseUrl: string, slug: string) {
  return `${baseUrl.replace(/\/$/, "")}/p/${slug}`;
}

export function ProjectClient({
  projectId,
  currentUserId,
  publicBaseUrl,
}: ProjectClientProps) {
  const { notify, registerCommand, setCommandContext } = useCommandPalette();
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [workload, setWorkload] = useState<WorkloadAnalytics | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [dependencies, setDependencies] = useState<DependencySummary | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("MEDIUM");
  const [createAssigneeId, setCreateAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("0");
  const [labelsInput, setLabelsInput] = useState("");
  const [dependencyIssueId, setDependencyIssueId] = useState("");
  const [filterStatus, setFilterStatus] = useState<IssueStatus | "ALL">("ALL");
  const [filterAssigneeId, setFilterAssigneeId] = useState("ALL");
  const [filterLabel, setFilterLabel] = useState("");
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  const [workloadView, setWorkloadView] = useState<"ALL" | "OPEN" | "OVERDUE">("ALL");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("Connecting");
  const [liveMessage, setLiveMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isUpdatingPublicLink, setIsUpdatingPublicLink] = useState(false);

  const project = useMemo(
    () => projects.find((item) => item.id === projectId),
    [projects, projectId],
  );

  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.id === selectedIssueId) ?? null,
    [issues, selectedIssueId],
  );

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId],
  );

  const members = project?.organization.memberships ?? [];
  const currentMembership = members.find((member) => member.user.id === currentUserId);
  const currentRole = currentMembership?.role;
  const canCreateIssue = hasMinimumRole(currentRole, "DEVELOPER");
  const canMoveIssue = hasMinimumRole(currentRole, "DEVELOPER");
  const canAssignIssue = hasMinimumRole(currentRole, "ADMIN");
  const canComment = hasMinimumRole(currentRole, "DEVELOPER");
  const canManageDependencies = hasMinimumRole(currentRole, "DEVELOPER");
  const canGenerateReports = hasMinimumRole(currentRole, "ADMIN");
  const canManagePublicRoadmap = hasMinimumRole(currentRole, "ADMIN");
  const availableLabels = useMemo(
    () => Array.from(new Set(issues.flatMap((issue) => issue.labels))).sort(),
    [issues],
  );

  const setTransientLiveMessage = useCallback((message: string) => {
    setLiveMessage(message);
    window.clearTimeout((window as typeof window & { __devboardLiveTimer?: number }).__devboardLiveTimer);
    (window as typeof window & { __devboardLiveTimer?: number }).__devboardLiveTimer =
      window.setTimeout(() => setLiveMessage(""), 4000);
  }, []);

  const loadComments = useCallback(async (issueId: string) => {
    const response = await fetch(`/api/issues/${issueId}/comments`);
    if (!response.ok) {
      setComments([]);
      return;
    }

    const body = (await response.json()) as { comments: Comment[] };
    setComments(body.comments);
  }, []);

  const loadDependencies = useCallback(async (issueId: string) => {
    const response = await fetch(`/api/issues/${issueId}/dependencies`);
    if (!response.ok) {
      setDependencies(null);
      return;
    }

    const body = (await response.json()) as DependencySummary;
    setDependencies(body);
  }, []);

  const loadProject = useCallback(async () => {
    const issueParams = new URLSearchParams();
    if (filterStatus !== "ALL") issueParams.set("status", filterStatus);
    if (filterAssigneeId !== "ALL") issueParams.set("assigneeId", filterAssigneeId);
    if (filterLabel.trim()) issueParams.set("label", filterLabel.trim());
    if (showBlockedOnly) issueParams.set("blocked", "true");
    if (query.trim()) issueParams.set("q", query.trim());

    const [projectResponse, issueResponse, activityResponse, analyticsResponse, workloadResponse, reportsResponse] =
      await Promise.all([
        fetch("/api/projects"),
        fetch(`/api/projects/${projectId}/issues?${issueParams.toString()}`),
        fetch(`/api/projects/${projectId}/activity`),
        fetch(`/api/projects/${projectId}/analytics`),
        fetch(`/api/projects/${projectId}/analytics/workload?view=${workloadView}`),
        fetch(`/api/projects/${projectId}/reports/weekly`),
      ]);

    if (
      !projectResponse.ok ||
      !issueResponse.ok ||
      !activityResponse.ok ||
      !analyticsResponse.ok ||
      !workloadResponse.ok ||
      !reportsResponse.ok
    ) {
      setError("Could not load project data.");
      setIsLoading(false);
      return;
    }

    const projectBody = (await projectResponse.json()) as { projects: Project[] };
    const issueBody = (await issueResponse.json()) as { issues: Issue[] };
    const activityBody = (await activityResponse.json()) as { activity: Activity[] };
    const analyticsBody = (await analyticsResponse.json()) as { analytics: Analytics };
    const workloadBody = (await workloadResponse.json()) as WorkloadAnalytics;
    const reportsBody = (await reportsResponse.json()) as { reports: WeeklyReport[] };

    setProjects(projectBody.projects);
    setIssues(issueBody.issues);
    setActivity(activityBody.activity);
    setAnalytics(analyticsBody.analytics);
    setWorkload(workloadBody);
    setReports(reportsBody.reports);
    setIsLoading(false);

    if (selectedIssueId && !issueBody.issues.some((issue) => issue.id === selectedIssueId)) {
      setSelectedIssueId(null);
      setComments([]);
      setDependencies(null);
    }
  }, [
    filterAssigneeId,
    filterLabel,
    filterStatus,
    projectId,
    query,
    selectedIssueId,
    showBlockedOnly,
    workloadView,
  ]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadProject();
    }, 0);

    return () => window.clearTimeout(handle);
  }, [loadProject]);

  useEffect(() => {
    setCommandContext({
      currentProjectId: projectId,
      currentIssueId: selectedIssueId ?? undefined,
    });

    return () => {
      setCommandContext({});
    };
  }, [projectId, selectedIssueId, setCommandContext]);

  useEffect(() => {
    if (!canCreateIssue) {
      return;
    }

    return registerCommand(
      createProjectIssueCommands({
        focusCreateIssue: () => {
          document.getElementById("command-create-issue-title")?.focus();
        },
      }),
    );
  }, [canCreateIssue, registerCommand]);

  useEffect(() => {
    if (!selectedIssue) {
      return;
    }

    const commands = [];

    if (canMoveIssue) {
      commands.push(
        createMoveIssueCommand({
          issueId: selectedIssue.id,
          status: selectedIssue.status,
          onChanged: loadProject,
        }),
        createAddLabelCommand({
          issueId: selectedIssue.id,
          labels: selectedIssue.labels,
          availableLabels,
          onChanged: loadProject,
        }),
      );
    }

    if (canAssignIssue) {
      commands.push(
        createAssignIssueCommand({
          issueId: selectedIssue.id,
          onChanged: loadProject,
        }),
      );
    }

    return commands.length > 0 ? registerCommand(commands) : undefined;
  }, [
    availableLabels,
    canAssignIssue,
    canMoveIssue,
    loadProject,
    registerCommand,
    selectedIssue,
  ]);

  useEffect(() => {
    function selectIssueFromCommand(event: Event) {
      const detail = (event as CustomEvent<{ issueId: string; projectId: string }>).detail;
      if (detail.projectId === projectId) {
        setSelectedIssueId(detail.issueId);
      }
    }

    window.addEventListener("devboard:select-issue", selectIssueFromCommand);
    return () => window.removeEventListener("devboard:select-issue", selectIssueFromCommand);
  }, [projectId]);

  useEffect(() => {
    if (selectedIssueId || issues.length === 0) {
      return;
    }

    const issueId = new URLSearchParams(window.location.search).get("issue");
    if (issueId && issues.some((issue) => issue.id === issueId)) {
      const handle = window.setTimeout(() => setSelectedIssueId(issueId), 0);
      return () => window.clearTimeout(handle);
    }
  }, [issues, selectedIssueId]);

  useEffect(() => {
    if (!selectedIssueId) {
      return;
    }

    const handle = window.setTimeout(() => {
      void Promise.all([loadComments(selectedIssueId), loadDependencies(selectedIssueId)]);
    }, 0);

    return () => window.clearTimeout(handle);
  }, [loadComments, loadDependencies, selectedIssueId]);

  useEffect(() => {
    const socket = getSocketClient();

    socket.on("connect", () => {
      setRealtimeStatus("Live");
      socket.emit("project:join", projectId);
    });

    socket.on("disconnect", () => {
      setRealtimeStatus("Offline");
    });

    function shouldIgnoreOwnUpdate(payload?: LivePayload) {
      return payload?.updatedBy?.id === currentUserId;
    }

    const onIssueCreated = (payload: LivePayload) => {
      if (payload.projectId !== projectId || shouldIgnoreOwnUpdate(payload)) {
        return;
      }
      setTransientLiveMessage(`${payload.updatedBy?.name ?? "A teammate"} created a new issue`);
      void loadProject();
    };

    const onIssueMoved = (payload: LivePayload) => {
      if (payload.projectId !== projectId || shouldIgnoreOwnUpdate(payload)) {
        return;
      }
      setTransientLiveMessage(
        `${payload.updatedBy?.name ?? "A teammate"} moved ${payload.issueId ?? "an issue"} to ${statusLabel(payload.toStatus ?? "IN_PROGRESS")}`,
      );
      void loadProject();
    };

    const onIssueAssigned = (payload: LivePayload) => {
      if (payload.projectId !== projectId || shouldIgnoreOwnUpdate(payload)) {
        return;
      }
      setTransientLiveMessage(`${payload.updatedBy?.name ?? "A teammate"} reassigned work`);
      void loadProject();
    };

    const onCommentCreated = (payload: LivePayload) => {
      if (payload.projectId !== projectId || payload.comment?.author.id === currentUserId) {
        return;
      }
      setTransientLiveMessage(`${payload.comment?.author.name ?? "A teammate"} added a comment`);
      void loadProject();
      if (payload.issueId && payload.issueId === selectedIssueId) {
        void loadComments(payload.issueId);
      }
    };

    const onDependencyChanged = (payload: LivePayload) => {
      if (payload.projectId !== projectId || shouldIgnoreOwnUpdate(payload)) {
        return;
      }
      setTransientLiveMessage(`${payload.updatedBy?.name ?? "A teammate"} updated dependencies`);
      void loadProject();
      if (payload.issueId && payload.issueId === selectedIssueId) {
        void loadDependencies(payload.issueId);
      }
    };

    const onReportGenerated = (payload: LivePayload & { reportId?: string }) => {
      if (payload.projectId !== projectId) {
        return;
      }
      setTransientLiveMessage("Weekly report generated");
      void loadProject();
    };

    socket.on("issue.created", onIssueCreated);
    socket.on("issue.moved", onIssueMoved);
    socket.on("issue.assigned", onIssueAssigned);
    socket.on("comment.created", onCommentCreated);
    socket.on("dependency.added", onDependencyChanged);
    socket.on("dependency.removed", onDependencyChanged);
    socket.on("report.generated", onReportGenerated);

    return () => {
      socket.emit("project:leave", projectId);
      socket.off("issue.created", onIssueCreated);
      socket.off("issue.moved", onIssueMoved);
      socket.off("issue.assigned", onIssueAssigned);
      socket.off("comment.created", onCommentCreated);
      socket.off("dependency.added", onDependencyChanged);
      socket.off("dependency.removed", onDependencyChanged);
      socket.off("report.generated", onReportGenerated);
    };
  }, [
    currentUserId,
    loadComments,
    loadDependencies,
    loadProject,
    projectId,
    selectedIssueId,
    setTransientLiveMessage,
  ]);

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
        estimatedHours: Number(estimatedHours),
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
    setEstimatedHours("0");
    setLabelsInput("");
    setIsCreating(false);
    await loadProject();
  }

  async function moveIssue(issue: Issue) {
    const status = nextStatus[issue.status];
    if (!status) {
      return;
    }

    if (status === "DONE" && issue.isBlocked) {
      setError("Blocked issues cannot move to Done until every blocker is completed.");
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
    await Promise.all([loadComments(selectedIssue.id), loadProject()]);
  }

  async function addDependency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIssue || !dependencyIssueId) {
      return;
    }

    const response = await fetch(`/api/issues/${selectedIssue.id}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockingIssueId: dependencyIssueId }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not add dependency.");
      return;
    }

    setDependencyIssueId("");
    await Promise.all([loadDependencies(selectedIssue.id), loadProject()]);
  }

  async function removeDependency(issueId: string, dependencyId: string) {
    const response = await fetch(`/api/issues/${issueId}/dependencies/${dependencyId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not remove dependency.");
      return;
    }

    await Promise.all([loadDependencies(issueId), loadProject()]);
  }

  async function generateWeeklyReport() {
    setError("");
    setIsGeneratingReport(true);

    const response = await fetch(`/api/projects/${projectId}/reports/weekly/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not queue weekly report.");
      setIsGeneratingReport(false);
      return;
    }

    setIsGeneratingReport(false);
    setTransientLiveMessage("Weekly report generation queued");
    await loadProject();
  }

  async function updatePublicRoadmap(enabled: boolean) {
    setError("");
    setIsUpdatingPublicLink(true);

    const response = await fetch(`/api/projects/${projectId}/public-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setError(body?.error ?? "Could not update the public roadmap.");
      setIsUpdatingPublicLink(false);
      return;
    }

    notify(enabled ? "Public roadmap enabled" : "Public roadmap disabled");
    setIsUpdatingPublicLink(false);
    await loadProject();
  }

  async function copyPublicRoadmapLink() {
    if (!project?.publicSlug) {
      return;
    }

    await navigator.clipboard.writeText(
      getPublicRoadmapUrl(publicBaseUrl, project.publicSlug),
    );
    notify("Public roadmap link copied");
  }

  const dependencyOptions = issues.filter((issue) => issue.id !== selectedIssueId);

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
        <div className="flex flex-wrap items-center gap-2">
          {liveMessage ? (
            <span className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              {liveMessage}
            </span>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void loadProject()}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[360px_minmax(0,1fr)_380px]">
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

          <section className="rounded-lg border bg-background p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4" />
              <h2 className="text-base font-semibold">Public roadmap</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Share a read-only board without exposing members, comments, or activity.
            </p>
            <label className="mt-4 flex items-center justify-between gap-4 rounded-md border p-3">
              <span>
                <span className="block text-sm font-medium">Make roadmap public</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Anyone with the link can view project progress.
                </span>
              </span>
              <input
                type="checkbox"
                checked={project?.isPublic ?? false}
                disabled={
                  !canManagePublicRoadmap || isUpdatingPublicLink || !project
                }
                onChange={(event) => void updatePublicRoadmap(event.target.checked)}
                className="size-4"
              />
            </label>
            {project?.isPublic && project.publicSlug ? (
              <div className="mt-3 space-y-2">
                <p className="break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {getPublicRoadmapUrl(publicBaseUrl, project.publicSlug)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyPublicRoadmapLink()}
                  >
                    <Copy className="size-4" />
                    Copy link
                  </Button>
                  <Link
                    href={`/p/${project.publicSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 items-center justify-center gap-1 rounded-md border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                  >
                    <ExternalLink className="size-3.5" />
                    Open
                  </Link>
                </div>
              </div>
            ) : null}
          </section>

          {analytics ? <AnalyticsPanel analytics={analytics} /> : null}
          {workload ? (
            <WorkloadPanel
              analytics={workload}
              workloadView={workloadView}
              setWorkloadView={setWorkloadView}
            />
          ) : null}

          <section className="rounded-lg border bg-background p-5 shadow-sm">
            <h2 className="text-base font-semibold">Create issue</h2>
            <form onSubmit={createIssue} className="mt-4 space-y-3">
              <input
                id="command-create-issue-title"
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
                value={estimatedHours}
                onChange={(event) => setEstimatedHours(event.target.value)}
                disabled={!canCreateIssue}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                placeholder="Estimated hours"
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
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                value={filterLabel}
                onChange={(event) => setFilterLabel(event.target.value)}
                className="h-10 min-w-52 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Filter by label"
              />
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showBlockedOnly}
                  onChange={(event) => setShowBlockedOnly(event.target.checked)}
                />
                Blocked only
              </label>
              <Button variant="outline" onClick={() => void loadProject()}>
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
                            {issue.isBlocked ? (
                              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                                Blocked
                              </span>
                            ) : null}
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
                                disabled={nextStatus[issue.status] === "DONE" && issue.isBlocked}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void moveIssue(issue);
                                }}
                              >
                                Move to {statusLabel(nextStatus[issue.status] ?? "DONE")}
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
                Select an issue to review comments, labels, assignment, and dependencies.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{selectedIssue.title}</h3>
                    {selectedIssue.isBlocked ? (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        Blocked
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedIssue.description || "No description"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem label="Status" value={statusLabel(selectedIssue.status)} />
                  <DetailItem label="Priority" value={selectedIssue.priority} />
                  <DetailItem label="Reporter" value={selectedIssue.reporter.name} />
                  <DetailItem label="Due date" value={formatDate(selectedIssue.dueDate)} />
                  <DetailItem
                    label="Estimate"
                    value={`${selectedIssue.estimatedHours}h`}
                  />
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

                <section className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Link2 className="size-4" />
                    <h3 className="text-sm font-semibold">Dependencies</h3>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Blocking this issue
                      </p>
                      <div className="mt-2 space-y-2">
                        {dependencies?.blockedBy.length ? (
                          dependencies.blockedBy.map((dependency) => (
                            <div
                              key={dependency.dependencyId}
                              className="flex items-center justify-between gap-3 rounded-lg border p-3"
                            >
                              <div>
                                <p className="text-sm font-medium">{dependency.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {statusLabel(dependency.status)} · {dependency.assignee?.name ?? "Unassigned"}
                                </p>
                              </div>
                              {canManageDependencies ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void removeDependency(selectedIssue.id, dependency.dependencyId)
                                  }
                                >
                                  Remove
                                </Button>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No blockers.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Blocked by this issue
                      </p>
                      <div className="mt-2 space-y-2">
                        {dependencies?.blocking.length ? (
                          dependencies.blocking.map((dependency) => (
                            <div key={dependency.dependencyId} className="rounded-lg border p-3">
                              <p className="text-sm font-medium">{dependency.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {statusLabel(dependency.status)} · {dependency.assignee?.name ?? "Unassigned"}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">This issue is not blocking other work.</p>
                        )}
                      </div>
                    </div>
                    {canManageDependencies ? (
                      <form onSubmit={addDependency} className="space-y-3">
                        <select
                          value={dependencyIssueId}
                          onChange={(event) => setDependencyIssueId(event.target.value)}
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">Add blocker</option>
                          {dependencyOptions.map((issue) => (
                            <option key={issue.id} value={issue.id}>
                              {issue.title}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" className="w-full" variant="outline">
                          Add dependency
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </section>

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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4" />
                <h2 className="text-base font-semibold">Weekly reports</h2>
              </div>
              <Button
                size="sm"
                onClick={() => void generateWeeklyReport()}
                disabled={!canGenerateReports || isGeneratingReport}
              >
                {isGeneratingReport ? "Queueing..." : "Generate"}
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No reports yet. Generate one to capture project progress.
                </p>
              ) : (
                reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setSelectedReportId(report.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 ${
                      selectedReport?.id === report.id ? "border-foreground/30 bg-muted/40" : ""
                    }`}
                  >
                    <p className="text-sm font-medium">
                      {formatDate(report.weekStart)} to {formatDate(report.weekEnd)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {report.summary.totalIssuesCompleted} completed · {report.summary.totalBlockedIssues} blocked
                    </p>
                  </button>
                ))
              )}
            </div>
            {selectedReport ? (
              <div className="mt-4 rounded-lg border p-4">
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Created" value={selectedReport.summary.totalIssuesCreated} />
                  <MetricCard label="Done" value={selectedReport.summary.totalIssuesCompleted} />
                  <MetricCard label="Blocked" value={selectedReport.summary.totalBlockedIssues} />
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Top contributors
                    </p>
                    <div className="mt-2 space-y-2">
                      {selectedReport.summary.topContributors.map((contributor) => (
                        <div
                          key={contributor.userId}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <p className="text-sm font-medium">{contributor.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {contributor.completedIssues} done · {contributor.commentsAdded} comments
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Workload summary
                    </p>
                    <div className="mt-2 space-y-2">
                      {selectedReport.summary.workloadSummary.map((member) => (
                        <div key={member.userId} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.openIssues} open · {member.overdueIssues} overdue
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
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
      return `${activity.actor.name} moved "${issueTitle}" to ${statusLabel(activity.metadata.toStatus ?? "IN_PROGRESS")}`;
    case "ISSUE_ASSIGNED":
      return `${activity.actor.name} updated assignment for "${issueTitle}"`;
    case "COMMENT_CREATED":
      return `${activity.actor.name} commented on "${issueTitle}"`;
    case "ISSUE_DEPENDENCY_ADDED":
      return `${activity.actor.name} added blocker "${activity.metadata.blockingIssueTitle ?? "issue"}"`;
    case "ISSUE_DEPENDENCY_REMOVED":
      return `${activity.actor.name} removed blocker "${activity.metadata.blockingIssueTitle ?? "issue"}"`;
    case "WEEKLY_REPORT_GENERATED":
      return `${activity.actor.name} generated the weekly report`;
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
            name: statusLabel(item.status),
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
      </div>
    </section>
  );
}

function WorkloadPanel({
  analytics,
  workloadView,
  setWorkloadView,
}: {
  analytics: WorkloadAnalytics;
  workloadView: "ALL" | "OPEN" | "OVERDUE";
  setWorkloadView: (view: "ALL" | "OPEN" | "OVERDUE") => void;
}) {
  const pieData = [
    {
      name: "Underloaded",
      value: analytics.members.filter((member) => member.status === "UNDERLOADED").length,
      color: "#0ea5e9",
    },
    {
      name: "Balanced",
      value: analytics.members.filter((member) => member.status === "BALANCED").length,
      color: "#10b981",
    },
    {
      name: "Overloaded",
      value: analytics.members.filter((member) => member.status === "OVERLOADED").length,
      color: "#f59e0b",
    },
  ].filter((entry) => entry.value > 0);

  return (
    <section className="rounded-lg border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Workload</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Open work, urgency, blocked tasks, and overload detection.
          </p>
        </div>
        <select
          value={workloadView}
          onChange={(event) => setWorkloadView(event.target.value as "ALL" | "OPEN" | "OVERDUE")}
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="ALL">All issues</option>
          <option value="OPEN">Only open</option>
          <option value="OVERDUE">Only overdue</option>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <MetricCard label="Open" value={analytics.summary.totalOpenIssues} />
        <MetricCard label="Blocked" value={analytics.summary.totalBlockedIssues} />
        <MetricCard label="Overloaded" value={analytics.summary.overloadedMembers} />
      </div>

      <div className="mt-5 space-y-5">
        <ChartBlock
          title="Open issues per member"
          data={analytics.members.map((member) => ({
            name: member.name,
            value: member.openIssues,
          }))}
        />
        <ChartBlock
          title="Overdue issues per member"
          data={analytics.members.map((member) => ({
            name: member.name,
            value: member.overdueIssues,
          }))}
        />
        <div>
          <h3 className="text-sm font-semibold">Load distribution</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={82}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-2">
          {analytics.members.map((member) => (
            <div key={member.userId} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.openIssues} open · {member.urgentIssues} urgent · {member.blockedIssues} blocked
                  </p>
                </div>
                <span
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${workloadBadgeClasses[member.status]}`}
                >
                  {member.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div className="rounded-md bg-muted px-2 py-2">Score {member.workloadScore}</div>
                <div className="rounded-md bg-muted px-2 py-2">{member.overdueIssues} overdue</div>
                <div className="rounded-md bg-muted px-2 py-2">{member.totalEstimatedHours}h est</div>
                <div className="rounded-md bg-muted px-2 py-2">{member.completedIssues} done</div>
              </div>
            </div>
          ))}
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
            <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#111827" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
