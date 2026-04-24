import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import {
  getAppUrl,
  getUpstashRedisRestToken,
  getUpstashRedisRestUrl,
  isUpstashConfigured,
} from "@/lib/supabase/env";

type RateLimitBucket = "llm" | "report";

const redis = isUpstashConfigured()
  ? new Redis({
      url: getUpstashRedisRestUrl(),
      token: getUpstashRedisRestToken(),
    })
  : null;

const rateLimiters: Record<RateLimitBucket, Ratelimit | null> = {
  llm: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        analytics: true,
        prefix: "suppgo:llm",
      })
    : null,
  report: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 h"),
        analytics: true,
        prefix: "suppgo:report",
      })
    : null,
};

function getRequestOrigin(request: Request) {
  return request.headers.get("origin");
}

function getAllowedOrigins(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  return new Set([requestOrigin, new URL(getAppUrl()).origin]);
}

function getRateLimitIdentifier(request: Request, userId?: string | null) {
  if (userId) {
    return `user:${userId}`;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "anonymous";
  return `ip:${ip}`;
}

export function enforceSameOrigin(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const origin = getRequestOrigin(request);

  if (!origin) {
    return null;
  }

  if (!getAllowedOrigins(request).has(origin)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  return null;
}

export async function enforceRateLimit({
  request,
  bucket,
  userId,
}: {
  request: Request;
  bucket: RateLimitBucket;
  userId?: string | null;
}) {
  const limiter = rateLimiters[bucket];

  if (!limiter) {
    return null;
  }

  let result: Awaited<ReturnType<Ratelimit["limit"]>>;

  try {
    result = await limiter.limit(getRateLimitIdentifier(request, userId));
  } catch (error) {
    // Fail open: if Upstash is unreachable (dead DB, DNS failure, network blip),
    // we explicitly prefer to let the request through rather than 500 the whole
    // endpoint. Restore strict enforcement once a healthy Upstash is wired back up.
    console.warn("[rate-limit]", {
      bucket,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }

  if (result.success) {
    return null;
  }

  return NextResponse.json(
    {
      error:
        bucket === "report"
          ? "Too many report requests. Please try again later."
          : "Too many analysis requests. Please try again shortly.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))),
      },
    },
  );
}
