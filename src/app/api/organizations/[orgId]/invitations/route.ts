import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { InvitationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  handleApiError,
  requireOrganizationMembership,
  requireOrganizationRole,
  requireUserId,
} from "@/lib/api";
import { invitationFilterSchema, inviteMemberSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { orgId } = await context.params;
    const { searchParams } = new URL(request.url);
    const filters = invitationFilterSchema.parse({
      status: searchParams.get("status") ?? undefined,
    });

    await requireOrganizationMembership(userId, orgId);

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: orgId,
        status: filters.status,
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { orgId } = await context.params;
    const payload = inviteMemberSchema.parse(await request.json());

    await requireOrganizationRole(userId, orgId, "ADMIN");

    const existingMembership = await prisma.membership.findFirst({
      where: {
        organizationId: orgId,
        user: { email: payload.email },
      },
    });

    if (existingMembership) {
      throw new ApiError(409, "That user is already a member of this organization");
    }

    await prisma.invitation.updateMany({
      where: {
        organizationId: orgId,
        email: payload.email,
        status: InvitationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: InvitationStatus.EXPIRED },
    });

    const invitation = await prisma.invitation.create({
      data: {
        email: payload.email,
        organizationId: orgId,
        role: payload.role,
        token: crypto.randomBytes(24).toString("hex"),
        invitedById: userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        invitation,
        inviteLink: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/signup?invite=${invitation.token}`,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
