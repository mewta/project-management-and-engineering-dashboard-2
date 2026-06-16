import { describe, expect, it } from "vitest";
import { hasMinimumRole } from "@/lib/api";

describe("RBAC role hierarchy", () => {
  it("lets owners perform every role-gated action", () => {
    expect(hasMinimumRole("OWNER", "OWNER")).toBe(true);
    expect(hasMinimumRole("OWNER", "ADMIN")).toBe(true);
    expect(hasMinimumRole("OWNER", "DEVELOPER")).toBe(true);
    expect(hasMinimumRole("OWNER", "VIEWER")).toBe(true);
  });

  it("lets admins perform admin, developer, and viewer actions but not owner-only actions", () => {
    expect(hasMinimumRole("ADMIN", "OWNER")).toBe(false);
    expect(hasMinimumRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasMinimumRole("ADMIN", "DEVELOPER")).toBe(true);
    expect(hasMinimumRole("ADMIN", "VIEWER")).toBe(true);
  });

  it("limits developers and viewers according to the new team hierarchy", () => {
    expect(hasMinimumRole("DEVELOPER", "OWNER")).toBe(false);
    expect(hasMinimumRole("DEVELOPER", "ADMIN")).toBe(false);
    expect(hasMinimumRole("DEVELOPER", "DEVELOPER")).toBe(true);
    expect(hasMinimumRole("DEVELOPER", "VIEWER")).toBe(true);
    expect(hasMinimumRole("VIEWER", "DEVELOPER")).toBe(false);
    expect(hasMinimumRole("VIEWER", "VIEWER")).toBe(true);
  });
});
