'use client';

import Link from 'next/link';
import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import { getCandidateAvailabilityView } from '@/lib/seveno-candidate-availability';
import { formatDesiredContractTypeLabels } from '@/lib/seveno-desired-contract-types';
import type { CandidateAvailability, CandidateExperienceLevel, VisibleCandidateProfile } from '@/types/seveno';

const EXPERIENCE_LABELS: Record<CandidateExperienceLevel, string> = {
  beginner: 'Debutant',
  intermediate: 'Intermediaire',
  confirmed: 'Confirme',
  senior: 'Senior',
  expert: 'Expert',
};

const AVAILABILITY_LABELS: Record<CandidateAvailability, string> = {
  immediate: 'Immediatement',
  less_than_1_month: 'Moins d un mois',
  one_to_three_months: 'Sous 1 a 3 mois',
  listening: 'En ecoute',
  not_available: 'Non disponible',
};

const CARD_VARIANTS = [
  {
    card:
      'border-cyan-400/15 bg-[linear-gradient(180deg,rgba(9,17,32,0.96),rgba(8,15,28,0.92))] shadow-[0_20px_60px_rgba(2,6,23,0.22)] transition-all duration-300 ease-out transform-gpu hover:-translate-y-0.5 hover:border-cyan-300/25 hover:shadow-[0_28px_80px_rgba(34,211,238,0.08),0_24px_80px_rgba(2,6,23,0.42)]',
    score:
      'border-cyan-300/25 bg-cyan-400/10 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_0_24px_rgba(34,211,238,0.12)]',
    badge: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
    line: 'bg-gradient-to-r from-cyan-300 via-blue-300/70 to-transparent',
  },
  {
    card:
      'border-violet-400/15 bg-[linear-gradient(180deg,rgba(13,14,34,0.96),rgba(8,15,28,0.92))] shadow-[0_20px_60px_rgba(2,6,23,0.22)] transition-all duration-300 ease-out transform-gpu hover:-translate-y-0.5 hover:border-violet-300/25 hover:shadow-[0_28px_80px_rgba(139,92,246,0.08),0_24px_80px_rgba(2,6,23,0.42)]',
    score:
      'border-violet-300/25 bg-violet-400/10 text-violet-100 shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_0_24px_rgba(139,92,246,0.12)]',
    badge: 'border-violet-300/20 bg-violet-400/10 text-violet-100',
    line: 'bg-gradient-to-r from-violet-300 via-indigo-300/70 to-transparent',
  },
  {
    card:
      'border-orange-400/15 bg-[linear-gradient(180deg,rgba(18,15,24,0.96),rgba(8,15,28,0.92))] shadow-[0_20px_60px_rgba(2,6,23,0.22)] transition-all duration-300 ease-out transform-gpu hover:-translate-y-0.5 hover:border-orange-300/25 hover:shadow-[0_28px_80px_rgba(249,115,22,0.08),0_24px_80px_rgba(2,6,23,0.42)]',
    score:
      'border-orange-300/25 bg-orange-400/10 text-orange-100 shadow-[0_0_0_1px_rgba(249,115,22,0.10),0_0_24px_rgba(249,115,22,0.12)]',
    badge: 'border-orange-300/20 bg-orange-400/10 text-orange-100',
    line: 'bg-gradient-to-r from-orange-300 via-amber-200/70 to-transparent',
  },
] as const;

function profileVariant(publicCandidateId: string) {
  const seed = Array.from(publicCandidateId).reduce((accumulator, char) => accumulator + char.charCodeAt(0), 0);
  return CARD_VARIANTS[seed % CARD_VARIANTS.length];
}

export default function AnonymousCandidateCard({
  profile,
  returnHref = '/entreprise',
}: {
  profile: VisibleCandidateProfile;
  returnHref?: string;
}) {
  const variant = profileVariant(profile.publicCandidateId);
  const availabilityView = getCandidateAvailabilityView(profile);
  const sectorLabel = findSectorLabel(profile.sectorId) ?? 'Secteur non classé';
  const familyLabel = findFamilyLabel(profile.jobFamilyId) ?? 'Famille non classée';
  const roleLabel = findRoleLabel(profile.jobRoleId) ?? 'Métier non classé';
  const availabilityLabel = availabilityView.label ?? (AVAILABILITY_LABELS[profile.availability] ?? 'Disponibilité non renseignée');
  const experienceLabel = EXPERIENCE_LABELS[profile.experienceLevel] ?? 'Expérience non renseignée';
  const detailHref = `/entreprise/candidats/${profile.publicCandidateId}?returnTo=${encodeURIComponent(returnHref)}`;

  return (
    <Link
      href={detailHref}
      aria-label={`Voir le profil anonyme ${profile.publicCandidateId}`}
      className={'group relative block overflow-hidden rounded-[22px] border p-5 text-left ' + variant.card}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_24%),radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_64%)]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <span className={'inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ' + variant.badge}>
              Profil anonyme
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Identifiant public</p>
              <p className="mt-2 break-all text-lg font-semibold text-white">{profile.publicCandidateId}</p>
            </div>
          </div>

          <div className={'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border text-center ' + variant.score}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em]">Anonyme</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em]">Seven&apos;O</span>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-xl font-semibold text-white">{roleLabel}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {sectorLabel} - {familyLabel}
          </p>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Zone</p>
            <p className="mt-2 text-sm text-white">{profile.locationArea}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Expérience</p>
            <p className="mt-2 text-sm text-white">{experienceLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Disponibilité</p>
            <p className="mt-2 text-sm text-white">{availabilityLabel}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{availabilityView.detail}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Contrats recherchés</p>
            <p className="mt-2 text-sm text-white">{formatDesiredContractTypeLabels(profile.desiredContractTypeCodes)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Cette préférence pourra servir aux futurs filtres et au matching.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Analyse professionnelle</p>
            <p className="mt-2 text-sm text-white">Nouvelle version en préparation</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Aucun score global historique n&apos;est présenté côté entreprise.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Recommandations visibles</p>
            <p className="mt-2 text-sm text-white">
              {profile.recommendationVisibleCount && profile.recommendationVisibleCount > 0
                ? `${profile.recommendationVisibleCount} ${profile.recommendationVisibleCount > 1 ? 'recommandations vérifiées' : 'recommandation vérifiée'}`
                : 'Aucune recommandation vérifiée'}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Uniquement les avis vérifiés et rendus visibles apparaissent ici.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
            Statut anonyme actif
          </span>
          <span className="inline-flex items-center gap-3 text-sm font-medium text-white/90 transition group-hover:translate-x-0.5">
            <span className={'h-px w-8 ' + variant.line} />
            <span>Voir le profil anonyme</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
