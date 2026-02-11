import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { SystemUser, Permissions, UserRole, PointOfSale } from '../types';
import { Shield, Plus, Edit2, Trash2, CheckSquare, Square, MapPin, X } from 'lucide-react';

const ROLES_WITH_SEDE: UserRole[] = ['dueno', 'admin', 'empleado', 'cliente'];

const UserAdmin: React.FC = () => {
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [currentUser, setCurrentUser] = useState<Partial<SystemUser>>({ username: '', role: 'empleado', permissions: {} });

    useEffect(() => {
        DataService.getUsers().then(setUsers);
    }, []);

    useEffect(() => {
        DataService.getPointsOfSale().then(setPointsOfSale);
    }, []);

    const handleSave = async () => {
        if (!currentUser.username || !currentUser.name) return;
        const isNew = !users.some(u => u.username === currentUser.username);
        if (isNew && (!currentUser.password || String(currentUser.password).trim() === '')) {
            alert('Al crear un usuario nuevo debe asignar una contraseña.');
            return;
        }
        await DataService.saveUser(currentUser as SystemUser);
        const list = await DataService.getUsers();
        setUsers(list);
        setShowModal(false);
    };

    const handleDelete = async (username: string) => {
        if (confirm(`¿Borrar usuario ${username}?`)) {
            await DataService.deleteUser(username);
            const list = await DataService.getUsers();
            setUsers(list);
        }
    };

    const togglePermission = (key: keyof Permissions) => {
        const currentPerms = currentUser.permissions || {};
        setCurrentUser({
            ...currentUser,
            permissions: {
                ...currentPerms,
                [key]: !currentPerms[key]
            }
        });
    };

    const openModal = (user?: SystemUser) => {
        if (user) {
            setCurrentUser(JSON.parse(JSON.stringify(user)));
        } else {
            setCurrentUser({ username: '', name: '', role: 'empleado', password: '', permissions: {} });
        }
        setShowModal(true);
    };

    const getSedeName = (posId: number | null | undefined) => {
        if (posId == null) return '—';
        const pos = pointsOfSale.find(p => p.id === posId);
        return pos ? pos.name : `Sede #${posId}`;
    };

    const showSedeSelector = currentUser.role && ROLES_WITH_SEDE.includes(currentUser.role as UserRole);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                    <Shield className="mr-2" /> Administración de Usuarios y Privilegios
                </h2>
                <button onClick={() => openModal()} className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center space-x-2">
                    <Plus size={18} />
                    <span>Nuevo Usuario</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 text-slate-600 text-sm font-semibold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4 text-left">Usuario</th>
                            <th className="px-6 py-4 text-left">Nombre</th>
                            <th className="px-6 py-4 text-left">Rol</th>
                            <th className="px-6 py-4 text-left">Barbería asignada</th>
                            <th className="px-6 py-4 text-left">Permisos Especiales</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map((u, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-800">{u.username}</td>
                                <td className="px-6 py-4 text-slate-600">{u.name}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                                        u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                                        u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center text-sm text-slate-600">
                                        <MapPin size={14} className="mr-1.5 text-slate-400" />
                                        {getSedeName(u.posId)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500">
                                    {u.permissions ? Object.keys(u.permissions).filter(k => (u.permissions as any)[k]).join(', ') : '-'}
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => openModal(u)} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg"><Edit2 size={18}/></button>
                                    <button onClick={() => handleDelete(u.username)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 overflow-visible">
                        <div className="flex items-start justify-between gap-4 p-6 pb-0">
                            <h3 className="text-xl font-bold text-slate-800 flex-1 min-w-0 pr-2">
                                {currentUser.username ? 'Editar Privilegios' : 'Nuevo Usuario'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                aria-label="Cerrar"
                            >
                                <X size={22} />
                            </button>
                        </div>
                        <div className="p-6 pt-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Usuario</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentUser.username} onChange={e => setCurrentUser({...currentUser, username: e.target.value})} disabled={!!currentUser.username && users.some(u => u.username === currentUser.username && u !== currentUser)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Rol</label>
                                <select className="w-full border rounded-lg p-2" value={currentUser.role} onChange={e => setCurrentUser({...currentUser, role: e.target.value as UserRole})}>
                                    <option value="empleado">Empleado</option>
                                    <option value="admin">Administrador</option>
                                    <option value="dueno">Dueño</option>
                                    <option value="cliente">Cliente</option>
                                </select>
                            </div>
                        </div>
                        {showSedeSelector && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 flex items-center">
                                    <MapPin size={16} className="mr-1.5 text-slate-500" />
                                    Barbería / Sede de acceso
                                </label>
                                <select
                                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]"
                                    value={currentUser.posId === undefined || currentUser.posId === null ? '' : currentUser.posId}
                                    onChange={e => setCurrentUser({ ...currentUser, posId: e.target.value === '' ? null : Number(e.target.value) })}
                                >
                                    <option value="">— Sin sede asignada —</option>
                                    {pointsOfSale.filter(p => p.isActive).map(pos => (
                                        <option key={pos.id} value={pos.id}>{pos.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Define a qué barbería tiene acceso este usuario (dueño, admin o empleado).</p>
                            </div>
                        )}
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Nombre Completo</label>
                            <input type="text" className="w-full border rounded-lg p-2" value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Contraseña</label>
                            <input type="password" className="w-full border rounded-lg p-2" value={currentUser.password} onChange={e => setCurrentUser({...currentUser, password: e.target.value})} placeholder={currentUser.username ? "Sin cambios" : "Contraseña inicial"} />
                        </div>

                        <div className="border-t border-slate-100 pt-4 mt-4">
                            <h4 className="text-sm font-bold text-slate-700 mb-3">Privilegios Granulares</h4>
                            <div className="space-y-2">
                                {[
                                    { key: 'canManageUsers', label: 'Gestionar Usuarios' },
                                    { key: 'canViewReports', label: 'Ver Reportes' },
                                    { key: 'canDeleteAppointments', label: 'Borrar Citas' },
                                    { key: 'canManageInventory', label: 'Gestionar Inventario' },
                                    { key: 'canOverrideSchedule', label: 'Sobreescribir Horarios' }
                                ].map(perm => (
                                    <label key={perm.key} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                                        <div onClick={() => togglePermission(perm.key as keyof Permissions)} className={`text-slate-500 ${currentUser.permissions && (currentUser.permissions as any)[perm.key] ? 'text-yellow-600' : ''}`}>
                                            {currentUser.permissions && (currentUser.permissions as any)[perm.key] ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </div>
                                        <span className="text-sm text-slate-700">{perm.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2 mt-6 border-t border-slate-100 pt-4">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]">Guardar</button>
                        </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserAdmin;