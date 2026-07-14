'use client';

import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { PREREQUISITE_CATEGORIES, SEVENO_OFFER_PREREQUISITE_LIMITS } from '@/lib/seveno-prerequisite-constants';
import type { JobOfferInput } from '@/types/seveno-job-offers';
import type {
  CompanyPrerequisiteDefinition,
  PrerequisiteImportance,
} from '@/types/seveno-prerequisites';

type LibraryPickerProps = {
  currentOfferId: string;
  input: Pick<JobOfferInput, 'requiredPrerequisites' | 'preferredPrerequisites'>;
  search: string;
  onSearchChange: (value: string) => void;
  filteredDefinitions: CompanyPrerequisiteDefinition[];
  isLoading?: boolean;
  searchError?: string | null;
  requiredCount: number;
  preferredCount: number;
  totalCount: number;
  canAddRequired: boolean;
  canAddPreferred: boolean;
  hasLimitWarning: boolean;
  newPrerequisiteOpen: boolean;
  newPrerequisiteSaving: boolean;
  newPrerequisiteName: string;
  onNewPrerequisiteNameChange: (value: string) => void;
  newPrerequisiteImportance: PrerequisiteImportance;
  onNewPrerequisiteImportanceChange: (value: PrerequisiteImportance) => void;
  newPrerequisiteSaveToLibrary: boolean;
  onNewPrerequisiteSaveToLibraryChange: (value: boolean) => void;
  onOpenNewPrerequisiteForm: () => void;
  onResetNewPrerequisiteForm: () => void;
  onSaveNewPrerequisite: () => void;
  onAssignPrerequisite: (definition: CompanyPrerequisiteDefinition, importance: PrerequisiteImportance) => void;
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

function prerequisiteOriginLabel(definition: CompanyPrerequisiteDefinition) {
  if (definition.source === 'company') {
    return definition.originOfferId ? 'Personnalise' : 'Ma bibliotheque';
  }
  return "Seven'O";
}

function prerequisiteIdentity(definition: Pick<CompanyPrerequisiteDefinition, 'prerequisiteId' | 'code'>) {
  return definition.prerequisiteId || definition.code;
}

function prerequisiteCategoryLabel(value: CompanyPrerequisiteDefinition['category']) {
  return PREREQUISITE_CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

function prerequisiteApplicabilityLabel(value: CompanyPrerequisiteDefinition['applicabilityLevel']) {
  if (value === 'role') return 'Metier';
  if (value === 'family') return 'Famille';
  if (value === 'sector') return 'Secteur';
  return 'Global';
}

export function PrerequisiteLibraryPicker({
  currentOfferId,
  input,
  search,
  onSearchChange,
  filteredDefinitions,
  isLoading = false,
  searchError = null,
  requiredCount,
  preferredCount,
  totalCount,
  canAddRequired,
  canAddPreferred,
  hasLimitWarning,
  newPrerequisiteOpen,
  newPrerequisiteSaving,
  newPrerequisiteName,
  onNewPrerequisiteNameChange,
  newPrerequisiteImportance,
  onNewPrerequisiteImportanceChange,
  newPrerequisiteSaveToLibrary,
  onNewPrerequisiteSaveToLibraryChange,
  onOpenNewPrerequisiteForm,
  onResetNewPrerequisiteForm,
  onSaveNewPrerequisite,
  onAssignPrerequisite,
}: LibraryPickerProps) {
  return (
    <SevenoPanel tone="cyan" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Bibliotheque applicable</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Recherchez un prerequis Seven&apos;O ou de votre bibliotheque privee, puis ajoutez-le a l offre.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
            Obligatoires : {requiredCount}/{SEVENO_OFFER_PREREQUISITE_LIMITS.required}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
            Valeur ajoutee : {preferredCount}/{SEVENO_OFFER_PREREQUISITE_LIMITS.preferred}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
            Total : {totalCount}/{SEVENO_OFFER_PREREQUISITE_LIMITS.total}
          </div>
        </div>
      </div>

      {hasLimitWarning ? (
        <div className="rounded-2xl border border-orange-300/20 bg-orange-400/10 p-4 text-sm leading-6 text-orange-100">
          {requiredCount >= SEVENO_OFFER_PREREQUISITE_LIMITS.required ? 'Vous avez atteint la limite de 5 prerequis obligatoires. Retirez un critere ou transformez-en un en valeur ajoutee. ' : ''}
          {preferredCount >= SEVENO_OFFER_PREREQUISITE_LIMITS.preferred ? 'Vous avez atteint la limite de 3 prerequis en valeur ajoutee. ' : ''}
          {totalCount >= SEVENO_OFFER_PREREQUISITE_LIMITS.total ? 'Une offre peut contenir au maximum 8 prerequis.' : ''}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
        <div className="space-y-4">
          <label className="block space-y-2 text-sm text-slate-200">
            Rechercher un prerequis
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              placeholder="Ex. : Lire un plan, Permis B, AutoCAD..."
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenNewPrerequisiteForm}
              disabled={!currentOfferId || newPrerequisiteSaving || (!canAddRequired && !canAddPreferred)}
              className="rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 disabled:opacity-40"
            >
              Ajouter un nouveau prerequis
            </button>
            {!isLoading && filteredDefinitions.length > 0 ? (
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                {filteredDefinitions.length} resultat(s)
              </span>
            ) : null}
          </div>

          {isLoading ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-slate-300">
              Recherche des prerequis...
            </div>
          ) : searchError ? (
            <div className="rounded-3xl border border-rose-300/15 bg-rose-400/10 p-5 text-sm leading-7 text-rose-100">
              {searchError}
            </div>
          ) : search.trim() && filteredDefinitions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-slate-300">
              <p className="font-medium text-white">Aucun prerequis ne correspond a cette recherche.</p>
              <p className="mt-2 text-slate-400">Vous pouvez ajouter un nouveau prerequis si aucun resultat ne convient.</p>
            </div>
          ) : !search.trim() && filteredDefinitions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-slate-300">
              Aucun prerequis applicable n est encore disponible pour ce metier. Vous pouvez en ajouter un nouveau si besoin.
            </div>
          ) : null}

          {!isLoading && filteredDefinitions.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredDefinitions.map((definition) => {
                const definitionId = prerequisiteIdentity(definition);
                const inRequired = input.requiredPrerequisites.some((selection) => selection.prerequisiteId === definitionId);
                const inPreferred = input.preferredPrerequisites.some((selection) => selection.prerequisiteId === definitionId);
                const selectedImportance = inRequired ? 'required' : inPreferred ? 'preferred' : null;
                const canPlaceRequired = inRequired
                  ? false
                  : inPreferred
                    ? requiredCount < SEVENO_OFFER_PREREQUISITE_LIMITS.required
                    : canAddRequired;
                const canPlacePreferred = inPreferred
                  ? false
                  : inRequired
                    ? preferredCount < SEVENO_OFFER_PREREQUISITE_LIMITS.preferred
                    : canAddPreferred;
                return (
                  <article key={definitionId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{definition.companyLabel}</p>
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
                              Pas encore associe a ce metier
                            </span>
                          ) : null}
                          {definition.alreadySelected === true ? (
                            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200">
                              Deja ajoute
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
                        {selectedImportance === 'required' ? 'Deja obligatoire' : selectedImportance === 'preferred' ? 'Deplacer en obligatoire' : 'Ajouter en obligatoire'}
                      </button>
                      <button
                        type="button"
                        disabled={inPreferred || !canPlacePreferred}
                        onClick={() => onAssignPrerequisite(definition, 'preferred')}
                        className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs text-violet-100 disabled:opacity-40"
                      >
                        {selectedImportance === 'preferred' ? 'Deja en valeur ajoutee' : selectedImportance === 'required' ? 'Deplacer en valeur ajoutee' : 'Ajouter en valeur ajoutee'}
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
                  <h3 className="text-lg font-semibold text-white">Ajouter un nouveau prerequis</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Indiquez seulement le nom du prerequis. Le moteur Seven&apos;O generera les valeurs techniques automatiquement.
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
                Nom du prerequis
                <input
                  value={newPrerequisiteName}
                  onChange={(event) => onNewPrerequisiteNameChange(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                  placeholder="Ex. : Lire un plan"
                />
              </label>
              <p className="mt-2 text-xs leading-6 text-slate-400">
                Indiquez simplement la competence, l autorisation ou la condition recherchee.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!canAddRequired}
                  onClick={() => onNewPrerequisiteImportanceChange('required')}
                  className={newPrerequisiteImportance === 'required'
                    ? 'rounded-2xl border border-orange-300/20 bg-orange-400/10 p-4 text-left text-sm text-orange-100 disabled:opacity-40'
                    : 'rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-slate-200 disabled:opacity-40'}
                >
                  <strong className="block text-white">Obligatoire</strong>
                  <span className="mt-2 block text-slate-400">Le candidat doit satisfaire ce critere pour correspondre a l offre.</span>
                </button>
                <button
                  type="button"
                  disabled={!canAddPreferred}
                  onClick={() => onNewPrerequisiteImportanceChange('preferred')}
                  className={newPrerequisiteImportance === 'preferred'
                    ? 'rounded-2xl border border-violet-300/20 bg-violet-400/10 p-4 text-left text-sm text-violet-100 disabled:opacity-40'
                    : 'rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-slate-200 disabled:opacity-40'}
                >
                  <strong className="block text-white">Valeur ajoutee</strong>
                  <span className="mt-2 block text-slate-400">Ce critere valorise la candidature sans etre eliminatoire.</span>
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
                  <strong className="text-white">Enregistrer aussi dans ma bibliotheque entreprise</strong>
                  <span className="mt-1 block text-slate-400">Vous pourrez reutiliser ce prerequis dans vos prochaines offres.</span>
                </span>
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={newPrerequisiteSaving || (!canAddRequired && !canAddPreferred)}
                  onClick={onSaveNewPrerequisite}
                  className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {newPrerequisiteSaving ? 'Ajout...' : 'Ajouter le prerequis'}
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
              <p className="font-medium text-white">Ajouter un nouveau prerequis</p>
              <p className="mt-2 text-slate-400">Cliquez sur ce bouton pour creer un prerequis simple a partir de son seul nom.</p>
            </div>
          )}
        </div>
      </div>
    </SevenoPanel>
  );
}
