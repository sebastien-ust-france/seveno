import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import {
  COMPANY_QUESTION_TIME_LIMIT_SECONDS,
  COMPANY_QUESTIONNAIRE_AI_SCHEMA,
  COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
} from '@/lib/seveno-company-questionnaire-constants';
import type {
  CompanyQuestion,
  CompanyQuestionDifficulty,
  CompanyQuestionOption,
  CompanyQuestionType,
  CompanyQuestionnaireCreationMode,
  CompanyQuestionnaireInput,
} from '@/types/seveno-company-questionnaires';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';
import type { OfferPrerequisiteSnapshot } from '@/types/seveno-prerequisites';

type PlainObject = Record<string, unknown>;

export interface CompanyQuestionnaireAiImportResult {
  questionnaire: CompanyQuestionnaireInput & {
    creationMode: CompanyQuestionnaireCreationMode;
    questions: CompanyQuestion[];
  };
  warnings: string[];
}

function isPlainObject(value: unknown): value is PlainObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    return '';
  }
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function normalizeLabel(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeQuestionType(value: unknown): CompanyQuestionType | null {
  if (value === 'single_choice' || value === 'multiple_choice') {
    return value;
  }

  return null;
}

function normalizeDifficulty(value: unknown): CompanyQuestionDifficulty {
  if (value === 'easy' || value === 'medium' || value === 'hard') {
    return value;
  }
  return 'medium';
}

function resolveOptionId(reference: string, options: CompanyQuestionOption[]) {
  const cleaned = cleanText(reference, 120);
  if (!cleaned) {
    return '';
  }

  const byId = options.find((option) => option.id === cleaned);
  if (byId) {
    return byId.id;
  }

  const normalizedReference = normalizeLabel(cleaned);
  const byLabel = options.find((option) => normalizeLabel(option.label) === normalizedReference);
  return byLabel?.id ?? '';
}

function normalizeOptions(rawOptions: unknown, questionId: string): CompanyQuestionOption[] {
  if (!Array.isArray(rawOptions)) {
    return [];
  }

  const options = rawOptions.map((item, index) => {
    const option = isPlainObject(item) ? item : {};
    const label = cleanText(option.label ?? option.value, 120);
    if (!label) {
      throw new Error(`La reponse ${index + 1} de ${questionId} est invalide.`);
    }

    const id = cleanText(option.id ?? option.value, 120) || `option-${index + 1}`;
    const orderValue = typeof option.order === 'number' && Number.isInteger(option.order) && option.order >= 1
      ? option.order
      : index + 1;

    return {
      id,
      label,
      order: orderValue,
    };
  });

  if (options.length < 2 || options.length > 4) {
    throw new Error(`La question ${questionId} doit proposer entre deux et quatre reponses.`);
  }

  const optionIds = new Set(options.map((option) => option.id));
  if (optionIds.size !== options.length) {
    throw new Error(`Les identifiants des reponses de ${questionId} doivent etre uniques.`);
  }

  const normalizedLabels = new Set(options.map((option) => normalizeLabel(option.label)));
  if (normalizedLabels.size !== options.length) {
    throw new Error(`Les réponses de ${questionId} ne peuvent pas avoir le même libellé.`);
  }

  return options.map((option, index) => ({
    ...option,
    order: index + 1,
  }));
}

function normalizeExpectedAnswer(
  rawExpectedAnswer: unknown,
  type: CompanyQuestionType,
  options: CompanyQuestionOption[],
) {
  if (type === 'single_choice') {
    if (typeof rawExpectedAnswer !== 'string') {
      throw new Error('La reponse attendue doit etre une seule option existante.');
    }
    const optionId = resolveOptionId(rawExpectedAnswer, options);
    if (!optionId) {
      throw new Error('La bonne reponse fait reference a une option inexistante.');
    }
    return optionId;
  }

  if (type === 'multiple_choice') {
    if (!Array.isArray(rawExpectedAnswer)) {
      throw new Error('La bonne reponse multiple doit etre un tableau d options existantes.');
    }
    if (rawExpectedAnswer.length < 2) {
      throw new Error('Une question a choix multiple doit comporter au moins deux bonnes reponses.');
    }
    const optionIds = rawExpectedAnswer.map((value) => {
      if (typeof value !== 'string') {
        throw new Error('Une bonne reponse multiple est invalide.');
      }
      const optionId = resolveOptionId(value, options);
      if (!optionId) {
        throw new Error('Une bonne reponse fait reference a une option inexistante.');
      }
      return optionId;
    });
    if (new Set(optionIds).size !== optionIds.length) {
      throw new Error('Une bonne reponse multiple ne peut pas etre dupliquee.');
    }
    return optionIds;
  }

  throw new Error(`Le type ${type} n est pas autorise dans l import IA.`);
}

function normalizeQuestion(rawQuestion: unknown, index: number): CompanyQuestion {
  if (!isPlainObject(rawQuestion)) {
    throw new Error(`La question ${index + 1} est invalide.`);
  }

  const type = normalizeQuestionType(rawQuestion.type);
  if (!type) {
    throw new Error(`Le type de la question ${index + 1} doit etre single_choice ou multiple_choice.`);
  }

  const id = cleanText(rawQuestion.id ?? `question-${index + 1}`, 120);
  if (!id) {
    throw new Error(`L identifiant de la question ${index + 1} est invalide.`);
  }

  const prompt = cleanText(rawQuestion.prompt, 500);
  if (!prompt) {
    throw new Error(`La question ${id} doit contenir un intitule.`);
  }

  if (cleanText(rawQuestion.correctionMode, 40) !== 'automatic') {
    throw new Error(`La question ${id} doit utiliser correctionMode = automatic.`);
  }

  const options = normalizeOptions(rawQuestion.options, id);
  const expectedAnswer = normalizeExpectedAnswer(
    rawQuestion.expectedAnswer,
    type,
    options,
  );
  const difficulty = normalizeDifficulty(rawQuestion.difficulty);
  const explanation = cleanText(rawQuestion.explanation, 2000);
  const required = rawQuestion.required !== false;
  const order = typeof rawQuestion.order === 'number' && Number.isInteger(rawQuestion.order) && rawQuestion.order >= 0
    ? rawQuestion.order
    : index;

  if (expectedAnswer === undefined) {
    throw new Error(`La question ${id} doit definir une bonne reponse.`);
  }

  return {
    id,
    prompt,
    ...(cleanText(rawQuestion.help, 1000) ? { help: cleanText(rawQuestion.help, 1000) } : {}),
    ...(explanation ? { explanation } : {}),
    type,
    required,
    options,
    correctionMode: 'automatic',
    expectedAnswer,
    points: 1,
    order,
    difficulty,
  };
}

function formatPrerequisiteList(items: OfferPrerequisiteSnapshot[]) {
  if (!items.length) {
    return ['Aucun prerequis enregistre.'];
  }

  return items.map((item, index) => {
    const criterion = typeof item.expectedCriterion === 'string'
      ? item.expectedCriterion
      : typeof item.expectedCriterion === 'number'
        ? String(item.expectedCriterion)
        : Array.isArray(item.expectedCriterion)
          ? item.expectedCriterion.join(', ')
          : item.expectedCriterion === true
            ? 'Oui'
            : 'Non';
    return `${index + 1}. ${item.companyLabel || item.candidateQuestion} (${item.importance}) -> ${criterion}`;
  });
}

function formatOfferContext(offer: SerializedJobOffer) {
  const sectorLabel = findSectorLabel(offer.sectorId) ?? offer.sectorId;
  const familyLabel = findFamilyLabel(offer.jobFamilyId) ?? offer.jobFamilyId;
  const roleLabel = findRoleLabel(offer.jobRoleId) ?? offer.jobRoleLabel ?? offer.jobRoleId;

  return [
    `Offre Seven’O : ${offer.title}`,
    `Metier : ${sectorLabel} > ${familyLabel} > ${roleLabel}`,
    `Localisation : ${offer.location || 'Non renseignee'}`,
    `Mode de travail : ${offer.workMode || 'Non renseigne'}`,
    `Contrat : ${offer.contractType || 'Non renseigne'}`,
    `Temps de travail : ${offer.workingTime || 'Non renseigne'}`,
    `Description : ${offer.description || 'Non renseignee'}`,
    `Missions : ${offer.missions || 'Non renseignees'}`,
    `Resume du profil : ${offer.profileSummary || 'Non renseigne'}`,
    `Questionnaire actuel : ${offer.questionnaireTitleSnapshot || 'Aucun questionnaire associe'} (${offer.questionnaireQuestionCountSnapshot ?? 0} question(s))`,
    '',
    'Prerequis obligatoires:',
    ...formatPrerequisiteList(offer.requiredPrerequisites),
    '',
    'Prerequis valeurs ajoutees:',
    ...formatPrerequisiteList(offer.preferredPrerequisites),
  ].join('\n');
}

export function buildCompanyQuestionnaireAiPrompt(offer: SerializedJobOffer) {
  return [
    `Tu es un assistant de rédaction de questionnaire entreprise Seven’O.`,
    `Genere uniquement un JSON valide, sans Markdown, sans commentaire et sans texte autour.`,
    `Le questionnaire sera chronométré, noté et corrigé automatiquement par Seven’O.`,
    `Chaque nouvelle tentative candidat doit presenter les questions dans un ordre aleatoire stocke cote serveur.`,
    `Chaque question dispose de ${COMPANY_QUESTION_TIME_LIMIT_SECONDS} secondes et l ensemble doit tenir en 5 minutes maximum.`,
    '',
    formatOfferContext(offer),
    '',
    'Regles absolues:',
    `- Cree exactement ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions.`,
    '- Chaque question doit etre independante des autres et ne jamais referencer une autre question.',
    '- Utilise uniquement des questions a choix.',
    '- Utilise uniquement single_choice et multiple_choice.',
    '- N utilise jamais de reponse libre.',
    '- N utilise jamais le type "text".',
    '- Utilise toujours correctionMode = "automatic".',
    '- Chaque question doit comporter entre 2 et 4 options.',
    '- Chaque question doit comporter une ou plusieurs bonnes reponses explicitement referencees.',
    '- Pour single_choice, expectedAnswer doit etre l identifiant unique d une option existante.',
    '- Pour multiple_choice, expectedAnswer doit etre un tableau d identifiants d options existantes contenant au moins deux bonnes reponses.',
    '- Ne definis jamais de seuil minimum de passage dans ce JSON : il est configure separatement dans Seven\'O.',
    '- N utilise jamais expectedAnswer = null.',
    '- Ne cree aucune question declarative, personnelle, de motivation ou de description.',
    '- Ne demande jamais au candidat de confirmer un prerequis deja recu par Seven\'O.',
    '- N attribue aucun point.',
    '- Chaque question doit etre lisible et repondable en 15 secondes.',
    '',
    'Les prerequis de candidature sont deja demandes separement par Seven\'O.',
    'Ne cree aucune question demandant au candidat s il possede un permis, une certification, une disponibilite, une mobilite, un diplome ou une experience deja indiquee dans les prerequis.',
    'Utilise ces informations uniquement pour adapter le niveau et le contexte des questions metier.',
    '',
    'Questions interdites:',
    '- Avez-vous deja ete responsable de magasin ?',
    '- Possedez-vous le permis B ?',
    '- Etes-vous disponible le samedi ?',
    '- Combien de personnes avez-vous encadrees ?',
    '- Decrivez votre maniere de motiver une equipe.',
    '',
    'Questions attendues:',
    '- Un client mecontent parle tres fort devant les autres clients. Quelle est la premiere action appropriee ?',
    '- Un inventaire fait apparaitre un ecart important. Quelle etape doit etre realisee en premier ?',
    '- Quel indicateur aide directement a suivre la valeur moyenne des achats par client ?',
    '- Une rupture de stock est annoncee sur un produit tres demande. Quelle action doit etre priorisee ?',
    '',
    'Schema JSON attendu:',
    `{`,
    `  "schema": "${COMPANY_QUESTIONNAIRE_AI_SCHEMA}",`,
    `  "questionCount": ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT},`,
    `  "creationMode": "ai_import",`,
    `  "title": "Titre du questionnaire",`,
    `  "instructions": "Consignes a afficher au candidat",`,
    `  "questions": [`,
    `    {`,
    `      "id": "question-1",`,
    `      "prompt": "Question a poser",`,
    `      "help": "Aide optionnelle",`,
    `      "type": "single_choice",`,
    `      "required": true,`,
    `      "options": [`,
    `        { "id": "option-1", "label": "Reponse A", "order": 1 },`,
    `        { "id": "option-2", "label": "Reponse B", "order": 2 }`,
    `      ],`,
    `      "correctionMode": "automatic",`,
    `      "expectedAnswer": "option-1",`,
    `      "difficulty": "medium",`,
    `      "explanation": "Pourquoi cette reponse est correcte",`,
    `      "order": 0`,
    `    }`,
    `  ]`,
    `}`,
    '',
    'Regles de sortie:',
    '- Retourne uniquement le JSON.',
    '- Respecte les identifiants stables pour les questions et les options.',
    '- Ne definis aucun point.',
    '- N ajoute aucune question hors sujet.',
    '- N introduis aucune categorie supplementaire.',
    '- N ecris pas de texte en dehors du JSON.',
  ].join('\n');
}

export function parseCompanyQuestionnaireAiImport(raw: unknown): CompanyQuestionnaireAiImportResult {
  const payload = typeof raw === 'string'
    ? JSON.parse(raw) as unknown
    : raw;

  if (!isPlainObject(payload)) {
    throw new Error('Le JSON importe est invalide.');
  }

  const warnings: string[] = [];
  if (payload.schema && payload.schema !== COMPANY_QUESTIONNAIRE_AI_SCHEMA) {
    throw new Error(`Le schema du JSON doit etre ${COMPANY_QUESTIONNAIRE_AI_SCHEMA}.`);
  }
  if (!payload.schema) {
    warnings.push('Le champ schema est manquant. Le JSON a ete importe quand meme.');
  }
  if (payload.questionCount !== COMPANY_QUESTIONNAIRE_QUESTION_COUNT) {
    throw new Error(`Le JSON importe doit annoncer exactement ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions.`);
  }
  if (payload.creationMode && payload.creationMode !== 'ai_import') {
    throw new Error('Le JSON importe doit utiliser creationMode = ai_import.');
  }
  if ('minimumPassingScorePercent' in payload || 'threshold' in payload) {
    warnings.push('Le seuil minimum present dans le JSON a ete ignore. Il se configure directement dans Seven\'O.');
  }

  const title = cleanText(payload.title, 200);
  const instructions = cleanText(payload.instructions, 3000);
  if (!title) {
    throw new Error('Le JSON importe doit contenir un titre.');
  }
  if (!instructions) {
    throw new Error('Le JSON importe doit contenir des instructions.');
  }

  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    throw new Error('Le JSON importe doit contenir au moins une question.');
  }
  if (payload.questions.length !== COMPANY_QUESTIONNAIRE_QUESTION_COUNT) {
    throw new Error(`Le fichier annonce ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions mais en contient ${payload.questions.length}.`);
  }

  const questions = payload.questions.map((question, index) => normalizeQuestion(question, index));
  const questionIds = new Set(questions.map((question) => question.id));
  if (questionIds.size !== questions.length) {
    throw new Error('Les identifiants des questions doivent etre uniques.');
  }

  if (questions.some((question) => !question.explanation?.trim())) {
    warnings.push('Certaines questions n ont pas d explication. Ajouter une explication aide a valider le questionnaire avant enregistrement.');
  }

  return {
    questionnaire: {
      title,
      instructions,
      creationMode: 'ai_import',
      durationMinutes: null,
      questions,
    },
    warnings,
  };
}
