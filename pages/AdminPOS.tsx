import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { PointOfSale, SystemUser, AccountTier } from '../types';
import { MapPin, Plus, Edit2, Trash2, X, Save, User } from 'lucide-react';

const AdminPOS: React.FC = () => {
    const [posList, setPosList] = useState<PointOfSale[]>([]);
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [currentPos, setCurrentPos] = useState<Partial<PointOfSale>>({ name: '', address: '', ownerId: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [posData, usersData] = await Promise.all([DataService.getPointsOfSale(), DataService.getAllUsersGlobal()]);
        setPosList(posData);
        setUsers(usersData);
    };

    const handleSave = async () => {
        if (!currentPos.name || !currentPos.address || !currentPos.ownerId) {
            alert('Por favor complete todos los campos');
            return;
        }
        if (currentPos.id) {
            await DataService.updatePointOfSale(currentPos as PointOfSale);
        } else {
            await DataService.addPointOfSale(currentPos as any);
        }
        setShowModal(false);
        await loadData();
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Eliminar esta sede? Esto podría afectar datos históricos.')) {
            await DataService.deletePointOfSale(id);
            await loadData();
        }
    };

    const openModal = (pos?: PointOfSale) => {
        if (pos) {
            setCurrentPos(pos);
        } else {
            setCurrentPos({ name: '', address: '', ownerId: '', isActive: true, tier: 'barberia' });
        }
        setShowModal(true);
    };

    const owners = users.filter(u => u.role === 'admin');

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center">
                    <MapPin className="mr-2 flex-shrink-0" /> <span className="min-w-0">Administración de Sedes (Puntos de Venta)</span>
                </h2>
                <button onClick={() => openModal()} className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2.5 rounded-lg font-bold flex items-center justify-center space-x-2 w-full sm:w-auto">
                    <Plus size={18} />
                    <span>Nueva Sede</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="table-wrapper overflow-x-auto">
                <table className="w-full min-w-[640px]">
                    <thead className="bg-slate-50 text-slate-600 text-sm font-semibold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4 text-left">Nombre de Sede</th>
                            <th className="px-6 py-4 text-left">Dirección</th>
                            <th className="px-6 py-4 text-left">Dueño Asignado</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {posList.map(pos => {
                            const owner = users.find(u => u.username === pos.ownerId);
                            return (
                                <tr key={pos.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-semibold text-slate-800">{pos.name}</td>
                                    <td className="px-6 py-4 text-slate-600">{pos.address}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-2 text-slate-500">
                                                <User size={16} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium">{owner?.name || pos.ownerId}</div>
                                                <div className="text-xs text-slate-500">{owner?.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${pos.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {pos.isActive ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => openModal(pos)} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(pos.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-xl font-bold text-slate-800">{currentPos.id ? 'Editar Sede' : 'Nueva Sede'}</h3>
                            <button onClick={() => setShowModal(false)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Sede</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]" 
                                    value={currentPos.name} 
                                    onChange={e => setCurrentPos({...currentPos, name: e.target.value})}
                                    placeholder="Ej: Barbería Centro"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]" 
                                    value={currentPos.address} 
                                    onChange={e => setCurrentPos({...currentPos, address: e.target.value})}
                                    placeholder="Ej: Av. Principal 123"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Dueño Asignado</label>
                                <select 
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]"
                                    value={currentPos.ownerId}
                                    onChange={e => setCurrentPos({...currentPos, ownerId: e.target.value})}
                                >
                                    <option value="">Seleccionar Usuario</option>
                                    {owners.map(u => (
                                        <option key={u.username} value={u.username}>{u.name} ({u.username})</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Solo aparecen usuarios con rol 'Dueño' o 'Admin'.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de negocio</label>
                                <select
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]"
                                    value={currentPos.tier ?? 'barberia'}
                                    onChange={e => setCurrentPos({ ...currentPos, tier: e.target.value as AccountTier })}
                                >
                                    <option value="solo">Solo – Un barbero, una sede</option>
                                    <option value="barberia">Barbería – Varios barberos, una sede</option>
                                    <option value="multisede">Multi-Sede – Varias ubicaciones</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Define el menú y las opciones disponibles para esta sede.</p>
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <input 
                                    type="checkbox" 
                                    id="isActive"
                                    checked={currentPos.isActive}
                                    onChange={e => setCurrentPos({...currentPos, isActive: e.target.checked})}
                                    className="rounded text-[#ffd427] focus:ring-[#ffd427] h-4 w-4"
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Sede Activa</label>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-100">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23] flex items-center">
                                <Save size={18} className="mr-2" /> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPOS;