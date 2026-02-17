import React, { useState, useEffect } from 'react';
import { DataService, generateUniqueId } from '../services/data';
import { Client, Product, PointOfSale, FinanceRecord, Sale } from '../types';
import { Search, Plus, X, Edit2, User, Star, Upload, Image as ImageIcon, Ban, CheckCircle, Trophy, Crown, MapPin, Loader2, Phone, Users, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

// --- Clients Component ---
export const Clients: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
    const [userRole, setUserRole] = useState<string>('');

    // Form State
    const [currentClient, setCurrentClient] = useState<Partial<Client>>({
        nombre: '',
        telefono: '',
        email: '',
        notas: '',
        photoUrl: '',
        puntos: 0,
        status: 'active'
    });

    useEffect(() => {
        const role = DataService.getCurrentUserRole();
        setUserRole(role);
        setIsAdmin(['admin', 'superadmin'].includes(role));
        const loadClients = role === 'barbero'
            ? DataService.getClientsWithActivity()
            : DataService.getClients();
        setLoading(true);
        Promise.all([loadClients, DataService.getPointsOfSale()]).then(([clientsList, posList]) => {
            setClients(clientsList);
            setPointsOfSale(posList);
        }).finally(() => setLoading(false));
    }, []);

    const handleEditClick = (client: Client) => {
        setCurrentClient(client);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleCreateClick = () => {
        setCurrentClient({
            nombre: '',
            telefono: '',
            email: '',
            notas: '',
            photoUrl: '',
            puntos: 0,
            status: 'active'
        });
        setIsEditing(false);
        setShowModal(true);
    };

    const handleToggleStatus = async (client: Client) => {
        if (confirm(client.status === 'active'
            ? `¿Suspender la cuenta de ${client.nombre}? No podrá agendar citas.`
            : `¿Reactivar la cuenta de ${client.nombre}?`)) {
            await DataService.toggleClientStatus(client.id);
            const list = await DataService.getClients();
            setClients(list);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentClient(prev => ({ ...prev, photoUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentClient.nombre || !currentClient.telefono) return;
        if (isEditing && currentClient.id) {
            await DataService.updateClient(currentClient as Client);
            const list = await DataService.getClients();
            setClients(list);
        } else {
            const client = await DataService.addClientOrGetExisting({
                ...currentClient as any,
                fechaRegistro: new Date().toISOString().split('T')[0],
                ultimaVisita: 'N/A'
            });
            const merged = { ...client, ...currentClient, id: client.id, posId: client.posId, fechaRegistro: client.fechaRegistro } as Client;
            await DataService.updateClient(merged);
            const list = await DataService.getClients();
            setClients(list);
        }
        setShowModal(false);
    };

    const getPosName = (posId: number) => {
        const pos = pointsOfSale.find(p => p.id === posId);
        return pos ? pos.name : `Sede #${posId}`;
    };

    const formatRegDate = (iso: string) => {
        const d = new Date(iso + 'T12:00:00');
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const filtered = clients.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()) || c.telefono.includes(search));

    const topClients = [...clients].sort((a, b) => b.puntos - a.puntos).slice(0, 5);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4 text-[#ffd427]" size={48} />
                <p className="font-medium">Cargando clientes...</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="lg:col-span-3 space-y-6">
                {userRole === 'barbero' && (
                    <div className="bg-amber-50/80 border border-amber-200/80 text-amber-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                        <Users size={18} className="shrink-0" />
                        Solo se muestran clientes que ya se han agendado o atendido en esta barbería.
                    </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#ffd427]/15 text-[#c9a000]">
                            <User size={26} strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Gestión de Clientes</h1>
                            <p className="text-sm text-slate-500 mt-0.5">Busca y administra tu cartera de clientes</p>
                        </div>
                    </div>
                    {userRole !== 'barbero' && (
                        <button onClick={handleCreateClick} className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm shrink-0">
                            <Plus size={18} />
                            <span>Nuevo Cliente</span>
                        </button>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-slate-100">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o teléfono..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ffd427]/40 focus:border-[#ffd427]/50 focus:bg-white transition-all"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        {filtered.length > 0 && (
                            <p className="mt-3 text-sm text-slate-500">
                                <strong className="text-slate-700">{filtered.length}</strong> cliente{filtered.length !== 1 ? 's' : ''}
                                {search && filtered.length !== clients.length && ` de ${clients.length}`}
                            </p>
                        )}
                    </div>

                    {filtered.length === 0 ? (
                        <div className="py-16 px-6 text-center">
                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                <User size={28} className="text-slate-400" />
                            </div>
                            <p className="text-slate-600 font-medium">{search ? 'Ningún cliente coincide con la búsqueda' : 'No hay clientes'}</p>
                            <p className="text-slate-500 text-sm mt-1">{search ? 'Prueba otro nombre o teléfono' : 'Añade el primero desde Nuevo Cliente'}</p>
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/90 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                                            <th className="py-4 px-5">Cliente</th>
                                            <th className="py-4 px-5">Sede origen</th>
                                            <th className="py-4 px-5">Contacto</th>
                                            <th className="py-4 px-5">Puntos</th>
                                            <th className="py-4 px-5">Estado</th>
                                            <th className="py-4 px-5 text-right w-24">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filtered.map(c => (
                                            <tr key={c.id} className={`hover:bg-amber-50/30 transition-colors ${c.status === 'suspended' ? 'bg-red-50/50' : ''}`}>
                                                <td className="py-4 px-5">
                                                    <div className="flex items-center gap-3">
                                                        {c.photoUrl ? (
                                                            <img src={c.photoUrl} alt={c.nombre} className="w-11 h-11 rounded-full object-cover border-2 border-slate-100 shadow-sm" />
                                                        ) : (
                                                            <div className="w-11 h-11 rounded-full bg-[#ffd427]/20 flex items-center justify-center text-[#c9a000] font-bold text-lg shrink-0">
                                                                {c.nombre.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-semibold text-slate-800">{c.nombre}</div>
                                                            <div className="text-xs text-slate-500 mt-0.5">Reg: {formatRegDate(c.fechaRegistro)}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg w-fit">
                                                        <MapPin size={12} className="text-slate-400 shrink-0" />
                                                        {getPosName(c.posId)}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <div className="flex items-center gap-1.5 text-slate-700 text-sm font-medium">
                                                        <Phone size={14} className="text-slate-400 shrink-0" />
                                                        {c.telefono}
                                                    </div>
                                                    <div className="text-xs text-slate-400 mt-0.5">{c.email || 'Sin email'}</div>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg w-fit border border-amber-100">
                                                        <Star size={14} className="fill-amber-400 text-amber-400 shrink-0" />
                                                        <span className="font-bold text-sm">{c.puntos || 0}</span>
                                                    </span>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                                        c.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                                                    }`}>
                                                        {c.status === 'active' ? 'Activo' : 'Suspendido'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-5 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => handleEditClick(c)} className="p-2 rounded-lg text-slate-400 hover:text-[#c9a000] hover:bg-[#ffd427]/15 transition-colors" title="Editar">
                                                            <Edit2 size={18} />
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                onClick={() => handleToggleStatus(c)}
                                                                className={`p-2 rounded-lg transition-colors ${c.status === 'active' ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                                                title={c.status === 'active' ? 'Suspender' : 'Reactivar'}
                                                            >
                                                                {c.status === 'active' ? <Ban size={18} /> : <CheckCircle size={18} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="md:hidden divide-y divide-slate-100">
                                {filtered.map(c => (
                                    <div key={c.id} className={`p-4 ${c.status === 'suspended' ? 'bg-red-50/50' : ''}`}>
                                        <div className="flex items-start gap-3">
                                            {c.photoUrl ? (
                                                <img src={c.photoUrl} alt={c.nombre} className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shrink-0" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-[#ffd427]/20 flex items-center justify-center text-[#c9a000] font-bold text-lg shrink-0">
                                                    {c.nombre.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-slate-800 truncate">{c.nombre}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">Reg: {formatRegDate(c.fechaRegistro)}</p>
                                                <span className="inline-flex items-center gap-1 mt-2 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-lg w-fit">
                                                    <MapPin size={10} /> {getPosName(c.posId)}
                                                </span>
                                                <div className="flex items-center gap-1.5 mt-2 text-sm text-slate-700">
                                                    <Phone size={14} className="text-slate-400" />
                                                    {c.telefono}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">
                                                        <Star size={12} className="fill-amber-400" /> {c.puntos || 0}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                        {c.status === 'active' ? 'Activo' : 'Suspendido'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1 shrink-0">
                                                <button onClick={() => handleEditClick(c)} className="p-2 rounded-lg text-slate-400 hover:bg-[#ffd427]/15 hover:text-[#c9a000]" title="Editar">
                                                    <Edit2 size={18} />
                                                </button>
                                                {isAdmin && (
                                                    <button onClick={() => handleToggleStatus(c)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" title={c.status === 'active' ? 'Suspender' : 'Reactivar'}>
                                                        {c.status === 'active' ? <Ban size={18} /> : <CheckCircle size={18} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Sidebar Stats */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-lg border-t-4 border-[#ffd427]">
                    <div className="flex items-center space-x-2 mb-4">
                        <Trophy className="text-[#ffd427]" />
                        <h3 className="font-bold text-lg text-[#ffd427]">Top Clientes VIP</h3>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">Clientes con más puntos acumulados para sorteos y premios.</p>
                    
                    <div className="space-y-3">
                        {topClients.map((client, idx) => (
                            <div key={client.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg backdrop-blur-sm border border-white/10">
                                <div className="flex items-center space-x-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                        idx === 0 ? 'bg-[#ffd427] text-slate-900' : 
                                        idx === 1 ? 'bg-slate-300 text-slate-800' : 
                                        idx === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-700 text-white'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                    <span className="font-medium text-sm truncate max-w-[100px]">{client.nombre}</span>
                                </div>
                                <div className="flex items-center text-[#ffd427] font-bold text-sm">
                                    <Star size={12} className="fill-[#ffd427] mr-1" />
                                    {client.puntos}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-800">{isEditing ? 'Editar Perfil de Cliente' : 'Registrar Nuevo Cliente'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSaveClient} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Foto de Perfil</label>
                                <div className="flex items-center space-x-4">
                                    <div className="relative group">
                                        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-slate-200">
                                            {currentClient.photoUrl ? (
                                                <img src={currentClient.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <User size={32} className="text-slate-400" />
                                            )}
                                        </div>
                                        <label className="absolute bottom-0 right-0 bg-[#ffd427] text-slate-900 p-1.5 rounded-full cursor-pointer hover:bg-[#e6be23] shadow-md">
                                            <Upload size={14} />
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                        </label>
                                    </div>
                                    <div className="flex-1">
                                        <input 
                                            type="text" 
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffd427] mb-2" 
                                            placeholder="O pega una URL de imagen..." 
                                            value={currentClient.photoUrl} 
                                            onChange={e => setCurrentClient({...currentClient, photoUrl: e.target.value})} 
                                        />
                                        <p className="text-xs text-slate-500">Sube una imagen o pega un enlace directo.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
                                    <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentClient.nombre} onChange={e => setCurrentClient({...currentClient, nombre: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono *</label>
                                    <input type="tel" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentClient.telefono} onChange={e => setCurrentClient({...currentClient, telefono: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="email" className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentClient.email} onChange={e => setCurrentClient({...currentClient, email: e.target.value})} />
                            </div>
                            {isAdmin && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Puntos de Lealtad</label>
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427] placeholder:text-gray-400"
                                        value={currentClient.puntos === 0 ? '' : currentClient.puntos}
                                        placeholder="0"
                                        onChange={e => {
                                            const v = e.target.value;
                                            setCurrentClient({ ...currentClient, puntos: v === '' ? 0 : Number(v) });
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                                    <select className="w-full border border-slate-300 rounded-lg p-2.5" value={currentClient.status} onChange={e => setCurrentClient({...currentClient, status: e.target.value as any})}>
                                        <option value="active">Activo</option>
                                        <option value="suspended">Suspendido</option>
                                    </select>
                                </div>
                            </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                                <textarea className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" rows={2} value={currentClient.notas} onChange={e => setCurrentClient({...currentClient, notas: e.target.value})}></textarea>
                            </div>
                            
                            <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 mt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23] transition-colors shadow-lg shadow-yellow-500/20">Guardar Cliente</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Inventory Component ---
export const Inventory: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    // Form State
    const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({
        producto: '',
        categoria: '',
        stock: 0,
        precioCompra: 0,
        precioVenta: 0,
        estado: 'activo'
    });
    
    const barberIdForProducts = DataService.getCurrentUserRole() === 'barbero' ? DataService.getCurrentBarberId() ?? undefined : undefined;
    useEffect(() => {
        DataService.getProducts(barberIdForProducts).then(setProducts);
    }, [barberIdForProducts]);

    const handleCreateClick = () => {
        setCurrentProduct({
            producto: '',
            categoria: '',
            stock: 0,
            precioCompra: 0,
            precioVenta: 0,
            estado: 'activo'
        });
        setIsEditing(false);
        setShowModal(true);
    };

    const handleEditClick = (product: Product) => {
        setCurrentProduct(product);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentProduct.producto || !currentProduct.precioVenta) return;
        try {
            if (isEditing && currentProduct.id) {
                await DataService.updateProduct(currentProduct as Product);
                const list = await DataService.getProducts(barberIdForProducts);
                setProducts(list);
            } else {
                const product = await DataService.addProduct({
                    ...currentProduct as any
                });
                setProducts([...products, product]);
            }
            setShowModal(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'No se pudo guardar el producto. Revisa tu conexión.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Inventario</h2>
                <button onClick={handleCreateClick} className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center space-x-2 transition-colors shadow-sm">
                    <Plus size={18} />
                    <span>Nuevo Producto</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                {/* Estado vacío: mismo en móvil y escritorio */}
                {products.length === 0 ? (
                    <div className="p-8 md:p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <Package size={32} className="text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-medium">No hay productos en el inventario</p>
                        <p className="text-slate-500 text-sm mt-1">Pulsa &quot;Nuevo Producto&quot; para agregar el primero.</p>
                        <button
                            type="button"
                            onClick={handleCreateClick}
                            className="mt-6 inline-flex items-center gap-2 bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-5 py-2.5 rounded-xl font-bold transition-colors"
                        >
                            <Plus size={18} /> Nuevo Producto
                        </button>
                    </div>
                ) : (
                <>
                {/* Vista tarjetas — solo en móvil */}
                <div className="md:hidden p-4 space-y-4">
                    {
                        products.map(p => (
                            <div
                                key={p.id}
                                className="bg-white rounded-2xl border border-slate-200/80 shadow-md shadow-slate-200/50 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-slate-200/60"
                            >
                                {/* Barra de acento superior */}
                                <div className="h-1 bg-gradient-to-r from-[#ffd427] to-amber-400" />
                                <div className="p-4">
                                    <div className="flex justify-between items-start gap-3 mb-4">
                                        <div className="min-w-0 flex-1">
                                            <span className="inline-block text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">{p.categoria}</span>
                                            <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">{p.producto}</h3>
                                        </div>
                                        <button
                                            onClick={() => handleEditClick(p)}
                                            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-[#ffd427] hover:text-slate-900 transition-all duration-200"
                                            title="Editar Producto"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-slate-400 text-xs font-medium">Stock</span>
                                            <span className={`font-bold text-base tabular-nums ${p.stock < 5 ? 'text-red-500' : 'text-slate-800'}`}>{p.stock} und</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-slate-400 text-xs font-medium">Estado</span>
                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                {p.stock > 0 ? 'Activo' : 'Sin Stock'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                                        <div>
                                            <span className="text-slate-400 text-xs block">Compra</span>
                                            <span className="text-slate-600 font-medium">${p.precioCompra.toFixed(2)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-slate-400 text-xs block">Venta</span>
                                            <span className="text-slate-900 font-bold text-lg">${p.precioVenta.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>

                {/* Vista tabla — solo en escritorio */}
                <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[640px]">
                    <thead className="bg-slate-50 text-slate-600 text-sm font-semibold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4 text-left">Producto</th>
                            <th className="px-6 py-4 text-left">Categoría</th>
                            <th className="px-6 py-4 text-left">Stock</th>
                            <th className="px-6 py-4 text-right">Precio Compra</th>
                            <th className="px-6 py-4 text-right">Precio Venta</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-semibold text-slate-800">{p.producto}</td>
                                <td className="px-6 py-4 text-slate-600">{p.categoria}</td>
                                <td className={`px-6 py-4 font-bold ${p.stock < 5 ? 'text-red-500' : 'text-slate-700'}`}>{p.stock}</td>
                                <td className="px-6 py-4 text-right text-slate-500">${p.precioCompra.toFixed(2)}</td>
                                <td className="px-6 py-4 text-right font-bold text-slate-800">${p.precioVenta.toFixed(2)}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {p.stock > 0 ? 'Activo' : 'Sin Stock'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleEditClick(p)} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors" title="Editar Producto">
                                        <Edit2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                </>
                )}
            </div>

            {/* Product Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-800">{isEditing ? 'Editar Producto' : 'Agregar Nuevo Producto'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Producto *</label>
                                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentProduct.producto} onChange={e => setCurrentProduct({...currentProduct, producto: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                                    <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentProduct.categoria} onChange={e => setCurrentProduct({...currentProduct, categoria: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Stock Actual</label>
                                    <input
                                        type="number"
                                        min={0}
                                        required
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427] placeholder:text-gray-400"
                                        value={currentProduct.stock === 0 ? '' : currentProduct.stock}
                                        placeholder="0"
                                        onChange={e => {
                                            const v = e.target.value;
                                            setCurrentProduct({ ...currentProduct, stock: v === '' ? 0 : Number(v) });
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Precio Compra ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427] placeholder:text-gray-400"
                                        value={currentProduct.precioCompra === 0 ? '' : currentProduct.precioCompra}
                                        placeholder="0"
                                        onChange={e => {
                                            const v = e.target.value;
                                            setCurrentProduct({ ...currentProduct, precioCompra: v === '' ? 0 : Number(v) });
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Precio Venta ($) *</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        min={0}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427] placeholder:text-gray-400"
                                        value={currentProduct.precioVenta === 0 ? '' : currentProduct.precioVenta}
                                        placeholder="0"
                                        onChange={e => {
                                            const v = e.target.value;
                                            setCurrentProduct({ ...currentProduct, precioVenta: v === '' ? 0 : Number(v) });
                                        }}
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 mt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23] transition-colors shadow-lg shadow-yellow-500/20">
                                    {isEditing ? 'Actualizar Producto' : 'Guardar Producto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Finance Component ---
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function buildChartData(sales: Sale[], financeRecords: FinanceRecord[], days: number = 7): { name: string; ingresos: number; egresos: number }[] {
    const today = new Date();
    const result: { name: string; ingresos: number; egresos: number }[] = [];
    const ingresosByDate: Record<string, number> = {};
    const egresosByDate: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        ingresosByDate[key] = 0;
        egresosByDate[key] = 0;
    }
    sales.filter((s) => s.estado === 'completada').forEach((s) => {
        if (ingresosByDate[s.fecha] !== undefined) ingresosByDate[s.fecha] += s.total;
    });
    financeRecords.forEach((f) => {
        if (egresosByDate[f.fecha] !== undefined) egresosByDate[f.fecha] = f.egresos || 0;
    });
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        result.push({
            name: DAY_NAMES[d.getDay()] + ' ' + key.slice(5),
            ingresos: ingresosByDate[key] || 0,
            egresos: egresosByDate[key] || 0,
        });
    }
    return result;
}

export const Finance: React.FC = () => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showGastoModal, setShowGastoModal] = useState(false);
    const [gastoFecha, setGastoFecha] = useState(() => new Date().toISOString().split('T')[0]);
    const [gastoDescripcion, setGastoDescripcion] = useState('');
    const [gastoMonto, setGastoMonto] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [s, f] = await Promise.all([DataService.getSales(), DataService.getFinances()]);
            setSales(s);
            setFinanceRecords(f);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const salesThisMonth = sales.filter((s) => s.estado === 'completada' && s.fecha >= firstDay && s.fecha <= lastDay);
    const ingresosMes = salesThisMonth.reduce((sum, s) => sum + s.total, 0);
    const recordsThisMonth = financeRecords.filter((r) => r.fecha >= firstDay && r.fecha <= lastDay);
    const egresosMes = recordsThisMonth.reduce((sum, r) => sum + (r.egresos || 0), 0);
    const beneficioNeto = ingresosMes - egresosMes;

    const chartData = buildChartData(sales, financeRecords, 7);

    const handleAddGasto = async (e: React.FormEvent) => {
        e.preventDefault();
        const monto = Number.parseFloat(gastoMonto);
        if (!gastoDescripcion.trim() || Number.isNaN(monto) || monto <= 0) {
            alert('Indica descripción y monto mayor a 0.');
            return;
        }
        const posId = DataService.getActivePosId();
        if (posId == null) {
            alert('No hay sede activa.');
            return;
        }
        const existing = financeRecords.find((r) => r.fecha === gastoFecha);
        const newGasto = { descripcion: gastoDescripcion.trim(), monto };
        let updated: FinanceRecord[];
        if (existing) {
            const gastos = [...(existing.gastos || []), newGasto];
            const egresos = gastos.reduce((s, g) => s + (typeof g === 'object' && 'monto' in g ? Number(g.monto) : 0), 0);
            updated = financeRecords.map((r) =>
                r.fecha === gastoFecha ? { ...r, gastos, egresos } : r
            );
        } else {
            const newRecord: FinanceRecord = {
                id: generateUniqueId(),
                posId,
                fecha: gastoFecha,
                ingresos: 0,
                egresos: monto,
                ventas: [],
                gastos: [newGasto],
            };
            updated = [...financeRecords, newRecord];
        }
        await DataService.setFinances(updated);
        setFinanceRecords(updated);
        setShowGastoModal(false);
        setGastoDescripcion('');
        setGastoMonto('');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-medium">Cargando finanzas...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Finanzas</h2>
                <button
                    type="button"
                    onClick={() => setShowGastoModal(true)}
                    className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center justify-center space-x-2 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>Registrar gasto</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-slate-500 text-sm font-medium mb-1">Ingresos (este mes)</p>
                    <h3 className="text-3xl font-bold text-emerald-600 flex items-center">
                        <TrendingUp className="mr-2" /> ${ingresosMes.toFixed(2)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Por ventas registradas en el POS</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-slate-500 text-sm font-medium mb-1">Gastos operativos (este mes)</p>
                    <h3 className="text-3xl font-bold text-red-500 flex items-center">
                        <TrendingDown className="mr-2" /> ${egresosMes.toFixed(2)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Gastos registrados manualmente</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-slate-500 text-sm font-medium mb-1">Beneficio neto</p>
                    <h3 className={`text-3xl font-bold flex items-center ${beneficioNeto >= 0 ? 'text-[#e6be23]' : 'text-red-500'}`}>
                        <DollarSign className="mr-2" /> ${beneficioNeto.toFixed(2)}
                    </h3>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-96">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Últimos 7 días (ingresos por ventas vs egresos)</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="ingresos" fill="#ffd427" radius={[4, 4, 0, 0]} name="Ingresos" />
                        <Bar dataKey="egresos" fill="#ef4444" radius={[4, 4, 0, 0]} name="Egresos" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {recordsThisMonth.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Gastos del mes</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-500 text-sm border-b border-slate-200">
                                    <th className="py-2">Fecha</th>
                                    <th className="py-2">Descripción</th>
                                    <th className="py-2 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recordsThisMonth.flatMap((r) =>
                                    (r.gastos || []).map((g: any, i: number) => (
                                        <tr key={`${r.fecha}-${i}`} className="border-b border-slate-50">
                                            <td className="py-2 text-slate-700">{r.fecha}</td>
                                            <td className="py-2 text-slate-700">{typeof g === 'object' && g.descripcion != null ? g.descripcion : String(g)}</td>
                                            <td className="py-2 text-right font-medium text-red-600">${(typeof g === 'object' && g.monto != null ? Number(g.monto) : 0).toFixed(2)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showGastoModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <h3 className="text-xl font-bold text-slate-800">Registrar gasto</h3>
                            <button type="button" onClick={() => setShowGastoModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddGasto} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                                <input type="date" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]" value={gastoFecha} onChange={(e) => setGastoFecha(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]" placeholder="Ej: Alquiler, insumos, servicios" value={gastoDescripcion} onChange={(e) => setGastoDescripcion(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                                <input type="number" step="0.01" min="0.01" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]" value={gastoMonto} onChange={(e) => setGastoMonto(e.target.value)} />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowGastoModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]">Guardar gasto</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};