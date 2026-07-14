'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import {
  beginApplicationClient,
  getApplicationClient,
  getCandidateOfferClient,
  saveApplicationAnswersClient,
  submitApplicationClient,
  withdrawApplicationClient,
} from '@/lib/seveno-job-applications';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import type {
  CandidateOfferProjection,
  PrerequisiteAnswerInput,
  PrerequisiteAnswerValue,
  SerializedCandidateJobApplication,
  SerializedJobApplicationPrerequisiteAnswer,
} from '@/types/seveno-job-applications';
import type { OfferPrerequisiteSnapshot } from '@/types/seveno-prerequisites';

const FIELD = 'w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:opacity-50';

type AnswerState = { answerValue: PrerequisiteAnswerValue; confirmed: boolean; source: 'application' | 'reusable_profile' };

function answerLabel(snapshot: OfferPrerequisiteSnapshot) {
  if (snapshot.comparisonOperator === 'minimum') return 'minimum';
  if (snapshot.comparisonOperator === 'maximum') return 'maximum';
  if (snapshot.comparisonOperator === 'before') return 'avant';
  if (snapshot.comparisonOperator === 'after') return 'apres';
  return 'attendu';
}

function AnswerField({ snapshot, state, disabled, onChange }: {
  snapshot: OfferPrerequisiteSnapshot;
  state: AnswerState;
  disabled: boolean;
  onChange: (state: AnswerState) => void;
}) {
  const setValue = (answerValue: PrerequisiteAnswerValue) => onChange({ answerValue, confirmed: answerValue !== null, source: 'application' });
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-white">{snapshot.candidateQuestion}</p>{snapshot.candidateHelp ? <p className="mt-2 text-sm leading-6 text-slate-400">{snapshot.candidateHelp}</p> : null}</div><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">{snapshot.importance === 'required' ? 'Obligatoire' : 'Optionnel'}</span></div>
    {state.source === 'reusable_profile' && !state.confirmed ? <p className="mt-3 text-sm text-cyan-200">Reponse deja renseignee - confirmez qu elle est toujours exacte.</p> : null}
    <div className="mt-4">
      {snapshot.answerType === 'boolean' ? <select disabled={disabled} value={state.answerValue === null ? '' : state.answerValue ? 'true' : 'false'} onChange={(event) => setValue(event.target.value === '' ? null : event.target.value === 'true')} className={FIELD}><option value="">Selectionner</option><option value="true">Oui</option><option value="false">Non</option></select> : null}
      {(snapshot.answerType === 'single_choice' || snapshot.answerType === 'level') ? <select disabled={disabled} value={typeof state.answerValue === 'string' ? state.answerValue : ''} onChange={(event) => setValue(event.target.value || null)} className={FIELD}><option value="">Selectionner</option>{snapshot.options.map((option) => <option key={option.value} value={option.value}>{option.candidateLabel}</option>)}</select> : null}
      {snapshot.answerType === 'multiple_choice' ? <div className="grid gap-2 sm:grid-cols-2">{snapshot.options.map((option) => {
        const selected = Array.isArray(state.answerValue) && state.answerValue.includes(option.value);
        return <label key={option.value} className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200"><input type="checkbox" disabled={disabled} checked={selected} onChange={(event) => {
          const current = Array.isArray(state.answerValue) ? state.answerValue : [];
          setValue(event.target.checked ? [...current, option.value] : current.filter((item) => item !== option.value));
        }} className="accent-cyan-400" />{option.candidateLabel}</label>;
      })}</div> : null}
      {snapshot.answerType === 'number' ? <input type="number" disabled={disabled} value={typeof state.answerValue === 'number' ? state.answerValue : ''} onChange={(event) => setValue(event.target.value === '' ? null : Number(event.target.value))} className={FIELD} /> : null}
      {snapshot.answerType === 'date' ? <input type="date" disabled={disabled} value={typeof state.answerValue === 'string' ? state.answerValue : ''} onChange={(event) => setValue(event.target.value || null)} className={FIELD} /> : null}
    </div>
    {state.answerValue !== null ? <label className="mt-3 flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" disabled={disabled} checked={state.confirmed} onChange={(event) => onChange({ ...state, confirmed: event.target.checked })} className="accent-cyan-400" />Je confirme que cette reponse est exacte.</label> : null}
    <p className="mt-3 text-xs text-slate-500">Critere {answerLabel(snapshot)} defini par l offre.</p>
  </div>;
}

export default function CandidateOfferDetail({ offerId }: { offerId: string }) {
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [offer, setOffer] = useState<CandidateOfferProjection | null>(null);
  const [application, setApplication] = useState<SerializedCandidateJobApplication | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function hydrateAnswers(items: SerializedJobApplicationPrerequisiteAnswer[] = []) {
    setAnswers(Object.fromEntries(items.map((item) => [item.prerequisiteCode, {
      answerValue: item.answerValue,
      confirmed: item.confirmed,
      source: item.source,
    }])));
  }

  async function loadApplication(applicationId: string) {
    if (!authUser) return;
    const payload = await getApplicationClient(authUser, applicationId);
    setApplication(payload.application);
    setOffer(payload.application.offerSnapshot);
    hydrateAnswers(payload.application.answers);
  }

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    async function load() {
      try {
        const payload = await getCandidateOfferClient(authUser!, offerId);
        if (!active) return;
        setOffer(payload.offer);
        if (payload.applicationId) {
          const applicationPayload = await getApplicationClient(authUser!, payload.applicationId);
          if (!active) return;
          setApplication(applicationPayload.application);
          setOffer(applicationPayload.application.offerSnapshot);
          hydrateAnswers(applicationPayload.application.answers);
        }
      } catch (thrownError) {
        if (active) setError(thrownError instanceof Error ? thrownError.message : 'L offre n a pas pu etre chargee.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [authUser, offerId]);

  async function begin() {
    if (!authUser) return;
    setSaving(true);
    setError(null);
    try {
      const payload = await beginApplicationClient(authUser, offerId);
      await loadApplication(payload.application.id);
      setMessage('Candidature enregistree en brouillon. Repondez aux prerequis a votre rythme.');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La candidature n a pas pu etre commencee.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAnswers() {
    if (!authUser || !application || !offer) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const snapshots = [...offer.requiredPrerequisites, ...offer.preferredPrerequisites];
      const payload: PrerequisiteAnswerInput[] = snapshots.map((snapshot) => ({
        prerequisiteCode: snapshot.prerequisiteCode,
        answerValue: answers[snapshot.prerequisiteCode]?.answerValue ?? null,
        confirmed: answers[snapshot.prerequisiteCode]?.confirmed === true,
      }));
      await saveApplicationAnswersClient(authUser, application.id, payload);
      await loadApplication(application.id);
      setMessage('Reponses enregistrees et compatibilite recalculee.');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Les reponses n ont pas pu etre enregistrees.');
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!authUser || !application) return;
    setSaving(true);
    setError(null);
    try {
      await submitApplicationClient(authUser, application.id);
      await loadApplication(application.id);
      setMessage('Votre candidature a ete envoyee. Votre identite privee reste masquee.');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La candidature n a pas pu etre envoyee.');
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    if (!authUser || !application || !window.confirm('Retirer cette candidature sans supprimer ses donnees ?')) return;
    setSaving(true);
    try {
      await withdrawApplicationClient(authUser, application.id);
      await loadApplication(application.id);
      setMessage('Votre candidature a ete retiree.');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le retrait a echoue.');
    } finally {
      setSaving(false);
    }
  }

  const locked = application?.status === 'submitted' || application?.status === 'withdrawn';
  const preferred = application?.preferredResult;
  return <SevenoSurface eyebrow="Espace candidat" title={offer?.title ?? 'Detail de l offre'} description="Consultez les conditions publiees et repondez aux prerequis professionnels." actions={<Link href="/candidat/offres" className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">Retour aux offres</Link>} containerClassName="max-w-[86.4rem]">
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Candidat', href: '/candidat' },
          { label: 'Offres', href: '/candidat/offres' },
          { label: 'Offre' },
        ]}
      />
      {sessionError || error ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">{sessionError ?? error}</p></SevenoPanel> : null}
      {message ? <SevenoPanel tone="cyan"><p className="text-sm text-cyan-100">{message}</p></SevenoPanel> : null}
      {(sessionLoading || loading) ? <p className="text-sm text-slate-400">Chargement...</p> : null}
      {offer ? <>
        <SevenoPanel tone="cyan"><p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">{offer.companyName}</p><h2 className="mt-2 text-2xl font-semibold text-white">{offer.title}</h2><p className="mt-3 text-slate-300">{offer.jobRoleLabel}</p><div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-400"><span>{offer.location || offer.workMode}</span><span>{offer.contractType}</span><span>{offer.workingTime}</span><span>{offer.workMode}</span></div></SevenoPanel>
        <div className="grid gap-5 lg:grid-cols-3"><SevenoPanel tone="neutral"><h3 className="font-semibold text-white">Description</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{offer.description}</p></SevenoPanel><SevenoPanel tone="neutral"><h3 className="font-semibold text-white">Missions</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{offer.missions}</p></SevenoPanel><SevenoPanel tone="neutral"><h3 className="font-semibold text-white">Profil recherche</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{offer.profileSummary}</p></SevenoPanel></div>
        {!application ? <SevenoPanel tone="violet"><h2 className="text-xl font-semibold text-white">Candidater a cette offre</h2><p className="mt-3 text-sm leading-7 text-slate-300">Vos reponses restent modifiables tant que la candidature n est pas soumise. Aucune information n est envoyee a l entreprise avant la soumission.</p><button type="button" disabled={saving} onClick={() => void begin()} className="mt-5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Commencer ma candidature</button></SevenoPanel> : <>
          <SevenoPanel tone="neutral"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Reponses aux prerequis</h2><p className="mt-2 text-sm text-slate-400">Statut : {application.status}</p></div><div className="text-right text-sm"><p className="text-orange-100">Obligatoires : {application.requiredResult.satisfied}/{application.requiredResult.total}</p><p className="mt-1 text-violet-100">Valeurs ajoutees : {preferred?.satisfied ?? 0}/{preferred?.total ?? 0} ({preferred?.compatibilityRate ?? 0}%)</p></div></div></SevenoPanel>
          <section><h2 className="text-xl font-semibold text-orange-100">Prerequis obligatoires</h2><p className="mt-2 text-sm text-slate-300">Les prerequis obligatoires sont indispensables pour deposer votre candidature.</p><div className="mt-4 space-y-4">{offer.requiredPrerequisites.map((snapshot) => <AnswerField key={snapshot.prerequisiteCode} snapshot={snapshot} disabled={locked} state={answers[snapshot.prerequisiteCode] ?? { answerValue: null, confirmed: false, source: 'application' }} onChange={(state) => setAnswers((current) => ({ ...current, [snapshot.prerequisiteCode]: state }))} />)}</div></section>
          <section><h2 className="text-xl font-semibold text-violet-100">Prerequis optionnels - valeur ajoutee</h2><p className="mt-2 text-sm text-slate-300">Les elements optionnels valorisent votre candidature mais ne sont pas eliminatoires.</p><div className="mt-4 space-y-4">{offer.preferredPrerequisites.map((snapshot) => <AnswerField key={snapshot.prerequisiteCode} snapshot={snapshot} disabled={locked} state={answers[snapshot.prerequisiteCode] ?? { answerValue: null, confirmed: false, source: 'application' }} onChange={(state) => setAnswers((current) => ({ ...current, [snapshot.prerequisiteCode]: state }))} />)}</div></section>
          {application.status === 'ineligible' ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">Cette offre comporte un prerequis obligatoire que vous ne remplissez pas actuellement. Vous pouvez corriger vos reponses avant soumission.</p></SevenoPanel> : null}
          <div className="flex flex-wrap gap-3">{!locked ? <button type="button" disabled={saving} onClick={() => void saveAnswers()} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer mes reponses'}</button> : null}{application.status === 'eligible' ? <button type="button" disabled={saving} onClick={() => void submit()} className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Envoyer ma candidature</button> : null}{application.status === 'submitted' ? <button type="button" disabled={saving} onClick={() => void withdraw()} className="rounded-full border border-rose-300/20 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 disabled:opacity-50">Retirer ma candidature</button> : null}</div>
        </>}
      </> : null}
    </div>
  </SevenoSurface>;
}
