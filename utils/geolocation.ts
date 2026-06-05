import { getCitiesForCountry, SUPPORTED_COUNTRIES, type CountryCode } from '../constants/regions';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

export type GeoPermissionResult =
    | { status: 'success'; lat: number; lng: number; countryCode: CountryCode; city: string; displayLabel: string }
    | { status: 'denied'; message: string }
    | { status: 'unavailable'; message: string }
    | { status: 'error'; message: string };

function normalizeCountryCode(raw: string | undefined): CountryCode | null {
    if (!raw) return null;
    const code = raw.toUpperCase();
    if (code === 'USA') return 'US';
    const found = SUPPORTED_COUNTRIES.find((c) => c.code === code);
    return found ? found.code : null;
}

/** Intenta emparejar el nombre de ciudad del geocoder con el catálogo del país */
export function matchCityToCatalog(countryCode: string, geocodedCity: string): string {
    const cities = getCitiesForCountry(countryCode);
    if (!geocodedCity) return '';
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const lower = norm(geocodedCity);
    const exact = cities.find((c) => norm(c) === lower);
    if (exact) return exact;
    const partial = cities.find((c) => {
        const cl = c.toLowerCase();
        return lower.includes(cl) || cl.includes(lower);
    });
    if (partial) return partial;
    return geocodedCity;
}

async function reverseGeocode(lat: number, lng: number): Promise<{ countryCode: CountryCode | null; city: string; label: string }> {
    const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: 'json',
        'accept-language': 'es',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('No se pudo obtener la dirección.');
    const data = await res.json();
    const addr = data?.address ?? {};
    const countryCode = normalizeCountryCode(addr.country_code);
    const rawCity =
        addr.city ||
        addr.town ||
        addr.municipality ||
        addr.state_district ||
        addr.county ||
        addr.state ||
        '';
    const city = countryCode ? matchCityToCatalog(countryCode, rawCity) : rawCity;
    const label = [city, addr.country].filter(Boolean).join(', ');
    return { countryCode, city, label: label || 'Tu ubicación' };
}

/**
 * Solicita permiso de ubicación al usuario (solo al llamar esta función)
 * y devuelve país/ciudad detectados.
 */
export function requestUserLocationWithPermission(): Promise<GeoPermissionResult> {
    return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            resolve({
                status: 'unavailable',
                message: 'Tu navegador no soporta geolocalización. Elige tu país manualmente.',
            });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const geo = await reverseGeocode(latitude, longitude);
                    if (!geo.countryCode) {
                        resolve({
                            status: 'error',
                            message: 'Ubicación detectada, pero el país no está en nuestra lista. Elige tu país manualmente.',
                        });
                        return;
                    }
                    resolve({
                        status: 'success',
                        lat: latitude,
                        lng: longitude,
                        countryCode: geo.countryCode,
                        city: geo.city,
                        displayLabel: geo.label,
                    });
                } catch {
                    resolve({
                        status: 'error',
                        message: 'No pudimos determinar tu ciudad. Elige país y ciudad manualmente.',
                    });
                }
            },
            (err) => {
                if (err.code === err.PERMISSION_DENIED) {
                    resolve({
                        status: 'denied',
                        message: 'Permiso de ubicación denegado. Puedes elegir tu país y ciudad abajo.',
                    });
                } else if (err.code === err.TIMEOUT) {
                    resolve({
                        status: 'error',
                        message: 'Tiempo agotado al obtener ubicación. Intenta de nuevo o elige manualmente.',
                    });
                } else {
                    resolve({
                        status: 'unavailable',
                        message: 'No se pudo acceder a tu ubicación. Elige tu país manualmente.',
                    });
                }
            },
            { enableHighAccuracy: false, timeout: 18000, maximumAge: 300000 }
        );
    });
}
