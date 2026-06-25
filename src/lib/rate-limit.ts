import Redis from "ioredis";

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type MemoryEntry = {
  count: number;
  expiresAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __devboardRateLimitRedis?: Redis;
  __devboardRateLimitMemory?: Map<string, MemoryEntry>;
};

const memoryStore =
  globalForRateLimit.__devboardRateLimitMemory ?? new Map<string, MemoryEntry>();

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.__devboardRateLimitMemory = memoryStore;
}

function getRedis() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!globalForRateLimit.__devboardRateLimitRedis) {
    const redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 500,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redis.on("error", () => undefined);
    globalForRateLimit.__devboardRateLimitRedis = redis;
  }

  return globalForRateLimit.__devboardRateLimitRedis;
}

export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const redis = getRedis();

  if (redis) {
    try {
      if (redis.status === "wait") {
        await redis.connect();
      }

      const redisKey = `rate-limit:${key}`;
      const results = await redis
        .multi()
        .incr(redisKey)
        .expire(redisKey, windowSeconds, "NX")
        .ttl(redisKey)
        .exec();
      const count = Number(results?.[0]?.[1] ?? 1);
      const retryAfterSeconds = Math.max(Number(results?.[2]?.[1] ?? windowSeconds), 1);

      return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(limit - count, 0),
        retryAfterSeconds,
      };
    } catch {
      // Fall back to the process-local limiter when Redis is unavailable.
    }
  }

  return checkMemoryRateLimit(key, limit, windowSeconds);
}

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);
  const entry =
    existing && existing.expiresAt > now
      ? existing
      : {
          count: 0,
          expiresAt: now + windowSeconds * 1000,
        };

  entry.count += 1;
  memoryStore.set(key, entry);

  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(limit - entry.count, 0),
    retryAfterSeconds: Math.max(Math.ceil((entry.expiresAt - now) / 1000), 1),
  };
}

export function getRequestIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
