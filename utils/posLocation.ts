import type { PointOfSale } from '../types';
import {
    REGIONS,
    getBarriosForCityInCountry,
    getCitiesForCountry,
    getCountryName,
    type CountryCode,
} from '../constants/regions';

export type ResolvedLocation = {
    country: string | null;
    city: string | null;
    barrio: string | null;
};

export function getBarriosForCity(countryCode: string, city: string): string[] {
    return getBarriosForCityInCountry(countryCode, city);
}

/** @deprecated Usar getBarriosForCity(country, city) */
export function getBarriosForCityLegacy(city: string): string[] {
    return getBarriosForCityInCountry('DO', city);
}

/** Resuelve país, ciudad y barrio desde campos estructurados o inferidos (datos legacy). */
export function resolvePosLocation(pos: PointOfSale): ResolvedLocation {
    if (pos.country) {
        return {
            country: pos.country,
            city: pos.city ?? null,
            barrio: pos.barrio ?? null,
        };
    }

    const addr = (pos.address ?? '').toLowerCase();

    for (const [countryCode, cities] of Object.entries(REGIONS) as [CountryCode, Record<string, string[]>][]) {
        for (const [city, barrios] of Object.entries(cities)) {
            for (const barrio of barrios) {
                if (addr.includes(barrio.toLowerCase())) {
                    return { country: countryCode, city, barrio };
                }
            }
            if (addr.includes(city.toLowerCase())) {
                return { country: countryCode, city, barrio: pos.barrio ?? null };
            }
        }
    }

    if (pos.city) {
        for (const [countryCode, cities] of Object.entries(REGIONS) as [CountryCode, Record<string, string[]>][]) {
            if (Object.keys(cities).includes(pos.city)) {
                return { country: countryCode, city: pos.city, barrio: pos.barrio ?? null };
            }
        }
    }

    if (addr.trim()) {
        return { country: null, city: null, barrio: pos.address.trim() };
    }

    return { country: null, city: null, barrio: null };
}

export function formatPosLocationLabel(pos: PointOfSale): string {
    const { country, city, barrio } = resolvePosLocation(pos);
    const parts: string[] = [];
    if (barrio && barrio !== city) parts.push(barrio);
    if (city) parts.push(city);
    if (country) parts.push(getCountryName(country));
    if (parts.length > 0) return parts.join(', ');
    if (pos.address?.trim()) return pos.address.trim();
    return 'Ubicación no indicada';
}

export function formatSignupAddress(street: string, barrio: string, city: string, countryCode: string): string {
    const countryName = getCountryName(countryCode);
    const s = street.trim();
    const base = barrio ? `${barrio}, ${city}, ${countryName}` : `${city}, ${countryName}`;
    return s ? `${s}, ${base}` : base;
}

export function posMatchesLocationFilters(
    pos: PointOfSale,
    selectedCountry: string,
    selectedCity: string,
    selectedBarrio: string,
    searchTerm: string
): boolean {
    const { country, city, barrio } = resolvePosLocation(pos);

    if (selectedCountry) {
        if (!country || country !== selectedCountry) return false;
    }

    if (selectedCity && city !== selectedCity) return false;
    if (selectedBarrio && barrio !== selectedBarrio) return false;

    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;

    return (
        pos.name.toLowerCase().includes(q) ||
        (pos.address ?? '').toLowerCase().includes(q) ||
        (country ?? '').toLowerCase().includes(q) ||
        getCountryName(country ?? '').toLowerCase().includes(q) ||
        (city ?? '').toLowerCase().includes(q) ||
        (barrio ?? '').toLowerCase().includes(q)
    );
}

export function countShopsInCountry(posList: PointOfSale[], countryCode: string): number {
    return posList.filter((p) => resolvePosLocation(p).country === countryCode).length;
}

export function countShopsInCity(posList: PointOfSale[], countryCode: string, city: string): number {
    return posList.filter((p) => {
        const loc = resolvePosLocation(p);
        return loc.country === countryCode && loc.city === city;
    }).length;
}

export { getCitiesForCountry, getCountryName };
