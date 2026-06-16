import { InvitationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError, requireUserId } from "@/lib/api";
import { acceptInvitationSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const payload = acceptInvitationSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token: payload.token },
    });

    if (!invitation) {
      throw new ApiError(404, "Invitation not found");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ApiError(400, "Invitation is no longer active");
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new ApiError(400, "Invitation has expired");
    }

    if (invitation.email !== user.email) {
      throw new ApiError(403, "This invitation was sent to a different email address");
    }

    const membership = await prisma.$transaction(async (tx) => {
      const existingMembership = await tx.membership.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: invitation.organizationId,
          },
        },
      });

      if (existingMembership) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.ACCEPTED },
        });
        return existingMembership;
      }

      const createdMembership = await tx.membership.create({
        data: {
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      return createdMembership;
    });

    return NextResponse.json({ membership });
  } catch (error) {
    return handleApiError(error);
  }
}
