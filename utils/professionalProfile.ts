import type { ProfessionalCertification } from '../types';

export const PROFILE_LIMITS = {
  bio: 800,
  about: 800,
  certTitle: 120,
  certIssuer: 80,
  highlight: 48,
  maxCerts: 12,
  maxHighlights: 8,
  minYear: 1980,
  maxYearsExperience: 60,
};

export function currentCertYearMax(): number {
  return new Date().getFullYear() + 1;
}

export function newCertificationId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function asList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, unknown>);
  return [];
}

export function sanitizeCertifications(raw: unknown): ProfessionalCertification[] {
  const out: ProfessionalCertification[] = [];
  const yearMax = currentCertYearMax();
  for (const item of asList(raw)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const title = String(rec.title || '').trim().slice(0, PROFILE_LIMITS.certTitle);
    if (!title) continue;
    const cert: ProfessionalCertification = {
      id: String(rec.id || newCertificationId()).slice(0, 40),
      title,
    };
    const issuer = String(rec.issuer || '').trim().slice(0, PROFILE_LIMITS.certIssuer);
    if (issuer) cert.issuer = issuer;
    const year = Number(rec.year);
    if (Number.isFinite(year) && year >= PROFILE_LIMITS.minYear && year <= yearMax) {
      cert.year = Math.round(year);
    }
    out.push(cert);
    if (out.length >= PROFILE_LIMITS.maxCerts) break;
  }
  return out;
}

export function sanitizeHighlights(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : asList(raw);
  const out: string[] = [];
  for (const item of list) {
    const s = String(item || '').trim().slice(0, PROFILE_LIMITS.highlight);
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= PROFILE_LIMITS.maxHighlights) break;
  }
  return out;
}

export function sanitizeProfileText(raw: unknown, max: number): string {
  return String(raw || '').trim().slice(0, max);
}

export function sanitizeYearsExperience(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(PROFILE_LIMITS.maxYearsExperience, Math.round(n));
}
