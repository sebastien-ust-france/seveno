'use client';

import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { Select } from '@/components/ui/Select';
import { PREREQUISITE_CATEGORIES } from '@/lib/seveno-prerequisite-constants';
import type { JobOfferInput } from '@/types/seveno-job-offers';
import type {
  CompanyPrerequisiteDefinition,
  CompanyPrerequisiteCreationInput,
  PrerequisiteImportance,
  PrerequisiteFamily,
  OfferRequirementCategory,
} from '@/types/seveno-prerequisites';

type LibraryPickerProps = {
  input: Pick<JobOfferInput, 'requiredPrerequisites' | 'preferredPrerequisites'>;
  search: string;
  onSearchChange: (value: string) => void;
  filteredDefinitions: CompanyPrerequisiteDefinition[];
  isLoading?: boolean;
  searchError?: string | null;
  canAddRequired: boolean;
  canAddPreferred: boolean;
  newPrerequisiteOpen: boolean;
  newPrerequisiteSaving: boolean;
  newPrerequisiteName: string;
  onNewPrerequisiteNameChange: (value: string) => void;
  newPrerequisiteQuestion: string;
  onNewPrerequisiteQuestionChange: (value: string) => void;
  newPrerequisiteHelp: string;
  onNewPrerequisiteHelpChange: (value: string) => void;
  newPrerequisiteAnswerType: CompanyPrerequisiteCreationInput['answerType'];
  onNewPrerequisiteAnswerTypeChange: (value: CompanyPrerequisiteCreationInput['answerType']) => void;
  newPrerequisiteOptions: string;
  onNewPrerequisiteOptionsChange: (value: string) => void;
  newPrerequisiteAcceptedValues: string;
  onNewPrerequisiteAcceptedValuesChange: (value: string) => void;
  newPrerequisiteBooleanExpected: boolean;
  onNewPrerequisiteBooleanExpectedChange: (value: boolean) => void;
  newPrerequisiteImportance: PrerequisiteImportance;
  onNewPrerequisiteImportanceChange: (value: PrerequisiteImportance) => void;
  newPrerequisiteFamily: PrerequisiteFamily;
  onNewPrerequisiteFamilyChange: (value: PrerequisiteFamily) => void;
  newOfferRequirementCategory: OfferRequirementCategory;
  onNewOfferRequirementCategoryChange: (value: OfferRequirementCategory) => void;
  newPrerequisiteSaveToLibrary: boolean;
  onNewPrerequisiteSaveToLibraryChange: (value: boolean) => void;
  onOpenNewPrerequisiteForm: () => void;
  onResetNewPrerequisiteForm: () => void;
  onSaveNewPrerequisite: () => void;
  onAssignPrerequisite: (definition: CompanyPrerequisiteDefinition, importance: PrerequisiteImportance) => void;
  onEditSuggestion: (definition: CompanyPrerequisiteDefinition) => void;
};

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function prerequisiteSearchPlaceholder(family?: PrerequisiteFamily | null) {
  if (family === 'job_skill') {
    return 'Rechercher une compétence métier, par exemple : lecture de plans, métré, AutoCAD';
  }
  if (family === 'offer_requirement') {
    return 'Rechercher une condition ou un justificatif, par exemple : permis B, CACES R482, diplôme';
  }
  return 'Choisissez d’abord le type d’élément';
}

function prerequisiteOriginLabel(definition: CompanyPrerequisiteDefinition) {
  if (definition.source === 'company') {
    return definition.originOfferId ? 'Personnalisé' : 'Ma bibliothèque';
  }
  return 'Seven’O';
}

function prerequisiteIdentity(definition: Pick<CompanyPrerequisiteDefinition, 'prerequisiteId' | 'code'>) {
  return definition.prerequisiteId || definition.code;
}

function prerequisiteCategoryLabel(value: CompanyPrerequisiteDefinition['category']) {
  return PREREQUISITE_CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

function prerequisiteApplicabilityLabel(value: CompanyPrerequisiteDefinition['applicabilityLevel']) {
  if (value === 'role') return 'Métier';
  if (value === 'family') return 'Famille';
  if (value === 'sector') return 'Secteur';
  return 'Global';
}

export function PrerequisiteLibraryPicker({
  input,
  search,
  onSearchChange,
  filteredDefinitions,
  isLoading = false,
  searchError = null,
  canAddRequired,
  canAddPreferred,
  newPrerequisiteOpen,
  newPrerequisiteSaving,
  newPrerequisiteName,
  onNewPrerequisiteNameChange,
  newPrerequisiteQuestion,
  onNewPrerequisiteQuestionChange,
  newPrerequisiteHelp,
  onNewPrerequisiteHelpChange,
  newPrerequisiteAnswerType,
  onNewPrerequisiteAnswerTypeChange,
  newPrerequisiteOptions,
  onNewPrerequisiteOptionsChange,
  newPrerequisiteAcceptedValues,
  onNewPrerequisiteAcceptedValuesChange,
  newPrerequisiteBooleanExpected,
  onNewPrerequisiteBooleanExpectedChange,
  newPrerequisiteImportance,
  onNewPrerequisiteImportanceChange,
  newPrerequisiteFamily,
  onNewPrerequisiteFamilyChange,
  newOfferRequirementCategory,
  onNewOfferRequirementCategoryChange,
  newPrerequisiteSaveToLibrary,
  onNewPrerequisiteSaveToLibraryChange,
  onOpenNewPrerequisiteForm,
  onResetNewPrerequisiteForm,
  onSaveNewPrerequisite,
  onAssignPrerequisite,
  onEditSuggestion,
}: LibraryPickerProps) {
  return (
    <SevenoPanel tone="cyan" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Bibliothèque applicable</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Recherchez un prérequis Seven’O ou de votre bibliothèque privée, puis ajoutez-le à l’offre.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
        <div className="space-y-4">
          <label className="block space-y-2 text-sm text-slate-200">
            Rechercher un prérequis
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              placeholder={prerequisiteSearchPlaceholder(newPrerequisiteFamily)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenNewPrerequisiteForm}
              disabled={newPrerequisiteSaving}
              className="rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 disabled:opacity-40"
            >
              Créer un prérequis personnalisé
            </button>
            {!isLoading && filteredDefinitions.length > 0 ? (
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                {filteredDefinitions.length} {filteredDefinitions.length > 1 ? 'résultats' : 'résultat'}
              </span>
            ) : null}
          </div>

          {isLoading ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-slate-300">
              Recherche des prérequis...
            </div>
          ) : searchError ? (
            <div className="rounded-3xl border border-rose-300/15 bg-rose-400/10 p-5 text-sm leading-7 text-rose-100">
              {searchError}
            </div>
          ) : search.trim() && filteredDefinitions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-slate-300">
              <p className="font-medium text-white">Aucun prérequis ne correspond à cette recherche.</p>
              <p className="mt-2 text-slate-400">Vous pouvez créer « {search.trim()} » si aucun résultat ne convient.</p>
              <button
                type="button"
                onClick={onOpenNewPrerequisiteForm}
                disabled={newPrerequisiteSaving}
                className="mt-4 inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 disabled:opacity-40"
              >
                Créer « {search.trim()} »
              </button>
            </div>
          ) : !search.trim() && filteredDefinitions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-slate-300">
              <p className="font-medium text-white">Aucun prérequis applicable n’est encore disponible pour ce métier.</p>
              <p className="mt-2 text-slate-400">Créer un prérequis simple à partir de son seul nom si besoin.</p>
              <button
                type="button"
                onClick={onOpenNewPrerequisiteForm}
                disabled={newPrerequisiteSaving}
                className="mt-4 inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 disabled:opacity-40"
              >
                Créer un prérequis personnalisé
              </button>
            </div>
          ) : null}

          {!isLoading && filteredDefinitions.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredDefinitions.map((definition) => {
                const definitionId = prerequisiteIdentity(definition);
                const inRequired = input.requiredPrerequisites.some((selection) => selection.prerequisiteId === definitionId);
                const inPreferred = input.preferredPrerequisites.some((selection) => selection.prerequisiteId === definitionId);
                const selectedImportance = inRequired ? 'required' : inPreferred ? 'preferred' : null;
                const canPlaceRequired = !inRequired && canAddRequired;
                const canPlacePreferred = !inPreferred && canAddPreferred;
                return (
                  <article key={definitionId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{definition.companyLabel}</p>
                        {definition.candidateHelp ? <p className="mt-2 text-sm leading-6 text-slate-400">{definition.candidateHelp}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                            {prerequisiteOriginLabel(definition)}
                          </span>
                          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                            {prerequisiteCategoryLabel(definition.category)}
                          </span>
                          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                            {prerequisiteApplicabilityLabel(definition.applicabilityLevel)}
                          </span>
                          {definition.applicableToCurrentRole === false ? (
                            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-200">
                              Pas encore associé à ce métier
                            </span>
                          ) : null}
                          {definition.alreadySelected === true ? (
                            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200">
                              Déjà ajouté
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={inRequired || !canPlaceRequired}
                        onClick={() => onAssignPrerequisite(definition, 'required')}
                        className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-2 text-xs text-orange-100 disabled:opacity-40"
                      >
                        {selectedImportance === 'required' ? 'Déjà obligatoire' : selectedImportance === 'preferred' ? 'Déplacer en obligatoire' : 'Ajouter en obligatoire'}
                      </button>
                      <button
                        type="button"
                        disabled={inPreferred || !canPlacePreferred}
                        onClick={() => onAssignPrerequisite(definition, 'preferred')}
                        className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs text-violet-100 disabled:opacity-40"
                      >
                        {selectedImportance === 'preferred' ? 'Déjà en valeur ajoutée' : selectedImportance === 'required' ? 'Déplacer en valeur ajoutée' : 'Ajouter en valeur ajoutée'}
                      </button>
                      <button type="button" onClick={() => onEditSuggestion(definition)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-200">
                        Modifier avant ajout
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {newPrerequisiteOpen ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Créer un prérequis personnalisé</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Définissez une question structurée afin que Seven’O puisse qualifier automatiquement la réponse du candidat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onResetNewPrerequisiteForm}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200"
                >
                  Annuler
                </button>
              </div>

              <label className="mt-5 block space-y-2 text-sm text-slate-200">
                Nom du prérequis
                <input
                  value={newPrerequisiteName}
                  onChange={(event) => onNewPrerequisiteNameChange(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                  placeholder="Ex. : Lire un plan"
                />
              </label>
              <p className="mt-2 text-xs leading-6 text-slate-400">
                Indiquez simplement la compétence, l’autorisation ou la condition recherchée.
              </p>

              <label className="mt-4 block space-y-2 text-sm text-slate-200">
                Question affichée au candidat
                <textarea
                  value={newPrerequisiteQuestion}
                  onChange={(event) => onNewPrerequisiteQuestionChange(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                  rows={3}
                  placeholder="Ex. : Utilisez-vous cet outil de manière autonome ?"
                />
              </label>
              <label className="mt-4 block space-y-2 text-sm text-slate-200">
                Aide ou précision facultative
                <textarea value={newPrerequisiteHelp} onChange={(event) => onNewPrerequisiteHelpChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40" rows={2} />
              </label>

              <label className="mt-4 block space-y-2 text-sm text-slate-200">
                Type d’élément
                <Select value={newPrerequisiteFamily} onChange={(event) => onNewPrerequisiteFamilyChange(event.target.value as PrerequisiteFamily)}>
                  <option value="job_skill">Compétence métier</option>
                  <option value="offer_requirement">Condition ou justificatif de l’offre</option>
                </Select>
              </label>
              <p className="mt-2 text-sm text-slate-400">{newPrerequisiteFamily === 'job_skill' ? 'Cette compétence pourra être utilisée pour construire le questionnaire métier.' : 'Cet élément sera vérifié séparément lors de la candidature et ne sera jamais intégré au questionnaire métier.'}</p>
              {newPrerequisiteFamily === 'offer_requirement' ? (
                <label className="mt-4 block space-y-2 text-sm text-slate-200">
                  Nature de la condition
                  <Select value={newOfferRequirementCategory} onChange={(event) => onNewOfferRequirementCategoryChange(event.target.value as OfferRequirementCategory)}>
                    <option value="experience">Expérience</option><option value="diploma">Diplôme</option><option value="permit">Permis</option><option value="vehicle">Véhicule ou moyen de transport</option><option value="caces">CACES</option><option value="certification">Certification</option><option value="habilitation">Habilitation</option><option value="authorization">Autorisation</option><option value="professional_card">Carte professionnelle</option><option value="availability">Disponibilité</option><option value="mobility">Mobilité</option><option value="administrative">Condition administrative</option><option value="other">Autre</option>
                  </Select>
                </label>
              ) : null}

              <label className="mt-4 block space-y-2 text-sm text-slate-200">
                Type de réponse
                <Select value={newPrerequisiteAnswerType} onChange={(event) => onNewPrerequisiteAnswerTypeChange(event.target.value as CompanyPrerequisiteCreationInput['answerType'])}>
                  <option value="boolean">Oui / non</option>
                  <option value="single_choice">Choix unique</option>
                  <option value="multiple_choice">Choix multiple</option>
                  <option value="number">Nombre minimum</option>
                </Select>
              </label>

              {newPrerequisiteAnswerType === 'single_choice' || newPrerequisiteAnswerType === 'multiple_choice' ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2 text-sm text-slate-200">
                    Options proposées, une par ligne
                    <textarea value={newPrerequisiteOptions} onChange={(event) => onNewPrerequisiteOptionsChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40" rows={5} />
                  </label>
                  <label className="block space-y-2 text-sm text-slate-200">
                    Réponses acceptées, une par ligne
                    <textarea value={newPrerequisiteAcceptedValues} onChange={(event) => onNewPrerequisiteAcceptedValuesChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40" rows={5} />
                  </label>
                </div>
              ) : newPrerequisiteAnswerType === 'number' ? (
                <label className="mt-4 block space-y-2 text-sm text-slate-200">
                  Valeur minimale acceptée
                  <input type="number" value={newPrerequisiteAcceptedValues} onChange={(event) => onNewPrerequisiteAcceptedValuesChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40" />
                </label>
              ) : (
                <label className="mt-4 block space-y-2 text-sm text-slate-200">
                  Réponse acceptée
                  <Select value={newPrerequisiteBooleanExpected ? 'true' : 'false'} onChange={(event) => onNewPrerequisiteBooleanExpectedChange(event.target.value === 'true')}>
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </Select>
                </label>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!canAddRequired}
                  onClick={() => onNewPrerequisiteImportanceChange('required')}
                  className={newPrerequisiteImportance === 'required'
                    ? 'rounded-2xl border border-orange-300/20 bg-orange-400/10 p-4 text-left text-sm text-orange-100 disabled:opacity-40'
                    : 'rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-slate-200 disabled:opacity-40'}
                >
                  <strong className="block text-white">{newPrerequisiteFamily === 'job_skill' ? 'Indispensable' : 'Obligatoire'}</strong>
                  <span className="mt-2 block text-slate-400">Le candidat doit satisfaire ce critère pour correspondre à l’offre.</span>
                </button>
                <button
                  type="button"
                  disabled={!canAddPreferred}
                  onClick={() => onNewPrerequisiteImportanceChange('preferred')}
                  className={newPrerequisiteImportance === 'preferred'
                    ? 'rounded-2xl border border-violet-300/20 bg-violet-400/10 p-4 text-left text-sm text-violet-100 disabled:opacity-40'
                    : 'rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-slate-200 disabled:opacity-40'}
                >
                  <strong className="block text-white">{newPrerequisiteFamily === 'job_skill' ? 'Complémentaire' : 'Souhaité'}</strong>
                  <span className="mt-2 block text-slate-400">Ce critère valorise la candidature sans être éliminatoire.</span>
                </button>
              </div>

              <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={newPrerequisiteSaveToLibrary}
                  onChange={(event) => onNewPrerequisiteSaveToLibraryChange(event.target.checked)}
                  className="mt-1 accent-cyan-400"
                />
                <span>
                  <strong className="text-white">Proposer ce prérequis à Seven’O</strong>
                  <span className="mt-1 block text-slate-400">Votre prérequis restera utilisable immédiatement pour cette offre. Seven’O pourra l’examiner avant de l’ajouter éventuellement aux suggestions communes.</span>
                </span>
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={newPrerequisiteSaving}
                onClick={onSaveNewPrerequisite}
                className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                  {newPrerequisiteSaving ? 'Ajout...' : 'Créer le prérequis personnalisé'}
                </button>
                <button
                  type="button"
                  onClick={onResetNewPrerequisiteForm}
                  className="rounded-full border border-white/10 px-5 py-3 text-sm text-slate-200"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-slate-300">
              <p className="font-medium text-white">Créer un prérequis personnalisé</p>
              <p className="mt-2 text-slate-400">Définissez librement son libellé, sa question, son type de réponse et sa condition acceptée.</p>
            </div>
          )}
        </div>
      </div>
    </SevenoPanel>
  );
}
