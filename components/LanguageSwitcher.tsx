import React, { useEffect, useRef, useState } from 'react';
import { Languages } from 'lucide-react';
import { LOCALE_LABELS, SUPPORTED_LOCALES, type AppLocale } from '../config/i18n';
import { useTranslation } from '../i18n';

interface LanguageSwitcherProps {
  /** Barra fija para invitados (esquina inferior derecha). */
  floating?: boolean;
  className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ floating = false, className = '' }) => {
  const { locale, setLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const pick = (code: AppLocale) => {
    setLocale(code);
    setOpen(false);
  };

  if (floating) {
    return (
      <div
        ref={rootRef}
        className={`fixed bottom-4 right-4 z-[200] safe-area-bottom ${className}`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/85 px-3 py-2.5 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-slate-800/95"
          aria-label={t('language.title')}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Languages size={18} className="text-[#ffd427]" />
          <span className="text-xs font-bold uppercase tracking-wide">{locale}</span>
        </button>
        {open && (
          <div
            role="listbox"
            aria-label={t('language.title')}
            className="absolute bottom-full right-0 mb-2 min-w-[140px] overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 py-1 shadow-xl backdrop-blur-md"
          >
            {SUPPORTED_LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={locale === code}
                onClick={() => pick(code as AppLocale)}
                className={`block w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                  locale === code
                    ? 'bg-[#ffd427] text-slate-900'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                {LOCALE_LABELS[code]}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ffd427]/20 text-[#b89400]">
          <Languages size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-slate-800">{t('language.title')}</h4>
          <p className="mt-1 text-sm text-slate-600">{t('language.description')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUPPORTED_LOCALES.map((code) => {
              const active = locale === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => pick(code as AppLocale)}
                  className={`min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-[#ffd427] text-slate-900 shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  aria-pressed={active}
                >
                  {LOCALE_LABELS[code]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
