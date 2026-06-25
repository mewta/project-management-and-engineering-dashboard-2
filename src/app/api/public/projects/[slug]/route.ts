import { NextResponse } from "next/server";
import { getPublicRoadmap } from "@/lib/public-roadmap";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const rateLimit = await checkRateLimit({
    key: `public-roadmap:${getRequestIp(request.headers)}`,
    limit: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      },
    );
  }

  const roadmap = await getPublicRoadmap(slug);

  if (!roadmap) {
    return NextResponse.json({ error: "Roadmap not found" }, { status: 404 });
  }

  return NextResponse.json(roadmap, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-RateLimit-Limit": String(rateLimit.limit),
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    },
  });
}
