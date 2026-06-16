import { describe, expect, it } from "vitest";
import {
  buildAssignmentMetadata,
  buildCommentCreatedMetadata,
  buildIssueCreatedMetadata,
  buildStatusChangeMetadata,
} from "@/lib/activity";

describe("activity metadata builders", () => {
  it("builds stable issue-created metadata", () => {
    expect(
      buildIssueCreatedMetadata({
        issueTitle: "Add login page",
        priority: "HIGH",
        status: "TODO",
      }),
    ).toEqual({
      issueTitle: "Add login page",
      priority: "HIGH",
      status: "TODO",
    });
  });

  it("builds stable status-change metadata", () => {
    expect(
      buildStatusChangeMetadata({
        issueTitle: "Wire Kanban",
        fromStatus: "TODO",
        toStatus: "IN_PROGRESS",
      }),
    ).toEqual({
      issueTitle: "Wire Kanban",
      fromStatus: "TODO",
      toStatus: "IN_PROGRESS",
    });
  });

  it("builds stable assignment and comment metadata", () => {
    expect(
      buildAssignmentMetadata({
        issueTitle: "Fix RBAC",
        previousAssigneeId: null,
        assigneeId: "user_1",
      }),
    ).toEqual({
      issueTitle: "Fix RBAC",
      previousAssigneeId: null,
      assigneeId: "user_1",
    });

    expect(
      buildCommentCreatedMetadata({
        issueTitle: "Fix RBAC",
        commentId: "comment_1",
      }),
    ).toEqual({
      issueTitle: "Fix RBAC",
      commentId: "comment_1",
    });
  });
});
