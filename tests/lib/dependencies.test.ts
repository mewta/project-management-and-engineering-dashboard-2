import { describe, expect, it } from "vitest";
import { hasPathInDependencyGraph } from "@/lib/dependencies";

describe("dependency graph traversal", () => {
  it("detects indirect cycles through existing blockers", () => {
    const adjacency = new Map<string, string[]>([
      ["A", ["B"]],
      ["B", ["C"]],
    ]);

    expect(hasPathInDependencyGraph(adjacency, "A", "C")).toBe(true);
    expect(hasPathInDependencyGraph(adjacency, "C", "A")).toBe(false);
  });

  it("handles disconnected issues without false positives", () => {
    const adjacency = new Map<string, string[]>([
      ["API", ["DB"]],
      ["UI", ["API"]],
      ["Docs", []],
    ]);

    expect(hasPathInDependencyGraph(adjacency, "UI", "DB")).toBe(true);
    expect(hasPathInDependencyGraph(adjacency, "Docs", "DB")).toBe(false);
  });
});
