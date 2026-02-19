import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { AppSettings, SystemUser, Service, UserRole, Barber, BarberWorkingHours, BarberBlockedSlot, BarberGalleryPhoto, AccountTier, PointOfSale } from '../types';
import { Save, Plus, Trash2, Edit2, Shield, Scissors, UserCog, Settings as SettingsIcon, UserCheck, Power, QrCode, Download, Printer, Percent, Clock, CalendarOff, ImagePlus } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { handlePrintQR as handlePrintQRNative } from '../utils/print';

type SettingsTab = 'general' | 'users' | 'services' | 'privacy' | 'barbers' | 'taxes' | 'qr';

interface SettingsProps {
    accountTier?: AccountTier;
}

const Settings: React.FC<SettingsProps> = ({ accountTier = 'barberia' }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [settings, setSettings] = useState<AppSettings>({ taxRate: 0.16, storeName: '', currencySymbol: '$' });
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<string>(() => DataService.getCurrentUserRole());
    const [activePosId, setActivePosId] = useState<number | null>(null);

    const [showUserModal, setShowUserModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showBarberModal, setShowBarberModal] = useState(false);

    const [currentUser, setCurrentUser] = useState<Partial<SystemUser>>({ username: '', name: '', role: 'cliente', password: '' });
    const [currentService, setCurrentService] = useState<Partial<Service>>({ name: '', price: 0, duration: 30 });
    const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const [currentBarber, setCurrentBarber] = useState<Partial<Barber>>({ name: '', specialty: '', active: true });
    const [myBarberWorkingHours, setMyBarberWorkingHours] = useState<BarberWorkingHours>({});
    const [myBarberLunchBreak, setMyBarberLunchBreak] = useState<BarberWorkingHours>({});
    const [savingHours, setSavingHours] = useState(false);
    const [myBarberBlockedHours, setMyBarberBlockedHours] = useState<BarberBlockedSlot[]>([]);
    const [savingBlocked, setSavingBlocked] = useState(false);
    const [showAddBlock, setShowAddBlock] = useState(false);
    const [newBlock, setNewBlock] = useState<BarberBlockedSlot>({ date: '', start: '10:00', end: '11:00' });
    const [galleryPhotos, setGalleryPhotos] = useState<BarberGalleryPhoto[]>([]);
    const [galleryUploading, setGalleryUploading] = useState(false);
    const [galleryCaption, setGalleryCaption] = useState('');
    const [galleryUrl, setGalleryUrl] = useState('');

    const loadData = async () => {
        const role = DataService.getCurrentUserRole();
        const [settingsData, usersData, servicesData, barbersData, posList] = await Promise.all([
            DataService.getSettings(),
            role === 'barbero' ? Promise.resolve([]) : DataService.getUsers(),
            DataService.getServices(),
            DataService.getBarbers(),
            DataService.getPointsOfSale(),
        ]);
        setSettings(settingsData);
        setUsers(usersData);
        setPointsOfSale(posList);
        let servicesList = servicesData;
        if (role === 'barbero') {
            const myBarberId = DataService.getCurrentBarberId();
            servicesList = servicesData.filter((s) => s.barberId != null && s.barberId === myBarberId);
        }
        setServices(servicesList);
        setBarbers(barbersData);
        if (role === 'barbero') {
            const myId = DataService.getCurrentBarberId();
            const me = barbersData.find((b: Barber) => b.id === myId);
            if (me?.workingHours) setMyBarberWorkingHours(me.workingHours);
            else setMyBarberWorkingHours({});
            setMyBarberLunchBreak(me?.lunchBreak ?? {});
            setMyBarberBlockedHours(me?.blockedHours ?? []);
            if (myId != null) {
                try { const gallery = await DataService.getBarberGallery(myId); setGalleryPhotos(gallery); } catch { setGalleryPhotos([]); }
            }
        }
        setCurrentUserRole(role);
        setActivePosId(DataService.getActivePosId());
    };

    useEffect(() => {
        loadData();
    }, []);

    // En plan Solo no hay pestaña Barberos; si estaba en barbers, volver a general
    useEffect(() => {
        if (accountTier === 'solo' && activeTab === 'barbers') setActiveTab('general');
    }, [accountTier, activeTab]);

    const handleSaveSettings = async () => {
        try {
            await DataService.updateSettings(settings);
            alert('Configuración guardada correctamente');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'No se pudo guardar la configuración. Verifica que tengas una sede activa.');
        }
    };

    const handleSaveUser = async () => {
        if (!currentUser.username?.trim() || !currentUser.name?.trim() || !currentUser.role) {
            alert('Completa nombre de usuario, nombre completo y rol.');
            return;
        }
        try {
            const toSave: SystemUser = {
                username: currentUser.username.trim(),
                name: currentUser.name.trim(),
                role: currentUser.role,
                posId: currentUser.posId ?? null,
                barberId: currentUser.barberId ?? null,
                clientId: currentUser.clientId ?? null,
                status: currentUser.status || 'active',
            };
            if (currentUser.password != null && String(currentUser.password).trim() !== '') {
                toSave.password = String(currentUser.password).trim();
            }
            await DataService.saveUser(toSave);
            await loadData();
            setShowUserModal(false);
            alert('Usuario guardado correctamente.');
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            alert('No se pudo guardar: ' + msg);
        }
    };

    const handleDeleteUser = async (username: string) => {
        if (confirm(`¿Eliminar usuario ${username}?`)) {
            await DataService.deleteUser(username);
            await loadData();
        }
    };

    const handleSaveService = async () => {
        if (!currentService.name || !currentService.price) return;
        try {
            if (currentService.id) {
                await DataService.saveService(currentService as Service);
            } else {
                await DataService.addService(currentService as Omit<Service, 'id' | 'posId'>);
            }
            await loadData();
            setShowServiceModal(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'No se pudo guardar.');
        }
    };

    const handleDeleteService = async (id: number) => {
        if (confirm('¿Eliminar servicio?')) {
            try {
                await DataService.deleteService(id);
                await loadData();
            } catch (err) {
                alert(err instanceof Error ? err.message : 'No se pudo eliminar.');
            }
        }
    };

    const handleSaveBarber = async () => {
        if (!currentBarber.name) return;
        if (currentBarber.id) {
            await DataService.updateBarber(currentBarber as Barber);
        } else {
            await DataService.addBarber(currentBarber as Barber);
        }
        await loadData();
        setShowBarberModal(false);
    };

    const handleDeleteBarber = async (id: number) => {
        if (confirm('¿Eliminar barbero? Se recomienda solo desactivarlo si tiene historial.')) {
            await DataService.deleteBarber(id);
            await loadData();
        }
    };

    const handleToggleBarber = async (id: number) => {
        await DataService.toggleBarberStatus(id);
        await loadData();
    };

    const openUserModal = (user?: SystemUser) => {
        if (user) {
            setCurrentUser({ ...user, password: '' }); // Editing: no enviar contraseña para no sobrescribir
        } else {
            setCurrentUser({ username: '', name: '', role: 'barbero', password: '' }); // Creating
        }
        setShowUserModal(true);
    };

    const openServiceModal = (service?: Service) => {
        if (service) {
            setCurrentService({ ...service });
        } else {
            setCurrentService({ name: '', price: 0, duration: 30 });
        }
        setShowServiceModal(true);
    };

    const openBarberModal = (barber?: Barber) => {
        if (barber) {
            setCurrentBarber({ ...barber });
        } else {
            setCurrentBarber({ name: '', specialty: '', active: true });
        }
        setShowBarberModal(true);
    };

    // URL base para los QR: en producción/native usar siempre la URL pública del despliegue.
    // En Android/iOS (Capacitor) window.location es tipo capacitor://localhost → los QR salían rotos.
    const rawPublicUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_PUBLIC_URL;
    const isNativeApp = Capacitor.isNativePlatform();
    const defaultPublicUrl = 'https://gen-lang-client-0624135070.web.app';
    const baseUrl = rawPublicUrl
        ? String(rawPublicUrl).replace(/\/+$/, '')
        : isNativeApp
            ? defaultPublicUrl
            : (window.location.origin + (window.location.pathname || '').replace(/\/+$/, '') || window.location.origin);
    const getRegistrationUrl = () => `${baseUrl}?ref_pos=${activePosId}`;
    const getRegistrationUrlForPos = (posId: number) => `${baseUrl}?ref_pos=${posId}`;

    const handlePrintQR = (title: string, qrImageUrl: string) => {
        if (Capacitor.isNativePlatform()) {
            handlePrintQRNative();
            return;
        }
        const el = document.getElementById('qr-print-area');
        if (!el) return;
        const img = new Image();
        img.onload = () => {
            el.innerHTML = `
                <div style="text-align:center; padding:24px; font-family:Inter,sans-serif;">
                    <h1 style="font-size:1.5rem; font-weight:700; color:#1e293b; margin-bottom:8px;">${title.replace(/</g, '&lt;')}</h1>
                    <p style="font-size:0.875rem; color:#64748b; margin-bottom:16px;">Escanea para registrarte o agendar cita</p>
                    <img src="${qrImageUrl}" alt="QR BarberShow" width="280" height="280" style="display:block; margin:0 auto;" />
                </div>`;
            document.body.classList.add('print-qr');
            window.print();
        };
        img.onerror = () => {
            el.innerHTML = `<div style="padding:24px; text-align:center;"><p>QR</p><img src="${qrImageUrl}" alt="QR" width="280" height="280" /></div>`;
            document.body.classList.add('print-qr');
            window.print();
        };
        img.src = qrImageUrl;
        const cleanup = () => {
            document.body.classList.remove('print-qr');
            el.innerHTML = '';
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
    };

    const isBarber = currentUserRole === 'barbero';
    const canAccessSettings = ['admin', 'superadmin', 'dueno', 'barbero'].includes(currentUserRole);
    if (!canAccessSettings) {
        return (
            <div className="p-8 text-center text-slate-500">
                No tienes permisos para acceder a esta sección. Solo administradores, superadmin y barberos pueden acceder a Configuración.
            </div>
        );
    }

    // Barbero entra directo a pestaña Servicios (Mis servicios); no sobrescribir si eligió Impuestos o QR
    useEffect(() => {
        if (isBarber && activeTab !== 'services' && activeTab !== 'taxes' && activeTab !== 'qr') setActiveTab('services');
    }, [isBarber]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                <SettingsIcon className="mr-2" /> {isBarber ? 'Mis Servicios' : 'Administración de Sede'}
            </h2>

            {/* Tabs: barbero solo ve Servicios */}
            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit overflow-x-auto">
                {!isBarber && (
                    <>
                        <button 
                            onClick={() => setActiveTab('general')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'general' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <SettingsIcon size={16} className="mr-2" /> General
                        </button>
                        <button 
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'users' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <UserCog size={16} className="mr-2" /> Usuarios
                        </button>
                        {accountTier !== 'solo' && (
                            <button 
                                onClick={() => setActiveTab('barbers')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'barbers' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <UserCheck size={16} className="mr-2" /> Barberos
                            </button>
                        )}
                    </>
                )}
                <button 
                    onClick={() => setActiveTab('services')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'services' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <Scissors size={16} className="mr-2" /> {isBarber ? 'Mis Servicios' : 'Servicios'}
                </button>
                {isBarber && (
                    <>
                        <button 
                            onClick={() => setActiveTab('qr')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'qr' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <QrCode size={16} className="mr-2" /> Código QR
                        </button>
                        <button 
                            onClick={() => setActiveTab('taxes')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'taxes' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Percent size={16} className="mr-2" /> Impuestos
                        </button>
                    </>
                )}
                {!isBarber && (
                    <button 
                        onClick={() => setActiveTab('privacy')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'privacy' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Shield size={16} className="mr-2" /> Privacidad
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                
                {/* GENERAL SETTINGS */}
                {activeTab === 'general' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Configuración General</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Negocio (Sede Actual)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg p-2.5"
                                    value={settings.storeName}
                                    onChange={e => setSettings({...settings, storeName: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tasa de Impuestos (Decimal)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    className="w-full border border-slate-300 rounded-lg p-2.5 placeholder:text-gray-400"
                                    value={settings.taxRate === 0 ? '' : settings.taxRate}
                                    placeholder="0"
                                    onChange={e => {
                                        const v = e.target.value;
                                        setSettings({ ...settings, taxRate: v === '' ? 0 : Number(v) });
                                    }}
                                />
                                <p className="text-xs text-slate-500 mt-1">Ejemplo: 0.16 para 16%</p>
                            </div>
                            <button onClick={handleSaveSettings} className="bg-[#ffd427] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center hover:bg-[#e6be23]">
                                <Save size={18} className="mr-2" /> Guardar Cambios
                            </button>
                        </div>

                        {/* QR Code Banner Section */}
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center text-center">
                            <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getRegistrationUrl())}`} 
                                    alt="QR de Registro" 
                                    className="w-48 h-48 rounded-full object-cover"
                                />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-1">Escanea para Registrarte</h3>
                            <p className="text-slate-500 text-sm mb-4">Coloca este código en la entrada para que los clientes se registren automáticamente en esta sede.</p>
                            
                            <div className="flex space-x-2">
                                <a 
                                    href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getRegistrationUrl())}`}
                                    download="BarberShow_QR.png"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm"
                                >
                                    <Download size={16} className="mr-2" /> Descargar PNG
                                </a>
                                <button 
                                    type="button"
                                    onClick={() => handlePrintQR(settings.storeName || 'BarberShow - Registro', `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(getRegistrationUrl())}`)}
                                    className="flex items-center px-4 py-2 bg-[#ffd427] text-slate-900 rounded-lg hover:bg-[#e6be23] font-bold text-sm"
                                >
                                    <Printer size={16} className="mr-2" /> Imprimir Bajante
                                </button>
                            </div>
                        </div>

                        {/* QR por barbería (admin/superadmin): un QR por cada sede */}
                        {!isBarber && pointsOfSale.length > 0 && (
                            <div className="mt-8 pt-8 border-t border-slate-200">
                                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
                                    <QrCode size={20} className="mr-2" /> Códigos QR por barbería
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">Cada código lleva al registro o login con esa sede preseleccionada. Descarga o imprime el que corresponda a cada local.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {pointsOfSale.filter((pos) => pos.isActive !== false).map((pos) => {
                                        const qrUrl = getRegistrationUrlForPos(pos.id);
                                        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;
                                        const downloadFilename = `BarberShow_QR_${(pos.name || `sede-${pos.id}`).replace(/\s+/g, '_')}.png`;
                                        return (
                                            <div key={pos.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center text-center">
                                                <p className="font-bold text-slate-800 mb-1">{pos.name}</p>
                                                {pos.address && <p className="text-xs text-slate-500 mb-3">{pos.address}</p>}
                                                <div className="bg-white p-2 rounded-lg shadow-sm mb-3">
                                                    <img src={qrImageUrl} alt={`QR ${pos.name}`} className="w-36 h-36 object-contain" />
                                                </div>
                                                <div className="flex flex-wrap gap-2 justify-center">
                                                    <a
                                                        href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrUrl)}`}
                                                        download={downloadFilename}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
                                                    >
                                                        <Download size={14} className="mr-1.5" /> Descargar
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrintQR(pos.name || `Sede ${pos.id}`, qrImageUrl.replace('200x200', '400x400'))}
                                                        className="flex items-center px-3 py-1.5 bg-[#ffd427] text-slate-900 rounded-lg hover:bg-[#e6be23] text-sm font-bold"
                                                    >
                                                        <Printer size={14} className="mr-1.5" /> Imprimir
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAXES (barbero): solo tasa y símbolo de moneda */}
                {activeTab === 'taxes' && (
                    <div className="space-y-4 max-w-md">
                        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Impuestos y moneda</h3>
                        <p className="text-sm text-slate-500">Configura la tasa de impuestos y el símbolo de moneda que se usan en ventas y facturación.</p>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tasa de impuestos (decimal)</label>
                            <input 
                                type="number" 
                                step="0.01"
                                min={0}
                                max={1}
                                className="w-full border border-slate-300 rounded-lg p-2.5"
                                value={settings.taxRate}
                                onChange={e => setSettings({ ...settings, taxRate: Number(e.target.value) })}
                            />
                            <p className="text-xs text-slate-500 mt-1">Ejemplo: 0.16 para 16%</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Símbolo de moneda</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-300 rounded-lg p-2.5"
                                value={settings.currencySymbol}
                                onChange={e => setSettings({ ...settings, currencySymbol: e.target.value })}
                                placeholder="$"
                            />
                        </div>
                        <button onClick={handleSaveSettings} className="bg-[#ffd427] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center hover:bg-[#e6be23]">
                            <Save size={18} className="mr-2" /> Guardar
                        </button>
                    </div>
                )}

                {/* QR DE LA BARBERÍA (barbero): mismo QR que General pero en su propia pestaña */}
                {activeTab === 'qr' && isBarber && (
                    <div className="max-w-lg">
                        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center">
                            <QrCode size={20} className="mr-2" /> Código QR de la barbería
                        </h3>
                        {activePosId != null ? (
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center text-center">
                                <p className="text-sm text-slate-600 mb-3">
                                    {pointsOfSale.find(p => p.id === activePosId)?.name || settings.storeName || 'Sede actual'}
                                </p>
                                <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getRegistrationUrl())}`}
                                        alt="QR de Registro"
                                        className="w-48 h-48 rounded-lg object-contain"
                                    />
                                </div>
                                <p className="text-slate-500 text-sm mb-4">Los clientes pueden escanear este código para registrarse o agendar en esta barbería.</p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    <a
                                        href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getRegistrationUrl())}`}
                                        download="BarberShow_QR_barberia.png"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm"
                                    >
                                        <Download size={16} className="mr-2" /> Descargar PNG
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => handlePrintQR(pointsOfSale.find(p => p.id === activePosId)?.name || settings.storeName || 'Barbería', `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(getRegistrationUrl())}`)}
                                        className="flex items-center px-4 py-2 bg-[#ffd427] text-slate-900 rounded-lg hover:bg-[#e6be23] font-bold text-sm"
                                    >
                                        <Printer size={16} className="mr-2" /> Imprimir
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-slate-500 py-6">No hay sede seleccionada. Selecciona una barbería/sede para ver y descargar su código QR.</p>
                        )}
                    </div>
                )}

                {/* USERS SETTINGS */}
                {activeTab === 'users' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Gestión de Personal (Sede Actual)</h3>
                            <button onClick={() => openUserModal()} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center hover:bg-green-700">
                                <Plus size={16} className="mr-1" /> Nuevo Usuario
                            </button>
                        </div>
                        <div className="overflow-x-auto table-wrapper">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-500 text-sm border-b border-slate-200">
                                        <th className="py-2">Usuario</th>
                                        <th className="py-2">Nombre Completo</th>
                                        <th className="py-2">Rol</th>
                                        <th className="py-2 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u, i) => (
                                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                                            <td className="py-3 font-medium text-slate-700">{u.username}</td>
                                            <td className="py-3 text-slate-600">{u.name}</td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                                    u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                    u.role === 'dueno' ? 'bg-amber-100 text-amber-700' :
                                                    u.role === 'barbero' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {u.role === 'dueno' ? 'Dueño' : u.role}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right space-x-2">
                                                <button onClick={() => openUserModal(u)} className="text-blue-500 hover:text-blue-700"><Edit2 size={18}/></button>
                                                <button onClick={() => handleDeleteUser(u.username)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* BARBERS SETTINGS */}
                {activeTab === 'barbers' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Gestión de Barberos (Sede Actual)</h3>
                            <button onClick={() => openBarberModal()} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center hover:bg-green-700">
                                <Plus size={16} className="mr-1" /> Nuevo Barbero
                            </button>
                        </div>
                        <div className="overflow-x-auto table-wrapper">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-500 text-sm border-b border-slate-200">
                                        <th className="py-2">Nombre</th>
                                        <th className="py-2">Especialidad</th>
                                        <th className="py-2 text-center">Estado</th>
                                        <th className="py-2 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {barbers.map((b) => (
                                        <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                                            <td className="py-3 font-medium text-slate-700">{b.name}</td>
                                            <td className="py-3 text-slate-600">{b.specialty}</td>
                                            <td className="py-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                    b.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {b.active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right space-x-2 flex justify-end">
                                                <button 
                                                    onClick={() => handleToggleBarber(b.id)} 
                                                    className={`p-2 rounded-lg transition-colors ${b.active ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                                    title={b.active ? 'Desactivar' : 'Activar'}
                                                >
                                                    <Power size={18} />
                                                </button>
                                                <button onClick={() => openBarberModal(b)} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg"><Edit2 size={18}/></button>
                                                <button onClick={() => handleDeleteBarber(b.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SERVICES SETTINGS */}
                {activeTab === 'services' && (
                    <div className="space-y-4">
                        {isBarber && DataService.getCurrentBarberId() == null && (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                                <strong>Perfil incompleto.</strong> Tu usuario no tiene un barbero asignado. Pide al administrador que te asigne en <strong>Admin Usuarios</strong> (o en Barberos + usuario con rol barbero). Hasta entonces no podrás agregar tus propios servicios ni ver tus citas correctamente.
                            </div>
                        )}
                        {isBarber && DataService.getCurrentBarberId() != null && (
                            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1"><Clock size={18} /> Horario en que trabajas</h4>
                                <p className="text-xs text-slate-500 mb-3">Marca los días y horas en que atiendes. Los clientes solo verán slots en este horario.</p>
                                <div className="space-y-2 mb-3">
                                    {[0,1,2,3,4,5,6].map((day) => {
                                        const wh = myBarberWorkingHours[day] ?? null;
                                        const enabled = wh != null;
                                        return (
                                            <div key={day} className="flex items-center gap-2 flex-wrap">
                                                <input type="checkbox" id={`mywh-${day}`} checked={enabled} className="rounded text-[#ffd427] focus:ring-[#ffd427]" onChange={e => {
                                                    const next = { ...myBarberWorkingHours };
                                                    if (e.target.checked) next[day] = { start: '09:00', end: '19:00' };
                                                    else delete next[day];
                                                    setMyBarberWorkingHours(next);
                                                }} />
                                                <label htmlFor={`mywh-${day}`} className="w-8 text-sm font-medium text-slate-600">{DAY_NAMES[day]}</label>
                                                {enabled && (
                                                    <>
                                                        <input type="time" className="border rounded px-2 py-1 text-sm w-24" value={wh.start} onChange={e => setMyBarberWorkingHours({ ...myBarberWorkingHours, [day]: { ...wh, start: e.target.value } })} />
                                                        <span className="text-slate-400">–</span>
                                                        <input type="time" className="border rounded px-2 py-1 text-sm w-24" value={wh.end} onChange={e => setMyBarberWorkingHours({ ...myBarberWorkingHours, [day]: { ...wh, end: e.target.value } })} />
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
</div>
                                <p className="text-sm font-medium text-slate-700 mt-3 mb-2">Horario de comida</p>
                                <p className="text-xs text-slate-500 mb-2">Opcional: indica en qué rango no atiendes (comida). Los clientes no verán slots en esa franja.</p>
                                <div className="space-y-2 mb-3">
                                    {[0,1,2,3,4,5,6].map((day) => {
                                        const lb = myBarberLunchBreak[day] ?? null;
                                        const hasLunch = lb != null && (lb.start || lb.end);
                                        return (
                                            <div key={day} className="flex items-center gap-2 flex-wrap">
                                                <label className="w-8 text-sm font-medium text-slate-600">{DAY_NAMES[day]}</label>
                                                <input type="time" className="border rounded px-2 py-1 text-sm w-24" value={lb?.start ?? ''} placeholder="Inicio" onChange={e => {
                                                    const start = e.target.value;
                                                    const end = lb?.end ?? (start || '14:00');
                                                    setMyBarberLunchBreak(prev => ({ ...prev, [day]: { start: start || '13:00', end } }));
                                                }} />
                                                <span className="text-slate-400">–</span>
                                                <input type="time" className="border rounded px-2 py-1 text-sm w-24" value={lb?.end ?? ''} onChange={e => {
                                                    const end = e.target.value;
                                                    const start = lb?.start ?? '13:00';
                                                    setMyBarberLunchBreak(prev => ({ ...prev, [day]: { start, end: end || '14:00' } }));
                                                }} />
                                                {hasLunch && (
                                                    <button type="button" onClick={() => { const next = { ...myBarberLunchBreak }; delete next[day]; setMyBarberLunchBreak(next); }} className="text-slate-400 hover:text-red-500 text-xs">Quitar</button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <button onClick={async () => {
                                    setSavingHours(true);
                                    try {
                                        await DataService.updateBarberWorkingHours(DataService.getCurrentBarberId()!, myBarberWorkingHours);
                                        await DataService.updateBarberLunchBreak(DataService.getCurrentBarberId()!, myBarberLunchBreak);
                                        const updated = await DataService.getBarbers();
                                        setBarbers(updated);
                                        const me = updated.find((b: Barber) => b.id === DataService.getCurrentBarberId());
                                        if (me?.workingHours) setMyBarberWorkingHours(me.workingHours);
                                        if (me?.lunchBreak) setMyBarberLunchBreak(me.lunchBreak);
                                        alert('Horario y comida guardados.');
                                    } catch (err) {
                                        alert(err instanceof Error ? err.message : 'Error al guardar.');
                                    } finally {
                                        setSavingHours(false);
                                    }
                                }} disabled={savingHours} className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23] disabled:opacity-50 text-sm">
                                    {savingHours ? 'Guardando...' : 'Guardar mi horario'}
                                </button>
                            </div>
                        )}
                        {isBarber && DataService.getCurrentBarberId() != null && (
                            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1"><CalendarOff size={18} /> Bloquear horas (salidas)</h4>
                                <p className="text-xs text-slate-500 mb-3">Marca rangos de hora en los que no atenderás (ej. salida, cita personal). Esos slots no se mostrarán a los clientes.</p>
                                <ul className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                                    {(myBarberBlockedHours ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)).map((bl, i) => (
                                        <li key={i} className="flex items-center justify-between gap-2 py-1.5 px-2 bg-slate-50 rounded border border-slate-100">
                                            <span className="text-sm text-slate-700"><strong>{bl.date}</strong> {bl.start} – {bl.end}</span>
                                            <button type="button" onClick={() => {
                                                const next = (myBarberBlockedHours ?? []).filter((_, j) => j !== i);
                                                setMyBarberBlockedHours(next);
                                            }} className="text-red-500 hover:text-red-700 p-1" title="Eliminar"><Trash2 size={16} /></button>
                                        </li>
                                    ))}
                                    {(!myBarberBlockedHours || myBarberBlockedHours.length === 0) && (
                                        <li className="text-sm text-slate-400 italic">Sin bloques. Agrega uno si necesitas bloquear horas.</li>
                                    )}
                                </ul>
                                {showAddBlock && (
                                    <div className="flex flex-wrap items-center gap-2 p-3 bg-amber-50/50 border border-amber-200 rounded-lg mb-3">
                                        <input type="date" className="border rounded px-2 py-1 text-sm" value={newBlock.date} onChange={e => setNewBlock(b => ({ ...b, date: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
                                        <input type="time" className="border rounded px-2 py-1 text-sm w-24" value={newBlock.start} onChange={e => setNewBlock(b => ({ ...b, start: e.target.value }))} />
                                        <span className="text-slate-500">–</span>
                                        <input type="time" className="border rounded px-2 py-1 text-sm w-24" value={newBlock.end} onChange={e => setNewBlock(b => ({ ...b, end: e.target.value }))} />
                                        <button type="button" onClick={() => {
                                            if (!newBlock.date || newBlock.start >= newBlock.end) { alert('Fecha obligatoria y la hora fin debe ser mayor que la de inicio.'); return; }
                                            setMyBarberBlockedHours(prev => [...(prev ?? []), { ...newBlock }]);
                                            setNewBlock({ date: '', start: '10:00', end: '11:00' });
                                            setShowAddBlock(false);
                                        }} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Agregar</button>
                                        <button type="button" onClick={() => setShowAddBlock(false)} className="px-3 py-1 border border-slate-300 rounded text-sm">Cancelar</button>
                                    </div>
                                )}
                                {!showAddBlock && (
                                    <button type="button" onClick={() => setShowAddBlock(true)} className="mr-2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">+ Agregar bloqueo</button>
                                )}
                                <button type="button" onClick={async () => {
                                    setSavingBlocked(true);
                                    try {
                                        await DataService.updateBarberBlockedHours(DataService.getCurrentBarberId()!, myBarberBlockedHours ?? []);
                                        const updated = await DataService.getBarbers();
                                        setBarbers(updated);
                                        const me = updated.find((b: Barber) => b.id === DataService.getCurrentBarberId());
                                        setMyBarberBlockedHours(me?.blockedHours ?? []);
                                        alert('Horas bloqueadas guardadas.');
                                    } catch (err) {
                                        alert(err instanceof Error ? err.message : 'Error al guardar.');
                                    } finally {
                                        setSavingBlocked(false);
                                    }
                                }} disabled={savingBlocked} className="px-4 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 text-sm">
                                    {savingBlocked ? 'Guardando...' : 'Guardar bloqueos'}
                                </button>
                            </div>
                        )}
                        {isBarber && DataService.getCurrentBarberId() != null && (
                            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1"><ImagePlus size={18} /> Fotos de mis trabajos / cortes</h4>
                                <p className="text-xs text-slate-500 mb-3">Sube fotos de cortes o servicios que hayas hecho. Los clientes las verán al elegirte para una cita.</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                                    {galleryPhotos.map((p) => (
                                        <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                                            <img src={p.imageUrl} alt={p.caption || 'Trabajo'} className="w-full h-full object-cover" />
                                            {p.caption && <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 truncate">{p.caption}</p>}
                                            <button type="button" onClick={async () => { if (confirm('¿Eliminar esta foto?')) { await DataService.deleteBarberGalleryPhoto(DataService.getCurrentBarberId()!, p.id); setGalleryPhotos(prev => prev.filter(x => x.id !== p.id)); } }} className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600" title="Eliminar"><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="cursor-pointer px-3 py-2 bg-[#ffd427] text-slate-900 font-medium rounded-lg hover:bg-[#e6be23] text-sm inline-flex items-center gap-1">
                                        <ImagePlus size={16} /> Subir foto
                                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file || !file.type.startsWith('image/')) return;
                                            setGalleryUploading(true);
                                            const barberId = DataService.getCurrentBarberId()!;
                                            const compressToDataUrl = (): Promise<string> => new Promise((resolve, reject) => {
                                                const img = new Image();
                                                const url = URL.createObjectURL(file);
                                                img.onload = () => {
                                                    URL.revokeObjectURL(url);
                                                    const max = 500;
                                                    let w = img.width, h = img.height;
                                                    if (w > max || h > max) {
                                                        if (w > h) { h = Math.round((h * max) / w); w = max; } else { w = Math.round((w * max) / h); h = max; }
                                                    }
                                                    const canvas = document.createElement('canvas');
                                                    canvas.width = w; canvas.height = h;
                                                    const ctx = canvas.getContext('2d');
                                                    if (!ctx) { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(file); return; }
                                                    ctx.drawImage(img, 0, 0, w, h);
                                                    resolve(canvas.toDataURL('image/jpeg', 0.75));
                                                };
                                                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
                                                img.src = url;
                                            });
                                            try {
                                                const dataUrl = await compressToDataUrl();
                                                const photo = await DataService.addBarberGalleryPhoto(barberId, { imageUrl: dataUrl, caption: galleryCaption || undefined });
                                                setGalleryPhotos(prev => [photo, ...prev]);
                                                setGalleryCaption('');
                                                e.target.value = '';
                                            } catch (err) {
                                                alert(err instanceof Error ? err.message : 'Error al subir.');
                                            } finally {
                                                setGalleryUploading(false);
                                            }
                                        }} disabled={galleryUploading} />
                                    </label>
                                    <input type="text" className="border rounded-lg px-2 py-1.5 text-sm w-48" placeholder="Descripción (opcional)" value={galleryCaption} onChange={e => setGalleryCaption(e.target.value)} />
                                    {galleryUploading && <span className="text-sm text-slate-500">Subiendo...</span>}
                                    <span className="text-slate-400 text-sm">o</span>
                                    <input type="url" className="border rounded-lg px-2 py-1.5 text-sm w-52" placeholder="Pega URL de imagen" value={galleryUrl} onChange={e => setGalleryUrl(e.target.value)} />
                                    <button type="button" disabled={galleryUploading || !galleryUrl.trim()} onClick={async () => {
                                        if (!galleryUrl.trim()) return;
                                        setGalleryUploading(true);
                                        try {
                                            const photo = await DataService.addBarberGalleryPhoto(DataService.getCurrentBarberId()!, { imageUrl: galleryUrl.trim(), caption: galleryCaption || undefined });
                                            setGalleryPhotos(prev => [photo, ...prev]);
                                            setGalleryCaption(''); setGalleryUrl('');
                                        } catch (err) { alert(err instanceof Error ? err.message : 'Error al agregar.'); } finally { setGalleryUploading(false); }
                                    }} className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50">Agregar desde URL</button>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-slate-100 pb-2">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">{isBarber ? 'Tus servicios y precios de tus cortes' : 'Catálogo de Servicios (Sede Actual)'}</h3>
                                {isBarber && (
                                    <p className="text-sm text-slate-500 mt-1">Define nombre, <strong>precio</strong> y duración de cada corte o servicio. Puedes editar los precios cuando quieras desde el botón editar.</p>
                                )}
                            </div>
                            <button onClick={() => openServiceModal()} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center hover:bg-green-700 whitespace-nowrap">
                                <Plus size={16} className="mr-1" /> {isBarber ? 'Agregar mi servicio' : 'Nuevo Servicio'}
                            </button>
                        </div>
                        <div className="overflow-x-auto table-wrapper">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-500 text-sm border-b border-slate-200">
                                        <th className="py-2">Servicio</th>
                                        <th className="py-2">Duración (min)</th>
                                        <th className="py-2">Precio</th>
                                        {!isBarber && <th className="py-2">Tipo</th>}
                                        <th className="py-2 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {services.map((s) => (
                                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                                            <td className="py-3 font-medium text-slate-700">{s.name}</td>
                                            <td className="py-3 text-slate-600">{s.duration}</td>
                                            <td className="py-3 font-bold text-slate-800">${s.price.toFixed(2)}</td>
                                            {!isBarber && (
                                                <td className="py-3 text-slate-600">
                                                    {s.barberId == null ? 'Sede (todos)' : (barbers.find(b => b.id === s.barberId)?.name ?? `Barbero #${s.barberId}`)}
                                                </td>
                                            )}
                                            <td className="py-3 text-right space-x-2">
                                                <button onClick={() => openServiceModal(s)} className="text-blue-500 hover:text-blue-700"><Edit2 size={18}/></button>
                                                <button onClick={() => handleDeleteService(s.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* PRIVACY SETTINGS */}
                {activeTab === 'privacy' && (
                    <div className="space-y-4">
                         <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Política de Privacidad y Cookies</h3>
                         <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-600 h-64 overflow-y-auto">
                            <p className="font-bold mb-2">1. Introducción</p>
                            <p className="mb-4">BarberShow valora su privacidad. Esta política describe cómo recopilamos, usamos y protegemos su información.</p>
                            
                            <p className="font-bold mb-2">2. Recopilación de Datos</p>
                            <p className="mb-4">Recopilamos información personal como nombre, teléfono y correo electrónico para gestionar citas y servicios.</p>
                            
                            <p className="font-bold mb-2">3. Uso de Cookies</p>
                            <p className="mb-4">Utilizamos cookies para mejorar la experiencia del usuario, recordar preferencias y analizar el tráfico del sitio.</p>
                            
                            <p className="font-bold mb-2">4. Seguridad</p>
                            <p className="mb-4">Implementamos medidas de seguridad para proteger sus datos contra acceso no autorizado.</p>
                            
                            <p className="font-bold mb-2">5. Derechos del Usuario</p>
                            <p>Usted tiene derecho a acceder, rectificar o eliminar sus datos personales en cualquier momento.</p>
                         </div>
                         <div className="flex justify-end">
                             <button className="text-blue-600 text-sm font-medium hover:underline">Descargar PDF</button>
                         </div>
                    </div>
                )}

            </div>

            {/* USER MODAL */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">{currentUser.username ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre de Usuario (Login)</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentUser.username} onChange={e => setCurrentUser({...currentUser, username: e.target.value})} disabled={!!currentUser.username && users.some(u => u.username === currentUser.username && u !== currentUser)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre Completo</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Contraseña</label>
                                <input type="password" className="w-full border rounded-lg p-2" value={currentUser.password} onChange={e => setCurrentUser({...currentUser, password: e.target.value})} placeholder={currentUser.username ? "Sin cambios" : "Contraseña inicial"} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Rol / Privilegios</label>
                                <select className="w-full border rounded-lg p-2" value={currentUser.role || ''} onChange={e => setCurrentUser({...currentUser, role: (e.target.value || 'barbero') as UserRole})}>
                                    <option value="admin">Administrador</option>
                                    <option value="dueno">Dueño</option>
                                    <option value="barbero">Barbero</option>
                                    <option value="cliente">Cliente</option>
                                </select>
                            </div>
                            <div className="flex justify-end space-x-2 mt-4">
                                <button onClick={() => setShowUserModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button onClick={handleSaveUser} className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SERVICE MODAL */}
            {showServiceModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">{currentService.id ? (isBarber ? 'Editar mi servicio y precio' : 'Editar Servicio') : (isBarber ? 'Nuevo servicio (corte)' : 'Nuevo Servicio')}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre del Servicio</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentService.name} onChange={e => setCurrentService({...currentService, name: e.target.value})} placeholder={isBarber ? 'Ej: Corte clásico, Fade, Barba' : undefined} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{isBarber ? 'Precio que cobras ($)' : 'Precio ($)'}</label>
                                <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    className="w-full border rounded-lg p-2 placeholder:text-gray-400"
                                    value={currentService.price === 0 ? '' : currentService.price}
                                    placeholder="0"
                                    onChange={e => {
                                        const v = e.target.value;
                                        setCurrentService({ ...currentService, price: v === '' ? 0 : Number(v) });
                                    }}
                                />
                                {isBarber && <p className="text-xs text-slate-500 mt-1">Puedes cambiar el precio en cualquier momento.</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Duración (minutos)</label>
                                <input
                                    type="number"
                                    min={1}
                                    className="w-full border rounded-lg p-2 placeholder:text-gray-400"
                                    value={currentService.duration ?? ''}
                                    placeholder="30"
                                    onChange={e => setCurrentService({ ...currentService, duration: Number(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="flex justify-end space-x-2 mt-4">
                                <button onClick={() => setShowServiceModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button onClick={handleSaveService} className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* BARBER MODAL */}
            {showBarberModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 my-4">
                        <h3 className="text-xl font-bold mb-4">{currentBarber.id ? 'Editar Barbero' : 'Nuevo Barbero'}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre Completo</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentBarber.name} onChange={e => setCurrentBarber({...currentBarber, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Especialidad</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentBarber.specialty} onChange={e => setCurrentBarber({...currentBarber, specialty: e.target.value})} placeholder="Ej: Cortes clásicos, Barba" />
                            </div>
                            <div className="flex items-center space-x-2 mt-2">
                                <input type="checkbox" id="barberActive" checked={currentBarber.active} onChange={e => setCurrentBarber({...currentBarber, active: e.target.checked})} className="rounded text-[#ffd427] focus:ring-[#ffd427]" />
                                <label htmlFor="barberActive" className="text-sm font-medium text-slate-700">Barbero Activo (Disponible)</label>
                            </div>
                            <div className="border-t border-slate-200 pt-3 mt-3">
                                <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1"><Clock size={14} /> Horario de trabajo</p>
                                <p className="text-xs text-slate-500 mb-2">Días y horas en que atiende. Si no defines, se usa 09:00–19:00 todos los días.</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {[0,1,2,3,4,5,6].map((day) => {
                                        const wh = currentBarber.workingHours?.[day] ?? null;
                                        const enabled = wh != null;
                                        return (
                                            <div key={day} className="flex items-center gap-2 flex-wrap">
                                                <input type="checkbox" id={`wh-${day}`} checked={enabled} className="rounded text-[#ffd427] focus:ring-[#ffd427]" onChange={e => {
                                                    const next = { ...(currentBarber.workingHours || {}) };
                                                    if (e.target.checked) next[day] = { start: '09:00', end: '19:00' };
                                                    else delete next[day];
                                                    setCurrentBarber({ ...currentBarber, workingHours: next });
                                                }} />
                                                <label htmlFor={`wh-${day}`} className="w-8 text-sm font-medium text-slate-600">{DAY_NAMES[day]}</label>
                                                {enabled && (
                                                    <>
                                                        <input type="time" className="border rounded px-2 py-1 text-sm w-24" value={wh.start} onChange={e => setCurrentBarber({ ...currentBarber, workingHours: { ...(currentBarber.workingHours || {}), [day]: { ...wh, start: e.target.value } } })} />
                                                        <span className="text-slate-400">–</span>
                                                        <input type="time" className="border rounded px-2 py-1 text-sm w-24" value={wh.end} onChange={e => setCurrentBarber({ ...currentBarber, workingHours: { ...(currentBarber.workingHours || {}), [day]: { ...wh, end: e.target.value } } })} />
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="border-t border-slate-200 pt-3 mt-3">
                                <p className="text-sm font-medium text-slate-700 mb-2">Horario de comida</p>
                                <p className="text-xs text-slate-500 mb-2">Opcional: rango en que no atiende por día. Se guarda al guardar el barbero.</p>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {[0,1,2,3,4,5,6].map((day) => {
                                        const lb = (currentBarber as Barber).lunchBreak?.[day] ?? null;
                                        return (
                                            <div key={day} className="flex items-center gap-2 flex-wrap">
                                                <label className="w-8 text-sm font-medium text-slate-600">{DAY_NAMES[day]}</label>
                                                <input type="time" className="border rounded px-2 py-1 text-sm w-24" value={lb?.start ?? ''} onChange={e => {
                                                    const start = e.target.value;
                                                    const end = lb?.end ?? '14:00';
                                                    setCurrentBarber({ ...currentBarber, lunchBreak: { ...((currentBarber as Barber).lunchBreak || {}), [day]: { start: start || '13:00', end } } });
                                                }} />
                                                <span className="text-slate-400">–</span>
                                                <input type="time" className="border rounded px-2 py-1 text-sm w-24" value={lb?.end ?? ''} onChange={e => {
                                                    const end = e.target.value;
                                                    const start = lb?.start ?? '13:00';
                                                    setCurrentBarber({ ...currentBarber, lunchBreak: { ...((currentBarber as Barber).lunchBreak || {}), [day]: { start, end: end || '14:00' } } });
                                                }} />
                                                {(lb?.start || lb?.end) && (
                                                    <button type="button" onClick={() => { const next = { ...((currentBarber as Barber).lunchBreak || {}) }; delete next[day]; setCurrentBarber({ ...currentBarber, lunchBreak: next }); }} className="text-slate-400 hover:text-red-500 text-xs">Quitar</button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {currentBarber.id != null && (
                                <div className="border-t border-slate-200 pt-3 mt-3">
                                    <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1"><CalendarOff size={14} /> Horas bloqueadas (salidas)</p>
                                    <p className="text-xs text-slate-500 mb-2">Rangos en que no atiende. Se guardan al guardar el barbero.</p>
                                    <ul className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
                                        {((currentBarber as Barber).blockedHours ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)).map((bl, i) => (
                                            <li key={i} className="flex items-center justify-between gap-2 py-1 px-2 bg-slate-50 rounded text-sm">
                                                <span>{bl.date} {bl.start} – {bl.end}</span>
                                                <button type="button" onClick={() => {
                                                    const list = ((currentBarber as Barber).blockedHours ?? []).filter((_, j) => j !== i);
                                                    setCurrentBarber({ ...currentBarber, blockedHours: list });
                                                }} className="text-red-500 hover:text-red-700 p-0.5" title="Eliminar"><Trash2 size={14} /></button>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input type="date" className="border rounded px-2 py-1 text-sm" id="modal-block-date" />
                                        <input type="time" className="border rounded px-2 py-1 text-sm w-24" id="modal-block-start" defaultValue="10:00" />
                                        <span className="text-slate-500">–</span>
                                        <input type="time" className="border rounded px-2 py-1 text-sm w-24" id="modal-block-end" defaultValue="11:00" />
                                        <button type="button" onClick={() => {
                                            const date = (document.getElementById('modal-block-date') as HTMLInputElement)?.value;
                                            const start = (document.getElementById('modal-block-start') as HTMLInputElement)?.value || '10:00';
                                            const end = (document.getElementById('modal-block-end') as HTMLInputElement)?.value || '11:00';
                                            if (!date || start >= end) { alert('Fecha obligatoria y la hora fin debe ser mayor que la de inicio.'); return; }
                                            const list = [...((currentBarber as Barber).blockedHours ?? []), { date, start, end }];
                                            setCurrentBarber({ ...currentBarber, blockedHours: list });
                                        }} className="px-2 py-1 bg-slate-600 text-white rounded text-sm">+ Agregar</button>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end space-x-2 mt-4">
                                <button onClick={() => setShowBarberModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button onClick={handleSaveBarber} className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;