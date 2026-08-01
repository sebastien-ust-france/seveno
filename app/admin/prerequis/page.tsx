'use client';

import Link from 'next/link';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { JOB_SECTORS } from '@/lib/job-taxonomy';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import {
  PREREQUISITE_ANSWER_TYPES,
  PREREQUISITE_CATEGORIES,
  PREREQUISITE_CRITERION_MODES,
  PREREQUISITE_EVIDENCE_POLICIES,
  PREREQUISITE_OPERATORS,
  PREREQUISITE_RESPONSE_SCOPES,
  PREREQUISITE_STATUSES,
} from '@/lib/seveno-prerequisite-constants';
import type {
  PrerequisiteAnswerType,
  PrerequisiteApplicability,
  PrerequisiteCategory,
  PrerequisiteComparisonOperator,
  PrerequisiteCriterionMode,
  PrerequisiteDefinitionInput,
  PrerequisiteEvidencePolicy,
  PrerequisiteImportReport,
  PrerequisiteResponseScope,
  PrerequisiteStatus,
  SerializedPrerequisiteDefinition,
} from '@/types/seveno-prerequisites';

type LibraryPayload = { items: SerializedPrerequisiteDefinition[]; nextCursor: string | null };
type DetailPayload = { definition: SerializedPrerequisiteDefinition; history: SerializedPrerequisiteDefinition[] };

type FormState = {
  code: string;
  category: PrerequisiteCategory;
  companyLabel: string;
  companyDescription: string;
  candidateQuestion: string;
  candidateHelp: string;
  answerType: PrerequisiteAnswerType;
  optionsText: string;
  criterionMode: PrerequisiteCriterionMode;
  defaultCriterionText: string;
  allowedCriterionValuesText: string;
  comparisonOperator: PrerequisiteComparisonOperator;
  responseScope: PrerequisiteResponseScope;
  evidencePolicy: PrerequisiteEvidencePolicy;
  freshnessDays: string;
  global: boolean;
  sectorIds: string[];
  jobFamilyIds: string[];
  jobRoleIds: string[];
  excludedSectorIds: string[];
  excludedJobFamilyIds: string[];
  excludedJobRoleIds: string[];
  status: PrerequisiteStatus;
};

const EMPTY_FORM: FormState = {
  code: '',
  category: 'license',
  companyLabel: '',
  companyDescription: '',
  candidateQuestion: '',
  candidateHelp: '',
  answerType: 'boolean',
  optionsText: '',
  criterionMode: 'fixed',
  defaultCriterionText: 'true',
  allowedCriterionValuesText: '[]',
  comparisonOperator: 'equals',
  responseScope: 'profile_reusable',
  evidencePolicy: 'none',
  freshnessDays: '',
  global: true,
  sectorIds: [],
  jobFamilyIds: [],
  jobRoleIds: [],
  excludedSectorIds: [],
  excludedJobFamilyIds: [],
  excludedJobRoleIds: [],
  status: 'draft',
};

const FIELD_CLASS = 'w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40';
const ALL_FAMILIES = JOB_SECTORS.flatMap((sector) => sector.families);
const ALL_ROLES = ALL_FAMILIES.flatMap((family) => family.roles);

function collectRoleIdsFromFilters(sectorIds: string[], familyIds: string[], roleIds: string[]) {
  const selected = new Set(roleIds);
  for (const sector of JOB_SECTORS) {
    if (!sectorIds.includes(sector.code)) continue;
    for (const family of sector.families) {
      for (const role of family.roles) selected.add(role.code);
    }
  }
  for (const family of ALL_FAMILIES) {
    if (!familyIds.includes(family.code)) continue;
    for (const role of family.roles) selected.add(role.code);
  }
  return selected;
}

function countApplicableRoles(form: FormState) {
  const included = form.global
    ? new Set(ALL_ROLES.map((role) => role.code))
    : collectRoleIdsFromFilters(form.sectorIds, form.jobFamilyIds, form.jobRoleIds);
  const excluded = collectRoleIdsFromFilters(form.excludedSectorIds, form.excludedJobFamilyIds, form.excludedJobRoleIds);
  let count = 0;
  for (const roleId of included) {
    if (!excluded.has(roleId)) count += 1;
  }
  return count;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Non disponible' : date.toLocaleString('fr-FR');
}

function parseOptions(text: string) {
  if (!text.trim()) return [];
  return text.split('\n').filter((line) => line.trim()).map((line) => {
    const [value, candidateLabel, rankText] = line.split('|').map((part) => part.trim());
    return {
      value,
      candidateLabel,
      ...(rankText ? { rank: Number(rankText) } : {}),
    };
  });
}

function optionsToText(definition: SerializedPrerequisiteDefinition) {
  return definition.options.map((option) => [option.value, option.candidateLabel, option.rank ?? ''].join('|')).join('\n');
}

function readMultipleSelect(event: ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.target.selectedOptions, (option) => option.value);
}

function buildInput(form: FormState): PrerequisiteDefinitionInput {
  const applicability: PrerequisiteApplicability = {
    global: form.global,
    sectorIds: form.global ? [] : form.sectorIds,
    jobFamilyIds: form.global ? [] : form.jobFamilyIds,
    jobRoleIds: form.global ? [] : form.jobRoleIds,
    excludedSectorIds: form.excludedSectorIds,
    excludedJobFamilyIds: form.excludedJobFamilyIds,
    excludedJobRoleIds: form.excludedJobRoleIds,
  };
  return {
    code: form.code,
    category: form.category,
    companyLabel: form.companyLabel,
    ...(form.companyDescription.trim() ? { companyDescription: form.companyDescription } : {}),
    candidateQuestion: form.candidateQuestion,
    ...(form.candidateHelp.trim() ? { candidateHelp: form.candidateHelp } : {}),
    answerType: form.answerType,
    options: parseOptions(form.optionsText),
    criterionMode: form.criterionMode,
    ...(form.defaultCriterionText.trim() ? { defaultCriterion: JSON.parse(form.defaultCriterionText) } : {}),
    allowedCriterionValues: JSON.parse(form.allowedCriterionValuesText || '[]'),
    comparisonOperator: form.comparisonOperator,
    responseScope: form.responseScope,
    evidencePolicy: form.evidencePolicy,
    ...(form.freshnessDays ? { freshnessDays: Number(form.freshnessDays) } : {}),
    applicability,
    status: form.status,
  };
}

function definitionToForm(definition: SerializedPrerequisiteDefinition): FormState {
  return {
    code: definition.code,
    category: definition.category,
    companyLabel: definition.companyLabel,
    companyDescription: definition.companyDescription ?? '',
    candidateQuestion: definition.candidateQuestion,
    candidateHelp: definition.candidateHelp ?? '',
    answerType: definition.answerType,
    optionsText: optionsToText(definition),
    criterionMode: definition.criterionMode,
    defaultCriterionText: definition.defaultCriterion === undefined ? '' : JSON.stringify(definition.defaultCriterion),
    allowedCriterionValuesText: JSON.stringify(definition.allowedCriterionValues),
    comparisonOperator: definition.comparisonOperator,
    responseScope: definition.responseScope,
    evidencePolicy: definition.evidencePolicy,
    freshnessDays: definition.freshnessDays === undefined ? '' : String(definition.freshnessDays),
    global: definition.applicability.global,
    sectorIds: definition.applicability.sectorIds,
    jobFamilyIds: definition.applicability.jobFamilyIds,
    jobRoleIds: definition.applicability.jobRoleIds,
    excludedSectorIds: definition.applicability.excludedSectorIds,
    excludedJobFamilyIds: definition.applicability.excludedJobFamilyIds,
    excludedJobRoleIds: definition.applicability.excludedJobRoleIds,
    status: definition.status,
  };
}

export default function AdminPrerequisitesPage() {
  const [items, setItems] = useState<SerializedPrerequisiteDefinition[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PrerequisiteStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<PrerequisiteCategory | ''>('');
  const [filterSectorId, setFilterSectorId] = useState('');
  const [filterFamilyId, setFilterFamilyId] = useState('');
  const [filterRoleId, setFilterRoleId] = useState('');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [history, setHistory] = useState<SerializedPrerequisiteDefinition[]>([]);
  const [importText, setImportText] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importReport, setImportReport] = useState<PrerequisiteImportReport | null>(null);
  const [dryRunSignature, setDryRunSignature] = useState<string | null>(null);
  const [dryRunToken, setDryRunToken] = useState<string | null>(null);

  const filterFamilies = JOB_SECTORS.find((sector) => sector.code === filterSectorId)?.families ?? [];
  const filterRoles = filterFamilies.find((family) => family.code === filterFamilyId)?.roles ?? [];
  const coveredRoleCount = countApplicableRoles(form);

  async function loadLibrary(append = false, cursor?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (filterSectorId) params.set('sectorId', filterSectorId);
      if (filterFamilyId) params.set('jobFamilyId', filterFamilyId);
      if (filterRoleId) params.set('jobRoleId', filterRoleId);
      if (cursor) params.set('cursor', cursor);
      const payload = await fetchSevenoAdminApi<LibraryPayload>(`/api/admin/prerequisites?${params.toString()}`);
      setItems((current) => append ? [...current, ...payload.items] : payload.items);
      setNextCursor(payload.nextCursor);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La bibliotheque n a pas pu etre chargee.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLibrary();
    // Initial load only; filters are applied explicitly by the admin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const input = buildInput(form);
      const path = editingCode ? `/api/admin/prerequisites/${encodeURIComponent(editingCode)}` : '/api/admin/prerequisites';
      await fetchSevenoAdminApi(path, {
        method: editingCode ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      });
      setMessage(editingCode ? 'Prérequis modifié et versionné.' : 'Prérequis créé.');
      setForm(EMPTY_FORM);
      setEditingCode(null);
      setHistory([]);
      await loadLibrary();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function editDefinition(code: string) {
    try {
      const payload = await fetchSevenoAdminApi<DetailPayload>(`/api/admin/prerequisites/${encodeURIComponent(code)}`);
      setEditingCode(code);
      setForm(definitionToForm(payload.definition));
      setHistory(payload.history);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Lecture impossible.');
    }
  }

  async function changeStatus(code: string, status: PrerequisiteStatus) {
    try {
      await fetchSevenoAdminApi(`/api/admin/prerequisites/${encodeURIComponent(code)}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await loadLibrary();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Changement de statut impossible.');
    }
  }

  async function duplicateDefinition(code: string) {
    const newCode = window.prompt('Nouveau code stable pour la copie :', `${code}-copie`)?.trim();
    if (!newCode) return;
    try {
      await fetchSevenoAdminApi(`/api/admin/prerequisites/${encodeURIComponent(code)}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ newCode }),
      });
      await loadLibrary();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Duplication impossible.');
    }
  }

  function parseImportItems() {
    const parsed = JSON.parse(importText) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && 'items' in parsed && Array.isArray((parsed as { items?: unknown }).items)) {
      return (parsed as { items: unknown[] }).items;
    }
    throw new Error('Le JSON doit contenir un tableau ou une propriete items.');
  }

  async function runImport(dryRun: boolean) {
    try {
      const importedItems = parseImportItems();
      const signature = JSON.stringify({ importedItems, updateExisting });
      if (!dryRun && signature !== dryRunSignature) throw new Error('Executez un nouveau dry-run avant l import reel.');
      if (!dryRun && !dryRunToken) throw new Error('Le jeton du dry-run est absent ou expire.');
      const payload = await fetchSevenoAdminApi<{ report: PrerequisiteImportReport }>('/api/admin/prerequisites/import', {
        method: 'POST',
        body: JSON.stringify({ dryRun, updateExisting, ...(dryRunToken ? { dryRunToken } : {}), items: importedItems }),
      });
      setImportReport(payload.report);
      if (dryRun && payload.report.errors.length === 0 && payload.report.dryRunToken) {
        setDryRunSignature(signature);
        setDryRunToken(payload.report.dryRunToken);
      }
      if (!dryRun) {
        setDryRunSignature(null);
        setDryRunToken(null);
        await loadLibrary();
      }
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Import impossible.');
    }
  }

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Bibliothèque des prérequis"
      description="Définitions contrôlées par Seven’O. Les entreprises sélectionnent ces entrées sans pouvoir rédiger librement leurs critères."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        <SevenoPanel tone="neutral" className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">File privee</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Suggestions de prerequis</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Consultez la file privee des prerequis remontes par les entreprises, sans aucune action de moderation.
            </p>
          </div>
          <Link
            href="/admin/prerequis/suggestions"
            className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Ouvrir la file privee
          </Link>
        </SevenoPanel>

        {error ? <SevenoPanel tone="orange" className="p-4 text-sm text-orange-100">{error}</SevenoPanel> : null}
        {message ? <SevenoPanel tone="cyan" className="p-4 text-sm text-cyan-100">{message}</SevenoPanel> : null}

        <form onSubmit={handleSave} className="space-y-5">
          <SevenoPanel tone="cyan" className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Définition</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{editingCode ? `Modifier ${editingCode}` : 'Créer un prérequis'}</h2>
              </div>
              {editingCode ? (
                <button type="button" onClick={() => { setEditingCode(null); setForm(EMPTY_FORM); setHistory([]); }} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
                  Annuler
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-200">Code stable
                <input value={form.code} disabled={Boolean(editingCode)} onChange={(event) => setForm({ ...form, code: event.target.value })} className={FIELD_CLASS} placeholder="permis-b" />
              </label>
              <label className="space-y-2 text-sm text-slate-200">Catégorie
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as PrerequisiteCategory })} className={FIELD_CLASS}>
                  {PREREQUISITE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-200">Statut initial
                <select value={form.status} disabled={Boolean(editingCode)} onChange={(event) => setForm({ ...form, status: event.target.value as PrerequisiteStatus })} className={FIELD_CLASS}>
                  {PREREQUISITE_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Libellé entreprise
                <input value={form.companyLabel} onChange={(event) => setForm({ ...form, companyLabel: event.target.value })} className={FIELD_CLASS} />
              </label>
              <label className="space-y-2 text-sm text-slate-200 md:col-span-2 xl:col-span-3">Description entreprise
                <textarea value={form.companyDescription} onChange={(event) => setForm({ ...form, companyDescription: event.target.value })} className={FIELD_CLASS} rows={2} />
              </label>
              <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Question candidat
                <textarea value={form.candidateQuestion} onChange={(event) => setForm({ ...form, candidateQuestion: event.target.value })} className={FIELD_CLASS} rows={2} />
              </label>
              <label className="space-y-2 text-sm text-slate-200 md:col-span-2 xl:col-span-3">Aide candidat
                <textarea value={form.candidateHelp} onChange={(event) => setForm({ ...form, candidateHelp: event.target.value })} className={FIELD_CLASS} rows={2} />
              </label>
            </div>
          </SevenoPanel>

          <SevenoPanel tone="violet" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200/80">Réponse et critère</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-200">Type de réponse
                <select value={form.answerType} onChange={(event) => setForm({ ...form, answerType: event.target.value as PrerequisiteAnswerType })} className={FIELD_CLASS}>
                  {PREREQUISITE_ANSWER_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-200">Opérateur
                <select value={form.comparisonOperator} onChange={(event) => setForm({ ...form, comparisonOperator: event.target.value as PrerequisiteComparisonOperator })} className={FIELD_CLASS}>
                  {PREREQUISITE_OPERATORS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-200">Mode du critère
                <select value={form.criterionMode} onChange={(event) => setForm({ ...form, criterionMode: event.target.value as PrerequisiteCriterionMode })} className={FIELD_CLASS}>
                  {PREREQUISITE_CRITERION_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-200 md:col-span-2 xl:col-span-3">Options, une par ligne : valeur|libellé candidat|rang
                <textarea value={form.optionsText} onChange={(event) => setForm({ ...form, optionsText: event.target.value })} className={FIELD_CLASS} rows={4} placeholder={'A1|Niveau A1|1\nA2|Niveau A2|2'} />
              </label>
              <label className="space-y-2 text-sm text-slate-200">Critère par défaut, JSON
                <input value={form.defaultCriterionText} onChange={(event) => setForm({ ...form, defaultCriterionText: event.target.value })} className={FIELD_CLASS} placeholder={'true ou "B2"'} />
              </label>
              <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Valeurs configurables autorisées, tableau JSON
                <input value={form.allowedCriterionValuesText} onChange={(event) => setForm({ ...form, allowedCriterionValuesText: event.target.value })} className={FIELD_CLASS} placeholder={'["B1","B2","C1"]'} />
              </label>
              <label className="space-y-2 text-sm text-slate-200">Portée de réponse
                <select value={form.responseScope} onChange={(event) => setForm({ ...form, responseScope: event.target.value as PrerequisiteResponseScope })} className={FIELD_CLASS}>
                  {PREREQUISITE_RESPONSE_SCOPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-200">Politique de preuve
                <select value={form.evidencePolicy} onChange={(event) => setForm({ ...form, evidencePolicy: event.target.value as PrerequisiteEvidencePolicy })} className={FIELD_CLASS}>
                  {PREREQUISITE_EVIDENCE_POLICIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-200">Fraîcheur en jours
                <input type="number" min="1" max="3650" value={form.freshnessDays} onChange={(event) => setForm({ ...form, freshnessDays: event.target.value })} className={FIELD_CLASS} />
              </label>
            </div>
          </SevenoPanel>

          <SevenoPanel tone="orange" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-200/80">Applicabilité métier</p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
              Ce prérequis sera applicable à : {form.global ? 'tous les métiers' : `${form.sectorIds.length} ${form.sectorIds.length > 1 ? 'secteurs' : 'secteur'}, ${form.jobFamilyIds.length} ${form.jobFamilyIds.length > 1 ? 'familles' : 'famille'}, ${form.jobRoleIds.length} ${form.jobRoleIds.length > 1 ? 'métiers spécifiques' : 'métier spécifique'}`}.
              {' '}
              Exclusions actives : {form.excludedSectorIds.length} {form.excludedSectorIds.length > 1 ? 'secteurs' : 'secteur'}, {form.excludedJobFamilyIds.length} {form.excludedJobFamilyIds.length > 1 ? 'familles' : 'famille'}, {form.excludedJobRoleIds.length} {form.excludedJobRoleIds.length > 1 ? 'métiers' : 'métier'}.
              {' '}
              Couverture estimée : {coveredRoleCount} {coveredRoleCount > 1 ? 'métiers' : 'métier'}.
            </div>
            <label className="mt-4 flex items-center gap-3 text-sm text-white">
              <input type="checkbox" checked={form.global} onChange={(event) => setForm({ ...form, global: event.target.checked })} className="accent-cyan-400" />
              Prérequis transversal à tous les métiers
            </label>
            {!form.global ? (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="space-y-2 text-sm text-slate-200">Secteurs
                  <select multiple value={form.sectorIds} onChange={(event) => setForm({ ...form, sectorIds: readMultipleSelect(event) })} className={FIELD_CLASS + ' min-h-44'}>
                    {JOB_SECTORS.map((sector) => <option key={sector.code} value={sector.code}>{sector.label}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-slate-200">Familles métier
                  <select multiple value={form.jobFamilyIds} onChange={(event) => setForm({ ...form, jobFamilyIds: readMultipleSelect(event) })} className={FIELD_CLASS + ' min-h-44'}>
                    {ALL_FAMILIES.map((family) => <option key={family.code} value={family.code}>{family.label}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-slate-200">Métiers précis
                  <select multiple value={form.jobRoleIds} onChange={(event) => setForm({ ...form, jobRoleIds: readMultipleSelect(event) })} className={FIELD_CLASS + ' min-h-44'}>
                    {ALL_ROLES.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}
                  </select>
                </label>
              </div>
            ) : null}
            <div className="mt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-200/80">Exclusions</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="space-y-2 text-sm text-slate-200">Secteurs exclus
                  <select multiple value={form.excludedSectorIds} onChange={(event) => setForm({ ...form, excludedSectorIds: readMultipleSelect(event) })} className={FIELD_CLASS + ' min-h-40'}>
                    {JOB_SECTORS.map((sector) => <option key={sector.code} value={sector.code}>{sector.label}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-slate-200">Familles exclues
                  <select multiple value={form.excludedJobFamilyIds} onChange={(event) => setForm({ ...form, excludedJobFamilyIds: readMultipleSelect(event) })} className={FIELD_CLASS + ' min-h-40'}>
                    {ALL_FAMILIES.map((family) => <option key={family.code} value={family.code}>{family.label}</option>)}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-slate-200">Métiers exclus
                  <select multiple value={form.excludedJobRoleIds} onChange={(event) => setForm({ ...form, excludedJobRoleIds: readMultipleSelect(event) })} className={FIELD_CLASS + ' min-h-40'}>
                    {ALL_ROLES.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </SevenoPanel>

          <button disabled={saving} className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? 'Enregistrement...' : editingCode ? 'Enregistrer une nouvelle version' : 'Créer la définition'}
          </button>
        </form>

        {history.length > 0 ? (
          <SevenoPanel tone="neutral" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Historique minimal</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {history.map((item) => <span key={`${item.code}-${item.version}`} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">v{item.version} - {formatDate(item.updatedAt)}</span>)}
            </div>
          </SevenoPanel>
        ) : null}

        <SevenoPanel tone="neutral" className="p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-56 flex-1 space-y-2 text-sm text-slate-200">Recherche texte
              <input value={search} onChange={(event) => setSearch(event.target.value)} className={FIELD_CLASS} placeholder="Code ou libellé" />
            </label>
            <label className="space-y-2 text-sm text-slate-200">Catégorie
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as PrerequisiteCategory | '')} className={FIELD_CLASS}>
                <option value="">Toutes</option>{PREREQUISITE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-200">Statut
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PrerequisiteStatus | '')} className={FIELD_CLASS}>
                <option value="">Tous</option>{PREREQUISITE_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <select value={filterSectorId} onChange={(event) => { setFilterSectorId(event.target.value); setFilterFamilyId(''); setFilterRoleId(''); }} className={FIELD_CLASS}>
              <option value="">Tous les secteurs</option>{JOB_SECTORS.map((sector) => <option key={sector.code} value={sector.code}>{sector.label}</option>)}
            </select>
            <select value={filterFamilyId} disabled={!filterSectorId} onChange={(event) => { setFilterFamilyId(event.target.value); setFilterRoleId(''); }} className={FIELD_CLASS}>
              <option value="">Toutes les familles</option>{filterFamilies.map((family) => <option key={family.code} value={family.code}>{family.label}</option>)}
            </select>
            <select value={filterRoleId} disabled={!filterFamilyId} onChange={(event) => setFilterRoleId(event.target.value)} className={FIELD_CLASS}>
              <option value="">Tous les métiers</option>{filterRoles.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => void loadLibrary()} className="mt-4 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-2 text-sm font-semibold text-cyan-100">Appliquer les filtres</button>
        </SevenoPanel>

        <SevenoPanel tone="neutral" className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Définitions</h2>
            <span className="text-sm text-slate-400">{items.length} {items.length > 1 ? 'affichés' : 'affiché'}</span>
          </div>
          <div className="mt-4 space-y-3">
            {loading && items.length === 0 ? <p className="text-sm text-slate-400">Chargement...</p> : items.map((item) => (
              <article key={item.id} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">{item.code} - v{item.version}</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{item.companyLabel}</h3>
                    <p className="mt-2 text-sm text-slate-300">{item.candidateQuestion}</p>
                    <p className="mt-2 text-xs text-slate-500">{item.source} - {item.category} - {item.answerType} - {item.comparisonOperator} - {item.applicabilityKeys.join(', ')}{item.exclusionKeys.length ? ` | exclusions: ${item.exclusionKeys.join(', ')}` : ''}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">{item.status}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void editDefinition(item.code)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white">Modifier</button>
                  <button type="button" onClick={() => void duplicateDefinition(item.code)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white">Dupliquer</button>
                  {item.status !== 'active' ? <button type="button" onClick={() => void changeStatus(item.code, 'active')} className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">Activer</button> : null}
                  {item.status !== 'archived' ? <button type="button" onClick={() => void changeStatus(item.code, 'archived')} className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-2 text-xs text-orange-100">Archiver</button> : null}
                </div>
              </article>
            ))}
          </div>
          {nextCursor ? <button type="button" disabled={loading} onClick={() => void loadLibrary(true, nextCursor)} className="mt-4 rounded-full border border-white/10 px-5 py-2 text-sm text-white">Charger la suite</button> : null}
        </SevenoPanel>

        <SevenoPanel tone="orange" className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-200/80">Import / export</p><h2 className="mt-2 text-xl font-semibold text-white">Import JSON securise</h2></div>
            <Link href="/api/admin/prerequisites/export" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white">Exporter en JSON</Link>
          </div>
          <textarea value={importText} onChange={(event) => { setImportText(event.target.value); setDryRunSignature(null); setDryRunToken(null); }} className={FIELD_CLASS + ' mt-4 font-mono'} rows={10} placeholder="Collez le tableau items du format officiel." />
          <label className="mt-3 flex items-center gap-3 text-sm text-slate-200"><input type="checkbox" checked={updateExisting} onChange={(event) => { setUpdateExisting(event.target.checked); setDryRunSignature(null); setDryRunToken(null); }} className="accent-cyan-400" />Autoriser explicitement la mise a jour des codes existants</label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => void runImport(true)} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-2 text-sm font-semibold text-cyan-100">Executer le dry-run</button>
            <button type="button" disabled={!dryRunSignature || Boolean(importReport?.errors.length)} onClick={() => void runImport(false)} className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">Appliquer l import valide</button>
          </div>
          {importReport ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p>{importReport.dryRun ? 'Simulation' : 'Import'} : {importReport.total} {importReport.total > 1 ? 'entrées' : 'entrée'}, {importReport.created.length} {importReport.created.length > 1 ? 'créations' : 'création'}, {importReport.updated.length} {importReport.updated.length > 1 ? 'mises à jour' : 'mise à jour'}, {importReport.unchanged.length} {importReport.unchanged.length > 1 ? 'inchangées' : 'inchangée'}, {importReport.errors.length} {importReport.errors.length > 1 ? 'erreurs' : 'erreur'}.</p>
              {importReport.errors.map((item) => <p key={`${item.index}-${item.code ?? ''}`} className="mt-2 text-orange-200">Ligne {item.index + 1} {item.code ?? ''}: {item.message}</p>)}
            </div>
          ) : null}
        </SevenoPanel>
      </div>
    </SevenoSurface>
  );
}
