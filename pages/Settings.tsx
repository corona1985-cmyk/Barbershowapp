import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DataService } from '../services/data';
import { AppSettings, SystemUser, Service, UserRole, Barber, BarberWorkingHours, BarberBlockedSlot, BarberGalleryPhoto, AccountTier, PointOfSale, ProfessionalCertification } from '../types';
import { Save, Plus, Trash2, Edit2, Shield, Scissors, UserCog, Settings as SettingsIcon, UserCheck, Power, QrCode, Download, Printer, Percent, Clock, CalendarOff, ImagePlus, CreditCard, Loader2, CheckCircle, AlertCircle, X, Copy, Link2, MapPin, FileText, Languages, Users, Award } from 'lucide-react';
import CertificationsEditor from '../components/settings/CertificationsEditor';
import { PROFILE_LIMITS, sanitizeCertifications, sanitizeHighlights } from '../utils/professionalProfile';
import { Capacitor } from '@capacitor/core';
import { handlePrintQR as handlePrintQRNative } from '../utils/print';
import { DEFAULT_PUBLIC_APP_URL, GLOBAL_FREE_MODE, isPromotionalFreeTier } from '../config/app';
import { navigateToLegal } from '../utils/legal';
import DeactivateAccountSection from '../components/account/DeactivateAccountSection';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from '../i18n';

type SettingsTab = 'general' | 'users' | 'services' | 'privacy' | 'account' | 'barbers' | 'taxes' | 'qr' | 'planes' | 'horario' | 'galeria' | 'perfil';

const PLANES_INFO: { value: AccountTier; label: string; description: string; price: number }[] = [
  { value: 'gratuito', label: 'Plan Gratuito', description: 'Solo ver y gestionar citas. Hasta 100 citas al mes.', price: 0 },
  { value: 'solo', label: 'Plan Solo', description: 'Una persona, un local.', price: 14.95 },
  { value: 'barberia', label: 'Plan Barbería', description: 'Varios barberos, una sede.', price: 19.95 },
  { value: 'multisede', label: 'Plan Multi-Sede', description: 'Varias ubicaciones o cadena.', price: 29.95 },
];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const INPUT_CLASS =
  'w-full min-h-[44px] border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ffd427] focus:border-transparent';

interface SettingsProps {
  accountTier?: AccountTier;
  onAccountDeactivated?: () => void;
}

type Feedback = { type: 'success' | 'error'; message: string } | null;

type NavItem = {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint?: string;
};

type NavGroup = { id: string; label: string; items: NavItem[] };

function taxToPercentDisplay(rate: number): string {
  if (!rate) return '';
  return String(Math.round(rate * 10000) / 100);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const FeedbackBanner: React.FC<{ feedback: Feedback; onClose: () => void }> = ({ feedback, onClose }) => {
  if (!feedback) return null;
  const ok = feedback.type === 'success';
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      {ok ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
      <p className="flex-1 min-w-0">{feedback.message}</p>
      <button type="button" onClick={onClose} className="touch-target shrink-0 text-current/70 hover:text-current" aria-label="Cerrar aviso">
        <X size={16} />
      </button>
    </div>
  );
};

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center text-center py-10 px-4">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">{icon}</div>
    <p className="font-semibold text-slate-800">{title}</p>
    <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div
    className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-modal-title"
  >
    <div
      className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 sm:p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 id="settings-modal-title" className="text-lg font-bold text-slate-800">
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="touch-target flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (next: boolean) => void; id?: string }> = ({ checked, onChange, id }) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#ffd427]' : 'bg-slate-300'}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
    />
  </button>
);

const Settings: React.FC<SettingsProps> = ({ accountTier = 'barberia', onAccountDeactivated }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (accountTier === 'gratuito') return 'qr';
    if (DataService.getCurrentUserRole() === 'barbero') return 'perfil';
    return 'general';
  });
  const [settings, setSettings] = useState<AppSettings>({ taxRate: 0, storeName: '', currencySymbol: '$' });
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>(() => DataService.getCurrentUserRole());
  const [activePosId, setActivePosId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showUserModal, setShowUserModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showBarberModal, setShowBarberModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);

  const [currentUser, setCurrentUser] = useState<Partial<SystemUser>>({ username: '', name: '', role: 'cliente', password: '' });
  const [currentService, setCurrentService] = useState<Partial<Service>>({ name: '', price: 0, duration: 30 });
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
  const [shopAbout, setShopAbout] = useState('');
  const [shopHighlights, setShopHighlights] = useState<string[]>([]);
  const [shopCerts, setShopCerts] = useState<ProfessionalCertification[]>([]);
  const [highlightDraft, setHighlightDraft] = useState('');
  const [mySpecialty, setMySpecialty] = useState('');
  const [myBio, setMyBio] = useState('');
  const [myYears, setMyYears] = useState('');
  const [myCerts, setMyCerts] = useState<ProfessionalCertification[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 4500);
  };

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const loadData = async () => {
    const role = DataService.getCurrentUserRole();
    try {
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
      const activeId = DataService.getActivePosId();
      const pos = posList.find((p) => p.id === activeId);
      setShopAbout(pos?.about || '');
      setShopHighlights(sanitizeHighlights(pos?.highlights));
      setShopCerts(sanitizeCertifications(pos?.certifications));
      const linkedId = DataService.getLinkedBarberId();
      const linkedBarber = linkedId != null ? barbersData.find((b: Barber) => b.id === linkedId) : undefined;
      setMySpecialty(linkedBarber?.specialty || '');
      setMyBio(linkedBarber?.bio || '');
      setMyYears(linkedBarber?.yearsExperience ? String(linkedBarber.yearsExperience) : '');
      setMyCerts(sanitizeCertifications(linkedBarber?.certifications));
      if (role === 'barbero') {
        const myId = DataService.getCurrentBarberId();
        const me = barbersData.find((b: Barber) => b.id === myId);
        if (me?.workingHours) setMyBarberWorkingHours(me.workingHours);
        else setMyBarberWorkingHours({});
        setMyBarberLunchBreak(me?.lunchBreak ?? {});
        setMyBarberBlockedHours(me?.blockedHours ?? []);
        if (myId != null) {
          try {
            const gallery = await DataService.getBarberGallery(myId);
            setGalleryPhotos(gallery);
          } catch {
            setGalleryPhotos([]);
          }
        }
      }
      setCurrentUserRole(role);
      setActivePosId(DataService.getActivePosId());
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'No se pudo cargar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isBarber = currentUserRole === 'barbero';
  const canAccessSettings = ['admin', 'superadmin', 'dueno', 'barbero'].includes(currentUserRole);

  useEffect(() => {
    if ((accountTier === 'solo' || accountTier === 'gratuito') && activeTab === 'barbers') setActiveTab('general');
  }, [accountTier, activeTab]);

  useEffect(() => {
    if (accountTier === 'gratuito' && activeTab !== 'qr' && activeTab !== 'account') setActiveTab('qr');
  }, [accountTier, activeTab]);

  useEffect(() => {
    if (!isBarber) return;
    const allowed: SettingsTab[] = ['perfil', 'services', 'horario', 'galeria', 'taxes', 'qr', 'account'];
    if (!allowed.includes(activeTab)) setActiveTab('services');
  }, [isBarber, activeTab]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await DataService.updateSettings(settings);
      showFeedback('success', 'Cambios guardados. Ya se aplican en ventas y facturas.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'No se pudo guardar. Verifica que tengas una sede activa.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveUser = async () => {
    if (!currentUser.username?.trim() || !currentUser.name?.trim() || !currentUser.role) {
      showFeedback('error', 'Completa nombre de usuario, nombre completo y rol.');
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
      showFeedback('success', isEditingUser ? 'Usuario actualizado.' : 'Usuario creado.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', 'No se pudo guardar: ' + msg);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (confirm(`¿Eliminar usuario ${username}? Esta acción no se puede deshacer.`)) {
      await DataService.deleteUser(username);
      await loadData();
      showFeedback('success', 'Usuario eliminado.');
    }
  };

  const handleSaveService = async () => {
    if (!currentService.name || !currentService.price) {
      showFeedback('error', 'Indica el nombre y un precio mayor a 0.');
      return;
    }
    try {
      if (currentService.id) {
        await DataService.saveService(currentService as Service);
      } else {
        await DataService.addService(currentService as Omit<Service, 'id' | 'posId'>);
      }
      await loadData();
      setShowServiceModal(false);
      showFeedback('success', currentService.id ? 'Servicio actualizado.' : 'Servicio agregado.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'No se pudo guardar.');
    }
  };

  const handleDeleteService = async (id: number) => {
    if (confirm('¿Eliminar este servicio? Los clientes ya no podrán agendarlo.')) {
      try {
        await DataService.deleteService(id);
        await loadData();
        showFeedback('success', 'Servicio eliminado.');
      } catch (err) {
        showFeedback('error', err instanceof Error ? err.message : 'No se pudo eliminar.');
      }
    }
  };

  const handleSaveBarber = async () => {
    if (!currentBarber.name) {
      showFeedback('error', 'El nombre del barbero es obligatorio.');
      return;
    }
    const years = currentBarber.yearsExperience != null && Number(currentBarber.yearsExperience) > 0
      ? Number(currentBarber.yearsExperience)
      : undefined;
    const toSave = {
      ...currentBarber,
      specialty: (currentBarber.specialty || '').trim(),
      bio: (currentBarber.bio || '').trim() || undefined,
      yearsExperience: years,
      certifications: sanitizeCertifications(currentBarber.certifications),
    };
    if (toSave.id) {
      await DataService.updateBarber(toSave as Barber);
    } else {
      await DataService.addBarber(toSave as Barber);
    }
    await loadData();
    setShowBarberModal(false);
    showFeedback('success', currentBarber.id ? 'Barbero actualizado.' : 'Barbero agregado.');
  };

  const addHighlight = (list: string[], draft: string, setList: (next: string[]) => void, setDraft: (v: string) => void) => {
    const next = sanitizeHighlights([...list, draft]);
    setList(next);
    setDraft('');
  };

  const handleSavePublicProfile = async () => {
    setSavingProfile(true);
    try {
      if (!isBarber) {
        if (activePosId == null) throw new Error('No hay sede activa.');
        await DataService.updateShopPublicProfile(activePosId, {
          about: shopAbout,
          highlights: shopHighlights,
          certifications: shopCerts,
        });
      }
      const linkedId = DataService.getLinkedBarberId();
      if (isBarber || linkedId != null) {
        if (linkedId == null) throw new Error('Pide al administrador que asigne tu usuario a un barbero para publicar tu perfil.');
        const yearsNum = myYears.trim() === '' ? null : Number(myYears);
        await DataService.updateBarberProfile(linkedId, {
          specialty: mySpecialty,
          bio: myBio,
          yearsExperience: yearsNum,
          certifications: myCerts,
        });
      }
      await loadData();
      showFeedback('success', 'Perfil público guardado. Los clientes ya pueden verlo al agendar.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'No se pudo guardar el perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteBarber = async (id: number) => {
    if (confirm('¿Eliminar barbero? Si tiene historial, es mejor desactivarlo.')) {
      await DataService.deleteBarber(id);
      await loadData();
      showFeedback('success', 'Barbero eliminado.');
    }
  };

  const handleToggleBarber = async (id: number) => {
    await DataService.toggleBarberStatus(id);
    await loadData();
  };

  const openUserModal = (user?: SystemUser) => {
    if (user) {
      setIsEditingUser(true);
      setCurrentUser({ ...user, password: '' });
    } else {
      setIsEditingUser(false);
      setCurrentUser({ username: '', name: '', role: 'barbero', password: '' });
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

  const rawPublicUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_PUBLIC_URL;
  const isNativeApp = Capacitor.isNativePlatform();
  const baseUrl = rawPublicUrl
    ? String(rawPublicUrl).replace(/\/+$/, '')
    : isNativeApp
      ? DEFAULT_PUBLIC_APP_URL
      : window.location.origin + (window.location.pathname || '').replace(/\/+$/, '') || window.location.origin;
  const getRegistrationUrl = () => `${baseUrl}?ref_pos=${activePosId}`;
  const activePos = activePosId != null ? pointsOfSale.find((p) => p.id === activePosId) : null;

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

  const currentPlanLabel = isPromotionalFreeTier(accountTier)
    ? 'Plan Barbería (Promoción)'
    : accountTier === 'gratuito'
      ? 'Plan Gratuito'
      : accountTier === 'solo'
        ? 'Plan Solo'
        : accountTier === 'barberia'
          ? 'Plan Barbería'
          : 'Plan Multi-Sede';

  const navGroups: NavGroup[] = useMemo(() => {
    if (accountTier === 'gratuito') {
      return [
        { id: 'sede', label: 'Tu sede', items: [{ id: 'qr', label: 'Código QR', icon: QrCode, hint: 'Registro de clientes' }] },
        { id: 'cuenta', label: 'Cuenta', items: [{ id: 'account', label: t('settings.accountTab'), icon: Power }] },
      ];
    }
    if (isBarber) {
      return [
        {
          id: 'trabajo',
          label: 'Mi trabajo',
          items: [
            { id: 'perfil', label: 'Mi perfil', icon: Award, hint: 'Lo que ven los clientes' },
            { id: 'services', label: 'Mis servicios', icon: Scissors, hint: 'Precios y duración' },
            { id: 'horario', label: 'Horario', icon: Clock, hint: 'Días, comida y bloqueos' },
            { id: 'galeria', label: 'Galería', icon: ImagePlus, hint: 'Fotos de cortes' },
          ],
        },
        {
          id: 'sede',
          label: 'Sede',
          items: [
            { id: 'qr', label: 'Código QR', icon: QrCode },
            { id: 'taxes', label: 'Impuestos', icon: Percent },
          ],
        },
        { id: 'cuenta', label: 'Cuenta', items: [{ id: 'account', label: t('settings.accountTab'), icon: Power }] },
      ];
    }
    const sedeItems: NavItem[] = [
      { id: 'general', label: 'Negocio', icon: SettingsIcon, hint: 'Nombre, impuestos y QR' },
      { id: 'perfil', label: 'Perfil público', icon: Award, hint: 'Sobre la barbería y el peluquero' },
      { id: 'services', label: 'Servicios', icon: Scissors, hint: 'Catálogo de la sede' },
    ];
    if (!isNativeApp) {
      sedeItems.push({ id: 'planes', label: 'Planes', icon: CreditCard });
    }
    sedeItems.push({ id: 'privacy', label: 'Privacidad', icon: Shield });
    const equipo: NavItem[] = [{ id: 'users', label: 'Usuarios', icon: UserCog, hint: 'Accesos del personal' }];
    if (accountTier !== 'solo') {
      equipo.push({ id: 'barbers', label: 'Barberos', icon: UserCheck, hint: 'Equipo de la sede' });
    }
    return [
      { id: 'sede', label: 'Sede', items: sedeItems },
      { id: 'equipo', label: 'Equipo', items: equipo },
      { id: 'cuenta', label: 'Cuenta', items: [{ id: 'account', label: t('settings.accountTab'), icon: Power }] },
    ];
  }, [accountTier, isBarber, isNativeApp, t]);

  const allNavItems = navGroups.flatMap((g) => g.items);
  const activeNav = allNavItems.find((i) => i.id === activeTab);
  const sedeName = activePos?.name || settings.storeName || 'Sede actual';
  const taxPercent = settings.taxRate ? Math.round(settings.taxRate * 10000) / 100 : 0;
  const myBarberId = DataService.getCurrentBarberId();
  const linkedBarberId = DataService.getLinkedBarberId();

  const applyWeekdaysPreset = () => {
    const hours = { start: '09:00', end: '19:00' };
    setMyBarberWorkingHours({ 1: hours, 2: { ...hours }, 3: { ...hours }, 4: { ...hours }, 5: { ...hours } });
  };

  const copyEnabledHoursToAll = () => {
    const first = Object.values(myBarberWorkingHours).find(Boolean);
    if (!first) return;
    const next: BarberWorkingHours = {};
    Object.keys(myBarberWorkingHours).forEach((key) => {
      next[Number(key)] = { start: first.start, end: first.end };
    });
    setMyBarberWorkingHours(next);
  };

  const renderQrPanel = (compact = false) => {
    if (activePosId == null) {
      return (
        <EmptyState
          icon={<QrCode size={28} />}
          title="No hay sede seleccionada"
          description="Elige una barbería en el menú superior para ver e imprimir su código QR."
        />
      );
    }
    const url = getRegistrationUrl();
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    const qrPrint = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
    const qrDownload = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`;
    const title = activePos?.name || settings.storeName || 'BarberShow';
    return (
      <div className={`flex flex-col items-center text-center ${compact ? '' : 'max-w-md mx-auto'}`}>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4">
          <img src={qrSrc} alt="QR de registro" className="w-44 h-44 sm:w-48 sm:h-48 object-contain" />
        </div>
        <p className="font-bold text-slate-800">{title}</p>
        {activePos?.address && (
          <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1">
            <MapPin size={12} /> {activePos.address}
          </p>
        )}
        <p className="text-sm text-slate-500 mt-3 mb-4 max-w-xs">
          Colócalo en la recepción. Al escanearlo, el cliente se registra o agenda en esta sede.
        </p>
        <div className="flex flex-wrap gap-2 justify-center w-full">
          <button
            type="button"
            onClick={async () => {
              const ok = await copyToClipboard(url);
              showFeedback(ok ? 'success' : 'error', ok ? 'Enlace copiado. Ya puedes pegarlo en WhatsApp o redes.' : 'No se pudo copiar el enlace.');
            }}
            className="inline-flex min-h-[44px] items-center px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium text-sm"
          >
            <Copy size={16} className="mr-2" /> Copiar enlace
          </button>
          <a
            href={qrDownload}
            download={`BarberShow_QR_${(activePos?.name || 'barberia').replace(/\s+/g, '_')}.png`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-medium text-sm"
          >
            <Download size={16} className="mr-2" /> Descargar
          </a>
          <button
            type="button"
            onClick={() => handlePrintQR(title, qrPrint)}
            className="inline-flex min-h-[44px] items-center px-4 py-2 bg-[#ffd427] text-slate-900 rounded-xl hover:bg-[#e6be23] font-bold text-sm"
          >
            <Printer size={16} className="mr-2" /> Imprimir
          </button>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 break-all flex items-center gap-1 justify-center">
          <Link2 size={12} className="shrink-0" /> {url}
        </p>
      </div>
    );
  };

  const roleBadge = (role: string) => {
    const cls =
      role === 'admin' || role === 'superadmin'
        ? 'bg-purple-100 text-purple-700'
        : role === 'dueno'
          ? 'bg-amber-100 text-amber-800'
          : role === 'barbero'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-slate-100 text-slate-600';
    const label = role === 'dueno' ? 'Dueño' : role === 'admin' ? 'Admin' : role;
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${cls}`}>{label}</span>;
  };

  if (!canAccessSettings) {
    return (
      <div className="p-8 text-center text-slate-500">
        No tienes permisos para acceder a esta sección. Solo administradores, dueños y barberos pueden ver Configuración.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <Loader2 className="animate-spin mb-4 text-[#ffd427]" size={40} />
        <p className="font-medium">Cargando configuración…</p>
      </div>
    );
  }

  const navButton = (item: NavItem, variant: 'pill' | 'row') => {
    const active = activeTab === item.id;
    const Icon = item.icon;
    const danger = item.id === 'account';
    if (variant === 'pill') {
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => setActiveTab(item.id)}
          className={`inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
            active
              ? danger
                ? 'bg-red-600 text-white'
                : 'bg-[#ffd427] text-slate-900'
              : danger
                ? 'text-red-600 bg-white border border-red-100'
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Icon size={15} className="mr-1.5" />
          {item.label}
        </button>
      );
    }
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setActiveTab(item.id)}
        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
          active
            ? danger
              ? 'bg-red-50 text-red-700'
              : 'bg-[#ffd427] text-slate-900'
            : danger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-slate-600 hover:bg-white'
        }`}
      >
        <Icon size={18} className="shrink-0" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{item.label}</span>
          {item.hint && !active && <span className="block text-[11px] text-slate-400 font-normal truncate">{item.hint}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffd427]/20 text-slate-800 shrink-0">
              <SettingsIcon size={18} />
            </span>
            <span className="truncate">{isBarber ? 'Mis ajustes' : 'Ajustes de la sede'}</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5 min-w-0">
            <MapPin size={14} className="shrink-0 text-slate-400" />
            <span className="truncate">{sedeName}</span>
            {activeNav && (
              <>
                <span className="text-slate-300">·</span>
                <span className="truncate">{activeNav.hint || activeNav.label}</span>
              </>
            )}
          </p>
        </div>
        <span className="inline-flex self-start items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm">
          <CreditCard size={14} className="text-[#b89400]" />
          {currentPlanLabel}
        </span>
      </div>

      <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 lg:items-start">
        <div className="lg:hidden sticky top-0 z-10 -mx-3 px-3 py-2 bg-slate-100/95 backdrop-blur-sm">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">{allNavItems.map((item) => navButton(item, 'pill'))}</div>
        </div>

        <nav className="hidden lg:block sticky top-2 space-y-5 bg-slate-50/80 border border-slate-200 rounded-2xl p-3">
          {navGroups.map((group) => (
            <div key={group.id}>
              <p className="px-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group.label}</p>
              <div className="space-y-0.5">{group.items.map((item) => navButton(item, 'row'))}</div>
            </div>
          ))}
        </nav>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 mt-3 lg:mt-0">
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Datos del negocio</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Así aparece tu sede en citas, tickets y el código QR.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre de la sede</label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    value={settings.storeName}
                    onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                    placeholder="Ej. Barbería Centro"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Impuesto en ventas</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      className={`${INPUT_CLASS} pr-10`}
                      value={taxToPercentDisplay(settings.taxRate)}
                      placeholder="0"
                      onChange={(e) => {
                        const v = e.target.value;
                        setSettings({ ...settings, taxRate: v === '' ? 0 : Number(v) / 100 });
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">%</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    {taxPercent > 0
                      ? `En una venta de ${settings.currencySymbol || '$'}100 se cobrarán ${settings.currencySymbol || '$'}${(100 * (1 + settings.taxRate)).toFixed(2)} (incluye ${taxPercent}%).`
                      : 'Deja 0 si no aplicas impuesto. Ejemplo: 16 para IVA 16%.'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Símbolo de moneda</label>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    value={settings.currencySymbol}
                    onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                    placeholder="$"
                    maxLength={4}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="inline-flex min-h-[44px] items-center bg-[#ffd427] text-slate-900 px-5 py-2.5 rounded-xl font-bold hover:bg-[#e6be23] disabled:opacity-60"
                >
                  {savingSettings ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
                  {savingSettings ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-5">{renderQrPanel(true)}</div>
            </div>
          )}

          {activeTab === 'perfil' && (
            <div className="space-y-8 max-w-2xl">
              {!isBarber && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">La barbería</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Así te ven los clientes en descubrir barberías y al agendar. Cuenta qué ofreces y qué te diferencia.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Sobre el negocio</label>
                    <textarea
                      className={`${INPUT_CLASS} min-h-[120px] resize-y`}
                      value={shopAbout}
                      maxLength={PROFILE_LIMITS.about}
                      placeholder="Ej. Barbería de barrio con fade, barba y color. Ambiente relajado, cita puntual y productos profesionales."
                      onChange={(e) => setShopAbout(e.target.value)}
                    />
                    <p className="text-xs text-slate-400 mt-1 text-right">{shopAbout.length}/{PROFILE_LIMITS.about}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Lo que ofrece la sede</label>
                    <p className="text-xs text-slate-500 mb-2">Etiquetas cortas: Fade, Barba, Color, Kids, etc.</p>
                    {shopHighlights.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {shopHighlights.map((h) => (
                          <span key={h} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-sm">
                            {h}
                            <button
                              type="button"
                              onClick={() => setShopHighlights(shopHighlights.filter((x) => x !== h))}
                              className="text-slate-400 hover:text-red-500"
                              aria-label={`Quitar ${h}`}
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {shopHighlights.length < PROFILE_LIMITS.maxHighlights && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className={INPUT_CLASS}
                          value={highlightDraft}
                          maxLength={PROFILE_LIMITS.highlight}
                          placeholder="Ej: Fade, Color, Afeitado clásico"
                          onChange={(e) => setHighlightDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addHighlight(shopHighlights, highlightDraft, setShopHighlights, setHighlightDraft);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addHighlight(shopHighlights, highlightDraft, setShopHighlights, setHighlightDraft)}
                          disabled={!highlightDraft.trim()}
                          className="shrink-0 min-h-[44px] px-3 rounded-xl bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 disabled:opacity-40"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  <CertificationsEditor value={shopCerts} onChange={setShopCerts} />
                </div>
              )}

              {(isBarber || linkedBarberId != null) && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{isBarber ? 'Tu perfil de peluquero' : 'Tu perfil profesional'}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Especialidad, experiencia y cursos. El cliente lo ve al elegir barbero.
                    </p>
                  </div>
                  {linkedBarberId == null ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                      <strong>Perfil incompleto.</strong> Pide al administrador que asigne tu usuario a un barbero para publicar tu nivel y certificaciones.
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Especialidad</label>
                        <input
                          type="text"
                          className={INPUT_CLASS}
                          value={mySpecialty}
                          maxLength={120}
                          placeholder="Ej: Cortes clásicos, Fade, Barba"
                          onChange={(e) => setMySpecialty(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Años de experiencia</label>
                        <input
                          type="number"
                          min={0}
                          max={PROFILE_LIMITS.maxYearsExperience}
                          className={`${INPUT_CLASS} max-w-[10rem]`}
                          value={myYears}
                          placeholder="Ej: 8"
                          onChange={(e) => setMyYears(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Presentación</label>
                        <textarea
                          className={`${INPUT_CLASS} min-h-[120px] resize-y`}
                          value={myBio}
                          maxLength={PROFILE_LIMITS.bio}
                          placeholder="Cuéntale al cliente tu estilo, con qué te especializas y cómo trabajas."
                          onChange={(e) => setMyBio(e.target.value)}
                        />
                        <p className="text-xs text-slate-400 mt-1 text-right">{myBio.length}/{PROFILE_LIMITS.bio}</p>
                      </div>
                      <CertificationsEditor value={myCerts} onChange={setMyCerts} />
                    </>
                  )}
                </div>
              )}

              {!isBarber && linkedBarberId == null && accountTier !== 'solo' && (
                <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  El perfil de cada peluquero del equipo se edita en la pestaña <strong>Barberos</strong>: especialidad, presentación y certificaciones.
                </p>
              )}

              <button
                type="button"
                onClick={handleSavePublicProfile}
                disabled={savingProfile}
                className="inline-flex min-h-[44px] items-center bg-[#ffd427] text-slate-900 px-5 py-2.5 rounded-xl font-bold hover:bg-[#e6be23] disabled:opacity-60"
              >
                {savingProfile ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
                {savingProfile ? 'Guardando…' : 'Publicar perfil'}
              </button>
            </div>
          )}

          {activeTab === 'taxes' && (
            <div className="space-y-5 max-w-md">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Impuestos y moneda</h3>
                <p className="text-sm text-slate-500 mt-0.5">Se usan en el punto de venta y en las facturas de esta sede.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tasa de impuesto</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    className={`${INPUT_CLASS} pr-10`}
                    value={taxToPercentDisplay(settings.taxRate)}
                    placeholder="0"
                    onChange={(e) => {
                      const v = e.target.value;
                      setSettings({ ...settings, taxRate: v === '' ? 0 : Number(v) / 100 });
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">%</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {taxPercent > 0
                    ? `Ejemplo: ${settings.currencySymbol || '$'}100 + ${taxPercent}% = ${settings.currencySymbol || '$'}${(100 * (1 + settings.taxRate)).toFixed(2)}`
                    : 'Escribe 16 si el IVA es del 16%.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Símbolo de moneda</label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  placeholder="$"
                  maxLength={4}
                />
              </div>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="inline-flex min-h-[44px] items-center bg-[#ffd427] text-slate-900 px-5 py-2.5 rounded-xl font-bold hover:bg-[#e6be23] disabled:opacity-60"
              >
                {savingSettings ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
                {savingSettings ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )}

          {activeTab === 'qr' && (isBarber || accountTier === 'gratuito') && (
            <div>
              <div className="mb-5">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <QrCode size={20} /> Código QR de la barbería
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">Imprímelo o compártelo para que los clientes lleguen directo a tu agenda.</p>
              </div>
              {renderQrPanel()}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Personal de la sede</h3>
                  <p className="text-sm text-slate-500">Cuentas con las que el equipo entra a BarberShow.</p>
                </div>
                <button
                  type="button"
                  onClick={() => openUserModal()}
                  className="inline-flex min-h-[44px] items-center justify-center bg-[#ffd427] text-slate-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#e6be23]"
                >
                  <Plus size={16} className="mr-1" /> Nuevo usuario
                </button>
              </div>
              {users.length === 0 ? (
                <EmptyState
                  icon={<Users size={28} />}
                  title="Aún no hay usuarios"
                  description="Crea una cuenta para cada persona del equipo. El rol define qué puede ver y editar."
                  action={
                    <button type="button" onClick={() => openUserModal()} className="text-sm font-semibold text-slate-800 underline">
                      Crear el primero
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {users.map((u) => (
                      <div key={u.username} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{u.name}</p>
                            <p className="text-sm text-slate-500 truncate">@{u.username}</p>
                          </div>
                          {roleBadge(u.role)}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => openUserModal(u)}
                            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
                          >
                            <Edit2 size={16} /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.username)}
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-red-100 text-red-600"
                            aria-label={`Eliminar ${u.username}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto table-wrapper">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
                          <th className="py-3 font-semibold">Usuario</th>
                          <th className="py-3 font-semibold">Nombre</th>
                          <th className="py-3 font-semibold">Rol</th>
                          <th className="py-3 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.username} className="border-b border-slate-50 hover:bg-slate-50/80">
                            <td className="py-3 font-medium text-slate-700">{u.username}</td>
                            <td className="py-3 text-slate-600">{u.name}</td>
                            <td className="py-3">{roleBadge(u.role)}</td>
                            <td className="py-3 text-right">
                              <button type="button" onClick={() => openUserModal(u)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg" aria-label="Editar">
                                <Edit2 size={18} />
                              </button>
                              <button type="button" onClick={() => handleDeleteUser(u.username)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg" aria-label="Eliminar">
                                <Trash2 size={18} />
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
          )}

          {activeTab === 'barbers' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Barberos de la sede</h3>
                  <p className="text-sm text-slate-500">Activa o desactiva perfiles. Si hay historial, desactivar es más seguro que borrar.</p>
                </div>
                <button
                  type="button"
                  onClick={() => openBarberModal()}
                  className="inline-flex min-h-[44px] items-center justify-center bg-[#ffd427] text-slate-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#e6be23]"
                >
                  <Plus size={16} className="mr-1" /> Nuevo barbero
                </button>
              </div>
              {barbers.length === 0 ? (
                <EmptyState
                  icon={<UserCheck size={28} />}
                  title="No hay barberos aún"
                  description="Agrega al equipo para que los clientes elijan con quién agendar."
                  action={
                    <button type="button" onClick={() => openBarberModal()} className="text-sm font-semibold text-slate-800 underline">
                      Agregar barbero
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {barbers.map((b) => (
                      <div key={b.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800">{b.name}</p>
                            <p className="text-sm text-slate-500">{b.specialty || 'Sin especialidad'}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${b.active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                            {b.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleToggleBarber(b.id)}
                            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-sm font-medium"
                          >
                            {b.active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button type="button" onClick={() => openBarberModal(b)} className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 flex items-center justify-center" aria-label="Editar">
                            <Edit2 size={16} />
                          </button>
                          <button type="button" onClick={() => handleDeleteBarber(b.id)} className="min-h-[44px] min-w-[44px] rounded-xl border border-red-100 text-red-600 flex items-center justify-center" aria-label="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto table-wrapper">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
                          <th className="py-3 font-semibold">Nombre</th>
                          <th className="py-3 font-semibold">Especialidad</th>
                          <th className="py-3 font-semibold text-center">Estado</th>
                          <th className="py-3 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {barbers.map((b) => (
                          <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                            <td className="py-3 font-medium text-slate-700">{b.name}</td>
                            <td className="py-3 text-slate-600">{b.specialty}</td>
                            <td className="py-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                {b.active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleToggleBarber(b.id)}
                                className={`p-2 rounded-lg ${b.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                title={b.active ? 'Desactivar' : 'Activar'}
                              >
                                <Power size={18} />
                              </button>
                              <button type="button" onClick={() => openBarberModal(b)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg">
                                <Edit2 size={18} />
                              </button>
                              <button type="button" onClick={() => handleDeleteBarber(b.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                                <Trash2 size={18} />
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
          )}

          {activeTab === 'horario' && isBarber && (
            <div className="space-y-6">
              {myBarberId == null ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                  <strong>Perfil incompleto.</strong> Pide al administrador que asigne tu usuario a un barbero para poder definir horario.
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Clock size={20} /> Horario en que atiendes
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">Los clientes solo verán citas en estos días y horas.</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button type="button" onClick={applyWeekdaysPreset} className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">
                        Lun–Vie 9:00–19:00
                      </button>
                      <button type="button" onClick={copyEnabledHoursToAll} className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">
                        Copiar horario al resto de días activos
                      </button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                        const wh = myBarberWorkingHours[day] ?? null;
                        const enabled = wh != null;
                        return (
                          <div
                            key={day}
                            className={`rounded-xl border px-3 py-2.5 flex flex-wrap items-center gap-3 ${enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}
                          >
                            <span className="w-24 text-sm font-semibold text-slate-700">{DAY_FULL[day]}</span>
                            <Toggle
                              checked={enabled}
                              onChange={(next) => {
                                const nextHours = { ...myBarberWorkingHours };
                                if (next) nextHours[day] = { start: '09:00', end: '19:00' };
                                else delete nextHours[day];
                                setMyBarberWorkingHours(nextHours);
                              }}
                            />
                            {enabled && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="time"
                                  className="border border-slate-300 rounded-lg px-2 py-2 text-sm min-h-[40px]"
                                  value={wh.start}
                                  onChange={(e) => setMyBarberWorkingHours({ ...myBarberWorkingHours, [day]: { ...wh, start: e.target.value } })}
                                />
                                <span className="text-slate-400">–</span>
                                <input
                                  type="time"
                                  className="border border-slate-300 rounded-lg px-2 py-2 text-sm min-h-[40px]"
                                  value={wh.end}
                                  onChange={(e) => setMyBarberWorkingHours({ ...myBarberWorkingHours, [day]: { ...wh, end: e.target.value } })}
                                />
                              </div>
                            )}
                            {!enabled && <span className="text-xs text-slate-400">Descanso</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Hora de comida</h4>
                    <p className="text-xs text-slate-500 mb-3">Opcional. En esa franja no aparecerán citas.</p>
                    <div className="space-y-2">
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                        const lb = myBarberLunchBreak[day] ?? null;
                        const hasLunch = lb != null && (lb.start || lb.end);
                        const works = myBarberWorkingHours[day] != null;
                        if (!works) return null;
                        return (
                          <div key={day} className="flex items-center gap-2 flex-wrap rounded-xl border border-slate-100 px-3 py-2">
                            <span className="w-24 text-sm font-medium text-slate-600">{DAY_NAMES[day]}</span>
                            <input
                              type="time"
                              className="border rounded-lg px-2 py-2 text-sm min-h-[40px]"
                              value={lb?.start ?? ''}
                              onChange={(e) => {
                                const start = e.target.value;
                                const end = lb?.end ?? (start || '14:00');
                                setMyBarberLunchBreak((prev) => ({ ...prev, [day]: { start: start || '13:00', end } }));
                              }}
                            />
                            <span className="text-slate-400">–</span>
                            <input
                              type="time"
                              className="border rounded-lg px-2 py-2 text-sm min-h-[40px]"
                              value={lb?.end ?? ''}
                              onChange={(e) => {
                                const end = e.target.value;
                                const start = lb?.start ?? '13:00';
                                setMyBarberLunchBreak((prev) => ({ ...prev, [day]: { start, end: end || '14:00' } }));
                              }}
                            />
                            {hasLunch && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = { ...myBarberLunchBreak };
                                  delete next[day];
                                  setMyBarberLunchBreak(next);
                                }}
                                className="text-xs font-medium text-red-500 hover:text-red-700"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      setSavingHours(true);
                      try {
                        await DataService.updateBarberWorkingHours(myBarberId, myBarberWorkingHours);
                        await DataService.updateBarberLunchBreak(myBarberId, myBarberLunchBreak);
                        const updated = await DataService.getBarbers();
                        setBarbers(updated);
                        const me = updated.find((b: Barber) => b.id === myBarberId);
                        if (me?.workingHours) setMyBarberWorkingHours(me.workingHours);
                        if (me?.lunchBreak) setMyBarberLunchBreak(me.lunchBreak);
                        showFeedback('success', 'Horario y comida guardados. Ya aplica para nuevas citas.');
                      } catch (err) {
                        showFeedback('error', err instanceof Error ? err.message : 'Error al guardar.');
                      } finally {
                        setSavingHours(false);
                      }
                    }}
                    disabled={savingHours}
                    className="inline-flex min-h-[44px] items-center px-5 py-2.5 bg-[#ffd427] text-slate-900 font-bold rounded-xl hover:bg-[#e6be23] disabled:opacity-50 text-sm"
                  >
                    {savingHours ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                    {savingHours ? 'Guardando…' : 'Guardar horario'}
                  </button>

                  <div className="border-t border-slate-100 pt-6">
                    <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                      <CalendarOff size={18} /> Bloquear horas
                    </h4>
                    <p className="text-xs text-slate-500 mb-3">Salidas o citas personales. Esos huecos no se ofrecen a los clientes.</p>
                    <ul className="space-y-2 mb-3">
                      {(myBarberBlockedHours ?? [])
                        .slice()
                        .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
                        .map((bl, i) => (
                          <li key={`${bl.date}-${bl.start}-${bl.end}-${i}`} className="flex items-center justify-between gap-2 py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-sm text-slate-700">
                              <strong>{bl.date}</strong> {bl.start} – {bl.end}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setMyBarberBlockedHours((prev) =>
                                  (prev ?? []).filter((x) => !(x.date === bl.date && x.start === bl.start && x.end === bl.end)),
                                )
                              }
                              className="touch-target text-red-500 hover:text-red-700"
                              title="Quitar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </li>
                        ))}
                      {(!myBarberBlockedHours || myBarberBlockedHours.length === 0) && (
                        <li className="text-sm text-slate-400 italic py-2">Sin bloqueos. Agrega uno si no vas a atender un rato.</li>
                      )}
                    </ul>
                    {showAddBlock && (
                      <div className="flex flex-wrap items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-3">
                        <input
                          type="date"
                          className="border rounded-lg px-2 py-2 text-sm min-h-[40px]"
                          value={newBlock.date}
                          onChange={(e) => setNewBlock((b) => ({ ...b, date: e.target.value }))}
                          min={new Date().toISOString().split('T')[0]}
                        />
                        <input type="time" className="border rounded-lg px-2 py-2 text-sm w-28 min-h-[40px]" value={newBlock.start} onChange={(e) => setNewBlock((b) => ({ ...b, start: e.target.value }))} />
                        <span className="text-slate-500">–</span>
                        <input type="time" className="border rounded-lg px-2 py-2 text-sm w-28 min-h-[40px]" value={newBlock.end} onChange={(e) => setNewBlock((b) => ({ ...b, end: e.target.value }))} />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newBlock.date || newBlock.start >= newBlock.end) {
                              showFeedback('error', 'Fecha obligatoria y la hora fin debe ser mayor que la de inicio.');
                              return;
                            }
                            setMyBarberBlockedHours((prev) => [...(prev ?? []), { ...newBlock }]);
                            setNewBlock({ date: '', start: '10:00', end: '11:00' });
                            setShowAddBlock(false);
                          }}
                          className="min-h-[40px] px-3 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-semibold"
                        >
                          Agregar
                        </button>
                        <button type="button" onClick={() => setShowAddBlock(false)} className="min-h-[40px] px-3 py-1.5 border border-slate-300 rounded-lg text-sm">
                          Cancelar
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {!showAddBlock && (
                        <button type="button" onClick={() => setShowAddBlock(true)} className="min-h-[44px] px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
                          + Agregar bloqueo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          setSavingBlocked(true);
                          try {
                            await DataService.updateBarberBlockedHours(myBarberId, myBarberBlockedHours ?? []);
                            const updated = await DataService.getBarbers();
                            setBarbers(updated);
                            const me = updated.find((b: Barber) => b.id === myBarberId);
                            setMyBarberBlockedHours(me?.blockedHours ?? []);
                            showFeedback('success', 'Bloqueos guardados.');
                          } catch (err) {
                            showFeedback('error', err instanceof Error ? err.message : 'Error al guardar.');
                          } finally {
                            setSavingBlocked(false);
                          }
                        }}
                        disabled={savingBlocked}
                        className="min-h-[44px] px-4 py-2 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-900 disabled:opacity-50 text-sm"
                      >
                        {savingBlocked ? 'Guardando…' : 'Guardar bloqueos'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'galeria' && isBarber && (
            <div className="space-y-4">
              {myBarberId == null ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                  <strong>Perfil incompleto.</strong> Necesitas un barbero asignado para publicar fotos de tus trabajos.
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <ImagePlus size={20} /> Galería de trabajos
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">Los clientes las ven al elegirte para una cita. Usa fotos claras, de frente.</p>
                  </div>
                  {galleryPhotos.length === 0 ? (
                    <EmptyState
                      icon={<ImagePlus size={28} />}
                      title="Todavía no hay fotos"
                      description="Sube un corte reciente. Una buena galería ayuda a que te elijan."
                    />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {galleryPhotos.map((p) => (
                        <div key={p.id} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                          <img src={p.imageUrl} alt={p.caption || 'Trabajo'} className="w-full h-full object-cover" />
                          {p.caption && <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 truncate">{p.caption}</p>}
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm('¿Eliminar esta foto?')) {
                                await DataService.deleteBarberGalleryPhoto(myBarberId, p.id);
                                setGalleryPhotos((prev) => prev.filter((x) => x.id !== p.id));
                              }
                            }}
                            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            title="Eliminar"
                            aria-label="Eliminar foto"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-700">Agregar foto</p>
                    <input
                      type="text"
                      className={INPUT_CLASS}
                      placeholder="Descripción corta (opcional)"
                      value={galleryCaption}
                      onChange={(e) => setGalleryCaption(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer min-h-[44px] px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-xl hover:bg-[#e6be23] text-sm inline-flex items-center gap-1.5">
                        <ImagePlus size={16} /> {galleryUploading ? 'Subiendo…' : 'Elegir imagen'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={galleryUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !file.type.startsWith('image/')) return;
                            setGalleryUploading(true);
                            const compressToDataUrl = (): Promise<string> =>
                              new Promise((resolve, reject) => {
                                const img = new Image();
                                const objectUrl = URL.createObjectURL(file);
                                img.onload = () => {
                                  URL.revokeObjectURL(objectUrl);
                                  const max = 500;
                                  let w = img.width,
                                    h = img.height;
                                  if (w > max || h > max) {
                                    if (w > h) {
                                      h = Math.round((h * max) / w);
                                      w = max;
                                    } else {
                                      w = Math.round((w * max) / h);
                                      h = max;
                                    }
                                  }
                                  const canvas = document.createElement('canvas');
                                  canvas.width = w;
                                  canvas.height = h;
                                  const ctx = canvas.getContext('2d');
                                  if (!ctx) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result as string);
                                    reader.readAsDataURL(file);
                                    return;
                                  }
                                  ctx.drawImage(img, 0, 0, w, h);
                                  resolve(canvas.toDataURL('image/jpeg', 0.75));
                                };
                                img.onerror = () => {
                                  URL.revokeObjectURL(objectUrl);
                                  reject(new Error('No se pudo leer la imagen.'));
                                };
                                img.src = objectUrl;
                              });
                            try {
                              const dataUrl = await compressToDataUrl();
                              const photo = await DataService.addBarberGalleryPhoto(myBarberId, { imageUrl: dataUrl, caption: galleryCaption || undefined });
                              setGalleryPhotos((prev) => [photo, ...prev]);
                              setGalleryCaption('');
                              e.target.value = '';
                              showFeedback('success', 'Foto publicada.');
                            } catch (err) {
                              showFeedback('error', err instanceof Error ? err.message : 'Error al subir.');
                            } finally {
                              setGalleryUploading(false);
                            }
                          }}
                        />
                      </label>
                      <span className="text-slate-400 text-sm">o</span>
                      <input
                        type="url"
                        className={`${INPUT_CLASS} max-w-xs`}
                        placeholder="Pega URL de imagen"
                        value={galleryUrl}
                        onChange={(e) => setGalleryUrl(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={galleryUploading || !galleryUrl.trim()}
                        onClick={async () => {
                          if (!galleryUrl.trim()) return;
                          setGalleryUploading(true);
                          try {
                            const photo = await DataService.addBarberGalleryPhoto(myBarberId, { imageUrl: galleryUrl.trim(), caption: galleryCaption || undefined });
                            setGalleryPhotos((prev) => [photo, ...prev]);
                            setGalleryCaption('');
                            setGalleryUrl('');
                            showFeedback('success', 'Foto agregada.');
                          } catch (err) {
                            showFeedback('error', err instanceof Error ? err.message : 'Error al agregar.');
                          } finally {
                            setGalleryUploading(false);
                          }
                        }}
                        className="min-h-[44px] px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                      >
                        Agregar URL
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-4">
              {isBarber && myBarberId == null && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                  <strong>Perfil incompleto.</strong> Tu usuario no tiene un barbero asignado. Pide al administrador que te asigne. Hasta entonces no podrás agregar tus propios servicios.
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{isBarber ? 'Tus cortes y precios' : 'Catálogo de servicios'}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {isBarber ? 'Nombre, precio y duración. Puedes cambiarlos cuando quieras.' : 'Servicios de la sede y de cada barbero.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openServiceModal()}
                  className="inline-flex min-h-[44px] items-center justify-center bg-[#ffd427] text-slate-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#e6be23] whitespace-nowrap"
                >
                  <Plus size={16} className="mr-1" /> {isBarber ? 'Agregar servicio' : 'Nuevo servicio'}
                </button>
              </div>
              {services.length === 0 ? (
                <EmptyState
                  icon={<Scissors size={28} />}
                  title="Sin servicios"
                  description={isBarber ? 'Agrega tu primer corte para que los clientes puedan agendar contigo.' : 'Crea el catálogo de la sede: corte, barba, combos…'}
                  action={
                    <button type="button" onClick={() => openServiceModal()} className="text-sm font-semibold text-slate-800 underline">
                      Crear servicio
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {services.map((s) => (
                      <div key={s.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800">{s.name}</p>
                            <p className="text-sm text-slate-500">{s.duration} min</p>
                            {!isBarber && (
                              <p className="text-xs text-slate-400 mt-1">
                                {s.barberId == null ? 'Toda la sede' : barbers.find((b) => b.id === s.barberId)?.name ?? `Barbero #${s.barberId}`}
                              </p>
                            )}
                          </div>
                          <p className="font-bold text-slate-900">
                            {settings.currencySymbol || '$'}
                            {s.price.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button type="button" onClick={() => openServiceModal(s)} className="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-sm font-medium inline-flex items-center justify-center gap-1.5">
                            <Edit2 size={16} /> Editar
                          </button>
                          <button type="button" onClick={() => handleDeleteService(s.id)} className="min-h-[44px] min-w-[44px] rounded-xl border border-red-100 text-red-600 inline-flex items-center justify-center" aria-label="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto table-wrapper">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
                          <th className="py-3 font-semibold">Servicio</th>
                          <th className="py-3 font-semibold">Duración</th>
                          <th className="py-3 font-semibold">Precio</th>
                          {!isBarber && <th className="py-3 font-semibold">Tipo</th>}
                          <th className="py-3 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((s) => (
                          <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                            <td className="py-3 font-medium text-slate-700">{s.name}</td>
                            <td className="py-3 text-slate-600">{s.duration} min</td>
                            <td className="py-3 font-bold text-slate-800">
                              {settings.currencySymbol || '$'}
                              {s.price.toFixed(2)}
                            </td>
                            {!isBarber && (
                              <td className="py-3 text-slate-600">
                                {s.barberId == null ? 'Sede (todos)' : barbers.find((b) => b.id === s.barberId)?.name ?? `Barbero #${s.barberId}`}
                              </td>
                            )}
                            <td className="py-3 text-right">
                              <button type="button" onClick={() => openServiceModal(s)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg">
                                <Edit2 size={18} />
                              </button>
                              <button type="button" onClick={() => handleDeleteService(s.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                                <Trash2 size={18} />
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
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Privacidad y términos</h3>
                <p className="text-sm text-slate-500 mt-0.5">Documentos oficiales de BarberShow. Ábrelos cuando un cliente o el equipo los pida.</p>
              </div>
              <button
                type="button"
                onClick={() => navigateToLegal('privacidad')}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Shield size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">Política de privacidad</p>
                  <p className="text-sm text-slate-500">Cómo se usan los datos de clientes y del equipo.</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => navigateToLegal('terminos')}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <FileText size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">Términos y condiciones</p>
                  <p className="text-sm text-slate-500">Uso de la plataforma, planes y responsabilidades.</p>
                </div>
              </button>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Languages size={20} /> Idioma y cuenta
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">Cambia el idioma de la app o gestiona tu cuenta.</p>
              </div>
              <LanguageSwitcher />
              <div>
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">{t('settings.accountTitle')}</h3>
                <p className="mt-2 text-sm text-slate-600">{t('settings.accountDescription')}</p>
              </div>
              <DeactivateAccountSection onDeactivated={onAccountDeactivated} />
            </div>
          )}

          {activeTab === 'planes' && !isNativeApp && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Planes disponibles</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Tu plan actual:{' '}
                  <strong className="text-slate-800">{currentPlanLabel}</strong>
                </p>
              </div>
              {GLOBAL_FREE_MODE && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  Promoción activa: las barberías nuevas reciben el <strong>Plan Barbería</strong> incluido sin costo.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {PLANES_INFO.map((plan) => {
                  const isCurrent = accountTier === plan.value;
                  return (
                    <div
                      key={plan.value}
                      className={`rounded-2xl border-2 p-5 flex flex-col ${isCurrent ? 'border-[#ffd427] bg-amber-50/60 shadow-sm' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="font-bold text-slate-800">{plan.label}</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900">{plan.price === 0 ? 'Gratis' : `$${plan.price.toFixed(2)}`}</div>
                      {plan.price > 0 && <div className="text-xs text-slate-500">al mes · anual −40%: ${(plan.price * 0.6 * 12).toFixed(2)}/año</div>}
                      <p className="mt-3 text-sm text-slate-600 flex-1">{plan.description}</p>
                      {isCurrent && (
                        <span className="inline-block mt-4 text-xs font-bold text-slate-800 bg-[#ffd427] px-2.5 py-1 rounded-full self-start">Tu plan</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showUserModal && (
        <ModalShell title={isEditingUser ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setShowUserModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre de usuario (login)</label>
              <input type="text" className={INPUT_CLASS} value={currentUser.username} onChange={(e) => setCurrentUser({ ...currentUser, username: e.target.value })} disabled={isEditingUser} autoComplete="username" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nombre completo</label>
              <input type="text" className={INPUT_CLASS} value={currentUser.name} onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña</label>
              <input
                type="password"
                className={INPUT_CLASS}
                value={currentUser.password}
                onChange={(e) => setCurrentUser({ ...currentUser, password: e.target.value })}
                placeholder={isEditingUser ? 'Dejar en blanco para no cambiar' : 'Contraseña inicial'}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rol</label>
              <select className={INPUT_CLASS} value={currentUser.role || ''} onChange={(e) => setCurrentUser({ ...currentUser, role: (e.target.value || 'barbero') as UserRole })}>
                <option value="admin">Administrador</option>
                <option value="dueno">Dueño</option>
                <option value="barbero">Barbero</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowUserModal(false)} className="min-h-[44px] px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveUser} className="min-h-[44px] px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-xl hover:bg-[#e6be23]">
                Guardar
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {showServiceModal && (
        <ModalShell title={currentService.id ? (isBarber ? 'Editar servicio y precio' : 'Editar servicio') : isBarber ? 'Nuevo servicio' : 'Nuevo servicio'} onClose={() => setShowServiceModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                type="text"
                className={INPUT_CLASS}
                value={currentService.name}
                onChange={(e) => setCurrentService({ ...currentService, name: e.target.value })}
                placeholder={isBarber ? 'Ej: Corte clásico, Fade, Barba' : undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{isBarber ? 'Precio que cobras' : 'Precio'}</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className={INPUT_CLASS}
                value={currentService.price === 0 ? '' : currentService.price}
                placeholder="0"
                onChange={(e) => {
                  const v = e.target.value;
                  setCurrentService({ ...currentService, price: v === '' ? 0 : Number(v) });
                }}
              />
              {isBarber && <p className="text-xs text-slate-500 mt-1">Puedes cambiarlo en cualquier momento.</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duración (minutos)</label>
              <input
                type="number"
                min={1}
                className={INPUT_CLASS}
                value={currentService.duration ?? ''}
                placeholder="30"
                onChange={(e) => setCurrentService({ ...currentService, duration: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowServiceModal(false)} className="min-h-[44px] px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveService} className="min-h-[44px] px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-xl hover:bg-[#e6be23]">
                Guardar
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {showBarberModal && (
        <ModalShell title={currentBarber.id ? 'Editar barbero' : 'Nuevo barbero'} onClose={() => setShowBarberModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre completo</label>
              <input type="text" className={INPUT_CLASS} value={currentBarber.name} onChange={(e) => setCurrentBarber({ ...currentBarber, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Especialidad</label>
              <input type="text" className={INPUT_CLASS} value={currentBarber.specialty} onChange={(e) => setCurrentBarber({ ...currentBarber, specialty: e.target.value })} placeholder="Ej: Cortes clásicos, Barba" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Años de experiencia</label>
              <input
                type="number"
                min={0}
                max={PROFILE_LIMITS.maxYearsExperience}
                className={INPUT_CLASS}
                value={currentBarber.yearsExperience ?? ''}
                placeholder="Ej: 8"
                onChange={(e) => {
                  const v = e.target.value;
                  setCurrentBarber({ ...currentBarber, yearsExperience: v === '' ? undefined : Number(v) });
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Presentación pública</label>
              <textarea
                className={`${INPUT_CLASS} min-h-[88px] resize-y`}
                value={currentBarber.bio || ''}
                maxLength={PROFILE_LIMITS.bio}
                placeholder="Estilo, enfoque y lo que el cliente debe saber."
                onChange={(e) => setCurrentBarber({ ...currentBarber, bio: e.target.value })}
              />
            </div>
            <CertificationsEditor
              value={sanitizeCertifications(currentBarber.certifications)}
              onChange={(certs) => setCurrentBarber({ ...currentBarber, certifications: certs })}
            />
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              <label htmlFor="barberActive" className="text-sm font-medium text-slate-700">
                Disponible para citas
              </label>
              <Toggle checked={!!currentBarber.active} onChange={(next) => setCurrentBarber({ ...currentBarber, active: next })} id="barberActive" />
            </div>
            <div className="border-t border-slate-200 pt-3 mt-3">
              <p className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Clock size={14} /> Horario de trabajo
              </p>
              <p className="text-xs text-slate-500 mb-2">Si no lo defines, se usa 09:00–19:00 todos los días.</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const wh = currentBarber.workingHours?.[day] ?? null;
                  const enabled = wh != null;
                  return (
                    <div key={day} className="flex items-center gap-2 flex-wrap">
                      <input
                        type="checkbox"
                        id={`wh-${day}`}
                        checked={enabled}
                        className="rounded text-[#ffd427] focus:ring-[#ffd427]"
                        onChange={(e) => {
                          const next = { ...(currentBarber.workingHours || {}) };
                          if (e.target.checked) next[day] = { start: '09:00', end: '19:00' };
                          else delete next[day];
                          setCurrentBarber({ ...currentBarber, workingHours: next });
                        }}
                      />
                      <label htmlFor={`wh-${day}`} className="w-8 text-sm font-medium text-slate-600">
                        {DAY_NAMES[day]}
                      </label>
                      {enabled && (
                        <>
                          <input
                            type="time"
                            className="border rounded px-2 py-1 text-sm w-24"
                            value={wh.start}
                            onChange={(e) => setCurrentBarber({ ...currentBarber, workingHours: { ...(currentBarber.workingHours || {}), [day]: { ...wh, start: e.target.value } } })}
                          />
                          <span className="text-slate-400">–</span>
                          <input
                            type="time"
                            className="border rounded px-2 py-1 text-sm w-24"
                            value={wh.end}
                            onChange={(e) => setCurrentBarber({ ...currentBarber, workingHours: { ...(currentBarber.workingHours || {}), [day]: { ...wh, end: e.target.value } } })}
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3 mt-3">
              <p className="text-sm font-medium text-slate-700 mb-1">Horario de comida</p>
              <p className="text-xs text-slate-500 mb-2">Opcional. Se guarda junto con el barbero.</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const lb = (currentBarber as Barber).lunchBreak?.[day] ?? null;
                  return (
                    <div key={day} className="flex items-center gap-2 flex-wrap">
                      <label className="w-8 text-sm font-medium text-slate-600">{DAY_NAMES[day]}</label>
                      <input
                        type="time"
                        className="border rounded px-2 py-1 text-sm w-24"
                        value={lb?.start ?? ''}
                        onChange={(e) => {
                          const start = e.target.value;
                          const end = lb?.end ?? '14:00';
                          setCurrentBarber({ ...currentBarber, lunchBreak: { ...((currentBarber as Barber).lunchBreak || {}), [day]: { start: start || '13:00', end } } });
                        }}
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        type="time"
                        className="border rounded px-2 py-1 text-sm w-24"
                        value={lb?.end ?? ''}
                        onChange={(e) => {
                          const end = e.target.value;
                          const start = lb?.start ?? '13:00';
                          setCurrentBarber({ ...currentBarber, lunchBreak: { ...((currentBarber as Barber).lunchBreak || {}), [day]: { start, end: end || '14:00' } } });
                        }}
                      />
                      {(lb?.start || lb?.end) && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...((currentBarber as Barber).lunchBreak || {}) };
                            delete next[day];
                            setCurrentBarber({ ...currentBarber, lunchBreak: next });
                          }}
                          className="text-slate-400 hover:text-red-500 text-xs"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {currentBarber.id != null && (
              <div className="border-t border-slate-200 pt-3 mt-3">
                <p className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <CalendarOff size={14} /> Horas bloqueadas
                </p>
                <p className="text-xs text-slate-500 mb-2">Rangos en que no atiende. Se guardan al guardar el barbero.</p>
                <ul className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
                  {((currentBarber as Barber).blockedHours ?? [])
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
                    .map((bl, i) => (
                      <li key={`${bl.date}-${bl.start}-${bl.end}-${i}`} className="flex items-center justify-between gap-2 py-1 px-2 bg-slate-50 rounded text-sm">
                        <span>
                          {bl.date} {bl.start} – {bl.end}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const list = ((currentBarber as Barber).blockedHours ?? []).filter(
                              (x) => !(x.date === bl.date && x.start === bl.start && x.end === bl.end),
                            );
                            setCurrentBarber({ ...currentBarber, blockedHours: list });
                          }}
                          className="text-red-500 hover:text-red-700 p-0.5"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" className="border rounded px-2 py-1 text-sm" id="modal-block-date" />
                  <input type="time" className="border rounded px-2 py-1 text-sm w-24" id="modal-block-start" defaultValue="10:00" />
                  <span className="text-slate-500">–</span>
                  <input type="time" className="border rounded px-2 py-1 text-sm w-24" id="modal-block-end" defaultValue="11:00" />
                  <button
                    type="button"
                    onClick={() => {
                      const date = (document.getElementById('modal-block-date') as HTMLInputElement)?.value;
                      const start = (document.getElementById('modal-block-start') as HTMLInputElement)?.value || '10:00';
                      const end = (document.getElementById('modal-block-end') as HTMLInputElement)?.value || '11:00';
                      if (!date || start >= end) {
                        showFeedback('error', 'Fecha obligatoria y la hora fin debe ser mayor que la de inicio.');
                        return;
                      }
                      const list = [...((currentBarber as Barber).blockedHours ?? []), { date, start, end }];
                      setCurrentBarber({ ...currentBarber, blockedHours: list });
                    }}
                    className="px-2 py-1 bg-slate-600 text-white rounded text-sm"
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowBarberModal(false)} className="min-h-[44px] px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveBarber} className="min-h-[44px] px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-xl hover:bg-[#e6be23]">
                Guardar
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

export default Settings;
