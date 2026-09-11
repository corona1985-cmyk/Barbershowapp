import React, { useState } from 'react';
import { Award, Plus, Trash2 } from 'lucide-react';
import type { ProfessionalCertification } from '../../types';
import { PROFILE_LIMITS, currentCertYearMax, newCertificationId } from '../../utils/professionalProfile';

const INPUT_CLASS =
  'w-full min-h-[44px] border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ffd427] focus:border-transparent';

interface CertificationsEditorProps {
  value: ProfessionalCertification[];
  onChange: (next: ProfessionalCertification[]) => void;
}

const CertificationsEditor: React.FC<CertificationsEditorProps> = ({ value, onChange }) => {
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [year, setYear] = useState('');
  const yearMax = currentCertYearMax();

  const addCert = () => {
    const trimmed = title.trim().slice(0, PROFILE_LIMITS.certTitle);
    if (!trimmed) return;
    if (value.length >= PROFILE_LIMITS.maxCerts) return;
    const cert: ProfessionalCertification = { id: newCertificationId(), title: trimmed };
    const inst = issuer.trim().slice(0, PROFILE_LIMITS.certIssuer);
    if (inst) cert.issuer = inst;
    const y = Number(year);
    if (Number.isFinite(y) && y >= PROFILE_LIMITS.minYear && y <= yearMax) cert.year = Math.round(y);
    onChange([...value, cert]);
    setTitle('');
    setIssuer('');
    setYear('');
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <Award size={16} className="text-[#b89400]" /> Cursos y certificaciones
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          Lo que el cliente verá como respaldo de tu nivel (cursos, diplomas, academias). Hasta {PROFILE_LIMITS.maxCerts}.
        </p>
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((cert) => (
            <li
              key={cert.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{cert.title}</p>
                <p className="text-xs text-slate-500 truncate">
                  {[cert.issuer, cert.year].filter(Boolean).join(' · ') || 'Sin institución'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c.id !== cert.id))}
                className="touch-target shrink-0 text-red-500 hover:bg-red-50 rounded-lg p-1.5"
                aria-label={`Quitar ${cert.title}`}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.length < PROFILE_LIMITS.maxCerts && (
        <div className="rounded-xl border border-dashed border-slate-300 p-3 space-y-2">
          <input
            type="text"
            className={INPUT_CLASS}
            value={title}
            maxLength={PROFILE_LIMITS.certTitle}
            placeholder="Ej: Colorimetría avanzada, Barbería clásica"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCert();
              }
            }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-2">
            <input
              type="text"
              className={INPUT_CLASS}
              value={issuer}
              maxLength={PROFILE_LIMITS.certIssuer}
              placeholder="Academia o instituto (opcional)"
              onChange={(e) => setIssuer(e.target.value)}
            />
            <input
              type="number"
              className={INPUT_CLASS}
              value={year}
              min={PROFILE_LIMITS.minYear}
              max={yearMax}
              placeholder="Año"
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={addCert}
            disabled={!title.trim()}
            className="inline-flex min-h-[40px] items-center text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl px-3"
          >
            <Plus size={16} className="mr-1" /> Agregar certificación
          </button>
        </div>
      )}
    </div>
  );
};

export default CertificationsEditor;
