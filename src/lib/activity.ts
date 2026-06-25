import { IssuePriority, IssueStatus } from "@prisma/client";

export function buildIssueCreatedMetadata({
  issueTitle,
  priority,
  status,
}: {
  issueTitle: string;
  priority: IssuePriority;
  status: IssueStatus;
}) {
  return {
    issueTitle,
    priority,
    status,
  };
}

export function buildStatusChangeMetadata({
  issueTitle,
  fromStatus,
  toStatus,
}: {
  issueTitle: string;
  fromStatus: IssueStatus;
  toStatus: IssueStatus;
}) {
  return {
    issueTitle,
    fromStatus,
    toStatus,
  };
}

export function buildAssignmentMetadata({
  issueTitle,
  previousAssigneeId,
  assigneeId,
}: {
  issueTitle: string;
  previousAssigneeId: string | null;
  assigneeId: string | null;
}) {
  return {
    issueTitle,
    previousAssigneeId,
    assigneeId,
  };
}

export function buildSprintScopeMetadata({
  issueTitle,
  sprintId,
  sprintName,
  statusAtChange,
}: {
  issueTitle: string;
  sprintId: string;
  sprintName: string;
  statusAtChange: IssueStatus;
}) {
  return {
    issueTitle,
    sprintId,
    sprintName,
    statusAtChange,
  };
}

export function buildSprintMetadata({
  sprintId,
  sprintName,
  status,
}: {
  sprintId: string;
  sprintName: string;
  status: string;
}) {
  return {
    sprintId,
    sprintName,
    status,
  };
}

export function buildCommentCreatedMetadata({
  issueTitle,
  commentId,
}: {
  issueTitle: string;
  commentId: string;
}) {
  return {
    issueTitle,
    commentId,
  };
}

export function buildDependencyAddedMetadata({
  issueTitle,
  blockingIssueId,
  blockingIssueTitle,
}: {
  issueTitle: string;
  blockingIssueId: string;
  blockingIssueTitle: string;
}) {
  return {
    issueTitle,
    blockingIssueId,
    blockingIssueTitle,
  };
}

export function buildDependencyRemovedMetadata({
  issueTitle,
  blockingIssueId,
  blockingIssueTitle,
}: {
  issueTitle: string;
  blockingIssueId: string;
  blockingIssueTitle: string;
}) {
  return {
    issueTitle,
    blockingIssueId,
    blockingIssueTitle,
  };
}

export function buildWeeklyReportGeneratedMetadata({
  projectName,
  weekStart,
  weekEnd,
}: {
  projectName: string;
  weekStart: string;
  weekEnd: string;
}) {
  return {
    projectName,
    weekStart,
    weekEnd,
  };
}
