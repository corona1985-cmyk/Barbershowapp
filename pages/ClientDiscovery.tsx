import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DataService } from '../services/data';
import { PointOfSale } from '../types';
import {
    Scissors, MapPin, ExternalLink, Search, Star, StarOff, Loader2,
    Building2, X, Calendar, ArrowRight, Sparkles, Users, Navigation, Globe,
} from 'lucide-react';
import { SUPPORTED_COUNTRIES, QUICK_CITIES_BY_COUNTRY, countryHasBarrios } from '../constants/regions';
import {
    formatPosLocationLabel,
    getBarriosForCity,
    getCitiesForCountry,
    getCountryName,
    posMatchesLocationFilters,
    resolvePosLocation,
    countShopsInCountry,
    countShopsInCity,
} from '../utils/posLocation';
import { requestUserLocationWithPermission } from '../utils/geolocation';

const LOAD_TIMEOUT_MS = 18000;

interface ClientDiscoveryProps {
    onSwitchPos: (id: number) => void;
    guestMode?: boolean;
    onBookAppointment?: (posId: number, posName: string) => void;
    preferredPosId?: number | null;
    onRemoveFavorite?: () => void | Promise<void>;
}

const ClientDiscovery: React.FC<ClientDiscoveryProps> = ({
    onSwitchPos,
    guestMode,
    onBookAppointment,
    preferredPosId = null,
    onRemoveFavorite,
}) => {
    const [posList, setPosList] = useState<PointOfSale[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCountry, setSelectedCountry] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [selectedBarrio, setSelectedBarrio] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);
    const [geoMessage, setGeoMessage] = useState<string | null>(null);
    const [geoSuccess, setGeoSuccess] = useState(false);

    const cityOptions = useMemo(() => (selectedCountry ? getCitiesForCountry(selectedCountry) : []), [selectedCountry]);
    const barrioOptions = useMemo(
        () => (selectedCountry && selectedCity ? getBarriosForCity(selectedCountry, selectedCity) : []),
        [selectedCountry, selectedCity]
    );
    const showBarrioFilter = selectedCountry && selectedCity && countryHasBarrios(selectedCountry, selectedCity);
    const quickCities = selectedCountry
        ? (QUICK_CITIES_BY_COUNTRY[selectedCountry as keyof typeof QUICK_CITIES_BY_COUNTRY] ?? [])
        : [];

    const loadBarberias = useCallback(async () => {
        setLoadError(false);
        setLoading(true);
        try {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Tiempo de espera agotado.')), LOAD_TIMEOUT_MS)
            );
            const list = await Promise.race([DataService.getPointsOfSale(), timeoutPromise]);
            setPosList(Array.isArray(list) ? list.filter((p) => p.isActive !== false) : []);
        } catch (err) {
            console.error('Error cargando barberías:', err);
            setLoadError(true);
            setPosList([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBarberias();
    }, [loadBarberias]);

    const filtered = useMemo(
        () => posList.filter((p) => posMatchesLocationFilters(p, selectedCountry, selectedCity, selectedBarrio, searchTerm)),
        [posList, selectedCountry, selectedCity, selectedBarrio, searchTerm]
    );

    const sorted = useMemo(() => {
        if (preferredPosId == null || guestMode) return filtered;
        return [...filtered].sort((a, b) => (a.id === preferredPosId ? -1 : b.id === preferredPosId ? 1 : 0));
    }, [filtered, preferredPosId, guestMode]);

    const countriesWithShops = useMemo(() => {
        const set = new Set<string>();
        posList.forEach((p) => {
            const { country } = resolvePosLocation(p);
            if (country) set.add(country);
        });
        return set.size;
    }, [posList]);

    const hasActiveFilters = Boolean(selectedCountry || selectedCity || selectedBarrio || searchTerm.trim());

    const clearFilters = () => {
        setSelectedCountry('');
        setSelectedCity('');
        setSelectedBarrio('');
        setSearchTerm('');
        setGeoMessage(null);
        setGeoSuccess(false);
    };

    const selectCountry = (code: string) => {
        setSelectedCountry(code);
        setSelectedCity('');
        setSelectedBarrio('');
    };

    const selectCity = (city: string) => {
        setSelectedCity(city);
        setSelectedBarrio('');
    };

    const handleUseLocation = async () => {
        setGeoLoading(true);
        setGeoMessage(null);
        setGeoSuccess(false);
        const result = await requestUserLocationWithPermission();
        setGeoLoading(false);

        if (result.status === 'success') {
            setSelectedCountry(result.countryCode);
            setSelectedCity(result.city);
            setSelectedBarrio('');
            setGeoSuccess(true);
            const inCity = countShopsInCity(posList, result.countryCode, result.city);
            const inCountry = countShopsInCountry(posList, result.countryCode);
            if (inCity > 0) {
                setGeoMessage(`Estás en ${result.displayLabel}. Encontramos ${inCity} barbería${inCity === 1 ? '' : 's'} en tu ciudad.`);
            } else if (inCountry > 0) {
                setGeoMessage(`Estás en ${result.displayLabel}. No hay barberías en tu ciudad, pero hay ${inCountry} en ${getCountryName(result.countryCode)}.`);
            } else {
                setGeoMessage(`Estás en ${result.displayLabel}. Aún no hay barberías registradas en este país.`);
            }
        } else {
            setGeoMessage(result.message);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <div className="w-16 h-16 rounded-2xl bg-[#ffd427]/20 flex items-center justify-center mb-5">
                    <Loader2 className="animate-spin text-[#ffd427]" size={36} />
                </div>
                <p className="font-semibold text-lg text-slate-800">Cargando barberías...</p>
                <p className="text-sm text-slate-500 mt-1">Un momento por favor</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center py-32 max-w-md mx-auto text-center px-4">
                <p className="font-bold text-xl text-slate-900 mb-2">No se pudieron cargar las barberías</p>
                <p className="text-slate-500 mb-6">Revisa tu conexión e intenta de nuevo.</p>
                <button
                    type="button"
                    onClick={() => loadBarberias()}
                    className="bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold px-8 py-3.5 rounded-xl shadow-md"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="pb-16">
            {/* Hero blanco */}
            <section className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm p-8 sm:p-10 lg:p-12 mb-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffd427]/10 rounded-full blur-3xl pointer-events-none" aria-hidden />
                <div className="relative z-10">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ffd427]/15 text-amber-800 text-sm font-bold mb-5">
                        <Globe size={16} /> Latinoamérica y Estados Unidos
                    </span>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight mb-4">
                        Encuentra tu{' '}
                        <span className="text-[#ffd427] drop-shadow-sm">barbería ideal</span>
                    </h1>
                    <p className="text-slate-600 text-lg leading-relaxed mb-8 max-w-2xl">
                        {guestMode
                            ? 'Usa tu ubicación o elige país y ciudad. Agenda tu cita en segundos — sin crear cuenta.'
                            : 'Explora barberías afiliadas a BarberShow en tu país y ciudad.'}
                    </p>

                    <div className="flex flex-wrap gap-4 mb-8">
                        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-50 border border-slate-100">
                            <Building2 size={22} className="text-[#ffd427]" />
                            <div>
                                <p className="text-2xl font-black text-slate-900 leading-none">{posList.length}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Barberías activas</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-50 border border-slate-100">
                            <MapPin size={22} className="text-[#ffd427]" />
                            <div>
                                <p className="text-2xl font-black text-slate-900 leading-none">{countriesWithShops || SUPPORTED_COUNTRIES.length}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Países</p>
                            </div>
                        </div>
                    </div>

                    {/* Ubicación — permiso explícito */}
                    <div className="rounded-2xl border-2 border-dashed border-[#ffd427]/40 bg-[#ffd427]/5 p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="w-11 h-11 rounded-xl bg-[#ffd427] flex items-center justify-center flex-shrink-0 shadow-md">
                                    <Navigation size={22} className="text-slate-900" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900">¿Dónde estás?</p>
                                    <p className="text-sm text-slate-600 mt-0.5">
                                        Usamos tu ubicación solo para mostrarte barberías en tu país y ciudad. No la guardamos.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleUseLocation}
                                disabled={geoLoading}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#ffd427] hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-bold rounded-xl shadow-md transition-all whitespace-nowrap"
                            >
                                {geoLoading ? (
                                    <><Loader2 size={18} className="animate-spin" /> Detectando...</>
                                ) : (
                                    <><Navigation size={18} /> Usar mi ubicación</>
                                )}
                            </button>
                        </div>
                        {geoMessage && (
                            <p className={`mt-4 text-sm font-medium px-4 py-3 rounded-xl ${geoSuccess ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
                                {geoMessage}
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* Países rápidos */}
            <div className="mb-6">
                <p className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">País</p>
                <div className="flex flex-wrap gap-2">
                    {SUPPORTED_COUNTRIES.filter((c) => countShopsInCountry(posList, c.code) > 0 || ['DO', 'CO', 'US', 'MX'].includes(c.code)).slice(0, 12).map((c) => (
                        <button
                            key={c.code}
                            type="button"
                            onClick={() => selectCountry(selectedCountry === c.code ? '' : c.code)}
                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                selectedCountry === c.code
                                    ? 'bg-[#ffd427] text-slate-900 shadow-md'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:border-[#ffd427]/50 hover:shadow-sm'
                            }`}
                        >
                            {c.flag} {c.name}
                        </button>
                    ))}
                </div>
            </div>

            {quickCities.length > 0 && (
                <div className="mb-8">
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Ciudades populares</p>
                    <div className="flex flex-wrap gap-2">
                        {quickCities.map((city) => (
                            <button
                                key={city}
                                type="button"
                                onClick={() => selectCity(selectedCity === city ? '' : city)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                    selectedCity === city
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'
                                }`}
                            >
                                {city}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-10">
                <div className="flex items-center gap-2 mb-6">
                    <Search size={20} className="text-[#ffd427]" />
                    <h2 className="text-lg font-bold text-slate-900">Refinar búsqueda</h2>
                </div>

                <div className={`grid grid-cols-1 gap-4 ${showBarrioFilter ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">País</label>
                        <select
                            value={selectedCountry}
                            onChange={(e) => selectCountry(e.target.value)}
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ffd427] cursor-pointer"
                        >
                            <option value="">Todos los países</option>
                            {SUPPORTED_COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ciudad</label>
                        <select
                            value={selectedCity}
                            onChange={(e) => selectCity(e.target.value)}
                            disabled={!selectedCountry}
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ffd427] disabled:opacity-50 cursor-pointer"
                        >
                            <option value="">{selectedCountry ? 'Todas las ciudades' : 'Elige un país'}</option>
                            {cityOptions.map((city) => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>
                    {showBarrioFilter && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Barrio / Zona</label>
                            <select
                                value={selectedBarrio}
                                onChange={(e) => setSelectedBarrio(e.target.value)}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ffd427] cursor-pointer"
                            >
                                <option value="">Todos</option>
                                {barrioOptions.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar barbería..."
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6 pt-6 border-t border-slate-100">
                    <p className="text-slate-700 font-medium">
                        <span className="text-[#ffd427] font-black text-2xl">{sorted.length}</span>
                        {' '}resultado{sorted.length === 1 ? '' : 's'}
                        {selectedCountry && (
                            <span className="text-slate-500 text-sm ml-2">
                                en {getCountryName(selectedCountry)}
                                {selectedCity ? ` · ${selectedCity}` : ''}
                            </span>
                        )}
                    </p>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            <X size={16} /> Limpiar filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Resultados */}
            {sorted.length === 0 ? (
                <div className="text-center py-20 px-6 rounded-3xl border-2 border-dashed border-slate-200 bg-white">
                    <Scissors size={48} className="mx-auto text-[#ffd427] mb-5" />
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">No hay barberías con esos filtros</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-8">
                        Prueba otro país o ciudad, o usa tu ubicación para detectar barberías cerca.
                    </p>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex items-center gap-2 px-8 py-4 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold rounded-xl shadow-md"
                    >
                        Ver todas <ArrowRight size={18} />
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                    {sorted.map((pos) => {
                        const isFavorite = !guestMode && preferredPosId != null && pos.id === preferredPosId;
                        const { country, city, barrio } = resolvePosLocation(pos);

                        return (
                            <article
                                key={pos.id}
                                className={`group flex flex-col rounded-2xl overflow-hidden bg-white border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                                    isFavorite ? 'border-[#ffd427] ring-2 ring-[#ffd427]/30 shadow-lg' : 'border-slate-200 shadow-sm'
                                }`}
                            >
                                <div className="relative h-36 bg-gradient-to-br from-[#ffd427] via-amber-300 to-amber-400">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-20 h-20 rounded-2xl bg-white/90 shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Scissors size={36} className="text-slate-900" />
                                        </div>
                                    </div>
                                    {isFavorite && (
                                        <span className="absolute top-3 right-3 px-3 py-1 bg-slate-900 text-[#ffd427] text-xs font-bold rounded-full flex items-center gap-1">
                                            <Star size={12} fill="currentColor" /> Favorita
                                        </span>
                                    )}
                                    {guestMode && (
                                        <span className="absolute top-3 left-3 px-3 py-1 bg-white/95 text-slate-800 text-xs font-semibold rounded-full flex items-center gap-1 shadow-sm">
                                            <Users size={12} /> Afiliada
                                        </span>
                                    )}
                                </div>

                                <div className="p-6 flex flex-col flex-1">
                                    <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-amber-700 transition-colors">
                                        {pos.name}
                                    </h3>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {country && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                                {SUPPORTED_COUNTRIES.find((c) => c.code === country)?.flag} {getCountryName(country)}
                                            </span>
                                        )}
                                        {city && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ffd427]/15 text-amber-900 text-xs font-semibold">
                                                <MapPin size={11} /> {city}
                                            </span>
                                        )}
                                        {barrio && barrio !== city && (
                                            <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 text-xs border border-slate-200">
                                                {barrio}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 text-sm mb-6 flex-1">{formatPosLocationLabel(pos)}</p>
                                    <div className="flex flex-col gap-2.5 mt-auto">
                                        {guestMode && onBookAppointment && (
                                            <button
                                                type="button"
                                                onClick={() => onBookAppointment(pos.id, pos.name)}
                                                className="w-full py-3.5 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 shadow-md"
                                            >
                                                <Calendar size={18} /> Agendar cita
                                            </button>
                                        )}
                                        {isFavorite && onRemoveFavorite && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveFavorite()}
                                                className="w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50"
                                            >
                                                <StarOff size={16} /> Quitar favorito
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => onSwitchPos(pos.id)}
                                            className="w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        >
                                            {guestMode ? 'Registrarme aquí' : 'Ver perfil'}
                                            <ExternalLink size={15} />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ClientDiscovery;
