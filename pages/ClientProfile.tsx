import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Client } from '../types';
import { User, Upload, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { ViewState } from '../types';

interface ClientProfileProps {
  onChangeView: (view: ViewState) => void;
  onProfileUpdated?: () => void;
}

const ClientProfile: React.FC<ClientProfileProps> = ({ onChangeView, onProfileUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const user = DataService.getCurrentUser();
      if (!user) {
        setError('No hay sesión iniciada.');
        setLoading(false);
        return;
      }
      if (user.role !== 'cliente') {
        setClient(null);
        const fromDb = await DataService.getCurrentUserFromFirebase();
        setNombre(fromDb?.name ?? user.name ?? '');
        setTelefono('');
        setPhotoUrl(fromDb?.photoUrl ?? '');
        setLoading(false);
        return;
      }
      let c: Client | null = null;
      if (user.clientId != null) {
        c = await DataService.getClientById(user.clientId);
      }
      if (!c) {
        c = await DataService.ensureClientProfileForCurrentUser();
      }
      setClient(c);
      setNombre(c.nombre || '');
      setTelefono(String(c.telefono ?? ''));
      setPhotoUrl(c.photoUrl || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 400;
      let w = img.width;
      let h = img.height;
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
        reader.onloadend = () => setPhotoUrl(reader.result as string);
        reader.readAsDataURL(file);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setPhotoUrl(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoUrl(reader.result as string);
      reader.readAsDataURL(file);
    };
    img.src = url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      if (client) {
        await DataService.updateClientProfileForCurrentUser({
          nombre: nombre.trim() || undefined,
          telefono: telefono.trim() || undefined,
          photoUrl: photoUrl.trim() || null,
        });
        setClient({ ...client, nombre: nombre.trim(), telefono: telefono.trim(), photoUrl: photoUrl.trim() || undefined });
      } else {
        await DataService.updateCurrentUserProfile({
          name: nombre.trim() || undefined,
          photoUrl: photoUrl.trim() || null,
        });
      }
      setSuccess(true);
      onProfileUpdated?.();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 size={32} className="animate-spin text-[#ffd427]" />
        <p className="text-slate-600">Cargando tu perfil...</p>
      </div>
    );
  }

  if (error && !client && nombre === '') {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-center">{error}</div>
        <button type="button" onClick={() => onChangeView('dashboard')} className="mt-4 flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft size={18} /> Volver
        </button>
      </div>
    );
  }

  const isCliente = client !== null;

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <button
        type="button"
        onClick={() => onChangeView(isCliente ? 'appointments' : 'dashboard')}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
      >
        <ArrowLeft size={18} /> Volver
      </button>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-8 text-center">
          <h1 className="text-xl font-bold text-white">Mi perfil</h1>
          <p className="text-slate-300 text-sm mt-1">Edita tu nombre, teléfono y foto</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm flex items-center gap-2">
              <CheckCircle size={18} /> Perfil guardado correctamente.
            </div>
          )}

          {!isCliente && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-600 text-sm mb-2">
              <p className="font-medium text-slate-700">Cuenta de administrador</p>
              <p className="mt-1">Usuario: <strong>{DataService.getCurrentUser()?.username}</strong></p>
            </div>
          )}

          {/* Foto de perfil (todos) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Foto de perfil</label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-slate-200 shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Tu foto" className="w-full h-full object-cover" />
                  ) : (
                    <User size={40} className="text-slate-400" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 bg-[#ffd427] text-slate-900 p-2 rounded-full cursor-pointer hover:bg-[#e6be23] shadow-md">
                  <Upload size={16} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>
              <div className="flex-1 w-full">
                <input
                  type="url"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427] text-sm"
                  placeholder="O pega una URL de imagen..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">Sube una imagen o pega un enlace.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input
              type="text"
              required={isCliente}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          {isCliente && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (WhatsApp)</label>
              <input
                type="tel"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej. 8095551234"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#ffd427] text-slate-900 py-3 rounded-lg font-bold hover:bg-[#e6be23] transition-colors shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={20} className="animate-spin" /> Guardando...</> : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ClientProfile;
