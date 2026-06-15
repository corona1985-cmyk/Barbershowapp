import React, { useEffect, useState } from 'react';
import { ArrowLeft, Scissors, Mail } from 'lucide-react';
import { DataService } from '../services/data';
import { GlobalSettings } from '../types';
import { closeLegalDocument, LEGAL_TITLES, LegalDocumentType } from '../utils/legal';

interface LegalDocumentPageProps {
    type: LegalDocumentType;
}

const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({ type }) => {
    const [settings, setSettings] = useState<GlobalSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        DataService.getGlobalSettings()
            .then((data) => {
                if (!cancelled) setSettings(data);
            })
            .catch(() => {
                if (!cancelled) setError('No se pudo cargar el documento. Inténtalo de nuevo más tarde.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [type]);

    const title = LEGAL_TITLES[type];
    const content = type === 'terminos'
        ? settings?.termsAndConditions
        : settings?.privacyPolicy;
    const supportEmail = settings?.supportEmail ?? 'corona1985@iccdigitalgroup.com';

    return (
        <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white">
            <header className="sticky top-0 z-10 border-b border-slate-700/80 bg-slate-900/95 backdrop-blur-sm">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={closeLegalDocument}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Volver"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 bg-[#ffd427] rounded-full flex items-center justify-center flex-shrink-0">
                            <Scissors size={18} className="text-slate-900" />
                        </div>
                        <span className="font-bold text-[#ffd427] truncate">BarberShow</span>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{title}</h1>
                <p className="text-slate-400 text-sm mb-8">
                    Última actualización: documento editable desde el panel de administración de la plataforma.
                </p>

                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-[#ffd427] border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-6 text-red-200">
                        {error}
                    </div>
                )}

                {!loading && !error && content && (
                    <article className="prose prose-invert max-w-none">
                        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6 sm:p-8 text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                            {content}
                        </div>
                    </article>
                )}

                <footer className="mt-10 pt-6 border-t border-slate-700/80">
                    <p className="text-slate-400 text-sm flex flex-wrap items-center gap-2">
                        <Mail size={16} className="text-[#ffd427]" />
                        ¿Tienes dudas? Escríbenos a{' '}
                        <a href={`mailto:${supportEmail}`} className="text-[#ffd427] hover:underline">
                            {supportEmail}
                        </a>
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default LegalDocumentPage;
