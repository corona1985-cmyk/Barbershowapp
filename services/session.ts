import type { UserRole } from "../types";

export type SessionClaims = {
  role: UserRole | string;
  username: string;
  posId: number | null;
  barberId: number | null;
  clientId: number | null;
};

let cachedClaims: SessionClaims | null = null;

export function getCachedClaims(): SessionClaims | null {
  return cachedClaims;
}

export function setCachedClaims(claims: SessionClaims | null): void {
  cachedClaims = claims;
}

export function parseTokenClaims(claims: Record<string, unknown>): SessionClaims | null {
  const username = String(claims.username || "").trim();
  const role = String(claims.role || "").trim();
  if (!username || !role) return null;
  return {
    username,
    role,
    posId: typeof claims.posId === "number" ? claims.posId : claims.posId == null ? null : Number(claims.posId),
    barberId: typeof claims.barberId === "number" ? claims.barberId : claims.barberId == null ? null : Number(claims.barberId),
    clientId: typeof claims.clientId === "number" ? claims.clientId : claims.clientId == null ? null : Number(claims.clientId),
  };
}

export function clearSessionClaims(): void {
  cachedClaims = null;
}
