import React from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { isNativePaymentAvailable } from '../../services/playBilling';
import { isIOSPlatform } from '../../utils/platform';

interface SubscriptionExpiredViewProps {
    title: string;
    message: string;
    renewLabel: string;
    restoreLabel: string;
    logoutLabel: string;
    processingLabel: string;
    renewalError: string;
    renewalLoading: boolean;
    onRenew: () => void;
    onRestore: () => void;
    onLogout: () => void;
}

export const SubscriptionExpiredView: React.FC<SubscriptionExpiredViewProps> = ({
    title,
    message,
    renewLabel,
    restoreLabel,
    logoutLabel,
    processingLabel,
    renewalError,
    renewalLoading,
    onRenew,
    onRestore,
    onLogout,
}) => (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-6 text-white">
        <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
                <Shield size={32} className="text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-slate-300">{message}</p>
            {renewalError && (
                <p className="text-sm text-red-300 bg-red-900/30 rounded-lg px-3 py-2">{renewalError}</p>
            )}
            <div className="flex flex-col gap-3 justify-center">
                <button
                    type="button"
                    onClick={onRenew}
                    disabled={renewalLoading}
                    className="px-6 py-3 bg-[#ffd427] text-slate-900 font-semibold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                    {renewalLoading ? <><Loader2 size={18} className="animate-spin" /> {processingLabel}</> : renewLabel}
                </button>
                {isNativePaymentAvailable() && isIOSPlatform() && (
                    <button
                        type="button"
                        onClick={onRestore}
                        disabled={renewalLoading}
                        className="px-6 py-3 border border-slate-500 text-slate-300 rounded-xl hover:bg-slate-700/50 transition-colors disabled:opacity-60"
                    >
                        {restoreLabel}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onLogout}
                    className="px-6 py-3 border border-slate-500 text-slate-300 rounded-xl hover:bg-slate-700/50 transition-colors"
                >
                    {logoutLabel}
                </button>
            </div>
        </div>
    </div>
);
