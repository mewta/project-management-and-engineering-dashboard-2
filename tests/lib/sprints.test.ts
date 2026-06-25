import { describe, expect, it } from "vitest";
import { listUtcDates, replaySprintActivity, startOfUtcDay } from "@/lib/sprints";

describe("sprint activity replay", () => {
  it("tracks scope changes and current completion state", () => {
    const counts = replaySprintActivity("sprint-1", [
      {
        action: "ISSUE_ADDED_TO_SPRINT",
        issueId: "issue-1",
        metadata: {
          sprintId: "sprint-1",
          statusAtChange: "TODO",
        },
      },
      {
        action: "ISSUE_ADDED_TO_SPRINT",
        issueId: "issue-2",
        metadata: {
          sprintId: "sprint-1",
          statusAtChange: "IN_PROGRESS",
        },
      },
      {
        action: "ISSUE_STATUS_CHANGED",
        issueId: "issue-1",
        metadata: {
          fromStatus: "TODO",
          toStatus: "DONE",
        },
      },
      {
        action: "ISSUE_REMOVED_FROM_SPRINT",
        issueId: "issue-2",
        metadata: {
          sprintId: "sprint-1",
          statusAtChange: "IN_PROGRESS",
        },
      },
    ]);

    expect(counts).toEqual({
      totalScope: 1,
      completed: 1,
      remaining: 0,
    });
  });

  it("reflects reopened issues without double-counting scope", () => {
    const counts = replaySprintActivity("sprint-1", [
      {
        action: "ISSUE_ADDED_TO_SPRINT",
        issueId: "issue-1",
        metadata: {
          sprintId: "sprint-1",
          statusAtChange: "DONE",
        },
      },
      {
        action: "ISSUE_STATUS_CHANGED",
        issueId: "issue-1",
        metadata: {
          fromStatus: "DONE",
          toStatus: "IN_PROGRESS",
        },
      },
    ]);

    expect(counts).toEqual({
      totalScope: 1,
      completed: 0,
      remaining: 1,
    });
  });

  it("ignores membership events for other sprints", () => {
    expect(
      replaySprintActivity("sprint-1", [
        {
          action: "ISSUE_ADDED_TO_SPRINT",
          issueId: "issue-1",
          metadata: {
            sprintId: "sprint-2",
            statusAtChange: "DONE",
          },
        },
      ]),
    ).toEqual({
      totalScope: 0,
      completed: 0,
      remaining: 0,
    });
  });
});

describe("sprint UTC date helpers", () => {
  it("normalizes dates and includes both sprint boundaries", () => {
    expect(startOfUtcDay(new Date("2026-06-25T18:45:00.000Z")).toISOString()).toBe(
      "2026-06-25T00:00:00.000Z",
    );

    expect(
      listUtcDates(
        new Date("2026-06-23T12:00:00.000Z"),
        new Date("2026-06-25T22:00:00.000Z"),
      ).map((date) => date.toISOString()),
    ).toEqual([
      "2026-06-23T00:00:00.000Z",
      "2026-06-24T00:00:00.000Z",
      "2026-06-25T00:00:00.000Z",
    ]);
  });
});
