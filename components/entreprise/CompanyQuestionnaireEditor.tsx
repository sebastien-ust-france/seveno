'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { Select } from '@/components/ui/Select';
import {
  COMPANY_QUESTION_TIME_LIMIT_SECONDS,
  COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
  COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT,
  COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_VALUES,
} from '@/lib/seveno-company-questionnaire-constants';
import {
  buildCompanyQuestionnaireAiPrompt,
  parseCompanyQuestionnaireAiImport,
} from '@/lib/seveno-company-questionnaire-ai';
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
  CompanyQuestionDifficulty,
  CompanyQuestionInput,
  CompanyQuestionType,
  CompanyQuestionnaireCreationMode,
  CompanyQuestionnaireEditorProjection,
  CompanyQuestionnaireInput,
} from '@/types/seveno-company-questionnaires';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';

const FIELD = 'w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:opacity-50';
const TYPE_LABELS: Record<CompanyQuestionType, string> = {
  single_choice: 'Choix unique',
  multiple_choice: 'Choix multiple',
  boolean: 'Oui / non',
  number: 'Réponse numérique',
  short_text: 'Réponse courte',
  long_text: 'Réponse longue',
};
const DIFFICULTY_LABELS: Record<CompanyQuestionDifficulty, string> = {
  easy: 'Facile',
  medium: 'Moyenne',
  hard: 'Difficile',
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
    explanation: '',
    type: 'single_choice',
    required: true,
    options: [
      { id: 'option-1', label: 'Réponse A', order: 1 },
      { id: 'option-2', label: 'Réponse B', order: 2 },
    ],
    correctionMode: 'automatic',
    numberOperator: 'equals',
    points: 1,
    order,
    difficulty: 'medium',
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

function formatExpectedAnswerText(question: {
  correctOptionIds?: string[];
  expectedAnswer?: CompanyQuestionInput['expectedAnswer'];
  type: CompanyQuestionType;
}) {
  const correctOptionIds = question.correctOptionIds ?? [];
  if (question.type === 'single_choice') {
    if (typeof question.expectedAnswer === 'string') {
      return question.expectedAnswer;
    }
    return correctOptionIds.join(',');
  }
  if (question.type === 'multiple_choice') {
    if (Array.isArray(question.expectedAnswer)) {
      return question.expectedAnswer.join(',');
    }
    return correctOptionIds.join(',');
  }
  if (question.type === 'boolean' || question.type === 'number') {
    return typeof question.expectedAnswer === 'boolean' || typeof question.expectedAnswer === 'number'
      ? String(question.expectedAnswer)
      : '';
  }
  return typeof question.expectedAnswer === 'string' ? question.expectedAnswer : '';
}

function validateChoiceQuestion(question: EditorQuestion) {
  if (question.type !== 'single_choice' && question.type !== 'multiple_choice') return;
  if (question.options.length < 2 || question.options.length > 4) {
    throw new Error('Une question à choix doit proposer entre deux et quatre réponses.');
  }
  if (question.options.some((option) => !option.label.trim())) {
    throw new Error('Chaque réponse proposée doit avoir un libellé.');
  }
  if (new Set(question.options.map((option) => option.id)).size !== question.options.length) {
    throw new Error('Les identifiants des réponses proposées doivent être uniques.');
  }
  if (new Set(question.options.map((option) => normalizeOptionLabel(option.label))).size !== question.options.length) {
    throw new Error('Deux réponses proposées ne peuvent pas avoir le même libellé.');
  }
  const selected = selectedOptionIds(question);
  if (question.correctionMode === 'automatic' && selected.length === 0) {
    throw new Error('Sélectionnez au moins une bonne réponse pour la correction automatique.');
  }
  if (question.type === 'single_choice' && selected.length > 1) {
    throw new Error('Un choix unique ne peut avoir qu’une seule bonne réponse.');
  }
  if (selected.some((id) => !question.options.some((option) => option.id === id))) {
    throw new Error('Une bonne réponse fait référence à une option supprimée.');
  }
}

function parseExpectedAnswer(question: EditorQuestion) {
  if (question.correctionMode === 'manual' || !question.expectedAnswerText.trim()) {
    return undefined;
  }

  if (question.type === 'boolean') {
    const value = question.expectedAnswerText.trim().toLowerCase();
    if (value !== 'true' && value !== 'false') {
      throw new Error('La réponse attendue d’une question vrai/faux doit être true ou false.');
    }
    return value === 'true';
  }

  if (question.type === 'number') {
    const value = Number(question.expectedAnswerText);
    if (!Number.isFinite(value)) {
      throw new Error('La réponse attendue d’une question numérique doit être un nombre valide.');
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
    ...(question.explanation?.trim() ? { explanation: question.explanation } : {}),
    type: question.type,
    required: question.required,
    options: question.options.map((option, index) => ({ ...option, order: index + 1 })),
    correctionMode: question.correctionMode,
    ...(expectedAnswer !== undefined ? { expectedAnswer } : {}),
    ...(question.type === 'number'
      && question.correctionMode === 'automatic'
      && (question.expectedAnswerText.trim() || !question.hasExpectedAnswer)
      ? { numberOperator: question.numberOperator ?? 'equals' }
      : {}),
    points: question.points,
    order: question.order,
    ...(question.difficulty ? { difficulty: question.difficulty } : {}),
  };
}

function mapLoadedQuestion(question: CompanyQuestionnaireEditorProjection['questions'][number]): EditorQuestion {
  return {
    ...question,
    help: question.help ?? '',
    explanation: question.explanation ?? '',
    difficulty: question.difficulty ?? 'medium',
    expectedAnswerText: formatExpectedAnswerText(question),
    hasExpectedAnswer: question.hasExpectedAnswer,
  };
}

function formatEstimatedDuration(questionCount: number) {
  const totalSeconds = questionCount * COMPANY_QUESTION_TIME_LIMIT_SECONDS;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

export default function CompanyQuestionnaireEditor({ offerId }: { offerId: string }) {
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const [offer, setOffer] = useState<SerializedJobOffer | null>(null);
  const [questionnaire, setQuestionnaire] = useState<CompanyQuestionnaireEditorProjection | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [creationMode, setCreationMode] = useState<CompanyQuestionnaireCreationMode>('manual');
  const [minimumPassingScorePercent, setMinimumPassingScorePercent] = useState(
    COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT,
  );
  const [questions, setQuestions] = useState<EditorQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [aiImportText, setAiImportText] = useState('');
  const [aiImportWarnings, setAiImportWarnings] = useState<string[]>([]);
  const [aiValidationConfirmed, setAiValidationConfirmed] = useState(false);

  const aiPrompt = useMemo(
    () => (offer ? buildCompanyQuestionnaireAiPrompt(offer) : ''),
    [offer],
  );
  const estimatedDuration = formatEstimatedDuration(COMPANY_QUESTIONNAIRE_QUESTION_COUNT);

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
        setOffer(offerPayload.offer);
        const current = questionnairePayload.questionnaire;
        setQuestionnaire(current);
        if (current) {
          setTitle(current.title);
          setInstructions(current.instructions);
          setCreationMode(current.creationMode);
          setMinimumPassingScorePercent(current.minimumPassingScorePercent);
          setQuestions(current.questions.map(mapLoadedQuestion));
          setAiValidationConfirmed(current.creationMode !== 'ai_import');
          setAiImportWarnings([]);
        }
      } catch (thrownError) {
        if (active) {
          setError(thrownError instanceof Error ? thrownError.message : 'Le questionnaire n’a pas pu être chargé.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [authUser, offerId]);

  useEffect(() => {
    if (creationMode === 'ai_import') {
      setAiValidationConfirmed(false);
    }
  }, [creationMode, title, instructions, questions]);

  function updateQuestion(id: string, patch: Partial<EditorQuestion>) {
    setQuestions((current) => current.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  }

  function addOption(question: EditorQuestion) {
    if (question.options.length >= 4) return;
    const nextOrder = question.options.length + 1;
    updateQuestion(question.id, {
      options: [...question.options, {
        id: `option-${crypto.randomUUID()}`,
        label: `Réponse ${String.fromCharCode(64 + nextOrder)}`,
        order: nextOrder,
      }],
    });
  }

  function updateOptionLabel(question: EditorQuestion, optionId: string, label: string) {
    updateQuestion(question.id, {
      options: question.options.map((option) => (option.id === optionId ? { ...option, label } : option)),
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
    if (selected.includes(optionId) && !window.confirm('Cette réponse est configurée comme correcte. Confirmer sa suppression ?')) {
      return;
    }
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
    setQuestions((current) => {
      if (current.length >= COMPANY_QUESTIONNAIRE_QUESTION_COUNT) {
        return current;
      }

      return [...current, {
        ...question,
        id: crypto.randomUUID(),
        prompt: `${question.prompt} (copie)`,
        order: current.length,
        expectedAnswerText: '',
        hasExpectedAnswer: false,
      }];
    });
  }

  function resetAiValidation() {
    if (creationMode === 'ai_import') {
      setAiValidationConfirmed(false);
    }
  }

  function applyAiImport(raw: string) {
    const result = parseCompanyQuestionnaireAiImport(raw);
    setTitle(result.questionnaire.title);
    setInstructions(result.questionnaire.instructions);
    setCreationMode(result.questionnaire.creationMode);
    setQuestions(result.questionnaire.questions.map((question) => ({
      ...question,
      help: question.help ?? '',
      explanation: question.explanation ?? '',
      difficulty: question.difficulty ?? 'medium',
      expectedAnswerText: formatExpectedAnswerText(question),
      hasExpectedAnswer: question.expectedAnswer !== undefined,
    })));
    setAiImportWarnings(result.warnings);
    setAiValidationConfirmed(false);
    setMessage('Questionnaire importé. Vérifiez-le avant validation.');
    setError(null);
  }

  async function handleAiImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    try {
      setAiImportText(text);
      applyAiImport(text);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le JSON importé est invalide.');
    }
  }

  async function copyPrompt() {
    if (!aiPrompt) return;
    await navigator.clipboard.writeText(aiPrompt);
    setMessage('Prompt IA copie.');
  }

  async function save() {
    if (!authUser) return null;
    if (creationMode === 'ai_import' && !aiValidationConfirmed) {
      setError('Validez le questionnaire importé avant de l’enregistrer.');
      return null;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const input: CompanyQuestionnaireInput = {
        title,
        instructions,
        creationMode,
        minimumPassingScorePercent,
        durationMinutes: null,
        questions: questions.map((question, order) => toInput({ ...question, order })),
      };
      const payload = await saveCompanyQuestionnaireClient(authUser, offerId, input);
      setQuestionnaire(payload.questionnaire);
      setMinimumPassingScorePercent(payload.questionnaire.minimumPassingScorePercent);
      setQuestions((current) => current.map((question, order) => ({
        ...question,
        order,
        expectedAnswerText: formatExpectedAnswerText(
          payload.questionnaire.questions.find((item) => item.id === question.id) ?? question,
        ),
        hasExpectedAnswer: payload.questionnaire.questions.find((item) => item.id === question.id)?.hasExpectedAnswer ?? false,
      })));
      setCreationMode(payload.questionnaire.creationMode);
      setAiValidationConfirmed(true);
      setMessage('Questionnaire enregistré en brouillon.');
      return payload.questionnaire;
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le questionnaire n’a pas pu être enregistré.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function activate() {
    if (!authUser) return;
    if (questions.length !== COMPANY_QUESTIONNAIRE_QUESTION_COUNT) {
      setError(`Le questionnaire doit contenir exactement ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions avant activation.`);
      return;
    }
    const saved = await save();
    if (!saved) return;
    setSaving(true);
    try {
      const payload = await activateCompanyQuestionnaireClient(authUser, offerId);
      setQuestionnaire(payload.questionnaire);
      setMessage('Questionnaire actif. Sa correction reste exclusivement côté serveur.');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'L’activation a échoué.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SevenoSurface
      eyebrow="Espace entreprise"
      title="Questionnaire entreprise"
      description={`Questionnaire propre a l offre : ${offer?.title || 'Offre sans titre'}`}
      actions={(
        <Link href={`/entreprise/offres/${offerId}/modifier`} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
          Retour a l offre
        </Link>
      )}
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
        {profile?.profileStatus === 'suspended' ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">Profil suspendu : le questionnaire ne peut pas être modifié.</p></SevenoPanel> : null}
        {profile && isCompanyProfileIncomplete(profile) ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">Profil entreprise incomplet : le questionnaire peut rester en brouillon, mais l’offre ne pourra pas être publiée.</p></SevenoPanel> : null}
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
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Temps par question</p>
                  <p className="mt-2 text-lg font-semibold text-white">{COMPANY_QUESTION_TIME_LIMIT_SECONDS} s</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Durée maximale</p>
                  <p className="mt-2 text-lg font-semibold text-white">{estimatedDuration}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Progression</p>
                  <p className="mt-2 text-lg font-semibold text-white">{questions.length} / {COMPANY_QUESTIONNAIRE_QUESTION_COUNT}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Mode</p>
                  <p className="mt-2 text-lg font-semibold text-white">{creationMode === 'ai_import' ? 'Import IA' : 'Création manuelle'}</p>
                </article>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Le questionnaire doit contenir exactement {COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions avant activation.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-200">Titre<input value={title} onChange={(event) => { setTitle(event.target.value); resetAiValidation(); }} className={FIELD} /></label>
                <label className="space-y-2 text-sm text-slate-200">
                  Seuil minimum de réussite
                  <Select
                    value={minimumPassingScorePercent}
                    onChange={(event) => setMinimumPassingScorePercent(Number(event.target.value))}
                  >
                    {COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {value} % - {Math.round((value / 100) * COMPANY_QUESTIONNAIRE_QUESTION_COUNT)} bonnes réponses sur {COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Instructions<textarea value={instructions} onChange={(event) => { setInstructions(event.target.value); resetAiValidation(); }} className={FIELD} rows={4} /></label>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Seuil actif : {minimumPassingScorePercent} % soit {Math.round((minimumPassingScorePercent / 100) * COMPANY_QUESTIONNAIRE_QUESTION_COUNT)} bonnes réponses sur {COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions.
              </p>
            </SevenoPanel>

            <SevenoPanel tone="neutral" className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Preparation IA</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Génère un prompt puis importe un JSON</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void copyPrompt()} disabled={!aiPrompt} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 disabled:opacity-40">Copier le prompt IA</button>
                  <label className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                    Importer un JSON
                    <input type="file" accept=".json,application/json" onChange={(event) => void handleAiImportFile(event)} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-white">Prompt à envoyer à l’IA externe</p>
                  <textarea value={aiPrompt} readOnly rows={18} className={`${FIELD} font-mono text-xs leading-6`} />
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-white">JSON importé</p>
                  <textarea
                    value={aiImportText}
                    onChange={(event) => {
                      setAiImportText(event.target.value);
                      resetAiValidation();
                    }}
                    placeholder="Collez ici le JSON généré par l’IA, puis validez son import."
                    rows={18}
                    className={`${FIELD} font-mono text-xs leading-6`}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          applyAiImport(aiImportText);
                        } catch (thrownError) {
                          setError(thrownError instanceof Error ? thrownError.message : 'Le JSON importé est invalide.');
                        }
                      }}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
                    >
                      Valider l’import
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreationMode('manual');
                        setAiValidationConfirmed(true);
                        setAiImportWarnings([]);
                        setMessage('Mode manuel reactivé.');
                      }}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                    >
                      Revenir au manuel
                    </button>
                  </div>
                  {aiImportWarnings.length ? (
                    <div className="rounded-2xl border border-orange-300/20 bg-orange-400/10 p-4 text-sm text-orange-100">
                      <p className="font-semibold">Avertissements avant validation finale</p>
                      <ul className="mt-3 space-y-2">
                        {aiImportWarnings.map((warning) => (
                          <li key={warning}>- {warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                      Le JSON importé doit être relu par l’entreprise avant enregistrement.
                    </div>
                  )}
                  {creationMode === 'ai_import' ? (
                    <label className="flex items-start gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                      <input
                        type="checkbox"
                        checked={aiValidationConfirmed}
                        onChange={(event) => setAiValidationConfirmed(event.target.checked)}
                        className="mt-1 accent-cyan-400"
                      />
                      <span>Je confirme avoir relu, valide et accepte ce questionnaire importé avant son enregistrement.</span>
                    </label>
                  ) : null}
                </div>
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
                        <button
                          type="button"
                          onClick={() => duplicateQuestion(question)}
                          disabled={questions.length >= COMPANY_QUESTIONNAIRE_QUESTION_COUNT}
                          className="rounded-full border border-violet-300/20 px-3 py-1 text-xs text-violet-100 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Dupliquer
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id).map((item, order) => ({ ...item, order })))}
                          className="rounded-full border border-rose-300/20 px-3 py-1 text-xs text-rose-100"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Intitule<input value={question.prompt} onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })} className={FIELD} /></label>
                      <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Aide optionnelle<input value={question.help ?? ''} onChange={(event) => updateQuestion(question.id, { help: event.target.value })} className={FIELD} /></label>
                      <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Explication / correction attendue<textarea value={question.explanation ?? ''} onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} className={FIELD} rows={3} /></label>
                      <label className="space-y-2 text-sm text-slate-200">Type<Select value={question.type} onChange={(event) => changeType(question, event.target.value as CompanyQuestionType)}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
                      <label className="space-y-2 text-sm text-slate-200">Difficulte<Select value={question.difficulty ?? 'medium'} onChange={(event) => updateQuestion(question.id, { difficulty: event.target.value as CompanyQuestionDifficulty })}>{Object.entries(DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
                      <label className="space-y-2 text-sm text-slate-200">Points<input type="number" min="0" max="100" value={question.points} onChange={(event) => updateQuestion(question.id, { points: Number(event.target.value) })} className={FIELD} /></label>
                      <label className="flex items-center gap-3 text-sm text-slate-200"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} className="accent-cyan-400" />Question obligatoire</label>
                      {['single_choice', 'multiple_choice', 'boolean', 'number'].includes(question.type) ? (
                        <label className="space-y-2 text-sm text-slate-200">
                          Correction
                          <Select
                            value={question.correctionMode}
                            onChange={(event) => updateQuestion(question.id, {
                              correctionMode: event.target.value as CompanyQuestionCorrectionMode,
                              expectedAnswerText: '',
                              hasExpectedAnswer: false,
                            })}
                          >
                            <option value="automatic">Automatique</option>
                            <option value="manual">Manuelle</option>
                          </Select>
                        </label>
                      ) : null}

                      {isChoice ? (
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:col-span-2">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">Réponses proposées</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {question.type === 'single_choice'
                                  ? 'Le candidat pourra sélectionner une seule réponse.'
                                  : 'Le candidat pourra sélectionner plusieurs réponses.'}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-cyan-100">{question.options.length} réponses sur 4</span>
                          </div>

                          {question.options.map((option) => (
                            <div key={option.id} className="flex items-center gap-3">
                              {question.correctionMode === 'automatic' ? (
                                <input
                                  type={question.type === 'single_choice' ? 'radio' : 'checkbox'}
                                  name={`correct-answer-${question.id}`}
                                  checked={correctOptionIds.includes(option.id)}
                                  onChange={(event) => selectCorrectOption(question, option.id, event.target.checked)}
                                  aria-label={`Marquer la réponse ${option.order} comme correcte`}
                                  className="h-4 w-4 shrink-0 accent-cyan-400"
                                />
                              ) : null}
                              <span className="w-6 shrink-0 text-xs text-slate-500">{option.order}.</span>
                              <input
                                value={option.label}
                                onChange={(event) => updateOptionLabel(question, option.id, event.target.value)}
                                aria-label={`Libellé de la réponse ${option.order}`}
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
                              Ajouter une réponse
                            </button>
                            {question.correctionMode === 'automatic' ? <p className="text-xs text-emerald-200">{correctOptionIds.length} bonne(s) réponse(s) sélectionnée(s)</p> : null}
                          </div>
                        </div>
                      ) : null}

                      {question.correctionMode === 'automatic' && !isChoice ? (
                        <>
                          <label className="space-y-2 text-sm text-slate-200">Nouvelle réponse attendue<input value={question.expectedAnswerText} onChange={(event) => updateQuestion(question.id, { expectedAnswerText: event.target.value })} className={FIELD} placeholder={question.type === 'boolean' ? 'true ou false' : 'Valeur attendue'} /></label>
                          {question.type === 'number' ? <label className="space-y-2 text-sm text-slate-200">Critere<Select value={question.numberOperator ?? 'equals'} onChange={(event) => updateQuestion(question.id, { numberOperator: event.target.value as 'equals' | 'minimum' | 'maximum' })}><option value="equals">Égal à</option><option value="minimum">Minimum</option><option value="maximum">Maximum</option></Select></label> : null}
                          <p className="text-xs text-emerald-200 md:col-span-2">{question.hasExpectedAnswer && !question.expectedAnswerText ? 'Une correction existe côté serveur. Laissez vide pour la conserver.' : 'La correction saisie sera stockée côté serveur.'}</p>
                        </>
                      ) : null}
                    </div>
                  </SevenoPanel>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setQuestions((current) => (current.length >= COMPANY_QUESTIONNAIRE_QUESTION_COUNT ? current : [...current, newQuestion(current.length)]))}
              disabled={questions.length >= COMPANY_QUESTIONNAIRE_QUESTION_COUNT}
              className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Ajouter une question
            </button>

            {creationMode === 'ai_import' ? (
              <SevenoPanel tone="orange">
                <p className="text-sm text-orange-100">
                  Le questionnaire importé doit être relu puis validé avant enregistrement.
                </p>
              </SevenoPanel>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={saving || (creationMode === 'ai_import' && !aiValidationConfirmed)} onClick={() => void save()} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Enregistrer le brouillon</button>
              <button type="button" onClick={() => setPreview(true)} className="rounded-full border border-violet-300/20 bg-violet-400/10 px-5 py-3 text-sm font-semibold text-violet-100">Prévisualiser</button>
              <button
                type="button"
                disabled={saving || (creationMode === 'ai_import' && !aiValidationConfirmed) || questions.length !== COMPANY_QUESTIONNAIRE_QUESTION_COUNT}
                onClick={() => void activate()}
                className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Activer le questionnaire
              </button>
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
                      <p className="mt-2 text-xs text-slate-400">{TYPE_LABELS[question.type]} - {question.points} point(s) - {question.difficulty ? DIFFICULTY_LABELS[question.difficulty] : 'Moyenne'}</p>
                      {question.explanation ? <p className="mt-2 text-xs text-cyan-100">{question.explanation}</p> : null}
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
