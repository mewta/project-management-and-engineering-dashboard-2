import { describe, expect, it } from "vitest";
import { buildWorkloadScore, getWorkloadStatus } from "@/lib/workload";

describe("workload analytics helpers", () => {
  it("weights urgent, overdue, blocked, and estimated work into the workload score", () => {
    expect(
      buildWorkloadScore({
        openIssues: 4,
        highPriorityIssues: 1,
        urgentIssues: 2,
        overdueIssues: 1,
        blockedIssues: 1,
        totalEstimatedHours: 10,
      }),
    ).toBe(17);
  });

  it("classifies the score into underloaded, balanced, and overloaded bands", () => {
    expect(getWorkloadStatus(2)).toBe("UNDERLOADED");
    expect(getWorkloadStatus(6)).toBe("BALANCED");
    expect(getWorkloadStatus(11)).toBe("OVERLOADED");
  });
});
