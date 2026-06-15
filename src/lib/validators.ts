import { IssuePriority, IssueStatus } from "@prisma/client";
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
});
