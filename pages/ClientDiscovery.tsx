import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { PointOfSale } from '../types';
import { Globe, MapPin, ExternalLink, Search, Star, StarOff } from 'lucide-react';

interface ClientDiscoveryProps {
    onSwitchPos: (id: number) => void;
    /** Modo invitado: muestra "Agendar cita" (sin cuenta) y "Registrarme" */
    guestMode?: boolean;
    onBookAppointment?: (posId: number, posName: string) => void;
    /** Barbería preferida del cliente (al iniciar sesión va ahí). Solo cuando no es guestMode. */
    preferredPosId?: number | null;
    /** Quitar la barbería de favoritos. Solo cuando no es guestMode. */
    onRemoveFavorite?: () => void | Promise<void>;
}

const ClientDiscovery: React.FC<ClientDiscoveryProps> = ({ onSwitchPos, guestMode, onBookAppointment, preferredPosId = null, onRemoveFavorite }) => {
    const [posList, setPosList] = useState<PointOfSale[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        DataService.getPointsOfSale().then(list => setPosList(list.filter(p => p.isActive)));
    }, []);

    const filtered = posList.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6">
            <div className="text-center mb-10 mt-6">
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Descubre Barberías Afiliadas</h2>
                <p className="text-slate-500">Encuentra y agenda con los mejores profesionales cerca de ti</p>
            </div>

            <div className="max-w-xl mx-auto mb-8 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Buscar barbería..." 
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ffd427] text-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(pos => {
                    const isFavorite = !guestMode && preferredPosId != null && pos.id === preferredPosId;
                    return (
                        <div key={pos.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-lg transition-all group ${isFavorite ? 'border-[#ffd427] ring-1 ring-[#ffd427]/50' : 'border-slate-200'}`}>
                            <div className="h-32 bg-gradient-to-r from-[#ffd427] to-amber-500 flex items-center justify-center relative">
                                {isFavorite && (
                                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-slate-900/80 text-[#ffd427] text-xs font-semibold rounded-full flex items-center gap-1">
                                        <Star size={12} fill="currentColor" /> Tu favorita
                                    </span>
                                )}
                                <Globe size={48} className="text-slate-900 opacity-50 group-hover:scale-110 transition-transform duration-500" />
                            </div>
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-slate-800 mb-2">{pos.name}</h3>
                                <div className="flex items-start text-slate-500 text-sm mb-4">
                                    <MapPin size={16} className="mr-1 mt-0.5 flex-shrink-0" />
                                    <span>{pos.address}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {guestMode && onBookAppointment && (
                                        <button
                                            onClick={() => onBookAppointment(pos.id, pos.name)}
                                            className="w-full py-2.5 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold rounded-lg transition-colors flex items-center justify-center"
                                        >
                                            Agendar cita (sin cuenta)
                                        </button>
                                    )}
                                    {isFavorite && onRemoveFavorite && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveFavorite()}
                                            className="w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                                        >
                                            <StarOff size={16} /> Quitar de favoritos
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onSwitchPos(pos.id)}
                                        className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center border ${guestMode ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-50 hover:bg-[#ffd427] hover:text-slate-900 text-slate-600 border-transparent hover:border-[#e6be23]'}`}
                                    >
                                        <span>{guestMode ? 'Registrarme en esta barbería' : 'Visitar Perfil'}</span>
                                        <ExternalLink size={16} className="ml-2" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ClientDiscovery;