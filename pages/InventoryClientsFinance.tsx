import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Client, Product, PointOfSale } from '../types';
import { Search, Plus, X, Edit2, User, Star, Upload, Image as ImageIcon, Ban, CheckCircle, Trophy, Crown, MapPin, Loader2 } from 'lucide-react';
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
            const client = await DataService.addClient({
                ...currentClient as any,
                fechaRegistro: new Date().toISOString().split('T')[0],
                ultimaVisita: 'N/A'
            });
            setClients([...clients, client]);
        }
        setShowModal(false);
    };

    const getPosName = (posId: number) => {
        const pos = pointsOfSale.find(p => p.id === posId);
        return pos ? pos.name : `Sede #${posId}`;
    };

    const filtered = clients.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()) || c.telefono.includes(search));
    
    // Sort for leaderboard
    const topClients = [...clients].sort((a, b) => b.puntos - a.puntos).slice(0, 5);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-medium">Cargando clientes...</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
                {userRole === 'barbero' && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
                        Solo se muestran clientes que ya se han agendado o atendido en esta barbería.
                    </div>
                )}
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">Gestión de Clientes</h2>
                    {userRole !== 'barbero' && (
                        <button onClick={handleCreateClick} className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center space-x-2 transition-colors shadow-sm">
                            <Plus size={18} />
                            <span>Nuevo Cliente</span>
                        </button>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex space-x-4 bg-slate-50/50">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                            <input type="text" placeholder="Buscar por nombre o teléfono..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 text-slate-600 text-sm font-semibold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 text-left">Cliente</th>
                                    <th className="px-6 py-4 text-left">Sede Origen</th>
                                    <th className="px-6 py-4 text-left">Contacto</th>
                                    <th className="px-6 py-4 text-left">Puntos</th>
                                    <th className="px-6 py-4 text-left">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(c => (
                                    <tr key={c.id} className={`hover:bg-slate-50 transition-colors group ${c.status === 'suspended' ? 'bg-red-50' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                {c.photoUrl ? (
                                                    <img src={c.photoUrl} alt={c.nombre} className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shadow-sm" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-lg shadow-sm">
                                                        {c.nombre.charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-semibold text-slate-800">{c.nombre}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">Reg: {c.fechaRegistro}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">
                                                <MapPin size={12} className="mr-1" />
                                                {getPosName(c.posId)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="text-sm font-medium">{c.telefono}</div>
                                            <div className="text-xs text-slate-400">{c.email || 'Sin email'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center bg-amber-50 text-amber-700 px-3 py-1 rounded-full w-fit border border-amber-100">
                                                <Star size={14} className="mr-1.5 fill-amber-400 text-amber-400" />
                                                <span className="font-bold text-sm">{c.puntos || 0}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {c.status === 'active' ? 'Activo' : 'Suspendido'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end space-x-2">
                                            <button onClick={() => handleEditClick(c)} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors" title="Editar Cliente">
                                                <Edit2 size={18} />
                                            </button>
                                            {isAdmin && (
                                                <button 
                                                    onClick={() => handleToggleStatus(c)} 
                                                    className={`p-2 rounded-lg transition-colors ${c.status === 'active' ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}
                                                    title={c.status === 'active' ? 'Suspender Cuenta' : 'Activar Cuenta'}
                                                >
                                                    {c.status === 'active' ? <Ban size={18} /> : <CheckCircle size={18} />}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
                                    <input type="number" className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentClient.puntos} onChange={e => setCurrentClient({...currentClient, puntos: Number(e.target.value)})} />
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
    
    useEffect(() => { DataService.getProducts().then(setProducts); }, []);

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
        if (isEditing && currentProduct.id) {
            await DataService.updateProduct(currentProduct as Product);
            const list = await DataService.getProducts();
            setProducts(list);
        } else {
            const product = await DataService.addProduct({
                ...currentProduct as any
            });
            setProducts([...products, product]);
        }
        setShowModal(false);
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

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full">
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
                                    <input type="number" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentProduct.stock} onChange={e => setCurrentProduct({...currentProduct, stock: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Precio Compra ($)</label>
                                    <input type="number" step="0.01" className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentProduct.precioCompra} onChange={e => setCurrentProduct({...currentProduct, precioCompra: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Precio Venta ($) *</label>
                                    <input type="number" required step="0.01" className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentProduct.precioVenta} onChange={e => setCurrentProduct({...currentProduct, precioVenta: Number(e.target.value)})} />
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
export const Finance: React.FC = () => {
    const [data, setData] = useState<{name: string, ingresos: number, egresos: number}[]>([]);

    useEffect(() => {
        // Mock chart data generation
        const mockData = [
            { name: 'Lun', ingresos: 400, egresos: 240 },
            { name: 'Mar', ingresos: 300, egresos: 139 },
            { name: 'Mie', ingresos: 200, egresos: 980 },
            { name: 'Jue', ingresos: 278, egresos: 390 },
            { name: 'Vie', ingresos: 589, egresos: 480 },
            { name: 'Sab', ingresos: 839, egresos: 380 },
            { name: 'Dom', ingresos: 349, egresos: 430 },
        ];
        setData(mockData);
    }, []);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Finanzas</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-slate-500 text-sm font-medium mb-1">Ingresos Totales (Mes)</p>
                    <h3 className="text-3xl font-bold text-emerald-600 flex items-center">
                        <TrendingUp className="mr-2" /> $12,450.00
                    </h3>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-slate-500 text-sm font-medium mb-1">Gastos Operativos</p>
                    <h3 className="text-3xl font-bold text-red-500 flex items-center">
                        <TrendingDown className="mr-2" /> $4,200.00
                    </h3>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-slate-500 text-sm font-medium mb-1">Beneficio Neto</p>
                    <h3 className="text-3xl font-bold text-[#e6be23] flex items-center">
                        <DollarSign className="mr-2" /> $8,250.00
                    </h3>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-96">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Balance Semanal</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dx={-10} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px' }}
                        />
                        <Legend wrapperStyle={{paddingTop: '20px'}} />
                        <Bar dataKey="ingresos" fill="#ffd427" radius={[4, 4, 0, 0]} name="Ingresos" />
                        <Bar dataKey="egresos" fill="#ef4444" radius={[4, 4, 0, 0]} name="Egresos" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};