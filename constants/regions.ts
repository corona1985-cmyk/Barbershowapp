/** Países soportados: Latinoamérica + Estados Unidos */
export type CountryCode = 'DO' | 'CO' | 'MX' | 'US' | 'PA' | 'AR' | 'CL' | 'PE' | 'EC' | 'VE' | 'CR' | 'GT' | 'HN' | 'SV' | 'NI' | 'PR' | 'UY' | 'BO' | 'PY';

export interface CountryOption {
    code: CountryCode;
    name: string;
    flag: string;
}

export const SUPPORTED_COUNTRIES: CountryOption[] = [
    { code: 'DO', name: 'República Dominicana', flag: '🇩🇴' },
    { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
    { code: 'MX', name: 'México', flag: '🇲🇽' },
    { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
    { code: 'PA', name: 'Panamá', flag: '🇵🇦' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱' },
    { code: 'PE', name: 'Perú', flag: '🇵🇪' },
    { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
    { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
    { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
    { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
    { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
    { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
    { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
    { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷' },
    { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
    { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
    { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
];

/** Ciudades y barrios/zonas por país (código ISO 2 letras) */
export const REGIONS: Record<CountryCode, Record<string, string[]>> = {
    DO: {
        Santiago: ['Los Salados', 'Camboya', 'Buenos Aires', 'Pontezuela', 'Villa Olímpica', 'Centro de Santiago', 'Bella Vista', 'Pontón', 'Cienfuegos', 'Gurabo', 'Licey al Medio'],
        'Santo Domingo': ['Piantini', 'Naco', 'Los Mina', 'Villa Mella', 'Gazcue', 'Zona Colonial', 'Los Alcarrizos', 'Santo Domingo Este', 'Santo Domingo Norte', 'Boca Chica'],
        'La Vega': ['Centro', 'Constanza', 'Jarabacoa'],
        'Puerto Plata': ['Centro', 'Sosúa', 'Cabarete'],
        'San Cristóbal': ['Centro', 'Villa Carmen'],
        'La Romana': ['Centro', 'Cumayasa'],
        'San Pedro de Macorís': ['Centro', 'Miramar'],
    },
    CO: {
        Bogotá: ['Chapinero', 'Usaquén', 'Suba', 'Kennedy', 'Engativá', 'Teusaquillo', 'La Candelaria', 'Fontibón', 'Bosa'],
        Medellín: ['El Poblado', 'Laureles', 'Envigado', 'Belén', 'Robledo', 'Centro', 'Buenos Aires', 'Itagüí'],
        Cali: ['Granada', 'San Fernando', 'Ciudad Jardín', 'Centro', 'Pance', 'Meléndez'],
        Barranquilla: ['El Prado', 'Riomar', 'Centro', 'Suroccidente', 'Norte Centro Histórico'],
        Cartagena: ['Bocagrande', 'Centro Histórico', 'Manga', 'Crespo', 'Pie de la Popa'],
        Bucaramanga: ['Cabecera', 'Centro', 'Girón', 'Floridablanca'],
        Pereira: ['Centro', 'Cuba', 'Boston'],
    },
    MX: {
        'Ciudad de México': ['Polanco', 'Roma', 'Condesa', 'Coyoacán', 'Iztapalapa', 'Benito Juárez', 'Cuauhtémoc'],
        Guadalajara: ['Centro', 'Zapopan', 'Tlaquepaque', 'Chapalita'],
        Monterrey: ['Centro', 'San Pedro Garza García', 'Cumbres', 'Santa Catarina'],
        Puebla: ['Centro', 'Angelópolis', 'Cholula'],
        Tijuana: ['Centro', 'Zona Río', 'Playas de Tijuana'],
        Cancún: ['Centro', 'Zona Hotelera', 'Supermanzana'],
    },
    US: {
        'New York': ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'],
        Miami: ['Brickell', 'Wynwood', 'Little Havana', 'Coral Gables', 'Hialeah'],
        'Los Angeles': ['Downtown', 'Hollywood', 'Venice', 'Koreatown', 'East LA'],
        Houston: ['Downtown', 'Midtown', 'Montrose', 'Katy'],
        Chicago: ['Loop', 'Lincoln Park', 'Pilsen', 'Hyde Park'],
        Orlando: ['Downtown', 'International Drive', 'Kissimmee'],
        Dallas: ['Downtown', 'Deep Ellum', 'Oak Lawn'],
    },
    PA: {
        'Ciudad de Panamá': ['Bella Vista', 'El Cangrejo', 'San Francisco', 'Costa del Este', 'Casco Viejo', 'Pedregal'],
        Colón: ['Centro', 'Cristóbal'],
        David: ['Centro', 'Pedregal'],
    },
    AR: {
        'Buenos Aires': ['Palermo', 'Recoleta', 'Belgrano', 'Caballito', 'Microcentro', 'San Telmo'],
        Córdoba: ['Centro', 'Güemes', 'Cerro de las Rosas'],
        Rosario: ['Centro', 'Pichincha', 'Fisherton'],
        Mendoza: ['Centro', 'Godoy Cruz'],
    },
    CL: {
        Santiago: ['Providencia', 'Las Condes', 'Ñuñoa', 'Maipú', 'Centro', 'La Florida'],
        Valparaíso: ['Centro', 'Viña del Mar'],
        Concepción: ['Centro', 'San Pedro de la Paz'],
    },
    PE: {
        Lima: ['Miraflores', 'San Isidro', 'Surco', 'Barranco', 'Centro', 'San Miguel'],
        Arequipa: ['Centro', 'Cayma', 'Yanahuara'],
        Trujillo: ['Centro', 'La Esperanza'],
    },
    EC: {
        Quito: ['La Mariscal', 'Centro Histórico', 'Cumbayá', 'Tumbaco'],
        Guayaquil: ['Urdesa', 'Samborondón', 'Centro', 'Ceibos'],
        Cuenca: ['Centro', 'El Vergel'],
    },
    VE: {
        Caracas: ['Chacao', 'Las Mercedes', 'Altamira', 'Centro', 'Petare'],
        Maracaibo: ['Centro', 'La Lago'],
        Valencia: ['Centro', 'Naguanagua'],
    },
    CR: {
        'San José': ['Centro', 'Escazú', 'Santa Ana', 'Sabana', 'Pavas'],
        Alajuela: ['Centro', 'La Garita'],
        Heredia: ['Centro', 'San Francisco'],
    },
    GT: {
        'Ciudad de Guatemala': ['Zona 1', 'Zona 4', 'Zona 10', 'Zona 11', 'Zona 14', 'Mixco'],
        Antigua: ['Centro'],
        Quetzaltenango: ['Centro', 'Zone 3'],
    },
    HN: {
        Tegucigalpa: ['Centro', 'Comayagüela', 'Colonia Palmira', 'Las Minitas'],
        'San Pedro Sula': ['Centro', 'Colonia Trejo', 'Río de Piedras'],
    },
    SV: {
        'San Salvador': ['Centro', 'Escalón', 'Santa Tecla', 'Soyapango', 'Antiguo Cuscatlán'],
        'Santa Ana': ['Centro', 'Colonia San Luis'],
    },
    NI: {
        Managua: ['Centro', 'Carretera Masaya', 'Los Robles', 'Bolonia'],
        León: ['Centro', 'Sutiaba'],
    },
    PR: {
        'San Juan': ['Old San Juan', 'Condado', 'Santurce', 'Hato Rey', 'Río Piedras'],
        Ponce: ['Centro', 'Playa'],
        Bayamón: ['Centro'],
    },
    UY: {
        Montevideo: ['Centro', 'Pocitos', 'Carrasco', 'Cordón', 'Punta Carretas'],
    },
    BO: {
        'La Paz': ['Centro', 'Sopocachi', 'Miraflores', 'Zona Sur'],
        'Santa Cruz': ['Centro', 'Equipetrol', 'Plan 3000'],
    },
    PY: {
        Asunción: ['Centro', 'Villa Morra', 'Lambare', 'San Lorenzo'],
    },
};

export function getCountryName(code: string): string {
    return SUPPORTED_COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export function getCitiesForCountry(countryCode: string): string[] {
    const regions = REGIONS[countryCode as CountryCode];
    if (!regions) return [];
    return Object.keys(regions).sort((a, b) => a.localeCompare(b, 'es'));
}

export function getBarriosForCityInCountry(countryCode: string, city: string): string[] {
    const regions = REGIONS[countryCode as CountryCode];
    if (!regions || !city) return [];
    return regions[city] ?? [];
}

export function countryHasBarrios(countryCode: string, city: string): boolean {
    return getBarriosForCityInCountry(countryCode, city).length > 0;
}

/** Ciudades destacadas por país para acceso rápido */
export const QUICK_CITIES_BY_COUNTRY: Partial<Record<CountryCode, string[]>> = {
    DO: ['Santiago', 'Santo Domingo', 'La Vega'],
    CO: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla'],
    MX: ['Ciudad de México', 'Guadalajara', 'Monterrey'],
    US: ['Miami', 'New York', 'Los Angeles', 'Houston'],
    PA: ['Ciudad de Panamá'],
    AR: ['Buenos Aires'],
};
