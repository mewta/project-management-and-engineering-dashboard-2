import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_ORGANIZATION_ID, DEMO_USER_ID } from "@/lib/demo";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

const sessionMaxAge = 60 * 60 * 8;

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit({
    key: `demo-login:${getRequestIp(request.headers)}`,
    limit: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many demo login attempts" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Demo login is not configured" },
      { status: 503 },
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      id: DEMO_USER_ID,
      isDemo: true,
      memberships: {
        some: {
          organizationId: DEMO_ORGANIZATION_ID,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      isDemo: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Demo workspace is not available" },
      { status: 503 },
    );
  }

  const token = await encode({
    secret,
    maxAge: sessionMaxAge,
    token: {
      id: user.id,
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
      isDemo: true,
    },
  });
  const secure = new URL(request.url).protocol === "https:";
  const cookieName = secure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);

  response.cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: sessionMaxAge,
  });

  return response;
}
