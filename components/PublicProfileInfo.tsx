import React from 'react';
import { Award, BadgeCheck, Sparkles } from 'lucide-react';
import type { ProfessionalCertification } from '../types';
import { useTranslation } from '../i18n';

interface PublicProfileInfoProps {
  title?: string;
  bio?: string | null;
  specialty?: string | null;
  yearsExperience?: number | null;
  highlights?: string[] | null;
  certifications?: ProfessionalCertification[] | null;
}

export function hasPublicProfileInfo(props: Omit<PublicProfileInfoProps, 'title'>): boolean {
  const specialty = props.specialty?.trim() || '';
  const genericSpecialty = ['barbero', 'barber', 'peluquero'].includes(specialty.toLowerCase());
  return Boolean(
    (props.bio && props.bio.trim()) ||
      (specialty && !genericSpecialty) ||
      (props.yearsExperience && props.yearsExperience > 0) ||
      (props.highlights && props.highlights.length > 0) ||
      (props.certifications && props.certifications.length > 0)
  );
}

const PublicProfileInfo: React.FC<PublicProfileInfoProps> = ({
  title,
  bio,
  specialty,
  yearsExperience,
  highlights,
  certifications,
}) => {
  const { t } = useTranslation();
  if (!hasPublicProfileInfo({ bio, specialty, yearsExperience, highlights, certifications })) return null;

  const certs = certifications ?? [];
  const chips = highlights ?? [];

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
      {title && <h3 className="text-sm font-bold text-slate-800">{title}</h3>}
      <div className="flex flex-wrap gap-2">
        {specialty?.trim() && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ffd427]/20 text-amber-900 text-xs font-semibold">
            <Sparkles size={12} /> {specialty.trim()}
          </span>
        )}
        {yearsExperience != null && yearsExperience > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
            <BadgeCheck size={12} /> {t('profile.yearsExperience', { count: yearsExperience })}
          </span>
        )}
        {chips.map((h) => (
          <span key={h} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium">
            {h}
          </span>
        ))}
      </div>
      {bio?.trim() && <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{bio.trim()}</p>}
      {certs.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
            <Award size={12} /> {t('profile.certifications')}
          </p>
          <ul className="space-y-1">
            {certs.map((c) => (
              <li key={c.id} className="text-sm text-slate-700">
                <span className="font-medium">{c.title}</span>
                {(c.issuer || c.year) && (
                  <span className="text-slate-500"> · {[c.issuer, c.year].filter(Boolean).join(' · ')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default PublicProfileInfo;
