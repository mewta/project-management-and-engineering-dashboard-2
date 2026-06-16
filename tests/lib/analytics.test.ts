import { describe, expect, it } from "vitest";
import { buildProjectAnalytics } from "@/lib/analytics";

describe("project analytics", () => {
  it("fills missing status and priority buckets with zero", () => {
    const analytics = buildProjectAnalytics({
      totalIssues: 3,
      completedIssues: 1,
      overdueIssues: 1,
      byStatus: [
        { status: "TODO", _count: { _all: 2 } },
        { status: "DONE", _count: { _all: 1 } },
      ],
      byPriority: [{ priority: "HIGH", _count: { _all: 3 } }],
      workload: [],
      assignees: [],
    });

    expect(analytics.issuesByStatus).toEqual([
      { status: "TODO", count: 2 },
      { status: "IN_PROGRESS", count: 0 },
      { status: "IN_REVIEW", count: 0 },
      { status: "DONE", count: 1 },
    ]);

    expect(analytics.issuesByPriority).toEqual([
      { priority: "LOW", count: 0 },
      { priority: "MEDIUM", count: 0 },
      { priority: "HIGH", count: 3 },
      { priority: "URGENT", count: 0 },
    ]);
  });

  it("maps member workload to users and keeps unassigned work visible", () => {
    const analytics = buildProjectAnalytics({
      totalIssues: 4,
      completedIssues: 0,
      overdueIssues: 0,
      byStatus: [],
      byPriority: [],
      workload: [
        { assigneeId: "user_1", _count: { _all: 3 } },
        { assigneeId: null, _count: { _all: 1 } },
      ],
      assignees: [{ id: "user_1", name: "Demo User", email: "demo@example.com" }],
    });

    expect(analytics.memberWorkload).toEqual([
      {
        assigneeId: "user_1",
        name: "Demo User",
        email: "demo@example.com",
        count: 3,
      },
      {
        assigneeId: null,
        name: "Unassigned",
        email: null,
        count: 1,
      },
    ]);
  });
});
