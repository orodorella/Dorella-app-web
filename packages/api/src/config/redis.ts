import type { Redis } from 'ioredis';

let redis: Redis | null = null;

export async function getRedis(): Promise<Redis | null> {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('REDIS_URL not set — BullMQ jobs disabled');
    return null;
  }

  const { default: IoRedis } = await import('ioredis');
  redis = new IoRedis(url, { maxRetriesPerRequest: null });
  return redis;
}
