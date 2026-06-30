'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  detectAcquisitionTracking,
  normalizeAcquisitionSourceCode,
  studyAcquisitionSourceOptions,
} from '@/lib/study-acquisition';
import { getFamiliesBySector, getRolesByFamily } from '@/lib/job-taxonomy';
import { readLogoFeedbackFromStorage } from '@/lib/logo-feedback';
import {
  buildStudyAnswersPayload,
  getQuestionAnswer,
  getVisibleQuestions,
  isQuestionAnswered,
  respondentOptions,
  studyFinalQuestions,
  studyQuestionnaires,
  resolveQuestionOptions,
  yesNoOptions,
} from '@/lib/study-questionnaire';
import type {
  RespondentType,
  StudyAnswers,
  StudyQuestion,
  StudyQuestionOption,
  StudyResponseInput,
} from '@/types/study';

const TEXT_FIELD_MAX_LENGTHS: Record<string, number> = {
  activeZoneOther: 100,
  currentRoleOther: 120,
  languagesOther: 100,
  marketMissingOther: 200,
  openReason: 300,
  improvementNote: 500,
  feedbackNote: 500,
  email: 254,
  phone: 32,
};

function createFinalState() {
  return {
    wantsLaunchNotification: true,
    wantsBetaAccess: false,
    wantsProjectUpdates: false,
    email: '',
    phone: '',
    discoverySource: '',
  };
}

function hashFingerprintSeed(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createFingerprintSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateVisitorFingerprint(extraSeed = '') {
  if (typeof window === 'undefined') {
    return '';
  }

  const screenData = typeof screen !== 'undefined' ? `${screen.width}x${screen.height}x${screen.colorDepth}` : 'unknown';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'unknown';
  const hardware = typeof navigator.hardwareConcurrency === 'number' ? String(navigator.hardwareConcurrency) : 'unknown';
  const memory =
    typeof navigator === 'object' && 'deviceMemory' in navigator && typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === 'number'
      ? String((navigator as Navigator & { deviceMemory?: number }).deviceMemory)
      : 'unknown';
  const touchPoints = typeof navigator.maxTouchPoints === 'number' ? String(navigator.maxTouchPoints) : 'unknown';

  const seed = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    timezone,
    screenData,
    hardware,
    memory,
    touchPoints,
    extraSeed,
  ].join('|');

  return `fp_${hashFingerprintSeed(seed)}`;
}

function getTextFieldMaxLength(firestoreKey: string) {
  return TEXT_FIELD_MAX_LENGTHS[firestoreKey];
}

function getTextFieldCounter(value: string, maxLength?: number) {
  if (!maxLength) {
    return null;
  }

  return `${value.length} / ${maxLength}`;
}

const STUDY_COMPLETED_STORAGE_KEY = 'seveno_study_completed';
const STUDY_COMPLETED_AT_STORAGE_KEY = 'seveno_study_completed_at';
const STUDY_ALLOW_REPEAT = process.env.NODE_ENV !== 'production';

const ROLE_KEYS_TO_CLEAR = [
  'currentRoleCode',
  'targetRoleCode',
  'currentRecruitmentRoleCode',
  'hardestRecruitmentRoleCode',
  'agencyPrimaryRoleCode',
  'agencyFrequentRoleCode',
] as const;

const LEGACY_ROLE_KEYS_TO_CLEAR = [
  'targetRoleCodes',
  'secondaryRoleCodes',
  'roleToRecruitCode',
  'currentRecruitmentRoleCodes',
  'hardestRecruitmentRoleCodes',
  'mostFrequentRecruitmentRoleCodes',
  'agencyFrequentRoleCodes',
  'agencyHardestRoleCodes',
] as const;

const FINAL_STEP_ID = '__final__';
const HONEYPOT_FIELD_NAME = 'website';
const CUSTOM_ROLE_OPTION_VALUE = 'other';
const CUSTOM_ROLE_OPTION_LABEL = 'Métier non listé';
const DROPDOWN_SELECT_KEYS = new Set(['sectorCode', 'familyCode']);
const SEARCHABLE_SINGLE_SELECT_KEYS = new Set(['currentRoleCode']);
const COMPOSITE_QUESTION_IDS = new Set([
  'family_code',
  'current_role_code',
  'target_role_codes',
  'current_recruitment_role_codes',
  'hardest_recruitment_role_codes',
  'agency_frequent_role_codes',
  'agency_hardest_role_codes',
]);

function clearDependentAnswers(answers: StudyAnswers, firestoreKey: string): StudyAnswers {
  if (firestoreKey === 'sectorCode') {
    const nextAnswers = { ...answers };
    delete nextAnswers.familyCode;
    delete nextAnswers.currentRoleOther;
    for (const key of ROLE_KEYS_TO_CLEAR) {
      delete nextAnswers[key];
    }
    for (const key of LEGACY_ROLE_KEYS_TO_CLEAR) {
      delete nextAnswers[key];
    }
    return nextAnswers;
  }

  if (firestoreKey === 'familyCode') {
    const nextAnswers = { ...answers };
    delete nextAnswers.currentRoleOther;
    for (const key of ROLE_KEYS_TO_CLEAR) {
      delete nextAnswers[key];
    }
    for (const key of LEGACY_ROLE_KEYS_TO_CLEAR) {
      delete nextAnswers[key];
    }
    return nextAnswers;
  }

  if (firestoreKey === 'activeZoneCode') {
    const nextAnswers = { ...answers };
    delete nextAnswers.activeZoneOther;
    return nextAnswers;
  }

  if (firestoreKey === 'targetRoleCodes') {
    const nextAnswers = { ...answers };
    delete nextAnswers.secondaryRoleCodes;
    return nextAnswers;
  }

  if (firestoreKey === 'currentRecruitmentRoleCodes') {
    const nextAnswers = { ...answers };
    delete nextAnswers.hardestRecruitmentRoleCodes;
    delete nextAnswers.mostFrequentRecruitmentRoleCodes;
    return nextAnswers;
  }

  if (firestoreKey === 'agencyFrequentRoleCodes') {
    const nextAnswers = { ...answers };
    delete nextAnswers.agencyHardestRoleCodes;
    return nextAnswers;
  }

  if (firestoreKey === 'languagesCodes') {
    const nextAnswers = { ...answers };
    const hasOtherLanguage = Array.isArray(nextAnswers.languagesCodes)
      && nextAnswers.languagesCodes.some((entry) => entry === 'other');
    if (!hasOtherLanguage) {
      delete nextAnswers.languagesOther;
    }
    return nextAnswers;
  }

  if (firestoreKey === 'europeMobilityCode') {
    const nextAnswers = { ...answers };
    if (nextAnswers.europeMobilityCode !== 'yes_specific') {
      delete nextAnswers.europeTargetCountryCodes;
    }
    return nextAnswers;
  }

  if (firestoreKey === 'marketMissingCodes') {
    const nextAnswers = { ...answers };
    const hasOtherNeed = Array.isArray(nextAnswers.marketMissingCodes)
      && nextAnswers.marketMissingCodes.some((entry) => entry === 'other');
    if (!hasOtherNeed) {
      delete nextAnswers.marketMissingOther;
    }
    return nextAnswers;
  }

  if (firestoreKey === 'openToOpportunity') {
    const nextAnswers = { ...answers };
    if (nextAnswers.openToOpportunity === 'yes') {
      delete nextAnswers.openReason;
    } else if (nextAnswers.openToOpportunity === 'no') {
      delete nextAnswers.changeHorizonCode;
    }
    return nextAnswers;
  }

  return answers;
}

function toggleMultiSelection(
  currentValue: StudyAnswers[string],
  nextValue: string,
  maxSelections?: number,
): string[] {
  const currentSelections = Array.isArray(currentValue)
    ? currentValue.filter((item): item is string => typeof item === 'string')
    : [];

  if (currentSelections.includes(nextValue)) {
    return currentSelections.filter((item) => item !== nextValue);
  }

  if (typeof maxSelections === 'number' && currentSelections.length >= maxSelections) {
    return currentSelections;
  }

  return [...currentSelections, nextValue];
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getOptionSearchText(option: { label: string; searchTerms?: string[] }): string {
  const terms = option.searchTerms ?? [];
  return [option.label, ...terms].map(normalizeSearchText).join(' ');
}

function filterOptions(options: StudyQuestionOption[], query: string, excludedValues: string[] = []): StudyQuestionOption[] {
  const normalizedQuery = normalizeSearchText(query);
  const excluded = new Set(excludedValues);

  return options.filter((option) => {
    if (excluded.has(option.value)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return getOptionSearchText(option).includes(normalizedQuery);
  });
}

function mapTaxonomyOptions(items: Array<{ code: string; label: string; aliases?: string[] }>): StudyQuestionOption[] {
  return items.map((item) => ({
    value: item.code,
    label: item.label,
    ...(item.aliases && item.aliases.length > 0 ? { searchTerms: item.aliases } : {}),
  }));
}

function DropdownQuestionField({
  options,
  value,
  onChange,
  questionId,
  placeholder,
}: {
  options: StudyQuestionOption[];
  value: StudyAnswers[string] | undefined;
  onChange: (nextValue: string) => void;
  questionId: string;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsOpen(false);
    setQuery('');
  }, [questionId]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const currentValue = typeof value === 'string' ? value : '';
  const selectedOption = options.find((option) => option.value === currentValue);
  const selectedLabel =
    currentValue === CUSTOM_ROLE_OPTION_VALUE ? CUSTOM_ROLE_OPTION_LABEL : selectedOption?.label ?? '';
  const filteredOptions = filterOptions(options, query);

  return (
    <div ref={rootRef} className="space-y-3">
      {selectedOption ? (
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="max-w-full break-words rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-blue-100">
          Sélectionné: {selectedOption.label}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setIsOpen(false);
            setQuery('');
          }}
          className="min-h-11 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white/80 transition hover:border-white/20 hover:bg-white/10 touch-manipulation"
        >
          Effacer
        </button>
      </div>
      ) : null}

      <div className="rounded-[22px] border border-white/10 bg-white/5 shadow-[0_18px_50px_rgba(2,6,23,0.18)]">
        <button
          type="button"
          onClick={() => setIsOpen((previous) => !previous)}
          aria-expanded={isOpen}
          className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm text-white transition hover:bg-white/5 touch-manipulation"
        >
          <span className={'min-w-0 flex-1 break-words ' + (selectedLabel ? 'text-white' : 'text-slate-400')}>
            {selectedLabel || placeholder}
          </span>
          <span className="text-xs text-slate-400">{isOpen ? 'Fermer' : 'Ouvrir'}</span>
        </button>

        {isOpen ? (
          <div className="border-t border-white/10 p-3">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher"
              className="w-full rounded-[16px] border border-white/10 bg-[#050d1f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
            />

            <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] sm:max-h-[18rem]">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const active = currentValue === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className={
                        'flex min-h-11 w-full items-center justify-between gap-3 rounded-[16px] border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 touch-manipulation ' +
                        (active
                          ? 'border-blue-400/70 bg-gradient-to-r from-blue-500/20 to-violet-500/20 text-white shadow-[0_16px_40px_rgba(59,130,246,0.14)]'
                          : 'border-white/10 bg-white/5 text-white/90 hover:border-white/20 hover:bg-white/10')
                      }
                    >
                      <span className="block min-w-0 break-words text-sm font-medium leading-6">{option.label}</span>
                      {active ? <span className="text-xs text-white/70">Sélectionné</span> : null}
                    </button>
                  );
                })
              ) : (
                <p className="px-4 py-3 text-sm text-slate-400">Aucun résultat ne correspond à votre recherche.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <p className="text-sm text-slate-400">Choisissez une seule option dans la liste.</p>
    </div>
  );
}

function SearchableSingleSelectField({
  options,
  value,
  onChange,
  questionId,
  placeholder,
  otherValue,
  onOtherChange,
}: {
  options: StudyQuestionOption[];
  value: StudyAnswers[string] | undefined;
  onChange: (nextValue: string) => void;
  questionId: string;
  placeholder: string;
  otherValue?: string;
  onOtherChange?: (nextValue: string) => void;
}) {
  const [query, setQuery] = useState('');
  const customInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQuery('');
  }, [questionId]);

  useEffect(() => {
    if (typeof otherValue === 'string' && typeof onOtherChange === 'function' && value === CUSTOM_ROLE_OPTION_VALUE) {
      customInputRef.current?.focus();
    }
  }, [onOtherChange, otherValue, value]);

  const currentValue = typeof value === 'string' ? value : '';
  const currentOtherValue = typeof otherValue === 'string' ? otherValue : '';
  const selectedOption = options.find((option) => option.value === currentValue);
  const selectedLabel =
    currentValue === CUSTOM_ROLE_OPTION_VALUE ? CUSTOM_ROLE_OPTION_LABEL : selectedOption?.label ?? '';
  const filteredOptions = filterOptions(options, query);
  const hasCustomValueField = typeof otherValue === 'string' && typeof onOtherChange === 'function';
  const normalizedQuery = normalizeSearchText(query);
  const canUseCustomSelection = hasCustomValueField && normalizedQuery.length > 0;

  function clearSelection() {
    onChange('');
    if (hasCustomValueField) {
      onOtherChange('');
    }
    setQuery('');
  }

  function selectOption(option: StudyQuestionOption) {
    onChange(option.value);
    if (hasCustomValueField) {
      if (option.value !== CUSTOM_ROLE_OPTION_VALUE) {
        onOtherChange('');
      } else if (currentOtherValue.trim().length === 0 && normalizedQuery.length > 0) {
        onOtherChange(query.trim());
      }
    }
    setQuery('');
  }

  function selectCustomRole(customRoleText: string) {
    if (!hasCustomValueField) {
      return;
    }

    onChange(CUSTOM_ROLE_OPTION_VALUE);
    onOtherChange(customRoleText.trim());
    setQuery('');
  }

  function selectBestVisibleOption() {
    const bestVisibleOption = filteredOptions[0];
    if (bestVisibleOption) {
      selectOption(bestVisibleOption);
      return true;
    }

    if (canUseCustomSelection) {
      selectCustomRole(query);
      return true;
    }

    return false;
  }

  return (
    <div className="space-y-3">
      {selectedLabel ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="max-w-full break-words rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-blue-100">
            Sélectionné: {selectedLabel}
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="min-h-11 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white/80 transition hover:border-white/20 hover:bg-white/10 touch-manipulation"
          >
            Effacer
          </button>
        </div>
      ) : null}

      {hasCustomValueField && currentValue === CUSTOM_ROLE_OPTION_VALUE ? (
        <div className="rounded-[18px] border border-amber-400/20 bg-amber-500/10 p-4">
          <label className="block space-y-2">
            <span className="text-sm text-amber-100">Précisez votre métier</span>
            <input
              ref={customInputRef}
              type="text"
              value={currentOtherValue}
              onChange={(event) => onOtherChange(event.target.value)}
              placeholder="Ex : technicien support"
              maxLength={getTextFieldMaxLength('currentRoleOther')}
              className="w-full rounded-[16px] border border-white/10 bg-[#050d1f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-500/20"
            />
          </label>
          <p className="mt-2 text-xs text-amber-100/80">
            Votre métier est enregistré comme option libre et débloquera la suite.
          </p>
        </div>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm text-slate-300">{placeholder}</span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              selectBestVisibleOption();
            }
          }}
          onBlur={() => {
            if (filteredOptions.length === 1) {
              selectOption(filteredOptions[0]);
              return;
            }

            if (filteredOptions.length === 0 && canUseCustomSelection) {
              selectCustomRole(query);
            }
          }}
          placeholder="Rechercher un métier"
          className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
        />
      </label>

      <div className="max-h-[45vh] space-y-2 overflow-y-auto rounded-[22px] border border-white/10 bg-[#050d1f]/80 p-2 shadow-[0_18px_50px_rgba(2,6,23,0.18)] overscroll-contain [-webkit-overflow-scrolling:touch] sm:max-h-[21rem]">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const active = currentValue === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  selectOption(option);
                }}
                className={
                  'flex min-h-11 w-full items-center justify-between gap-3 rounded-[16px] border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 touch-manipulation ' +
                  (active
                    ? 'border-blue-400/70 bg-gradient-to-r from-blue-500/20 to-violet-500/20 text-white shadow-[0_16px_40px_rgba(59,130,246,0.14)]'
                    : 'border-white/10 bg-white/5 text-white/90 hover:border-white/20 hover:bg-white/10')
                }
              >
                <span className="block min-w-0 break-words text-sm font-medium leading-6">{option.label}</span>
                {active ? <span className="text-xs text-white/70">Sélectionné</span> : null}
              </button>
            );
          })
        ) : (
          <p className="px-4 py-3 text-sm text-slate-400">Aucun résultat ne correspond à votre recherche.</p>
        )}

        {hasCustomValueField ? (
          <button
            type="button"
            onClick={() => selectCustomRole(query || currentOtherValue || '')}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[16px] border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/60 hover:bg-amber-500/15 touch-manipulation"
          >
            <span className="block min-w-0 break-words text-sm font-medium leading-6 text-amber-50">
              {CUSTOM_ROLE_OPTION_LABEL}
            </span>
            <span className="text-xs text-amber-100/70">Saisie libre</span>
          </button>
        ) : null}
      </div>

      <p className="text-sm text-slate-400">
        Tapez votre métier puis sélectionnez une proposition. Si votre métier n&apos;apparaît pas, choisissez{' '}
        {CUSTOM_ROLE_OPTION_LABEL}.
      </p>
    </div>
  );
}

export function SearchableMultiSelectField({
  options,
  value,
  onToggle,
  questionId,
  maxSelections,
  placeholder,
}: {
  options: StudyQuestionOption[];
  value: StudyAnswers[string] | undefined;
  onToggle: (nextValue: string) => void;
  questionId: string;
  maxSelections?: number;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery('');
  }, [questionId]);

  const selectedValues = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
  const selectedLabels = selectedValues
    .map((selectedValue) => options.find((option) => option.value === selectedValue))
    .filter((option): option is StudyQuestionOption => Boolean(option));
  const filteredOptions = filterOptions(options, query, selectedValues);
  const limitReached = typeof maxSelections === 'number' && selectedValues.length >= maxSelections;

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-wrap gap-2">
        {selectedLabels.length > 0 ? (
          selectedLabels.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-100 transition hover:border-blue-300/50 hover:bg-blue-500/15 touch-manipulation"
            >
              <span className="max-w-full break-words">{option.label}</span>
              <span className="text-xs text-blue-100/70">Retirer</span>
            </button>
          ))
        ) : (
          <span className="text-sm text-slate-400">Aucune option sélectionnée pour le moment.</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-slate-400">
        <span className="min-w-0 break-words">{placeholder}</span>
        {typeof maxSelections === 'number' ? (
          <span>
            {selectedValues.length}/{maxSelections}
          </span>
        ) : null}
      </div>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher"
        className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
      />

      <div className="max-h-[45vh] space-y-2 overflow-y-auto rounded-[22px] border border-white/10 bg-[#050d1f]/80 p-2 shadow-[0_18px_50px_rgba(2,6,23,0.18)] overscroll-contain [-webkit-overflow-scrolling:touch] sm:max-h-[21rem]">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const active = selectedValues.includes(option.value);
            const disabled = limitReached && !active;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onToggle(option.value);
                  setQuery('');
                }}
                disabled={disabled}
                className={
                  'flex min-h-11 w-full items-center justify-between gap-3 rounded-[16px] border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 touch-manipulation ' +
                  (active
                    ? 'border-blue-400/70 bg-gradient-to-r from-blue-500/20 to-violet-500/20 text-white shadow-[0_16px_40px_rgba(59,130,246,0.14)]'
                    : 'border-white/10 bg-white/5 text-white/90 hover:border-white/20 hover:bg-white/10') +
                  (disabled ? ' cursor-not-allowed opacity-40 hover:translate-y-0 hover:shadow-none' : '')
                }
              >
                <span className="block min-w-0 break-words text-sm font-medium leading-6">{option.label}</span>
                <span className="text-xs text-white/60">{active ? 'Sélectionné' : 'Ajouter'}</span>
              </button>
            );
          })
        ) : (
          <p className="px-4 py-3 text-sm text-slate-400">Aucun résultat ne correspond à votre recherche.</p>
        )}
      </div>
    </div>
  );
}

export function MultiSelectQuestionField({
  options,
  value,
  onToggle,
  questionId,
  maxSelections,
  placeholder,
}: {
  options: StudyQuestionOption[];
  value: StudyAnswers[string] | undefined;
  onToggle: (nextValue: string) => void;
  questionId: string;
  maxSelections?: number;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsOpen(true);
    setQuery('');
  }, [questionId]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const selectedValues = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
  const selectedLabels = selectedValues
    .map((selectedValue) => options.find((option) => option.value === selectedValue))
    .filter((option): option is StudyQuestionOption => Boolean(option));
  const filteredOptions = filterOptions(options, query, selectedValues);
  const limitReached = typeof maxSelections === 'number' && selectedValues.length >= maxSelections;

  return (
    <div ref={rootRef} className="space-y-4">
      <div className="flex min-w-0 flex-wrap gap-2">
        {selectedLabels.length > 0 ? (
          selectedLabels.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-100 transition hover:border-blue-300/50 hover:bg-blue-500/15 touch-manipulation"
            >
              <span className="max-w-full break-words">{option.label}</span>
              <span className="text-xs text-blue-100/70">Retirer</span>
            </button>
          ))
        ) : (
          <span className="text-sm text-slate-400">Aucun métier sélectionné pour le moment.</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-slate-400">
        <span className="min-w-0 break-words">{placeholder}</span>
        <div className="flex items-center gap-3">
          {typeof maxSelections === 'number' ? (
            <span>
              {selectedValues.length}/{maxSelections}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setIsOpen((previous) => !previous)}
            aria-expanded={isOpen}
            className="min-h-10 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:border-white/20 hover:bg-white/10 touch-manipulation"
          >
            {isOpen ? 'Fermer la liste' : 'Ouvrir la liste'}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="space-y-3 rounded-[22px] border border-white/10 bg-[#050d1f]/80 p-3 shadow-[0_18px_50px_rgba(2,6,23,0.18)]">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher et ajouter un métier"
            className="w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
          />

          <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1 overscroll-contain [-webkit-overflow-scrolling:touch] sm:max-h-[21rem]">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const active = selectedValues.includes(option.value);
                const disabled = limitReached && !active;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onToggle(option.value)}
                    disabled={disabled}
                    className={
                      'flex min-h-11 w-full items-center justify-between gap-3 rounded-[16px] border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 touch-manipulation ' +
                      (active
                        ? 'border-blue-400/70 bg-gradient-to-r from-blue-500/20 to-violet-500/20 text-white shadow-[0_16px_40px_rgba(59,130,246,0.14)]'
                        : 'border-white/10 bg-white/5 text-white/90 hover:border-white/20 hover:bg-white/10') +
                      (disabled ? ' cursor-not-allowed opacity-40 hover:translate-y-0 hover:shadow-none' : '')
                    }
                  >
                    <span className="block min-w-0 break-words text-sm font-medium leading-6">{option.label}</span>
                    <span className="text-xs text-white/60">{active ? 'Sélectionné' : 'Ajouter'}</span>
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-3 text-sm text-slate-400">Aucun résultat ne correspond à votre recherche.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StudyQuestionnaire() {
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [respondentType, setRespondentType] = useState<RespondentType | ''>('');
  const [answers, setAnswers] = useState<StudyAnswers>({});
  const [finalState, setFinalState] = useState(createFinalState());
  const [acquisitionTracking, setAcquisitionTracking] = useState<{
    source?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    hasUtmSource: boolean;
  }>({
    hasUtmSource: false,
  });
  const [honeypotValue, setHoneypotValue] = useState('');
  const [visitorFingerprint, setVisitorFingerprint] = useState('');
  const [fingerprintSeed, setFingerprintSeed] = useState('');
  const [completionChecked, setCompletionChecked] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [alreadyCompletedAt, setAlreadyCompletedAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const previousVisibleQuestionsRef = useRef<StudyQuestion[]>([]);
  const lastNavigationActionRef = useRef<'initial' | 'answer' | 'next' | 'back' | 'jump' | 'fallback' | 'reset'>(
    'initial',
  );

  useEffect(() => {
    setVisitorFingerprint(generateVisitorFingerprint(fingerprintSeed));

    if (typeof window === 'undefined') {
      return;
    }

    setAcquisitionTracking(detectAcquisitionTracking(window.location.search));

    const completed = window.localStorage.getItem(STUDY_COMPLETED_STORAGE_KEY) === 'true';
    const completedAt = window.localStorage.getItem(STUDY_COMPLETED_AT_STORAGE_KEY) ?? '';

    setAlreadyCompleted(completed);
    setAlreadyCompletedAt(completedAt);
    setCompletionChecked(true);
  }, [fingerprintSeed]);

  const visibleQuestions = useMemo(
    () => (respondentType ? getVisibleQuestions(respondentType, answers) : []),
    [answers, respondentType],
  );

  const counterQuestions = useMemo(() => {
    if (!respondentType) {
      return [];
    }

    const context = { respondentType, answers };
    const branchQuestions = studyQuestionnaires[respondentType].filter((question) =>
      question.visibleIf ? question.visibleIf(context) : true,
    );

    return [...branchQuestions, ...studyFinalQuestions];
  }, [answers, respondentType]);

  const displayedQuestions = useMemo(
    () => visibleQuestions.filter((question) => !COMPOSITE_QUESTION_IDS.has(question.id)),
    [visibleQuestions],
  );

  const currentQuestion =
    currentStepId && currentStepId !== FINAL_STEP_ID
      ? displayedQuestions.find((question) => question.id === currentStepId) ?? null
      : null;

  const currentQuestionIndex = currentQuestion
    ? displayedQuestions.findIndex((question) => question.id === currentQuestion.id)
    : -1;
  const currentQuestionValue = currentQuestion ? getQuestionAnswer(answers, currentQuestion) : null;

  useEffect(() => {
    if (!respondentType) {
      setCurrentStepId(null);
      previousVisibleQuestionsRef.current = [];
      return;
    }

    if (currentStepId === null || currentStepId === FINAL_STEP_ID) {
      previousVisibleQuestionsRef.current = displayedQuestions;
      return;
    }

    if (!displayedQuestions.some((question) => question.id === currentStepId)) {
      const previousIndex = previousVisibleQuestionsRef.current.findIndex((question) => question.id === currentStepId);
      lastNavigationActionRef.current = 'fallback';
      setCurrentStepId(displayedQuestions[previousIndex + 1]?.id ?? displayedQuestions[previousIndex]?.id ?? FINAL_STEP_ID);
    }

    previousVisibleQuestionsRef.current = displayedQuestions;
  }, [currentStepId, displayedQuestions, respondentType]);

  const activeRespondentType: RespondentType = respondentType || 'professional_available';
  const isRecruiterProfile = respondentType === 'company' || respondentType === 'agency';
  const isBusinessBlockStep = currentQuestion?.firestoreKey === 'sectorCode';
  const selectedSectorCode = typeof answers.sectorCode === 'string' ? answers.sectorCode : '';
  const selectedFamilyCode = typeof answers.familyCode === 'string' ? answers.familyCode : '';
  const businessRoleFirestoreKey =
    respondentType === 'company'
      ? 'currentRecruitmentRoleCodes'
      : respondentType === 'agency'
        ? 'agencyFrequentRoleCodes'
        : 'currentRoleCode';
  const businessRoleValue = answers[businessRoleFirestoreKey];
  const currentRoleOtherValue = typeof answers.currentRoleOther === 'string' ? answers.currentRoleOther : '';
  const businessFamilyOptions = useMemo(
    () => mapTaxonomyOptions(getFamiliesBySector(selectedSectorCode)),
    [selectedSectorCode],
  );
  const businessRoleOptions = useMemo(
    () => mapTaxonomyOptions(getRolesByFamily(selectedFamilyCode)),
    [selectedFamilyCode],
  );
  const businessFamilyAnswered = selectedSectorCode.length > 0 && selectedFamilyCode.length > 0;
  const businessRoleAnswered =
    businessRoleFirestoreKey === 'currentRoleCode'
      ? typeof businessRoleValue === 'string' && businessRoleValue === CUSTOM_ROLE_OPTION_VALUE
        ? currentRoleOtherValue.trim().length > 0
        : isQuestionAnswered(
            {
              id: businessRoleFirestoreKey,
              label: '',
              type: 'single',
              required: true,
              firestoreKey: businessRoleFirestoreKey,
              category: 'qualification',
            },
            businessRoleValue ?? null,
          )
      : isQuestionAnswered(
          {
            id: businessRoleFirestoreKey,
            label: '',
            type: 'multi',
            required: true,
            firestoreKey: businessRoleFirestoreKey,
            category: 'qualification',
          },
          businessRoleValue ?? null,
        );
  const businessBlockAnswered = Boolean(currentQuestion) && isBusinessBlockStep && businessFamilyAnswered && businessRoleAnswered;
  const currentQuestionAnswered = isBusinessBlockStep
    ? businessBlockAnswered
    : currentQuestion
      ? isQuestionAnswered(currentQuestion, currentQuestionValue ?? null)
      : false;
  const canContinueCurrentQuestion = !currentQuestion || !currentQuestion.required || currentQuestionAnswered;

  const totalScreens = respondentType ? counterQuestions.length + 2 : 2;
  const currentCounterQuestionIndex = currentQuestion
    ? counterQuestions.findIndex((question) => question.id === currentQuestion.id)
    : -1;
  const progress =
    currentStepId === null
      ? 0
      : currentStepId === FINAL_STEP_ID
        ? 100
        : ((currentCounterQuestionIndex + 1) / (counterQuestions.length + 1)) * 100;
  const displayStep =
    currentStepId === null
      ? 1
      : currentStepId === FINAL_STEP_ID
        ? totalScreens
        : currentCounterQuestionIndex + 2;

  function updateField(firestoreKey: string, value: StudyAnswers[string]) {
    lastNavigationActionRef.current = 'answer';
    setAnswers((previous) => clearDependentAnswers({ ...previous, [firestoreKey]: value }, firestoreKey));
  }

  function updateAnswer(question: StudyQuestion, value: StudyAnswers[string]) {
    updateField(question.firestoreKey, value);
  }

  function updateMultiField(firestoreKey: string, value: string, maxSelections?: number) {
    lastNavigationActionRef.current = 'answer';
    setAnswers((previous) =>
      clearDependentAnswers(
        {
          ...previous,
          [firestoreKey]: toggleMultiSelection(previous[firestoreKey], value, maxSelections),
        },
        firestoreKey,
      ),
    );
  }

  function updateMultiAnswer(question: StudyQuestion, value: string) {
    updateMultiField(question.firestoreKey, value, question.maxSelections);
  }

  function goToQuestions() {
    if (!respondentType) {
      setError('Veuillez sélectionner un profil.');
      return;
    }

    setError('');
    lastNavigationActionRef.current = 'jump';
    setCurrentStepId(displayedQuestions[0]?.id ?? null);
  }

  function goNext() {
    const currentIndex = currentStepId
      ? displayedQuestions.findIndex((question) => question.id === currentStepId)
      : -1;
    const currentQuestionAtStep = currentIndex >= 0 ? displayedQuestions[currentIndex] : null;

    if (!currentQuestionAtStep) {
      return;
    }

    const value = getQuestionAnswer(answers, currentQuestionAtStep);
    if (currentQuestionAtStep.required && !isQuestionAnswered(currentQuestionAtStep, value)) {
      setError('Veuillez compléter cette réponse avant de continuer.');
      return;
    }

    setError('');
    lastNavigationActionRef.current = 'next';
    setCurrentStepId(displayedQuestions[currentIndex + 1]?.id ?? FINAL_STEP_ID);
  }

  function goBack() {
    setError('');
    lastNavigationActionRef.current = 'back';

    if (currentStepId === FINAL_STEP_ID) {
      setCurrentStepId(displayedQuestions[displayedQuestions.length - 1]?.id ?? null);
      return;
    }

    if (currentQuestionIndex <= 0) {
      setCurrentStepId(null);
      return;
    }

    setCurrentStepId(displayedQuestions[currentQuestionIndex - 1]?.id ?? null);
  }

  function resetAll() {
    lastNavigationActionRef.current = 'reset';
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STUDY_COMPLETED_STORAGE_KEY);
      window.localStorage.removeItem(STUDY_COMPLETED_AT_STORAGE_KEY);
    }
    setCurrentStepId(null);
    setRespondentType('');
    setAnswers({});
    setFinalState(createFinalState());
    setHoneypotValue('');
    setFingerprintSeed(createFingerprintSeed());
    setVisitorFingerprint('');
    setSaving(false);
    setError('');
    setSuccess(false);
    setAlreadyCompleted(false);
    setAlreadyCompletedAt('');
    previousVisibleQuestionsRef.current = [];
  }

  async function submitStudy() {
    if (!respondentType) {
      setError('Le profil répondant est requis.');
      return;
    }

    if (honeypotValue.trim().length > 0) {
      setError("La réponse n'a pas pu être enregistrée. Merci de réessayer.");
      return;
    }

    setSaving(true);
    setError('');
    const logoFeedback = readLogoFeedbackFromStorage();
    const resolvedFingerprint = visitorFingerprint || generateVisitorFingerprint();
    const isRecruiterProfile = respondentType === 'company' || respondentType === 'agency';
    const normalizedDiscoverySource = normalizeAcquisitionSourceCode(finalState.discoverySource);
    const resolvedSource =
      acquisitionTracking.source ??
      acquisitionTracking.utmSource ??
      normalizedDiscoverySource ??
      undefined;
    if (!visitorFingerprint && resolvedFingerprint) {
      setVisitorFingerprint(resolvedFingerprint);
    }

    const payload: StudyResponseInput = {
      respondentType,
      answers: buildStudyAnswersPayload(respondentType, answers),
      wantsLaunchNotification: finalState.wantsLaunchNotification,
      wantsBetaAccess: finalState.wantsBetaAccess,
      ...(isRecruiterProfile ? { wantsProjectUpdates: finalState.wantsProjectUpdates } : {}),
      email: finalState.email.trim(),
      phone: finalState.phone.trim(),
      ...(resolvedSource ? { source: resolvedSource } : {}),
      ...(acquisitionTracking.utmSource ? { utmSource: acquisitionTracking.utmSource } : {}),
      ...(acquisitionTracking.utmMedium ? { utmMedium: acquisitionTracking.utmMedium } : {}),
      ...(acquisitionTracking.utmCampaign ? { utmCampaign: acquisitionTracking.utmCampaign } : {}),
      ...(!acquisitionTracking.hasUtmSource && normalizedDiscoverySource
        ? { discoverySource: normalizedDiscoverySource }
        : {}),
      ...(logoFeedback ? { logoFeedback } : {}),
      visitorFingerprint: resolvedFingerprint,
    };

    try {
      // Future hardening: attach Firebase App Check tokens here once the frontend enables it.
      const response = await fetch('/api/study-responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          website: honeypotValue,
        }),
      });

      if (!response.ok) {
        const responsePayload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(responsePayload?.message ?? "La réponse n'a pas pu être enregistrée. Merci de réessayer.");
      }

      setSuccess(true);
      setAlreadyCompleted(true);
      const completedAt = new Date().toISOString();
      setAlreadyCompletedAt(completedAt);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STUDY_COMPLETED_STORAGE_KEY, 'true');
        window.localStorage.setItem(STUDY_COMPLETED_AT_STORAGE_KEY, completedAt);
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "La réponse n'a pas pu être enregistrée. Merci de réessayer.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderQuestionControl(question: StudyQuestion) {
    const questionOptions = resolveQuestionOptions(question, { respondentType: activeRespondentType, answers });
    const questionValue = getQuestionAnswer(answers, question);

    if (question.type === 'single' && DROPDOWN_SELECT_KEYS.has(question.firestoreKey)) {
      return (
        <DropdownQuestionField
          options={questionOptions}
          value={questionValue}
          onChange={(nextValue) => updateAnswer(question, nextValue)}
          questionId={question.id}
          placeholder={
            question.firestoreKey === 'sectorCode' ? 'Sélectionnez un secteur' : 'Sélectionnez une famille de métier'
          }
        />
      );
    }

    if (question.type === 'single' && SEARCHABLE_SINGLE_SELECT_KEYS.has(question.firestoreKey)) {
      return (
        <SearchableSingleSelectField
          options={questionOptions}
          value={questionValue}
          onChange={(nextValue) => updateAnswer(question, nextValue)}
          questionId={question.id}
          placeholder="Sélectionnez un métier"
        />
      );
    }

    if (question.type === 'multi') {
      return (
        <SearchableMultiSelectField
          options={questionOptions}
          value={questionValue}
          onToggle={(nextValue) => updateMultiAnswer(question, nextValue)}
          questionId={question.id}
          maxSelections={question.maxSelections}
          placeholder={question.description ?? 'Sélectionnez une ou plusieurs options'}
        />
      );
    }

    if (question.type === 'single' && questionOptions.length > 0 && !DROPDOWN_SELECT_KEYS.has(question.firestoreKey)) {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {questionOptions.map((option) => {
            const active = questionValue === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateAnswer(question, option.value)}
                className={
                  'min-h-14 rounded-[20px] border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(2,6,23,0.28)] touch-manipulation ' +
                  (active
                    ? 'border-blue-400/70 bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-white shadow-[0_18px_50px_rgba(59,130,246,0.18)]'
                    : 'border-white/10 bg-white/5 text-white/90 hover:border-white/20 hover:bg-white/10')
                }
              >
                <span className="block min-w-0 break-words text-base font-medium leading-6">{option.label}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === 'yesno') {
      return (
        <div className="flex flex-col gap-3 sm:flex-row">
          {yesNoOptions.map((option) => {
            const active = questionValue === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateAnswer(question, option.value)}
                className={
                  'inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-3 text-sm font-medium transition duration-200 touch-manipulation ' +
                  (active
                    ? 'border-blue-400/70 bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-[0_18px_50px_rgba(59,130,246,0.18)]'
                    : 'border-white/10 bg-white/5 text-white/90 hover:border-white/20 hover:bg-white/10')
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === 'text') {
      const maxLength = getTextFieldMaxLength(question.firestoreKey);
      const textValue = typeof questionValue === 'string' ? String(questionValue) : '';
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={textValue}
            onChange={(event) => updateAnswer(question, event.target.value)}
            placeholder={question.placeholder ?? 'Votre réponse'}
            maxLength={maxLength}
            className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
          />
          {maxLength ? <p className="text-right text-xs text-slate-400">{getTextFieldCounter(textValue, maxLength)}</p> : null}
        </div>
      );
    }

    if (question.type === 'textarea') {
      const maxLength = getTextFieldMaxLength(question.firestoreKey);
      const textValue = typeof questionValue === 'string' ? String(questionValue) : '';
      return (
        <div className="space-y-2">
          <textarea
            value={textValue}
            onChange={(event) => updateAnswer(question, event.target.value)}
            placeholder={question.placeholder ?? 'Votre réponse'}
            rows={5}
            maxLength={maxLength}
            className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
          />
          {maxLength ? <p className="text-right text-xs text-slate-400">{getTextFieldCounter(textValue, maxLength)}</p> : null}
        </div>
      );
    }

    return null;
  }

  const stepLabel =
    currentStepId === null
      ? 'Vous êtes ?'
      : isBusinessBlockStep
        ? 'Bloc métier'
        : currentQuestion
          ? currentQuestion.label
          : 'Finalisation';
  const panelKey = currentStepId === null ? 'profile' : currentQuestion ? currentQuestion.id : 'final';
  const shouldBlockRepeat = completionChecked && alreadyCompleted && !success;
  const completionDateLabel = alreadyCompletedAt && !Number.isNaN(Date.parse(alreadyCompletedAt))
    ? new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(alreadyCompletedAt))
    : '';

  if (shouldBlockRepeat) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between border-b border-white/10 pb-4">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo-seveno.png"
                alt="Seveno"
                width={160}
                height={48}
                priority
                className="h-10 w-auto sm:h-11"
              />
            </Link>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              Étude privée sur invitation
            </span>
          </header>

          <section className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-white/5 p-6 text-center shadow-[0_24px_70px_rgba(2,6,23,0.45)] backdrop-blur sm:p-8">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-blue-300">
                Vous avez déjà participé à cette étude.
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Merci pour votre contribution.</h1>
              {completionDateLabel ? (
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  Dernière réponse enregistrée le {completionDateLabel}.
                </p>
              ) : (
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  Votre participation a déjà été prise en compte.
                </p>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                {STUDY_ALLOW_REPEAT ? (
                  <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10 touch-manipulation sm:w-auto"
                  >
                    Répondre à nouveau
                  </button>
                ) : null}
                <Link
                  href="/"
                  className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110 sm:w-auto"
                >
                  Retour à l&apos;accueil
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-seveno.png"
              alt="Seveno"
              width={160}
              height={48}
              priority
              className="h-10 w-auto sm:h-11"
            />
          </Link>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
            Étude privée sur invitation
          </span>
        </header>

        <input
          type="text"
          name={HONEYPOT_FIELD_NAME}
          value={honeypotValue}
          onChange={(event) => setHoneypotValue(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        <section className="flex-1 py-6 pb-8 sm:py-8 sm:pb-12">
          <div className="mb-6 rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.45)] backdrop-blur sm:p-5">
            <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
              <span>
                Étape {displayStep} sur {totalScreens}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {success ? (
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.45)] backdrop-blur sm:p-8">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-blue-300">Réponse enregistrée</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Merci pour votre réponse.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Votre contribution est enregistrée. Nous nous en servirons pour valider la demande et affiner la suite.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {STUDY_ALLOW_REPEAT ? (
                  <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10 touch-manipulation sm:w-auto"
                  >
                    Répondre à nouveau
                  </button>
                ) : null}
                <Link
                  href="/"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10 touch-manipulation sm:w-auto"
                >
                  Retour à l&apos;accueil
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_70px_rgba(2,6,23,0.45)] backdrop-blur sm:p-8 lg:p-10">
              <div className="max-w-3xl">
                <p className="text-sm font-medium uppercase tracking-[0.22em] text-blue-300">Questionnaire adaptatif</p>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{stepLabel}</h1>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  Cette étude nous aidera à construire une plateforme réellement utile aux professionnels et aux
                  recruteurs.
                </p>
              </div>

              {error ? (
                <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <div key={panelKey} className="animate-seveno-fade-in mt-8">
                {currentStepId === null ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {respondentOptions.map((option) => {
                      const active = respondentType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            if (respondentType !== option.value) {
                              setAnswers({});
                              setFinalState(createFinalState());
                              setError('');
                              setSuccess(false);
                            }
                            setRespondentType(option.value);
                          }}
                          className={
                            'min-h-14 rounded-[20px] border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(2,6,23,0.28)] touch-manipulation ' +
                            (active
                              ? 'border-blue-400/60 bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-white shadow-[0_18px_50px_rgba(59,130,246,0.18)]'
                              : 'border-white/10 bg-white/5 text-white/90 hover:border-white/20 hover:bg-white/10')
                          }
                        >
                          <span className="block text-base font-medium">{option.label}</span>
                          <span className={'mt-1 block text-sm leading-6 ' + (active ? 'text-white/75' : 'text-slate-300')}>
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : currentQuestion ? (
                  isBusinessBlockStep ? (
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <p className="text-sm font-medium uppercase tracking-[0.22em] text-blue-300">Bloc métier</p>
                        <h2 className="text-2xl font-semibold tracking-tight text-white">Définissez votre contexte métier</h2>
                        <p className="max-w-2xl text-sm leading-6 text-slate-300">
                          Choisissez votre secteur, votre famille de métier et votre poste principal sur un seul écran.
                        </p>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-slate-200">{currentQuestion.label}</p>
                          {renderQuestionControl(currentQuestion)}
                        </div>

                        {selectedSectorCode.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-sm font-medium text-slate-200">Quelle famille de métier vous concerne le plus ?</p>
                            <DropdownQuestionField
                              options={businessFamilyOptions}
                              value={answers.familyCode}
                              onChange={(nextValue) => updateField('familyCode', nextValue)}
                              questionId={`familyCode-${selectedSectorCode}`}
                              placeholder="Sélectionnez une famille de métier"
                            />
                          </div>
                        ) : null}

                        {selectedFamilyCode.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-sm font-medium text-slate-200">
                              {respondentType === 'company'
                                ? 'Quels postes recrutez-vous actuellement ?'
                                : respondentType === 'agency'
                                  ? 'Quels métiers recrutez-vous le plus souvent ?'
                                  : 'Quel est votre poste actuel ou votre dernier poste occupé ?'}
                            </p>

                            {respondentType === 'company' || respondentType === 'agency' ? (
                              <SearchableMultiSelectField
                                options={businessRoleOptions}
                                value={businessRoleValue}
                                onToggle={(nextValue) =>
                                  updateMultiField(
                                    respondentType === 'company'
                                      ? 'currentRecruitmentRoleCodes'
                                      : 'agencyFrequentRoleCodes',
                                    nextValue,
                                    5,
                                  )
                                }
                                questionId={
                                  respondentType === 'company'
                                    ? `currentRecruitmentRoleCodes-${selectedFamilyCode}`
                                    : `agencyFrequentRoleCodes-${selectedFamilyCode}`
                                }
                                maxSelections={5}
                                placeholder="Sélectionnez un ou plusieurs métiers"
                              />
                            ) : (
                              <SearchableSingleSelectField
                                options={businessRoleOptions}
                                value={businessRoleValue}
                                onChange={(nextValue) => updateField('currentRoleCode', nextValue)}
                                questionId={`currentRoleCode-${selectedFamilyCode}`}
                                placeholder="Sélectionnez un métier"
                                otherValue={currentRoleOtherValue}
                                onOtherChange={(nextValue) => updateField('currentRoleOther', nextValue)}
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-7">
                      {currentQuestion.description ? (
                        <p className="max-w-2xl text-sm leading-6 text-slate-300">{currentQuestion.description}</p>
                      ) : null}

                      {renderQuestionControl(currentQuestion)}
                    </div>
                  )
                ) : (
                  <div className="space-y-7">
                    <div className="grid gap-4">
                      {isRecruiterProfile ? (
                        <div className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-white/90">
                          <p className="text-base font-medium text-white">Suivre l&apos;évolution du projet</p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            Seveno développe une nouvelle approche du recrutement basée sur des profils réellement
                            disponibles et des informations régulièrement actualisées.
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            Souhaitez-vous être informé de l&apos;avancement du projet et des futures phases de test ?
                          </p>

                          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <button
                              type="button"
                              onClick={() =>
                                setFinalState((previous) => ({
                                  ...previous,
                                  wantsProjectUpdates: true,
                                }))
                              }
                              className={
                                'inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-4 py-3 text-sm font-medium transition touch-manipulation ' +
                                (finalState.wantsProjectUpdates
                                  ? 'border-blue-400/70 bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-[0_18px_50px_rgba(59,130,246,0.18)]'
                                  : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10')
                              }
                            >
                              Oui
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setFinalState((previous) => ({
                                  ...previous,
                                  wantsProjectUpdates: false,
                                }))
                              }
                              className={
                                'inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-4 py-3 text-sm font-medium transition touch-manipulation ' +
                                (!finalState.wantsProjectUpdates
                                  ? 'border-blue-400/70 bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-[0_18px_50px_rgba(59,130,246,0.18)]'
                                  : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10')
                              }
                            >
                              Non
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {!acquisitionTracking.hasUtmSource ? (
                        <div className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-white/90">
                          <p className="text-base font-medium text-white">Comment avez-vous découvert cette étude ?</p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            Cette information nous aide à identifier les canaux d&apos;acquisition les plus efficaces.
                          </p>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {studyAcquisitionSourceOptions.map((option) => {
                              const active = finalState.discoverySource === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() =>
                                    setFinalState((previous) => ({
                                      ...previous,
                                      discoverySource: option.value,
                                    }))
                                  }
                                  className={
                                    'min-h-14 rounded-[18px] border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(2,6,23,0.28)] touch-manipulation ' +
                                    (active
                                      ? 'border-blue-400/70 bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-white shadow-[0_18px_50px_rgba(59,130,246,0.18)]'
                                      : 'border-white/10 bg-white/5 text-white/90 hover:border-white/20 hover:bg-white/10')
                                  }
                                >
                                  <span className="block min-w-0 break-words text-sm font-medium leading-6">{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <label className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-white/90">
                        <input
                          type="checkbox"
                          checked={finalState.wantsLaunchNotification}
                          onChange={(event) =>
                            setFinalState((previous) => ({
                              ...previous,
                              wantsLaunchNotification: event.target.checked,
                            }))
                          }
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-blue-500 focus:ring-blue-500/20"
                        />
                        <span>
                          <span className="block font-medium">Être prévenu du lancement</span>
                          <span className="mt-1 block text-sm leading-6 text-slate-300">
                            Recevez une alerte lorsque Seveno sera prêt.
                          </span>
                        </span>
                      </label>

                      <label className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-white/90">
                        <input
                          type="checkbox"
                          checked={finalState.wantsBetaAccess}
                          onChange={(event) =>
                            setFinalState((previous) => ({
                              ...previous,
                              wantsBetaAccess: event.target.checked,
                            }))
                          }
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-blue-500 focus:ring-blue-500/20"
                        />
                        <span>
                          <span className="block font-medium">Devenir bêta-testeur</span>
                          <span className="mt-1 block text-sm leading-6 text-slate-300">
                            Participez aux retours avant la mise en ligne.
                          </span>
                        </span>
                      </label>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm font-medium text-white">
                          Email
                          <input
                            type="email"
                            value={finalState.email}
                            onChange={(event) =>
                              setFinalState((previous) => ({
                                ...previous,
                                email: event.target.value,
                              }))
                            }
                            maxLength={getTextFieldMaxLength('email')}
                            className="w-full rounded-[16px] border border-white/10 bg-[#020817] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                            placeholder="Facultatif"
                          />
                          <p className="text-right text-xs font-normal text-slate-400">
                            {getTextFieldCounter(finalState.email, getTextFieldMaxLength('email'))}
                          </p>
                        </label>

                        <label className="flex flex-col gap-2 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm font-medium text-white">
                          Téléphone
                          <input
                            type="tel"
                            value={finalState.phone}
                            onChange={(event) =>
                              setFinalState((previous) => ({
                                ...previous,
                                phone: event.target.value,
                              }))
                            }
                            maxLength={getTextFieldMaxLength('phone')}
                            className="w-full rounded-[16px] border border-white/10 bg-[#020817] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                            placeholder="Facultatif"
                          />
                          <p className="text-right text-xs font-normal text-slate-400">
                            {getTextFieldCounter(finalState.phone, getTextFieldMaxLength('phone'))}
                          </p>
                        </label>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              <p className="mt-8 text-sm leading-6 text-slate-400">
                Vos réponses restent confidentielles et seront utilisées uniquement dans le cadre de cette étude de
                marché.
              </p>

              <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={currentStepId === null}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10 touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Retour
                </button>

                {currentStepId === null ? (
                  <button
                    type="button"
                    onClick={goToQuestions}
                    className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110 sm:w-auto"
                  >
                    Commencer
                  </button>
                ) : currentQuestion ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canContinueCurrentQuestion}
                    className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    Continuer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitStudy}
                    disabled={saving}
                    className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {saving ? 'Envoi en cours...' : 'Envoyer ma réponse'}
                  </button>
                )}
              </div>

            </div>
          )}
        </section>

        <footer className="border-t border-white/10 py-5 text-sm text-slate-400">
          Seveno collecte des signaux marché avant le lancement.
        </footer>
      </div>
    </main>
  );
}





