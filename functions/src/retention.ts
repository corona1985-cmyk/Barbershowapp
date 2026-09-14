import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, ROOT } from "./lib";

export const AUDIT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
export const NOTIFICATION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
export const RATE_LIMIT_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_DELETES_PER_RUN = 400;

export function shouldPruneTimestamp(raw: unknown, maxAgeMs: number, now = Date.now()): boolean {
  const value = String(raw || "");
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return false;
  return now - ts > maxAgeMs;
}

async function pruneCollection(
  path: string,
  maxAgeMs: number,
  getTimestamp: (row: Record<string, unknown>) => unknown,
  now: number
): Promise<number> {
  const snap = await db().ref(path).get();
  if (!snap.exists()) return 0;
  const val = snap.val() as Record<string, Record<string, unknown>>;
  const updates: Record<string, null> = {};
  let count = 0;
  for (const [key, row] of Object.entries(val || {})) {
    if (!row || typeof row !== "object") continue;
    if (!shouldPruneTimestamp(getTimestamp(row), maxAgeMs, now)) continue;
    updates[key] = null;
    count += 1;
    if (count >= MAX_DELETES_PER_RUN) break;
  }
  if (count) await db().ref(path).update(updates);
  return count;
}

async function pruneRateLimits(now: number): Promise<number> {
  const snap = await db().ref(`${ROOT}/rateLimits`).get();
  if (!snap.exists()) return 0;
  const buckets = snap.val() as Record<string, Record<string, { windowStart?: number }>>;
  const updates: Record<string, null> = {};
  let count = 0;
  for (const [bucket, keys] of Object.entries(buckets || {})) {
    if (!keys || typeof keys !== "object") continue;
    for (const [key, row] of Object.entries(keys)) {
      const start = Number(row?.windowStart);
      if (!Number.isFinite(start) || now - start <= RATE_LIMIT_MAX_AGE_MS) continue;
      updates[`${bucket}/${key}`] = null;
      count += 1;
      if (count >= MAX_DELETES_PER_RUN) break;
    }
    if (count >= MAX_DELETES_PER_RUN) break;
  }
  if (count) await db().ref(`${ROOT}/rateLimits`).update(updates);
  return count;
}

export async function pruneAgedLogs(now = Date.now()): Promise<{ audit: number; adminAudit: number; notifications: number; rateLimits: number }> {
  const [audit, adminAudit, notifications, rateLimits] = await Promise.all([
    pruneCollection(`${ROOT}/auditLogs`, AUDIT_MAX_AGE_MS, (row) => row.timestamp, now),
    pruneCollection(`${ROOT}/adminAudit`, AUDIT_MAX_AGE_MS, (row) => row.timestamp, now),
    pruneCollection(`${ROOT}/notificationLogs`, NOTIFICATION_MAX_AGE_MS, (row) => row.timestamp, now),
    pruneRateLimits(now),
  ]);
  return { audit, adminAudit, notifications, rateLimits };
}

export const pruneInflationLogs = onSchedule(
  {
    region: "us-central1",
    schedule: "every 24 hours",
    timeZone: "America/Santo_Domingo",
    timeoutSeconds: 120,
    memory: "256MiB",
    maxInstances: 1,
    retryCount: 0,
  },
  async () => {
    await pruneAgedLogs();
  }
);
