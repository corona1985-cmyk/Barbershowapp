import React from 'react';
import { Users, Calendar, TrendingUp, AlertTriangle, ShoppingBag, Clock, Scissors } from 'lucide-react';

const HeroMockup: React.FC = () => (
    <div className="relative w-full max-w-2xl lg:max-w-3xl mx-auto lg:mx-0 lg:ml-auto">
        {/* Laptop mockup */}
        <div className="relative bg-slate-800 rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 border-b border-white/5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-2 text-xs text-slate-500">BarberShow — Panel de Control</span>
            </div>
            <div className="flex min-h-[280px] sm:min-h-[320px] lg:min-h-[360px]">
                <div className="w-16 sm:w-20 bg-slate-900 border-r border-white/5 p-3 flex flex-col gap-2.5">
                    <div className="w-10 h-10 bg-[#ffd427] rounded-lg flex items-center justify-center mx-auto">
                        <Scissors size={18} className="text-slate-900" />
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`h-7 rounded ${i === 1 ? 'bg-[#ffd427]/30' : 'bg-white/5'}`} />
                    ))}
                </div>
                <div className="flex-1 p-4 sm:p-5 bg-slate-50 overflow-hidden">
                    <p className="text-sm font-bold text-slate-800 mb-3">Panel de Control</p>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {[
                            { icon: Users, label: 'Clientes Totales', value: '11', color: 'bg-yellow-100 text-yellow-700' },
                            { icon: Calendar, label: 'Citas Hoy', value: '0', color: 'bg-orange-100 text-orange-600' },
                            { icon: TrendingUp, label: 'Ventas Hoy', value: '$6.00', color: 'bg-amber-100 text-amber-600' },
                            { icon: AlertTriangle, label: 'Stock Bajo', value: '0', color: 'bg-red-100 text-red-600' },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center gap-2.5">
                                <div className={`p-2 rounded-full ${stat.color}`}>
                                    <stat.icon size={14} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-500 truncate">{stat.label}</p>
                                    <p className="text-base font-bold text-slate-800">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-3 bg-white rounded-lg border border-slate-200 p-3">
                            <p className="text-xs font-bold text-slate-700 mb-2">Actividad Reciente</p>
                            <div className="flex items-center gap-2.5 p-2 bg-slate-50 rounded">
                                <div className="p-1.5 bg-yellow-100 text-yellow-700 rounded-full">
                                    <ShoppingBag size={12} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-medium text-slate-800 truncate">Venta #42</p>
                                    <p className="text-[9px] text-slate-500 flex items-center gap-0.5">
                                        <Clock size={9} /> 14:30
                                    </p>
                                </div>
                                <span className="text-[10px] font-bold text-green-600">+$6.00</span>
                            </div>
                        </div>
                        <div className="col-span-2 bg-white rounded-lg border border-slate-200 p-3">
                            <p className="text-xs font-bold text-slate-700 mb-2">Acciones Rápidas</p>
                            <div className="space-y-1.5">
                                <div className="h-6 bg-[#ffd427]/20 rounded text-[9px] flex items-center justify-center text-slate-700 font-medium">Nueva Cita</div>
                                <div className="h-6 bg-slate-100 rounded text-[9px] flex items-center justify-center text-slate-600">Nueva Venta</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Phone mockup */}
        <div className="absolute -bottom-8 -left-4 sm:-left-10 w-[160px] sm:w-[180px] bg-slate-900 rounded-2xl border-4 border-slate-700 shadow-2xl shadow-black/60 overflow-hidden">
            <div className="h-6 bg-slate-900 flex items-center justify-center">
                <div className="w-14 h-2 bg-slate-700 rounded-full" />
            </div>
            <div className="bg-white p-3 pb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">Mayo 2024</span>
                    <div className="flex gap-1">
                        <div className="w-5 h-5 bg-slate-100 rounded" />
                        <div className="w-5 h-5 bg-slate-100 rounded" />
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center mb-2">
                    {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d) => (
                        <span key={d} className="text-[8px] text-slate-400 font-medium">{d}</span>
                    ))}
                    {Array.from({ length: 35 }, (_, i) => (
                        <span
                            key={i}
                            className={`text-[8px] py-0.5 rounded ${
                                i === 14 ? 'bg-[#ffd427] text-slate-900 font-bold' : i < 3 ? 'text-transparent' : 'text-slate-600'
                            }`}
                        >
                            {i < 3 ? '·' : i - 2}
                        </span>
                    ))}
                </div>
                <button type="button" className="w-full py-2 bg-[#ffd427] text-slate-900 text-[9px] font-bold rounded-lg">
                    Nueva Cita
                </button>
            </div>
        </div>
    </div>
);

export default HeroMockup;
