import type { AccountTier, DisplayPlanName, PointOfSale, PosPlan } from '../types';

/**
 * Obtiene el nombre comercial único del plan a partir del tier (y opcionalmente plan) de la sede.
 * Un solo nombre: Normal (solo), Pro (barbería), Full (multisede = todo incluido).
 */
export function getDisplayPlanName(tier?: AccountTier | null, _plan?: PosPlan | null): DisplayPlanName {
  if (tier === 'multisede') return 'Full';
  if (tier === 'barberia') return 'Pro';
  return 'Normal';
}

/** Obtiene el nombre de plan para una sede (usa tier; plan interno se mantiene para funciones como notificaciones). */
export function getDisplayPlanNameFromPos(pos: PointOfSale | null | undefined): DisplayPlanName {
  if (!pos) return 'Normal';
  return getDisplayPlanName(pos.tier, pos.plan);
}

/**
 * Convierte el nombre comercial (Normal/Pro/Full) a tier y plan para guardar en BD.
 * Pro y Full tienen notificaciones (plan 'pro'); Normal usa 'basic'.
 */
export function displayPlanNameToTierAndPlan(
  displayName: DisplayPlanName
): { tier: AccountTier; plan: PosPlan } {
  switch (displayName) {
    case 'Full':
      return { tier: 'multisede', plan: 'pro' };
    case 'Pro':
      return { tier: 'barberia', plan: 'pro' };
    default:
      return { tier: 'solo', plan: 'basic' };
  }
}
