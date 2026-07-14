'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import {
  activateCompanyQuestionnaireClient,
  getCompanyQuestionnaireClient,
  saveCompanyQuestionnaireClient,
} from '@/lib/seveno-company-questionnaires';
import { getCompanyJobOffer } from '@/lib/seveno-job-offers';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';
import { isCompanyProfileIncomplete } from '@/lib/seveno-companies';
import type {
  CompanyQuestionCorrectionMode,
  CompanyQuestionInput,
  CompanyQuestionType,
  CompanyQuestionnaireEditorProjection,
  CompanyQuestionnaireInput,
} from '@/types/seveno-company-questionnaires';

const FIELD = 'w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:opacity-50';
const TYPE_LABELS: Record<CompanyQuestionType, string> = {
  single_choice: 'Choix unique',
  multiple_choice: 'Choix multiple',
  boolean: 'Oui / non',
  number: 'Reponse numerique',
  short_text: 'Reponse courte',
  long_text: 'Reponse longue',
};

type EditorQuestion = Omit<CompanyQuestionInput, 'expectedAnswer'> & {
  expectedAnswer?: CompanyQuestionInput['expectedAnswer'];
  expectedAnswerText: string;
  hasExpectedAnswer: boolean;
};

function newQuestion(order: number): EditorQuestion {
  return {
    id: crypto.randomUUID(),
    prompt: '',
    help: '',
    type: 'single_choice',
    required: true,
    options: [
      { id: 'option-1', label: 'Reponse A', order: 1 },
      { id: 'option-2', label: 'Reponse B', order: 2 },
    ],
    correctionMode: 'automatic',
    numberOperator: 'equals',
    points: 1,
    order,
    expectedAnswerText: '',
    hasExpectedAnswer: false,
  };
}

function normalizeOptionLabel(label: string) {
  return label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function selectedOptionIds(question: EditorQuestion) {
  if (question.type === 'single_choice') {
    return question.expectedAnswerText.trim() ? [question.expectedAnswerText.trim()] : [];
  }
  if (question.type === 'multiple_choice') {
    return question.expectedAnswerText.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function validateChoiceQuestion(question: EditorQuestion) {
  if (question.type !== 'single_choice' && question.type !== 'multiple_choice') return;
  if (question.options.length < 2 || question.options.length > 4) {
    throw new Error('Une question a choix doit proposer entre deux et quatre reponses.');
  }
  if (question.options.some((option) => !option.label.trim())) {
    throw new Error('Chaque reponse proposee doit avoir un libelle.');
  }
  if (new Set(question.options.map((option) => option.id)).size !== question.options.length) {
    throw new Error('Les identifiants des reponses proposees doivent etre uniques.');
  }
  if (new Set(question.options.map((option) => normalizeOptionLabel(option.label))).size !== question.options.length) {
    throw new Error('Deux reponses proposees ne peuvent pas avoir le meme libelle.');
  }
  const selected = selectedOptionIds(question);
  if (question.correctionMode === 'automatic' && selected.length === 0) {
    throw new Error('Selectionnez au moins une bonne reponse pour la correction automatique.');
  }
  if (question.type === 'single_choice' && selected.length > 1) {
    throw new Error('Un choix unique ne peut avoir qu une seule bonne reponse.');
  }
  if (selected.some((id) => !question.options.some((option) => option.id === id))) {
    throw new Error('Une bonne reponse fait reference a une option supprimee.');
  }
}

function parseExpectedAnswer(question: EditorQuestion) {
  if (question.correctionMode === 'manual' || !question.expectedAnswerText.trim()) return undefined;
  if (question.type === 'boolean') {
    const value = question.expectedAnswerText.trim().toLowerCase();
    if (value !== 'true' && value !== 'false') {
      throw new Error('La reponse attendue d une question vrai/faux doit etre true ou false.');
    }
    return value === 'true';
  }
  if (question.type === 'number') {
    const value = Number(question.expectedAnswerText);
    if (!Number.isFinite(value)) {
      throw new Error('La reponse attendue d une question numerique doit etre un nombre valide.');
    }
    return value;
  }
  if (question.type === 'multiple_choice') {
    return question.expectedAnswerText.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return question.expectedAnswerText.trim();
}

function toInput(question: EditorQuestion): CompanyQuestionInput {
  validateChoiceQuestion(question);
  const expectedAnswer = parseExpectedAnswer(question);
  return {
    id: question.id,
    prompt: question.prompt,
    ...(question.help?.trim() ? { help: question.help } : {}),
    type: question.type,
    required: question.required,
    options: question.options.map((option, index) => ({ ...option, order: index + 1 })),
    correctionMode: question.correctionMode,
    ...(expectedAnswer !== undefined ? { expectedAnswer } : {}),
    ...(question.type === 'number' && question.correctionMode === 'automatic' && (question.expectedAnswerText.trim() || !question.hasExpectedAnswer)
      ? { numberOperator: question.numberOperator ?? 'equals' }
      : {}),
    points: question.points,
    order: question.order,
  };
}

export default function CompanyQuestionnaireEditor({ offerId }: { offerId: string }) {
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const [questionnaire, setQuestionnaire] = useState<CompanyQuestionnaireEditorProjection | null>(null);
  const [offerTitle, setOfferTitle] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duration, setDuration] = useState('');
  const [questions, setQuestions] = useState<EditorQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    async function load() {
      try {
        const [offerPayload, questionnairePayload] = await Promise.all([
          getCompanyJobOffer(authUser!, offerId),
          getCompanyQuestionnaireClient(authUser!, offerId),
        ]);
        if (!active) return;
        setOfferTitle(offerPayload.offer.title || 'Offre sans titre');
        const current = questionnairePayload.questionnaire;
        setQuestionnaire(current);
        if (current) {
          setTitle(current.title);
          setInstructions(current.instructions);
          setDuration(current.durationMinutes ? String(current.durationMinutes) : '');
          setQuestions(current.questions.map((question) => ({
            ...question,
            help: question.help ?? '',
            expectedAnswerText: question.correctOptionIds.join(','),
            hasExpectedAnswer: question.hasExpectedAnswer,
          })));
        }
      } catch (thrownError) {
        if (active) setError(thrownError instanceof Error ? thrownError.message : 'Le questionnaire n a pas pu etre charge.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [authUser, offerId]);

  function updateQuestion(id: string, patch: Partial<EditorQuestion>) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question));
  }

  function addOption(question: EditorQuestion) {
    if (question.options.length >= 4) return;
    const nextOrder = question.options.length + 1;
    updateQuestion(question.id, {
      options: [...question.options, {
        id: `option-${crypto.randomUUID()}`,
        label: `Reponse ${String.fromCharCode(64 + nextOrder)}`,
        order: nextOrder,
      }],
    });
  }

  function updateOptionLabel(question: EditorQuestion, optionId: string, label: string) {
    updateQuestion(question.id, {
      options: question.options.map((option) => option.id === optionId ? { ...option, label } : option),
    });
  }

  function selectCorrectOption(question: EditorQuestion, optionId: string, checked: boolean) {
    const selected = selectedOptionIds(question);
    const next = question.type === 'single_choice'
      ? [optionId]
      : checked
        ? [...new Set([...selected, optionId])]
        : selected.filter((id) => id !== optionId);
    updateQuestion(question.id, {
      expectedAnswerText: next.join(','),
      hasExpectedAnswer: next.length > 0,
    });
  }

  function removeOption(question: EditorQuestion, optionId: string) {
    if (question.options.length <= 2) return;
    const selected = selectedOptionIds(question);
    if (selected.includes(optionId) && !window.confirm('Cette reponse est configuree comme correcte. Confirmer sa suppression ?')) return;
    const remainingSelected = selected.filter((id) => id !== optionId);
    updateQuestion(question.id, {
      options: question.options
        .filter((option) => option.id !== optionId)
        .map((option, index) => ({ ...option, order: index + 1 })),
      expectedAnswerText: remainingSelected.join(','),
      hasExpectedAnswer: remainingSelected.length > 0,
    });
  }

  function changeType(question: EditorQuestion, type: CompanyQuestionType) {
    const automatic = ['single_choice', 'multiple_choice', 'boolean', 'number'].includes(type);
    updateQuestion(question.id, {
      type,
      correctionMode: automatic ? question.correctionMode : 'manual',
      options: type === 'single_choice' || type === 'multiple_choice'
        ? question.options.length >= 2 ? question.options : newQuestion(0).options
        : [],
      expectedAnswerText: '',
      hasExpectedAnswer: false,
    });
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    setQuestions((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((question, order) => ({ ...question, order }));
    });
  }

  function duplicateQuestion(question: EditorQuestion) {
    setQuestions((current) => [...current, {
      ...question,
      id: crypto.randomUUID(),
      prompt: `${question.prompt} (copie)`,
      order: current.length,
      expectedAnswerText: '',
      hasExpectedAnswer: false,
    }]);
  }

  async function save() {
    if (!authUser) return null;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const input: CompanyQuestionnaireInput = {
        title,
        instructions,
        durationMinutes: duration ? Number(duration) : null,
        questions: questions.map((question, order) => toInput({ ...question, order })),
      };
      const payload = await saveCompanyQuestionnaireClient(authUser, offerId, input);
      setQuestionnaire(payload.questionnaire);
      setQuestions((current) => current.map((question, order) => ({
        ...question,
        order,
        expectedAnswerText: payload.questionnaire.questions.find((item) => item.id === question.id)?.correctOptionIds.join(',') ?? '',
        hasExpectedAnswer: payload.questionnaire.questions.find((item) => item.id === question.id)?.hasExpectedAnswer ?? false,
      })));
      setMessage('Questionnaire enregistre en brouillon.');
      return payload.questionnaire;
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le questionnaire n a pas pu etre enregistre.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function activate() {
    if (!authUser) return;
    const saved = await save();
    if (!saved) return;
    setSaving(true);
    try {
      const payload = await activateCompanyQuestionnaireClient(authUser, offerId);
      setQuestionnaire(payload.questionnaire);
      setMessage('Questionnaire actif. Sa correction reste exclusivement cote serveur.');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'L activation a echoue.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SevenoSurface
      eyebrow="Espace entreprise"
      title="Questionnaire entreprise"
      description={`Questionnaire propre a l offre : ${offerTitle}`}
      actions={<Link href={`/entreprise/offres/${offerId}/modifier`} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">Retour a l offre</Link>}
      containerClassName="max-w-[86.4rem]"
    >
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Entreprise', href: '/entreprise' },
            { label: 'Mes offres', href: '/entreprise/offres' },
            { label: 'Questionnaire entreprise' },
          ]}
        />
        {profile?.profileStatus === 'suspended' ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">Profil suspendu : le questionnaire ne peut pas etre modifie.</p></SevenoPanel> : null}
        {profile && isCompanyProfileIncomplete(profile) ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">Profil entreprise incomplet : le questionnaire peut rester en brouillon, mais l offre ne pourra pas etre publiee.</p></SevenoPanel> : null}
        {sessionError || error ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">{sessionError ?? error}</p></SevenoPanel> : null}
        {message ? <SevenoPanel tone="cyan"><p className="text-sm text-cyan-100">{message}</p></SevenoPanel> : null}

        {sessionLoading || loading ? <p className="text-sm text-slate-400">Chargement...</p> : (
          <>
            <SevenoPanel tone="cyan">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Configuration</h2>
                  <p className="mt-2 text-sm text-slate-400">Statut : {questionnaire?.status === 'active' ? 'Actif' : questionnaire ? 'Brouillon' : 'Aucun questionnaire'}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">Version {questionnaire?.version ?? 0}</span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-200">Titre<input value={title} onChange={(event) => setTitle(event.target.value)} className={FIELD} /></label>
                <label className="space-y-2 text-sm text-slate-200">Duree optionnelle en minutes<input type="number" min="1" max="240" value={duration} onChange={(event) => setDuration(event.target.value)} className={FIELD} /></label>
                <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} className={FIELD} rows={4} /></label>
              </div>
            </SevenoPanel>

            <div className="space-y-4">
              {questions.map((question, index) => {
                const correctOptionIds = selectedOptionIds(question);
                const isChoice = question.type === 'single_choice' || question.type === 'multiple_choice';
                return (
                  <SevenoPanel key={question.id} tone="neutral">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-cyan-100">Question {index + 1}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => moveQuestion(index, -1)} disabled={index === 0} className="rounded-full border border-white/10 px-3 py-1 text-xs disabled:opacity-30">Monter</button>
                        <button type="button" onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1} className="rounded-full border border-white/10 px-3 py-1 text-xs disabled:opacity-30">Descendre</button>
                        <button type="button" onClick={() => duplicateQuestion(question)} className="rounded-full border border-violet-300/20 px-3 py-1 text-xs text-violet-100">Dupliquer</button>
                        <button type="button" onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id).map((item, order) => ({ ...item, order })))} className="rounded-full border border-rose-300/20 px-3 py-1 text-xs text-rose-100">Supprimer</button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Intitule<input value={question.prompt} onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })} className={FIELD} /></label>
                      <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Aide optionnelle<input value={question.help ?? ''} onChange={(event) => updateQuestion(question.id, { help: event.target.value })} className={FIELD} /></label>
                      <label className="space-y-2 text-sm text-slate-200">Type<select value={question.type} onChange={(event) => changeType(question, event.target.value as CompanyQuestionType)} className={FIELD}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label className="space-y-2 text-sm text-slate-200">Points<input type="number" min="0" max="100" value={question.points} onChange={(event) => updateQuestion(question.id, { points: Number(event.target.value) })} className={FIELD} /></label>
                      <label className="flex items-center gap-3 text-sm text-slate-200"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} className="accent-cyan-400" />Question obligatoire</label>
                      {['single_choice', 'multiple_choice', 'boolean', 'number'].includes(question.type) ? (
                        <label className="space-y-2 text-sm text-slate-200">
                          Correction
                          <select
                            value={question.correctionMode}
                            onChange={(event) => updateQuestion(question.id, {
                              correctionMode: event.target.value as CompanyQuestionCorrectionMode,
                              expectedAnswerText: '',
                              hasExpectedAnswer: false,
                            })}
                            className={FIELD}
                          >
                            <option value="automatic">Automatique</option>
                            <option value="manual">Manuelle</option>
                          </select>
                        </label>
                      ) : null}

                      {isChoice ? (
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:col-span-2">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">Reponses proposees</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {question.type === 'single_choice'
                                  ? 'Le candidat pourra selectionner une seule reponse.'
                                  : 'Le candidat pourra selectionner plusieurs reponses.'}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-cyan-100">{question.options.length} reponses sur 4</span>
                          </div>

                          {question.options.map((option) => (
                            <div key={option.id} className="flex items-center gap-3">
                              {question.correctionMode === 'automatic' ? (
                                <input
                                  type={question.type === 'single_choice' ? 'radio' : 'checkbox'}
                                  name={`correct-answer-${question.id}`}
                                  checked={correctOptionIds.includes(option.id)}
                                  onChange={(event) => selectCorrectOption(question, option.id, event.target.checked)}
                                  aria-label={`Marquer la reponse ${option.order} comme correcte`}
                                  className="h-4 w-4 shrink-0 accent-cyan-400"
                                />
                              ) : null}
                              <span className="w-6 shrink-0 text-xs text-slate-500">{option.order}.</span>
                              <input
                                value={option.label}
                                onChange={(event) => updateOptionLabel(question, option.id, event.target.value)}
                                aria-label={`Libelle de la reponse ${option.order}`}
                                className={FIELD}
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(question, option.id)}
                                disabled={question.options.length <= 2}
                                className="rounded-full border border-rose-300/20 px-3 py-2 text-xs text-rose-100 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                Supprimer
                              </button>
                            </div>
                          ))}

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => addOption(question)}
                              disabled={question.options.length >= 4}
                              className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              Ajouter une reponse
                            </button>
                            {question.correctionMode === 'automatic' ? <p className="text-xs text-emerald-200">{correctOptionIds.length} bonne(s) reponse(s) selectionnee(s)</p> : null}
                          </div>
                        </div>
                      ) : null}

                      {question.correctionMode === 'automatic' && !isChoice ? (
                        <>
                          <label className="space-y-2 text-sm text-slate-200">Nouvelle reponse attendue<input value={question.expectedAnswerText} onChange={(event) => updateQuestion(question.id, { expectedAnswerText: event.target.value })} className={FIELD} placeholder={question.type === 'boolean' ? 'true ou false' : 'Valeur attendue'} /></label>
                          {question.type === 'number' ? <label className="space-y-2 text-sm text-slate-200">Critere<select value={question.numberOperator ?? 'equals'} onChange={(event) => updateQuestion(question.id, { numberOperator: event.target.value as 'equals' | 'minimum' | 'maximum' })} className={FIELD}><option value="equals">Egal a</option><option value="minimum">Minimum</option><option value="maximum">Maximum</option></select></label> : null}
                          <p className="text-xs text-emerald-200 md:col-span-2">{question.hasExpectedAnswer && !question.expectedAnswerText ? 'Une correction existe cote serveur. Laissez vide pour la conserver.' : 'La correction saisie sera stockee cote serveur.'}</p>
                        </>
                      ) : null}
                    </div>
                  </SevenoPanel>
                );
              })}
            </div>

            <button type="button" onClick={() => setQuestions((current) => [...current, newQuestion(current.length)])} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100">Ajouter une question</button>
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={saving} onClick={() => void save()} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Enregistrer le brouillon</button>
              <button type="button" onClick={() => setPreview(true)} className="rounded-full border border-violet-300/20 bg-violet-400/10 px-5 py-3 text-sm font-semibold text-violet-100">Previsualiser</button>
              <button type="button" disabled={saving} onClick={() => void activate()} className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Activer le questionnaire</button>
            </div>
          </>
        )}

        {preview ? (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 p-5 backdrop-blur">
            <div className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-slate-900 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">{title || 'Questionnaire sans titre'}</h2>
                <button type="button" onClick={() => setPreview(false)} className="rounded-full border border-white/10 px-4 py-2 text-sm">Fermer</button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{instructions}</p>
              <div className="mt-6 space-y-4">
                {questions.map((question, index) => {
                  const correctOptionIds = selectedOptionIds(question);
                  return (
                    <div key={question.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="font-medium">{index + 1}. {question.prompt} {question.required ? '*' : ''}</p>
                      <p className="mt-2 text-xs text-slate-400">{TYPE_LABELS[question.type]} - {question.points} point(s)</p>
                      {question.options.length ? (
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          {question.options.map((option) => (
                            <label key={option.id} className="flex items-center gap-3">
                              <input
                                type={question.type === 'single_choice' ? 'radio' : 'checkbox'}
                                name={`preview-${question.id}`}
                                checked={correctOptionIds.includes(option.id)}
                                readOnly
                                className="accent-cyan-400"
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </SevenoSurface>
  );
}
