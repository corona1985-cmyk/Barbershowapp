import type { AccountTier, DisplayPlanName, PointOfSale, PosPlan } from '../types';

/**
 * Obtiene el nombre comercial único del plan a partir del tier (y opcionalmente plan) de la sede.
 * Gratuito (solo citas, 100/mes), Normal (solo), Pro (barbería), Full (multisede).
 */
export function getDisplayPlanName(tier?: AccountTier | null, _plan?: PosPlan | null): DisplayPlanName {
  if (tier === 'multisede') return 'Full';
  if (tier === 'barberia') return 'Pro';
  if (tier === 'gratuito') return 'Gratuito';
  return 'Normal';
}

/** Obtiene el nombre de plan para una sede (usa tier; plan interno se mantiene para funciones como notificaciones). */
export function getDisplayPlanNameFromPos(pos: PointOfSale | null | undefined): DisplayPlanName {
  if (!pos) return 'Normal';
  return getDisplayPlanName(pos.tier, pos.plan);
}

/**
 * Convierte el nombre comercial (Gratuito/Normal/Pro/Full) a tier y plan para guardar en BD.
 * Pro y Full tienen notificaciones (plan 'pro'); Gratuito y Normal usan 'basic'.
 */
export function displayPlanNameToTierAndPlan(
  displayName: DisplayPlanName
): { tier: AccountTier; plan: PosPlan } {
  switch (displayName) {
    case 'Full':
      return { tier: 'multisede', plan: 'pro' };
    case 'Pro':
      return { tier: 'barberia', plan: 'pro' };
    case 'Gratuito':
      return { tier: 'gratuito', plan: 'basic' };
    default:
      return { tier: 'solo', plan: 'basic' };
  }
}
