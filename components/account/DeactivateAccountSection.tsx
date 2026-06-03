import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import DeactivateAccountModal from './DeactivateAccountModal';
import { DataService } from '../../services/data';

interface DeactivateAccountSectionProps {
  onDeactivated?: () => void;
  compact?: boolean;
}

const CRITICAL_ROLES = new Set(['platform_owner', 'superadmin']);

const DeactivateAccountSection: React.FC<DeactivateAccountSectionProps> = ({ onDeactivated, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentUser = DataService.getCurrentUser();
  const role = DataService.getCurrentUserRole();
  const canDeactivate = Boolean(currentUser?.username) && !CRITICAL_ROLES.has(role);

  if (!currentUser?.username) return null;

  return (
    <>
      <div className={`rounded-3xl border ${compact ? 'border-slate-200' : 'border-red-200'} bg-white p-5 shadow-sm`}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <ShieldAlert size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900">Eliminar cuenta</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Puedes eliminar tu cuenta desde aquí. Se conservarán los datos administrativos y el historial relacionado con citas o pagos.
            </p>

            {!canDeactivate && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>Esta cuenta no puede eliminarse desde la app.</span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                disabled={!canDeactivate}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>Eliminar cuenta</span>
              </button>
              <p className="text-xs text-slate-500">
                {currentUser.username}
              </p>
            </div>
          </div>
        </div>
      </div>

      <DeactivateAccountModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          setIsOpen(false);
          onDeactivated?.();
        }}
      />
    </>
  );
};

export default DeactivateAccountSection;
