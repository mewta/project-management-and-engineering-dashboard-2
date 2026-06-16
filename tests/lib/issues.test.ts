import { describe, expect, it } from "vitest";
import { canTransitionIssueStatus } from "@/lib/issues";

describe("issue status transitions", () => {
  it("allows valid forward workflow transitions", () => {
    expect(canTransitionIssueStatus("TODO", "IN_PROGRESS")).toBe(true);
    expect(canTransitionIssueStatus("IN_PROGRESS", "IN_REVIEW")).toBe(true);
    expect(canTransitionIssueStatus("IN_REVIEW", "DONE")).toBe(true);
  });

  it("allows supported backward transitions", () => {
    expect(canTransitionIssueStatus("IN_PROGRESS", "TODO")).toBe(true);
    expect(canTransitionIssueStatus("IN_REVIEW", "IN_PROGRESS")).toBe(true);
    expect(canTransitionIssueStatus("DONE", "IN_REVIEW")).toBe(true);
  });

  it("rejects skipped workflow transitions", () => {
    expect(canTransitionIssueStatus("TODO", "DONE")).toBe(false);
    expect(canTransitionIssueStatus("IN_PROGRESS", "DONE")).toBe(false);
    expect(canTransitionIssueStatus("DONE", "TODO")).toBe(false);
  });

  it("allows idempotent transitions", () => {
    expect(canTransitionIssueStatus("TODO", "TODO")).toBe(true);
    expect(canTransitionIssueStatus("DONE", "DONE")).toBe(true);
  });
});
