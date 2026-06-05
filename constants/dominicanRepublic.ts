/** @deprecated Usar constants/regions.ts */
import { REGIONS } from './regions';

export const DR_CITIES_BARIOS = REGIONS.DO;
export const DR_CITY_NAMES = Object.keys(REGIONS.DO).sort((a, b) => a.localeCompare(b, 'es'));
