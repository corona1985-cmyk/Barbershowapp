import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Loader2, ShieldAlert, X } from 'lucide-react';
import { DEACTIVATION_REASON_OPTIONS, DeactivateAccountPayload } from '../../services/accountDeactivation';
import { DeactivationReason } from '../../types';
import { useDeactivateAccount } from '../../hooks/useDeactivateAccount';

interface DeactivateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WizardStep = 1 | 2;

const modalBackdrop = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4';

const DeactivateAccountModal: React.FC<DeactivateAccountModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [reason, setReason] = useState<DeactivationReason | ''>('');
  const [customReason, setCustomReason] = useState('');
  const [improvementFeedback, setImprovementFeedback] = useState('');
  const [password, setPassword] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [localNotice, setLocalNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const { loading, error, success, reset, deactivateAccount } = useDeactivateAccount();

  const selectedReasonLabel = useMemo(
    () => DEACTIVATION_REASON_OPTIONS.find((item) => item.value === reason)?.label ?? '',
    [reason]
  );

  const canContinue = Boolean(reason) && !(reason === 'other' && !customReason.trim());
  const canConfirm = canContinue && acknowledged && password.trim().length > 0 && !loading;

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setReason('');
    setCustomReason('');
    setImprovementFeedback('');
    setPassword('');
    setAcknowledged(false);
    setLocalNotice(null);
    reset();
  }, [isOpen, reset]);

  useEffect(() => {
    if (!error) return;
    setLocalNotice({ type: 'error', text: error });
  }, [error]);

  useEffect(() => {
    if (!success) return;
    setLocalNotice({ type: 'success', text: 'Tu cuenta ha sido eliminada permanentemente.' });
  }, [success]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!reason) return;
    if (reason === 'other' && !customReason.trim()) return;
    const payload: DeactivateAccountPayload = {
      password,
      reason,
      customReason,
      improvementFeedback,
    };
    const ok = await deactivateAccount(payload);
    if (ok) {
      onSuccess?.();
      onClose();
    }
  };

  return (
    <div className={modalBackdrop} onMouseDown={() => { if (!loading) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-account-title"
        className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 id="deactivate-account-title" className="text-lg font-bold text-slate-900">
                ¿Eliminar tu cuenta permanentemente?
              </h2>
              <p className="text-sm text-slate-500">
                {step === 1
                  ? 'Cuéntanos por qué deseas salir. Tu opinión nos ayuda a mejorar.'
                  : 'Revisa los detalles y confirma con tu contraseña para continuar.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-5 sm:px-6">
          {localNotice && (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
                localNotice.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {localNotice.text}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <p className="mb-3 text-sm font-semibold text-slate-800">¿Cuál es el motivo principal?</p>
                <div className="space-y-2">
                  {DEACTIVATION_REASON_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                        reason === option.value ? 'border-[#ffd427] bg-amber-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        className="h-4 w-4 accent-[#ffd427]"
                        checked={reason === option.value}
                        onChange={() => setReason(option.value)}
                        name="deactivationReason"
                      />
                      <span className="text-sm font-medium text-slate-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {reason === 'other' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Cuéntanos más</label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#ffd427] focus:ring-2 focus:ring-[#ffd427]/30"
                    placeholder="Ayúdanos a entender qué pasó..."
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">¿Qué podríamos mejorar?</label>
                <textarea
                  value={improvementFeedback}
                  onChange={(e) => setImprovementFeedback(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#ffd427] focus:ring-2 focus:ring-[#ffd427]/30"
                  placeholder="Opcional"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canContinue}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continuar
                  <ArrowLeft size={16} className="rotate-180" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                <div className="mb-3 flex items-center gap-2 text-slate-900">
                  <AlertTriangle size={18} className="text-red-500" />
                  <span className="font-semibold">Lamentamos verte ir. Tu opinión nos ayuda a mejorar.</span>
                </div>
                <p className="leading-6">
                  Motivo seleccionado: <strong>{selectedReasonLabel || 'No seleccionado'}</strong>
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Confirma tu contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#ffd427] focus:ring-2 focus:ring-[#ffd427]/30"
                  placeholder="Contraseña actual"
                  autoComplete="current-password"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-red-600"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span className="text-sm text-slate-700">Entiendo que se eliminarán mis datos de acceso de forma permanente e irreversible.</span>
              </label>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <ArrowLeft size={16} />
                  Volver
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canConfirm}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Confirmar eliminación permanente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeactivateAccountModal;
