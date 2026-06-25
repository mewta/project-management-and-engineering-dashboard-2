import { InvitationStatus, IssuePriority, IssueStatus, MembershipRole } from "@prisma/client";
import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const createProjectSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  key: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Z][A-Z0-9]*$/, "Use uppercase letters and numbers, starting with a letter"),
  description: z.string().trim().max(500).optional(),
});

export const createIssueSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  priority: z.nativeEnum(IssuePriority).default(IssuePriority.MEDIUM),
  status: z.nativeEnum(IssueStatus).default(IssueStatus.TODO),
  assigneeId: z.string().min(1).optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.coerce.number().int().min(0).max(1000).optional(),
  labels: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
});

export const updateIssueStatusSchema = z.object({
  status: z.nativeEnum(IssueStatus),
});

export const assignIssueSchema = z.object({
  assigneeId: z.string().min(1).nullable(),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const issueFilterSchema = z.object({
  projectId: z.string().min(1).optional(),
  status: z.nativeEnum(IssueStatus).optional(),
  priority: z.nativeEnum(IssuePriority).optional(),
  assigneeId: z.string().min(1).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  label: z.string().trim().min(1).max(30).optional(),
  blocked: z.coerce.boolean().optional(),
});

export const createIssueDependencySchema = z.object({
  blockingIssueId: z.string().min(1),
});

export const workloadFilterSchema = z.object({
  view: z.enum(["ALL", "OPEN", "OVERDUE"]).default("ALL"),
  sprint: z.string().trim().min(1).optional(),
});

export const generateWeeklyReportSchema = z.object({
  weekStart: z.string().datetime().optional(),
  weekEnd: z.string().datetime().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  role: z.nativeEnum(MembershipRole).refine((role) => role !== "OWNER", {
    message: "Invitations cannot create additional owners",
  }),
});

export const updateMembershipRoleSchema = z.object({
  role: z.nativeEnum(MembershipRole).refine((role) => role !== "OWNER", {
    message: "Owner role cannot be assigned from this form",
  }),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

export const invitationFilterSchema = z.object({
  status: z.nativeEnum(InvitationStatus).optional(),
});

export const commandSearchSchema = z.object({
  q: z.string().trim().max(100).default(""),
  scope: z.enum(["issues", "projects", "members", "all"]).default("all"),
  projectId: z.string().min(1).optional(),
});

export const updateIssueLabelsSchema = z.object({
  labels: z.array(z.string().trim().min(1).max(30)).max(10),
});
