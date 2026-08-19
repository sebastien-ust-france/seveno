'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { PrerequisiteLibraryPicker } from '@/components/entreprise/PrerequisiteLibraryPicker';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { GeographicLocationFields } from '@/components/ui/GeographicLocationFields';
import { Select } from '@/components/ui/Select';
import { JOB_SECTORS } from '@/lib/job-taxonomy';
import { formatGeographicLocation, type GeographicLocation } from '@/lib/seveno-geography';
import {
  PREREQUISITE_CATEGORIES,
  SEVENO_OFFER_PREREQUISITE_LIMITS,
} from '@/lib/seveno-prerequisite-constants';
import { resolvePrerequisiteFamily } from '@/lib/seveno-prerequisite-families';
import {
  createCompanyPrerequisiteClient,
  changeCompanyJobOfferStatus,
  getCompanyJobOffer,
  listApplicableOfferPrerequisites,
  saveCompanyJobOffer,
  serializedJobOfferToInput,
} from '@/lib/seveno-job-offers';
import { listCompanyQuestionnairesClient } from '@/lib/seveno-company-questionnaires';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';
import { isCompanyProfileIncomplete } from '@/lib/seveno-companies';
import type {
  JobOfferContractType,
  JobOfferInput,
  JobOfferPrerequisiteSelectionInput,
  JobOfferWorkingTime,
  JobOfferWorkMode,
  SerializedJobOffer,
} from '@/types/seveno-job-offers';
import type {
  CompanyQuestionnaireListItem,
  CompanyQuestionnaireStatus,
} from '@/types/seveno-company-questionnaires';
import type {
  CompanyPrerequisiteDefinition,
  PrerequisiteCriterionValue,
  PrerequisiteImportance,
  PrerequisiteCategory,
  CompanyPrerequisiteCreationInput,
  PrerequisiteFamily,
  OfferRequirementCategory,
} from '@/types/seveno-prerequisites';

const FIELD = 'w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50';
const EMPTY_INPUT: JobOfferInput = {
  title: '',
  sectorId: '',
  jobFamilyId: '',
  jobRoleId: '',
  location: '',
  countryCode: '',
  countryName: '',
  administrativeAreaCode: '',
  administrativeAreaName: '',
  city: '',
  cityName: '',
  workMode: '',
  contractType: '',
  workingTime: '',
  description: '',
  missions: '',
  profileSummary: '',
  questionnaireId: '',
  questionnaireRequired: false,
  requiredPrerequisites: [],
  preferredPrerequisites: [],
};
const STEPS = ['Poste', 'Conditions', 'Prérequis', 'Questionnaire entreprise', 'Présentation', 'Vérification'];
const QUESTIONNAIRE_STATUS_LABELS: Record<CompanyQuestionnaireStatus, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
};

function criterionKey(value: PrerequisiteCriterionValue) {
  return JSON.stringify(value);
}

function criterionLabel(definition: CompanyPrerequisiteDefinition | undefined, value: PrerequisiteCriterionValue) {
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) {
    return value.map((item) => definition?.options.find((option) => option.value === item)?.candidateLabel ?? item).join(' ou ');
  }
  if (typeof value === 'string') {
    return definition?.options.find((option) => option.value === value)?.candidateLabel ?? value;
  }
  return String(value);
}

function prerequisiteAnswerTypeLabel(definition: CompanyPrerequisiteDefinition | undefined) {
  if (!definition) return 'Type conservé dans le snapshot';
  if (definition.answerType === 'boolean') return 'Oui / non';
  if (definition.answerType === 'single_choice') return 'Choix unique';
  if (definition.answerType === 'multiple_choice') return 'Choix multiple';
  if (definition.answerType === 'number') return 'Nombre';
  if (definition.answerType === 'level') return 'Niveau ordonné';
  return 'Date';
}

function initialCriterion(definition: CompanyPrerequisiteDefinition) {
  if (definition.criterionMode === 'fixed' && definition.defaultCriterion !== undefined) return definition.defaultCriterion;
  const first = definition.allowedCriterionValues[0];
  if (first === undefined) throw new Error('Ce prérequis ne possède aucune valeur configurable.');
  return first;
}

function questionnaireLabel(questionnaire: CompanyQuestionnaireListItem) {
  const title = questionnaire.title || 'Questionnaire sans titre';
  return `${title} – ${QUESTIONNAIRE_STATUS_LABELS[questionnaire.status]} – ${questionnaire.questionCount} ${questionnaire.questionCount > 1 ? 'questions' : 'question'}`;
}

function workModeLabel(value: JobOfferWorkMode | '' | null | undefined) {
  if (value === 'onsite') return 'Sur site';
  if (value === 'hybrid') return 'Hybride';
  if (value === 'remote') return 'À distance';
  return 'Non renseignée';
}

function contractTypeLabel(value: JobOfferContractType | '' | null | undefined) {
  if (value === 'permanent') return 'CDI';
  if (value === 'fixed_term') return 'CDD';
  if (value === 'temporary') return 'Intérim';
  if (value === 'freelance') return 'Freelance';
  if (value === 'apprenticeship') return 'Alternance';
  if (value === 'internship') return 'Stage';
  if (value === 'other') return 'Autre';
  return 'Non renseigné';
}

function workingTimeLabel(value: JobOfferWorkingTime | '' | null | undefined) {
  if (value === 'full_time') return 'Temps plein';
  if (value === 'part_time') return 'Temps partiel';
  if (value === 'shift') return 'Horaires postes';
  if (value === 'flexible') return 'Flexible';
  if (value === 'other') return 'Autre';
  return 'Non renseigné';
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizePrerequisiteLabel(value: string) {
  return normalizeSearchText(value);
}

function prerequisiteIdentity(definition: Pick<CompanyPrerequisiteDefinition, 'prerequisiteId' | 'code'>) {
  return definition.prerequisiteId || definition.code;
}

function normalizePrerequisiteDefinition(definition: CompanyPrerequisiteDefinition) {
  return {
    ...definition,
    prerequisiteId: prerequisiteIdentity(definition),
  };
}

function mergePrerequisiteDefinitions(
  current: CompanyPrerequisiteDefinition[],
  incoming: CompanyPrerequisiteDefinition[],
) {
  const merged = new Map(current.map((item) => [prerequisiteIdentity(item), item]));
  for (const item of incoming) {
    merged.set(prerequisiteIdentity(item), item);
  }
  return [...merged.values()];
}

function mergeOfferInputPreservingPrerequisites(next: JobOfferInput, current: JobOfferInput): JobOfferInput {
  const sameJobContext = next.sectorId === current.sectorId
    && next.jobFamilyId === current.jobFamilyId
    && next.jobRoleId === current.jobRoleId;
  return {
    ...next,
    requiredPrerequisites: sameJobContext && next.requiredPrerequisites.length === 0 && current.requiredPrerequisites.length > 0
      ? current.requiredPrerequisites
      : next.requiredPrerequisites,
    preferredPrerequisites: sameJobContext && next.preferredPrerequisites.length === 0 && current.preferredPrerequisites.length > 0
      ? current.preferredPrerequisites
      : next.preferredPrerequisites,
  };
}

export function prerequisiteOriginLabel(definition: CompanyPrerequisiteDefinition) {
  if (definition.source === 'company') {
    return definition.originOfferId ? 'Personnalisé' : 'Ma bibliothèque';
  }
  return 'Seven\'O';
}

export function prerequisiteCategoryLabel(value: PrerequisiteCategory) {
  return PREREQUISITE_CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

type SelectionPanelProps = {
  title: string;
  description: string;
  importance: PrerequisiteImportance;
  family: 'job_skill' | 'offer_requirement';
  badge: string;
  canMoveToOther: boolean;
  selections: JobOfferPrerequisiteSelectionInput[];
  definitions: CompanyPrerequisiteDefinition[];
  savedOffer: SerializedJobOffer | null;
  onMove: (id: string, importance: PrerequisiteImportance) => void;
  onRemove: (id: string) => void;
  onCriterion: (id: string, importance: PrerequisiteImportance, value: PrerequisiteCriterionValue) => void;
};

function SelectionPanel({
  title,
  description,
  importance,
  family,
  badge,
  canMoveToOther,
  selections,
  definitions,
  savedOffer,
  onMove,
  onRemove,
  onCriterion,
}: SelectionPanelProps) {
  const savedSnapshots = savedOffer
    ? [...savedOffer.requiredPrerequisites, ...savedOffer.preferredPrerequisites]
    : [];
  return (
    <div data-prerequisite-family={family} className="h-full">
    <SevenoPanel tone={importance === 'required' ? 'orange' : 'blue'} className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
          <span className="mt-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs text-cyan-100">{badge}</span>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">{selections.length}/{importance === 'required' ? 5 : 3}</span>
      </div>
      <div className="mt-5 space-y-3">
        {selections.length === 0 ? <p className="text-sm text-slate-500">Aucune sélection.</p> : selections.map((selection) => {
          const definition = definitions.find((item) => prerequisiteIdentity(item) === selection.prerequisiteId);
          const saved = savedSnapshots.find((item) => item.prerequisiteId === selection.prerequisiteId);
          const label = definition?.companyLabel ?? saved?.companyLabel ?? selection.prerequisiteId;
          return (
            <div key={selection.prerequisiteId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="font-medium text-white">{label}</p>
              {definition ? <p className="mt-2 text-sm text-slate-300">Question : {definition.candidateQuestion}</p> : null}
              <p className="mt-2 text-xs text-slate-400">Type : {prerequisiteAnswerTypeLabel(definition)}</p>
              {definition?.criterionMode === 'configurable' ? (
                <label className="mt-3 block space-y-2 text-xs text-slate-300">
                  Critère attendu
                  <Select
                    value={criterionKey(selection.expectedCriterion)}
                    onChange={(event) => onCriterion(selection.prerequisiteId, importance, JSON.parse(event.target.value) as PrerequisiteCriterionValue)}
                  >
                    {definition.allowedCriterionValues.map((value) => (
                      <option key={criterionKey(value)} value={criterionKey(value)}>{criterionLabel(definition, value)}</option>
                    ))}
                  </Select>
                </label>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  {definition?.comparisonOperator === 'one_of' ? 'Réponses acceptées' : 'Critère Seven’O'} : {criterionLabel(definition, selection.expectedCriterion)}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!definition || !canMoveToOther}
                  onClick={() => onMove(selection.prerequisiteId, importance === 'required' ? 'preferred' : 'required')}
                  title={canMoveToOther ? undefined : 'La liste de destination a atteint sa limite.'}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
                >
                  Déplacer vers {importance === 'required' ? 'valeur ajoutée' : 'obligatoire'}
                </button>
                <button type="button" onClick={() => onRemove(selection.prerequisiteId)} className="rounded-full border border-rose-300/15 px-3 py-1.5 text-xs text-rose-200">Retirer</button>
              </div>
              {!definition && saved ? <p className="mt-2 text-xs text-amber-200">Définition archivée : snapshot conservé sans modification.</p> : null}
            </div>
          );
        })}
      </div>
    </SevenoPanel>
    </div>
  );
}

export default function JobOfferEditor({ offerId }: { offerId?: string }) {
  const router = useRouter();
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const [currentOfferId, setCurrentOfferId] = useState(offerId ?? '');
  const [savedOffer, setSavedOffer] = useState<SerializedJobOffer | null>(null);
  const [input, setInput] = useState<JobOfferInput>(EMPTY_INPUT);
  const [definitionCache, setDefinitionCache] = useState<CompanyPrerequisiteDefinition[]>([]);
  const [visibleDefinitions, setVisibleDefinitions] = useState<CompanyPrerequisiteDefinition[]>([]);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(Boolean(offerId));
  const [prerequisitesLoading, setPrerequisitesLoading] = useState(false);
  const [prerequisiteError, setPrerequisiteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [questionnaires, setQuestionnaires] = useState<CompanyQuestionnaireListItem[]>([]);
  const [questionnairesLoading, setQuestionnairesLoading] = useState(false);
  const [newPrerequisiteOpen, setNewPrerequisiteOpen] = useState(false);
  const [newPrerequisiteSaving, setNewPrerequisiteSaving] = useState(false);
  const [newPrerequisiteName, setNewPrerequisiteName] = useState('');
  const [newPrerequisiteQuestion, setNewPrerequisiteQuestion] = useState('');
  const [newPrerequisiteHelp, setNewPrerequisiteHelp] = useState('');
  const [newPrerequisiteAnswerType, setNewPrerequisiteAnswerType] = useState<CompanyPrerequisiteCreationInput['answerType']>('boolean');
  const [newPrerequisiteOptions, setNewPrerequisiteOptions] = useState('');
  const [newPrerequisiteAcceptedValues, setNewPrerequisiteAcceptedValues] = useState('');
  const [newPrerequisiteBooleanExpected, setNewPrerequisiteBooleanExpected] = useState(true);
  const [newPrerequisiteImportance, setNewPrerequisiteImportance] = useState<PrerequisiteImportance>('required');
  const [newPrerequisiteFamily, setNewPrerequisiteFamily] = useState<PrerequisiteFamily>('job_skill');
  const [newOfferRequirementCategory, setNewOfferRequirementCategory] = useState<OfferRequirementCategory>('other');
  const [newPrerequisiteSaveToLibrary, setNewPrerequisiteSaveToLibrary] = useState(false);

  const selectedSector = JOB_SECTORS.find((item) => item.code === input.sectorId);
  const families = selectedSector?.families ?? [];
  const selectedFamily = families.find((item) => item.code === input.jobFamilyId);
  const roles = selectedFamily?.roles ?? [];
  const verificationSector = JOB_SECTORS.find((item) => item.code === (input.sectorId || savedOffer?.sectorId || '')) ?? null;
  const verificationFamily = verificationSector?.families.find((item) => item.code === (input.jobFamilyId || savedOffer?.jobFamilyId || '')) ?? null;
  const verificationRole = verificationFamily?.roles.find((item) => item.code === (input.jobRoleId || savedOffer?.jobRoleId || '')) ?? null;
  const selectedQuestionnaire = questionnaires.find((item) => item.id === input.questionnaireId)
    ?? questionnaires.find((item) => item.offerId === currentOfferId)
    ?? null;
  const savedRequiredPrerequisites = savedOffer?.requiredPrerequisites.map((snapshot) => ({
    prerequisiteId: snapshot.prerequisiteId,
    expectedCriterion: snapshot.expectedCriterion,
  })) ?? [];
  const savedPreferredPrerequisites = savedOffer?.preferredPrerequisites.map((snapshot) => ({
    prerequisiteId: snapshot.prerequisiteId,
    expectedCriterion: snapshot.expectedCriterion,
  })) ?? [];
  const verificationRequiredPrerequisites = input.requiredPrerequisites.length > 0
    ? input.requiredPrerequisites
    : savedRequiredPrerequisites;
  const verificationPreferredPrerequisites = input.preferredPrerequisites.length > 0
    ? input.preferredPrerequisites
    : savedPreferredPrerequisites;
  const questionnaireSummary = selectedQuestionnaire
    ? questionnaireLabel(selectedQuestionnaire)
    : input.questionnaireId || savedOffer?.questionnaireId
    ? `${savedOffer?.questionnaireTitleSnapshot || 'Questionnaire sans titre'} – version ${savedOffer?.questionnaireVersion ?? 'n/a'} – ${savedOffer?.questionnaireQuestionCountSnapshot ?? 0} ${(savedOffer?.questionnaireQuestionCountSnapshot ?? 0) > 1 ? 'questions' : 'question'}`
    : 'Aucun questionnaire associé';
  const verificationTitle = input.title || savedOffer?.title || 'Non renseigné';
  const verificationLocation = input.location || savedOffer?.location || 'Non renseignée';
  const verificationWorkMode = input.workMode || savedOffer?.workMode || '';
  const verificationContractType = input.contractType || savedOffer?.contractType || '';
  const verificationWorkingTime = input.workingTime || savedOffer?.workingTime || '';
  const verificationDescription = input.description || savedOffer?.description || 'Non renseignée';
  const verificationMissions = input.missions || savedOffer?.missions || 'Non renseignées';
  const verificationProfileSummary = input.profileSummary || savedOffer?.profileSummary || 'Non renseigné';
  const canAddRequired = true;
  const canAddPreferred = true;
  const selectionFamily = (selection: JobOfferPrerequisiteSelectionInput) => {
    const definition = definitionCache.find((item) => prerequisiteIdentity(item) === selection.prerequisiteId);
    const snapshot = [...(savedOffer?.requiredPrerequisites ?? []), ...(savedOffer?.preferredPrerequisites ?? [])]
      .find((item) => item.prerequisiteId === selection.prerequisiteId);
    return resolvePrerequisiteFamily(snapshot ?? {
      prerequisiteFamily: definition?.prerequisiteFamily,
      offerRequirementCategory: definition?.offerRequirementCategory,
      category: definition?.category,
      companyLabel: definition?.companyLabel,
      candidateQuestion: definition?.candidateQuestion,
      prerequisiteCode: definition?.code,
    }).prerequisiteFamily;
  };
  const requiredJobSkills = input.requiredPrerequisites.filter((item) => selectionFamily(item) === 'job_skill');
  const preferredJobSkills = input.preferredPrerequisites.filter((item) => selectionFamily(item) === 'job_skill');
  const requiredOfferRequirements = input.requiredPrerequisites.filter((item) => selectionFamily(item) === 'offer_requirement');
  const preferredOfferRequirements = input.preferredPrerequisites.filter((item) => selectionFamily(item) === 'offer_requirement');

  useEffect(() => {
    if (!authUser) {
      setQuestionnaires([]);
      setQuestionnairesLoading(false);
      return;
    }
    const user = authUser;
    let active = true;
    async function loadQuestionnaires() {
      setQuestionnairesLoading(true);
      try {
        const payload = await listCompanyQuestionnairesClient(user);
        if (active) setQuestionnaires(payload.questionnaires);
      } catch (thrownError) {
        if (active) setError(thrownError instanceof Error ? thrownError.message : 'Les questionnaires n’ont pas pu être chargés.');
      } finally {
        if (active) setQuestionnairesLoading(false);
      }
    }
    void loadQuestionnaires();
    return () => { active = false; };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !offerId) {
      if (!offerId) setLoading(false);
      return;
    }
    let active = true;
    async function loadOffer() {
      try {
        const payload = await getCompanyJobOffer(authUser!, offerId!);
        if (!active) return;
        setSavedOffer(payload.offer);
        setCurrentOfferId(payload.offer.id);
        setInput(serializedJobOfferToInput(payload.offer));
      } catch (thrownError) {
        if (active) setError(thrownError instanceof Error ? thrownError.message : 'L’offre n’a pas pu être chargée.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadOffer();
    return () => { active = false; };
  }, [authUser, offerId]);

  useEffect(() => {
    if (!authUser || !input.jobRoleId) {
      setVisibleDefinitions([]);
      setPrerequisitesLoading(false);
      setPrerequisiteError(null);
      return;
    }
    let active = true;
    const searchValue = search.trim();
    setPrerequisitesLoading(true);
    setPrerequisiteError(null);
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const payload = await listApplicableOfferPrerequisites(authUser, input.jobRoleId, {
            offerId: currentOfferId || undefined,
            ...(searchValue ? { query: searchValue } : {}),
            limit: 20,
          });
          if (!active) return;
          const normalizedPrerequisites = payload.prerequisites.map(normalizePrerequisiteDefinition);
          setDefinitionCache((current) => mergePrerequisiteDefinitions(current, normalizedPrerequisites));
          setVisibleDefinitions(normalizedPrerequisites);
        } catch (thrownError) {
          if (active) {
            setPrerequisiteError(thrownError instanceof Error ? thrownError.message : 'Les prérequis n’ont pas pu être chargés.');
            setVisibleDefinitions([]);
          }
        } finally {
          if (active) setPrerequisitesLoading(false);
        }
      })();
    }, searchValue ? 220 : 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [authUser, currentOfferId, input.jobRoleId, search]);

  function changeSector(sectorId: string) {
    setSearch('');
    setVisibleDefinitions([]);
    setPrerequisiteError(null);
    setInput((current) => ({ ...current, sectorId, jobFamilyId: '', jobRoleId: '' }));
  }

  function changeFamily(jobFamilyId: string) {
    setSearch('');
    setVisibleDefinitions([]);
    setPrerequisiteError(null);
    setInput((current) => ({ ...current, jobFamilyId, jobRoleId: '' }));
  }

  function changeRole(jobRoleId: string) {
    if (!authUser) return;
    setSearch('');
    setVisibleDefinitions([]);
    setPrerequisiteError(null);
    setInput((current) => ({
      ...current,
      jobRoleId,
    }));
  }

  function findPrerequisiteDefinition(prerequisiteId: string) {
    return definitionCache.find((item) => prerequisiteIdentity(item) === prerequisiteId);
  }

  function getPrerequisiteLabel(prerequisiteId: string) {
    return findPrerequisiteDefinition(prerequisiteId)?.companyLabel
      ?? savedOffer?.requiredPrerequisites.find((snapshot) => snapshot.prerequisiteId === prerequisiteId)?.companyLabel
      ?? savedOffer?.preferredPrerequisites.find((snapshot) => snapshot.prerequisiteId === prerequisiteId)?.companyLabel
      ?? prerequisiteId;
  }

  function assignPrerequisite(definition: CompanyPrerequisiteDefinition, importance: PrerequisiteImportance) {
    setError(null);
    try {
      const definitionId = prerequisiteIdentity(definition);
      const currentSelections = [...input.requiredPrerequisites, ...input.preferredPrerequisites];
      const normalizedLabel = normalizePrerequisiteLabel(definition.companyLabel);
      const duplicate = currentSelections.find((item) => {
        if (item.prerequisiteId === definitionId) return false;
        const label = getPrerequisiteLabel(item.prerequisiteId);
        return normalizePrerequisiteLabel(label) === normalizedLabel;
      });
      if (duplicate) {
        setError('Ce prérequis est déjà ajouté à cette offre.');
        return;
      }

      setInput((current) => {
        const existingIndexRequired = current.requiredPrerequisites.findIndex((item) => item.prerequisiteId === definitionId);
        const existingIndexPreferred = current.preferredPrerequisites.findIndex((item) => item.prerequisiteId === definitionId);
        const existing = existingIndexRequired >= 0
          ? current.requiredPrerequisites[existingIndexRequired]
          : existingIndexPreferred >= 0
            ? current.preferredPrerequisites[existingIndexPreferred]
            : null;
        const selection = existing ?? {
          prerequisiteId: definitionId,
          expectedCriterion: initialCriterion(definition),
        };
        const nextRequired = current.requiredPrerequisites.filter((item) => item.prerequisiteId !== definitionId);
        const nextPreferred = current.preferredPrerequisites.filter((item) => item.prerequisiteId !== definitionId);
        if (importance === 'required') {
          nextRequired.push(selection);
        } else {
          nextPreferred.push(selection);
        }

        const family = resolvePrerequisiteFamily(definition).prerequisiteFamily;
        const familyOf = (item: JobOfferPrerequisiteSelectionInput) => item.prerequisiteId === definitionId
          ? family
          : selectionFamily(item);
        const nextRequiredCount = nextRequired.filter((item) => familyOf(item) === family).length;
        const nextPreferredCount = nextPreferred.filter((item) => familyOf(item) === family).length;
        if (nextRequiredCount > SEVENO_OFFER_PREREQUISITE_LIMITS[family].required) {
          throw new Error(`Vous avez atteint la limite de 5 ${family === 'job_skill' ? 'compétences métier indispensables' : 'conditions obligatoires'}.`);
        }
        if (nextPreferredCount > SEVENO_OFFER_PREREQUISITE_LIMITS[family].preferred) {
          throw new Error(`Vous avez atteint la limite de 3 ${family === 'job_skill' ? 'compétences métier complémentaires' : 'conditions souhaitées'}.`);
        }
        return {
          ...current,
          requiredPrerequisites: nextRequired,
          preferredPrerequisites: nextPreferred,
        };
      });
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Ce prérequis ne peut pas être sélectionné.');
    }
  }

  function movePrerequisite(id: string, importance: PrerequisiteImportance) {
    const definition = findPrerequisiteDefinition(id);
    if (definition) assignPrerequisite(definition, importance);
  }

  async function openNewPrerequisiteForm() {
    setError(null);
    if (!currentOfferId) {
      const saved = await saveDraft();
      if (!saved) {
        return;
      }
    }
    setNewPrerequisiteName(search.trim());
    setNewPrerequisiteQuestion('');
    setNewPrerequisiteHelp('');
    setNewPrerequisiteAnswerType('boolean');
    setNewPrerequisiteOptions('');
    setNewPrerequisiteAcceptedValues('');
    setNewPrerequisiteBooleanExpected(true);
    setNewPrerequisiteImportance(canAddRequired ? 'required' : 'preferred');
    setNewPrerequisiteSaveToLibrary(false);
    setNewPrerequisiteOpen(true);
  }

  function editPrerequisiteSuggestion(definition: CompanyPrerequisiteDefinition) {
    const supportedType = definition.answerType === 'boolean'
      || definition.answerType === 'single_choice'
      || definition.answerType === 'multiple_choice'
      || definition.answerType === 'number'
      ? definition.answerType
      : 'boolean';
    const criterion = definition.defaultCriterion ?? definition.allowedCriterionValues[0];
    const optionLabelByValue = new Map(definition.options.map((option) => [option.value, option.candidateLabel]));
    setNewPrerequisiteName(definition.companyLabel);
    setNewPrerequisiteQuestion(definition.candidateQuestion);
    setNewPrerequisiteHelp(definition.candidateHelp ?? '');
    setNewPrerequisiteAnswerType(supportedType);
    setNewPrerequisiteOptions(definition.options.map((option) => option.candidateLabel).join('\n'));
    setNewPrerequisiteAcceptedValues(Array.isArray(criterion)
      ? criterion.map((value) => optionLabelByValue.get(String(value)) ?? String(value)).join('\n')
      : typeof criterion === 'string'
        ? optionLabelByValue.get(criterion) ?? criterion
        : typeof criterion === 'number'
          ? String(criterion)
          : '');
    setNewPrerequisiteBooleanExpected(typeof criterion === 'boolean' ? criterion : true);
    setNewPrerequisiteSaveToLibrary(false);
    setNewPrerequisiteOpen(true);
  }

  function resetNewPrerequisiteForm() {
    setNewPrerequisiteOpen(false);
    setNewPrerequisiteSaving(false);
    setNewPrerequisiteName('');
    setNewPrerequisiteQuestion('');
    setNewPrerequisiteHelp('');
    setNewPrerequisiteAnswerType('boolean');
    setNewPrerequisiteOptions('');
    setNewPrerequisiteAcceptedValues('');
    setNewPrerequisiteBooleanExpected(true);
    setNewPrerequisiteImportance('required');
    setNewPrerequisiteFamily('job_skill');
    setNewOfferRequirementCategory('other');
    setNewPrerequisiteSaveToLibrary(false);
  }

  async function saveNewPrerequisite() {
    if (!authUser) return;
    if (!currentOfferId || !input.jobRoleId) {
      setError('Enregistrez d’abord le brouillon avant d’ajouter un prérequis.');
      return;
    }
    const label = newPrerequisiteName.trim().replace(/\s+/g, ' ');
    const candidateQuestion = newPrerequisiteQuestion.trim().replace(/\s+/g, ' ');
    const candidateHelp = newPrerequisiteHelp.trim().replace(/\s+/g, ' ');
    const normalizedLabel = normalizePrerequisiteLabel(label);
    if (!normalizedLabel) {
      setError('Saisissez le nom du prérequis.');
      return;
    }
    if (normalizedLabel.length < 2) {
      setError('Le nom du prérequis doit contenir au moins 2 caractères utiles.');
      return;
    }
    if (label.length > 120) {
      setError('Le nom du prérequis est trop long.');
      return;
    }
    if (!/[\p{L}\p{N}]/u.test(label)) {
      setError('Le nom du prérequis ne peut pas être composé uniquement de ponctuation.');
      return;
    }
    if (!candidateQuestion) {
      setError('Saisissez la question présentée au candidat.');
      return;
    }
    const optionLabels = newPrerequisiteOptions.split('\n').map((item) => item.trim()).filter(Boolean);
    const acceptedLabels = newPrerequisiteAcceptedValues.split('\n').map((item) => item.trim()).filter(Boolean);
    const choiceType = newPrerequisiteAnswerType === 'single_choice' || newPrerequisiteAnswerType === 'multiple_choice';
    if (choiceType && (optionLabels.length < 2 || optionLabels.length > 8)) {
      setError('Un choix personnalisé doit proposer entre 2 et 8 options.');
      return;
    }
    const options = optionLabels.map((candidateLabel, index) => ({
      value: `option-${index + 1}`,
      candidateLabel,
    }));
    const acceptedOptionValues = acceptedLabels.map((acceptedLabel) => {
      const index = optionLabels.findIndex((labelValue) => normalizePrerequisiteLabel(labelValue) === normalizePrerequisiteLabel(acceptedLabel));
      return index >= 0 ? `option-${index + 1}` : '';
    });
    if (choiceType && (acceptedOptionValues.some((value) => !value) || acceptedOptionValues.length === 0)) {
      setError('Chaque réponse acceptée doit correspondre exactement à une option proposée.');
      return;
    }
    if (new Set(acceptedOptionValues).size !== acceptedOptionValues.length) {
      setError('Les réponses acceptées ne doivent pas contenir de doublon.');
      return;
    }
    const numericMinimum = Number(newPrerequisiteAcceptedValues.trim().replace(',', '.'));
    if (newPrerequisiteAnswerType === 'number' && !Number.isFinite(numericMinimum)) {
      setError('Saisissez une valeur minimale numérique valide.');
      return;
    }
    const duplicate = [...input.requiredPrerequisites, ...input.preferredPrerequisites].some((selection) => {
      const selectionLabel = getPrerequisiteLabel(selection.prerequisiteId);
      return normalizePrerequisiteLabel(selectionLabel) === normalizedLabel;
    });
    if (duplicate) {
      setError('Ce prérequis est déjà ajouté à cette offre.');
      return;
    }
    setNewPrerequisiteSaving(true);
    setError(null);
    try {
      const payload = await createCompanyPrerequisiteClient(authUser, {
        offerId: currentOfferId,
        prerequisiteFamily: newPrerequisiteFamily,
        ...(newPrerequisiteFamily === 'offer_requirement' ? { offerRequirementCategory: newOfferRequirementCategory } : {}),
        companyLabel: label,
        candidateQuestion,
        ...(candidateHelp ? { candidateHelp } : {}),
        answerType: newPrerequisiteAnswerType,
        options: choiceType ? options : [],
        expectedCriterion: newPrerequisiteAnswerType === 'boolean'
          ? newPrerequisiteBooleanExpected
          : newPrerequisiteAnswerType === 'number'
            ? numericMinimum
            : newPrerequisiteAnswerType === 'single_choice' && acceptedOptionValues.length === 1
              ? acceptedOptionValues[0]
              : acceptedOptionValues,
        comparisonOperator: newPrerequisiteAnswerType === 'number'
          ? 'minimum'
          : newPrerequisiteAnswerType === 'multiple_choice'
            ? 'contains_any'
            : newPrerequisiteAnswerType === 'single_choice' && acceptedOptionValues.length > 1
              ? 'one_of'
            : 'equals',
        saveToLibrary: newPrerequisiteSaveToLibrary,
      } satisfies CompanyPrerequisiteCreationInput);
      const definition = normalizePrerequisiteDefinition(payload.definition);
      setDefinitionCache((current) => mergePrerequisiteDefinitions(current, [definition]));
      setVisibleDefinitions((current) => mergePrerequisiteDefinitions(current, [definition]));
      assignPrerequisite(definition, newPrerequisiteImportance);
      resetNewPrerequisiteForm();
      setMessage(newPrerequisiteSaveToLibrary
        ? 'Prérequis ajouté à l’offre et proposé à Seven’O pour modération.'
        : 'Prérequis ajouté à l’offre.');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le prérequis n’a pas pu être ajouté.');
    } finally {
      setNewPrerequisiteSaving(false);
    }
  }

  function removePrerequisite(id: string) {
    setInput((current) => ({
      ...current,
      requiredPrerequisites: current.requiredPrerequisites.filter((item) => item.prerequisiteId !== id),
      preferredPrerequisites: current.preferredPrerequisites.filter((item) => item.prerequisiteId !== id),
    }));
  }

  function updateCriterion(id: string, importance: PrerequisiteImportance, value: PrerequisiteCriterionValue) {
    const key = importance === 'required' ? 'requiredPrerequisites' : 'preferredPrerequisites';
    setInput((current) => ({
      ...current,
      [key]: current[key].map((item) => item.prerequisiteId === id ? { ...item, expectedCriterion: value } : item),
    }));
  }

  async function saveDraft() {
    if (!authUser) return null;
    setSaving(true);
    setError(null);
    setMessage(null);
    const draftInput = input;
    try {
      const payload = await saveCompanyJobOffer(authUser, input, currentOfferId || undefined);
      setCurrentOfferId(payload.offer.id);
      setSavedOffer(payload.offer);
      setInput(mergeOfferInputPreservingPrerequisites(serializedJobOfferToInput(payload.offer), draftInput));
      setMessage('Brouillon enregistré.');
      if (!offerId) window.history.replaceState(null, '', `/entreprise/offres/${payload.offer.id}/modifier`);
      return payload.offer;
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le brouillon n’a pas pu être enregistré.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!authUser) return;
    const saved = await saveDraft();
    if (!saved) return;
    setSaving(true);
    setError(null);
    try {
      await changeCompanyJobOfferStatus(authUser, saved.id, 'publish');
      router.push('/entreprise/offres');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La publication a échoué.');
    } finally {
      setSaving(false);
    }
  }

  async function openQuestionnaireEditor() {
    const saved = await saveDraft();
    if (!saved) return;
    router.push(`/entreprise/offres/${saved.id}/questionnaire`);
  }

  if (sessionLoading || loading) {
    return <SevenoSurface eyebrow="Espace entreprise" title="Chargement de l offre" description="Preparation de votre espace de travail."><p className="text-slate-300">Chargement...</p></SevenoSurface>;
  }

  return (
    <SevenoSurface
      eyebrow="Espace entreprise"
      title={currentOfferId ? 'Modifier une offre' : 'Créer une offre'}
      description="Construisez une offre structurée et sélectionnez uniquement des prérequis contrôlés par Seven’O."
      actions={<Link href="/entreprise/offres" className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">Retour aux offres</Link>}
      containerClassName="max-w-[96rem]"
    >
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Entreprise', href: '/entreprise' },
            { label: 'Mes offres', href: '/entreprise/offres' },
            { label: currentOfferId ? 'Modifier l’offre' : 'Nouvelle offre' },
          ]}
        />
        {profile?.profileStatus === 'suspended' ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">Votre profil entreprise est suspendu.</p></SevenoPanel> : null}
        {profile && isCompanyProfileIncomplete(profile) ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">Profil entreprise incomplet : le brouillon reste disponible, mais la publication sera refusée tant que le profil n’est pas complété.</p></SevenoPanel> : null}
        {sessionError || error ? <SevenoPanel tone="orange"><p className="text-sm text-orange-100">{sessionError ?? error}</p></SevenoPanel> : null}
        {message ? <SevenoPanel tone="cyan"><p className="text-sm text-cyan-100">{message}</p></SevenoPanel> : null}

        <div className="grid gap-2 sm:grid-cols-5">
          {STEPS.map((label, index) => (
            <button key={label} type="button" onClick={() => setStep(index)} className={index === step ? 'rounded-2xl border border-cyan-300/30 bg-cyan-400/15 px-3 py-3 text-sm font-semibold text-cyan-100' : 'rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-400'}>
              <span className="mr-2 text-xs">0{index + 1}</span>{label}
            </button>
          ))}
        </div>

        {step === 0 ? (
          <SevenoPanel tone="cyan">
            <h2 className="text-xl font-semibold text-white">Le poste</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Titre de l’offre<input value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} className={FIELD} placeholder="Ex. Développeur full stack" /></label>
              <label className="space-y-2 text-sm text-slate-200">Secteur<Select value={input.sectorId} onChange={(event) => changeSector(event.target.value)}><option value="">Sélectionner un secteur</option>{JOB_SECTORS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</Select></label>
              <label className="space-y-2 text-sm text-slate-200">Famille métier<Select value={input.jobFamilyId} disabled={!input.sectorId} onChange={(event) => changeFamily(event.target.value)}><option value="">Sélectionner une famille métier</option>{families.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</Select></label>
              <label className="space-y-2 text-sm text-slate-200 md:col-span-2">Métier précis<Select value={input.jobRoleId} disabled={!input.jobFamilyId || prerequisitesLoading} onChange={(event) => void changeRole(event.target.value)}><option value="">Sélectionner un métier</option>{roles.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</Select></label>
            </div>
          </SevenoPanel>
        ) : null}

        {step === 1 ? (
          <SevenoPanel tone="blue">
            <h2 className="text-xl font-semibold text-white">Conditions</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <GeographicLocationFields
                  value={{
                    countryCode: input.countryCode ?? '',
                    countryName: input.countryName ?? '',
                    administrativeAreaCode: input.administrativeAreaCode ?? '',
                    administrativeAreaName: input.administrativeAreaName ?? '',
                    city: input.city ?? '',
                    cityName: input.cityName ?? '',
                  }}
                  onChange={(location: GeographicLocation) => setInput((current) => ({
                    ...current,
                    ...location,
                    location: formatGeographicLocation(location),
                  }))}
                  legacyLabel={input.location}
                />
              </div>
              <label className="space-y-2 text-sm text-slate-200">Modalité<Select value={input.workMode} onChange={(event) => setInput({ ...input, workMode: event.target.value as JobOfferWorkMode | '' })}><option value="">Sélectionner</option><option value="onsite">Sur site</option><option value="hybrid">Hybride</option><option value="remote">À distance</option></Select></label>
              <label className="space-y-2 text-sm text-slate-200">Contrat<Select value={input.contractType} onChange={(event) => setInput({ ...input, contractType: event.target.value as JobOfferContractType | '' })}><option value="">Sélectionner</option><option value="permanent">CDI</option><option value="fixed_term">CDD</option><option value="temporary">Intérim</option><option value="freelance">Freelance</option><option value="apprenticeship">Alternance</option><option value="internship">Stage</option><option value="other">Autre</option></Select></label>
              <label className="space-y-2 text-sm text-slate-200">Temps de travail<Select value={input.workingTime} onChange={(event) => setInput({ ...input, workingTime: event.target.value as JobOfferWorkingTime | '' })}><option value="">Sélectionner</option><option value="full_time">Temps plein</option><option value="part_time">Temps partiel</option><option value="shift">Horaires postés</option><option value="flexible">Flexible</option><option value="other">Autre</option></Select></label>
            </div>
          </SevenoPanel>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            {!input.jobRoleId ? (
              <SevenoPanel tone="orange">
                <p className="text-sm text-orange-100">Sélectionnez d’abord un métier précis.</p>
              </SevenoPanel>
            ) : (
              <>
                <PrerequisiteLibraryPicker
                  input={input}
                  search={search}
                  onSearchChange={setSearch}
                  filteredDefinitions={visibleDefinitions}
                  canAddRequired={canAddRequired}
                  canAddPreferred={canAddPreferred}
                  isLoading={prerequisitesLoading}
                  searchError={prerequisiteError}
                  newPrerequisiteOpen={newPrerequisiteOpen}
                  newPrerequisiteSaving={newPrerequisiteSaving}
                  newPrerequisiteName={newPrerequisiteName}
                  onNewPrerequisiteNameChange={setNewPrerequisiteName}
                  newPrerequisiteQuestion={newPrerequisiteQuestion}
                  onNewPrerequisiteQuestionChange={setNewPrerequisiteQuestion}
                  newPrerequisiteHelp={newPrerequisiteHelp}
                  onNewPrerequisiteHelpChange={setNewPrerequisiteHelp}
                  newPrerequisiteAnswerType={newPrerequisiteAnswerType}
                  onNewPrerequisiteAnswerTypeChange={setNewPrerequisiteAnswerType}
                  newPrerequisiteOptions={newPrerequisiteOptions}
                  onNewPrerequisiteOptionsChange={setNewPrerequisiteOptions}
                  newPrerequisiteAcceptedValues={newPrerequisiteAcceptedValues}
                  onNewPrerequisiteAcceptedValuesChange={setNewPrerequisiteAcceptedValues}
                  newPrerequisiteBooleanExpected={newPrerequisiteBooleanExpected}
                  onNewPrerequisiteBooleanExpectedChange={setNewPrerequisiteBooleanExpected}
                  newPrerequisiteImportance={newPrerequisiteImportance}
                  onNewPrerequisiteImportanceChange={setNewPrerequisiteImportance}
                  newPrerequisiteFamily={newPrerequisiteFamily}
                  onNewPrerequisiteFamilyChange={setNewPrerequisiteFamily}
                  newOfferRequirementCategory={newOfferRequirementCategory}
                  onNewOfferRequirementCategoryChange={setNewOfferRequirementCategory}
                  newPrerequisiteSaveToLibrary={newPrerequisiteSaveToLibrary}
                  onNewPrerequisiteSaveToLibraryChange={setNewPrerequisiteSaveToLibrary}
                  onOpenNewPrerequisiteForm={openNewPrerequisiteForm}
                  onResetNewPrerequisiteForm={resetNewPrerequisiteForm}
                  onSaveNewPrerequisite={() => void saveNewPrerequisite()}
                  onAssignPrerequisite={assignPrerequisite}
                  onEditSuggestion={editPrerequisiteSuggestion}
                />
                <div className="grid gap-5 xl:grid-cols-2">
                  <SelectionPanel title="Compétences métier indispensables" description="Compétences nécessaires à l’exercice du poste et utilisées pour construire le questionnaire métier." family="job_skill" badge="Évalué dans le questionnaire" importance="required" canMoveToOther={preferredJobSkills.length < 3} selections={requiredJobSkills} definitions={definitionCache} savedOffer={savedOffer} onMove={movePrerequisite} onRemove={removePrerequisite} onCriterion={updateCriterion} />
                  <SelectionPanel title="Compétences métier complémentaires" description="Compétences constituant une valeur ajoutée pour le poste et pouvant être évaluées dans le questionnaire." family="job_skill" badge="Valeur ajoutée métier" importance="preferred" canMoveToOther={requiredJobSkills.length < 5} selections={preferredJobSkills} definitions={definitionCache} savedOffer={savedOffer} onMove={movePrerequisite} onRemove={removePrerequisite} onCriterion={updateCriterion} />
                  <SelectionPanel title="Conditions et justificatifs obligatoires" description="Éléments vérifiés séparément lors de la candidature. Ils ne sont jamais intégrés au questionnaire métier." family="offer_requirement" badge="Vérifié séparément" importance="required" canMoveToOther={preferredOfferRequirements.length < 3} selections={requiredOfferRequirements} definitions={definitionCache} savedOffer={savedOffer} onMove={movePrerequisite} onRemove={removePrerequisite} onCriterion={updateCriterion} />
                  <SelectionPanel title="Conditions et justificatifs souhaités" description="Éléments appréciés pour le poste, mais non intégrés au questionnaire métier." family="offer_requirement" badge="Vérifié séparément" importance="preferred" canMoveToOther={requiredOfferRequirements.length < 5} selections={preferredOfferRequirements} definitions={definitionCache} savedOffer={savedOffer} onMove={movePrerequisite} onRemove={removePrerequisite} onCriterion={updateCriterion} />
                </div>
              </>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <SevenoPanel tone="blue">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Questionnaire entreprise</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Associez un questionnaire créé par votre entreprise à cette offre. Il évalue les critères propres au poste et reste distinct des prérequis. Le seuil de réussite est défini par votre entreprise. Une offre peut rester en brouillon sans questionnaire.</p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">{questionnaireSummary}</span>
            </div>
            <label className="mt-5 block space-y-2 text-sm text-slate-200">
              Questionnaire associé
              <Select value={input.questionnaireId} onChange={(event) => setInput((current) => ({ ...current, questionnaireId: event.target.value }))}>
                <option value="">Aucun questionnaire associé</option>
                {questionnaires.map((item) => <option key={item.id} value={item.id}>{questionnaireLabel(item)}</option>)}
              </Select>
            </label>
            <p className="mt-3 text-sm leading-6 text-slate-400">Choisissez un questionnaire déjà enregistré par votre entreprise. La vérification de propriété est effectuée côté serveur.</p>
            {questionnairesLoading ? <p className="mt-2 text-xs text-slate-500">Chargement des questionnaires...</p> : questionnaires.length === 0 ? <p className="mt-2 text-xs text-amber-200">Aucun questionnaire n’est encore enregistré pour cette entreprise.</p> : null}
            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200"><input type="checkbox" checked={input.questionnaireRequired} onChange={(event) => setInput({ ...input, questionnaireRequired: event.target.checked })} className="mt-1 accent-cyan-400" /><span><strong className="text-white">Questionnaire obligatoire pour cette offre</strong><span className="mt-1 block text-slate-400">Si cette option est activée, un questionnaire associé sera exigé uniquement au moment de publier.</span></span></label>
            <div className="mt-5 flex flex-wrap gap-3">
              {currentOfferId ? <><button type="button" onClick={() => void openQuestionnaireEditor()} className="rounded-full border border-blue-300/20 bg-blue-400/10 px-5 py-3 text-sm font-semibold text-blue-100">{input.questionnaireId ? 'Modifier le questionnaire de cette offre' : 'Créer le questionnaire de cette offre'}</button><button type="button" onClick={() => void openQuestionnaireEditor()} className="rounded-full border border-white/10 px-5 py-3 text-sm text-slate-200">Prévisualiser</button></> : <button type="button" onClick={() => void saveDraft()} disabled={saving} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm text-cyan-100">Enregistrer d’abord le brouillon</button>}
              {input.questionnaireId ? <button type="button" onClick={() => void openQuestionnaireEditor()} className="rounded-full border border-white/10 px-5 py-3 text-sm text-slate-200">Ouvrir le questionnaire associé</button> : null}
            </div>
          </SevenoPanel>
        ) : null}

        {step === 4 ? (
          <SevenoPanel tone="orange">
            <h2 className="text-xl font-semibold text-white">Présentation</h2>
            <div className="mt-5 space-y-4">
              <label className="block space-y-2 text-sm text-slate-200">Description<textarea value={input.description} onChange={(event) => setInput({ ...input, description: event.target.value })} className={FIELD} rows={7} /></label>
              <label className="block space-y-2 text-sm text-slate-200">Missions<textarea value={input.missions} onChange={(event) => setInput({ ...input, missions: event.target.value })} className={FIELD} rows={6} /></label>
              <label className="block space-y-2 text-sm text-slate-200">Profil recherché<textarea value={input.profileSummary} onChange={(event) => setInput({ ...input, profileSummary: event.target.value })} className={FIELD} rows={5} /></label>
            </div>
          </SevenoPanel>
        ) : null}

        {step === 5 ? (
          <SevenoPanel tone="neutral">
            <h2 className="text-xl font-semibold text-white">Vérification avant publication</h2>
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <h3 className="text-base font-semibold text-white">Poste et conditions</h3>
                <dl className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
                  <div><dt className="text-slate-500">Titre</dt><dd className="mt-1 text-white">{verificationTitle}</dd></div>
                  <div><dt className="text-slate-500">Secteur</dt><dd className="mt-1 text-white">{verificationSector?.label ?? savedOffer?.sectorId ?? 'Non renseigné'}</dd></div>
                  <div><dt className="text-slate-500">Famille métier</dt><dd className="mt-1 text-white">{verificationFamily?.label ?? savedOffer?.jobFamilyId ?? 'Non renseignée'}</dd></div>
                  <div><dt className="text-slate-500">Métier</dt><dd className="mt-1 text-white">{verificationRole?.label ?? savedOffer?.jobRoleLabel ?? 'Non renseigné'}</dd></div>
                  <div><dt className="text-slate-500">Localisation</dt><dd className="mt-1 text-white">{verificationLocation}</dd></div>
                  <div><dt className="text-slate-500">Modalité</dt><dd className="mt-1 text-white">{workModeLabel(verificationWorkMode)}</dd></div>
                  <div><dt className="text-slate-500">Contrat</dt><dd className="mt-1 text-white">{contractTypeLabel(verificationContractType)}</dd></div>
                  <div><dt className="text-slate-500">Temps de travail</dt><dd className="mt-1 text-white">{workingTimeLabel(verificationWorkingTime)}</dd></div>
                </dl>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <h3 className="text-base font-semibold text-white">Présentation</h3>
                <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                  <div>
                    <p className="text-slate-500">Description</p>
                    <p className="mt-1 whitespace-pre-wrap text-white">{verificationDescription}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Missions</p>
                    <p className="mt-1 whitespace-pre-wrap text-white">{verificationMissions}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Profil recherché</p>
                    <p className="mt-1 whitespace-pre-wrap text-white">{verificationProfileSummary}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200">
              <p className="text-slate-500">Questionnaire associé</p>
              <p className="mt-1 text-white">{questionnaireSummary}</p>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2"><div><h3 className="font-semibold text-orange-100">Prérequis obligatoires ({verificationRequiredPrerequisites.length})</h3><ul className="mt-3 space-y-2 text-sm text-slate-300">{verificationRequiredPrerequisites.map((item) => <li key={item.prerequisiteId}>- {definitionCache.find((definition) => prerequisiteIdentity(definition) === item.prerequisiteId)?.companyLabel ?? savedOffer?.requiredPrerequisites.find((snapshot) => snapshot.prerequisiteId === item.prerequisiteId)?.companyLabel ?? item.prerequisiteId}</li>)}</ul></div><div><h3 className="font-semibold text-blue-100">Valeurs ajoutées ({verificationPreferredPrerequisites.length})</h3><ul className="mt-3 space-y-2 text-sm text-slate-300">{verificationPreferredPrerequisites.map((item) => <li key={item.prerequisiteId}>- {definitionCache.find((definition) => prerequisiteIdentity(definition) === item.prerequisiteId)?.companyLabel ?? savedOffer?.preferredPrerequisites.find((snapshot) => snapshot.prerequisiteId === item.prerequisiteId)?.companyLabel ?? item.prerequisiteId}</li>)}</ul></div></div>
          </SevenoPanel>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3"><button type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} className="rounded-full border border-white/10 px-5 py-3 text-sm text-slate-200 disabled:opacity-40">Étape précédente</button><button type="button" disabled={step === STEPS.length - 1} onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm text-cyan-100 disabled:opacity-40">Étape suivante</button></div>
          <div className="flex gap-3"><button type="button" disabled={saving || !authUser} onClick={() => void saveDraft()} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer le brouillon'}</button><button type="button" disabled={saving || !authUser} onClick={() => void publish()} className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Vérifier et publier</button></div>
        </div>
      </div>
    </SevenoSurface>
  );
}
