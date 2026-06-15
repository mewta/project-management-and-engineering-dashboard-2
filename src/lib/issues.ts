import { IssueStatus } from "@prisma/client";

const allowedStatusTransitions: Record<IssueStatus, IssueStatus[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["TODO", "IN_REVIEW"],
  IN_REVIEW: ["IN_PROGRESS", "DONE"],
  DONE: ["IN_REVIEW"],
};

export function canTransitionIssueStatus(from: IssueStatus, to: IssueStatus) {
  return from === to || allowedStatusTransitions[from].includes(to);
}
