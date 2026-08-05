import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import {
  COMPANY_QUESTION_TIME_LIMIT_SECONDS,
  COMPANY_QUESTION_POINTS,
  COMPANY_QUESTIONNAIRE_AI_SCHEMA,
  COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION,
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
import type { CompanyQuestionnaireEditorProjection } from '@/types/seveno-company-questionnaires';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';
import type { OfferPrerequisiteSnapshot } from '@/types/seveno-prerequisites';
import { classifyOfferPrerequisites } from '@/lib/seveno-prerequisite-families';

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

function normalizeDifficulty(value: unknown, path: string): CompanyQuestionDifficulty {
  if (value === 'easy' || value === 'medium' || value === 'hard') {
    return value;
  }
  throw new Error(`${path}.difficulty : valeur reçue ${JSON.stringify(value)}, valeur attendue easy, medium ou hard.`);
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
      throw new Error(`La réponse ${index + 1} de ${questionId} est invalide.`);
    }

    const id = cleanText(option.id, 120);
    if (!id) {
      throw new Error(`questions[${questionId}].options[${index}].id : identifiant obligatoire.`);
    }
    const orderValue = typeof option.order === 'number' && Number.isInteger(option.order) && option.order >= 1
      ? option.order
      : null;
    if (orderValue === null) {
      throw new Error(`questions[${questionId}].options[${index}].order : entier positif obligatoire.`);
    }

    return {
      id,
      label,
      order: orderValue,
    };
  });

  if (options.length < 2 || options.length > 4) {
    throw new Error(`La question ${questionId} doit proposer entre deux et quatre réponses.`);
  }

  const optionIds = new Set(options.map((option) => option.id));
  if (optionIds.size !== options.length) {
    throw new Error(`Les identifiants des réponses de ${questionId} doivent être uniques.`);
  }
  if (new Set(options.map((option) => option.order)).size !== options.length) {
    throw new Error(`questions[${questionId}].options[].order : les ordres doivent être uniques.`);
  }

  const normalizedLabels = new Set(options.map((option) => normalizeLabel(option.label)));
  if (normalizedLabels.size !== options.length) {
    throw new Error(`Les réponses de ${questionId} ne peuvent pas avoir le même libellé.`);
  }

  return options;
}

function normalizeExpectedAnswer(
  rawExpectedAnswer: unknown,
  type: CompanyQuestionType,
  options: CompanyQuestionOption[],
) {
  if (type === 'single_choice') {
    if (typeof rawExpectedAnswer !== 'string') {
      throw new Error('La réponse attendue doit être une seule option existante.');
    }
    const optionId = resolveOptionId(rawExpectedAnswer, options);
    if (!optionId) {
      throw new Error('La bonne réponse fait référence à une option inexistante.');
    }
    return optionId;
  }

  if (type === 'multiple_choice') {
    if (!Array.isArray(rawExpectedAnswer)) {
      throw new Error('La bonne réponse multiple doit être un tableau d’options existantes.');
    }
    if (rawExpectedAnswer.length < 2) {
      throw new Error('Une question à choix multiple doit comporter au moins deux bonnes réponses.');
    }
    const optionIds = rawExpectedAnswer.map((value) => {
      if (typeof value !== 'string') {
        throw new Error('Une bonne réponse multiple est invalide.');
      }
      const optionId = resolveOptionId(value, options);
      if (!optionId) {
        throw new Error('Une bonne réponse fait référence à une option inexistante.');
      }
      return optionId;
    });
    if (new Set(optionIds).size !== optionIds.length) {
      throw new Error('Une bonne réponse multiple ne peut pas être dupliquée.');
    }
    return optionIds;
  }

  throw new Error(`Le type ${type} n’est pas autorisé dans l’import IA.`);
}

function normalizeQuestion(rawQuestion: unknown, index: number): CompanyQuestion {
  if (!isPlainObject(rawQuestion)) {
    throw new Error(`La question ${index + 1} est invalide.`);
  }

  const type = normalizeQuestionType(rawQuestion.type);
  if (!type) {
    throw new Error(`Le type de la question ${index + 1} doit être single_choice ou multiple_choice.`);
  }

  const path = `questions[${index}]`;
  const id = cleanText(rawQuestion.id, 120);
  if (!id) {
    throw new Error(`${path}.id : identifiant obligatoire.`);
  }

  const prompt = cleanText(rawQuestion.prompt, 500);
  if (!prompt) {
    throw new Error(`La question ${id} doit contenir un intitulé.`);
  }

  if (cleanText(rawQuestion.correctionMode, 40) !== 'automatic') {
    throw new Error(`La question ${id} doit utiliser correctionMode = automatic.`);
  }
  if (rawQuestion.required !== true) {
    throw new Error(`${path}.required : valeur reçue ${JSON.stringify(rawQuestion.required)}, valeur attendue true.`);
  }
  if ('points' in rawQuestion) {
    throw new Error(`${path}.points : champ interdit dans un import IA.`);
  }

  const options = normalizeOptions(rawQuestion.options, id);
  const expectedAnswer = normalizeExpectedAnswer(
    rawQuestion.expectedAnswer,
    type,
    options,
  );
  const difficulty = normalizeDifficulty(rawQuestion.difficulty, path);
  const explanation = cleanText(rawQuestion.explanation, 2000);
  const order = typeof rawQuestion.order === 'number' && Number.isInteger(rawQuestion.order) && rawQuestion.order >= 0
    ? rawQuestion.order
    : null;
  if (!explanation) {
    throw new Error(`${path}.explanation : explication obligatoire.`);
  }
  if (order === null) {
    throw new Error(`${path}.order : entier positif ou nul obligatoire.`);
  }

  if (expectedAnswer === undefined) {
    throw new Error(`La question ${id} doit définir une bonne réponse.`);
  }

  return {
    id,
    prompt,
    ...(cleanText(rawQuestion.help, 1000) ? { help: cleanText(rawQuestion.help, 1000) } : {}),
    explanation,
    type,
    required: true,
    options,
    correctionMode: 'automatic',
    expectedAnswer,
    points: COMPANY_QUESTION_POINTS,
    order,
    difficulty,
  };
}

function formatPrerequisiteList(items: OfferPrerequisiteSnapshot[]) {
  if (!items.length) {
    return ['Aucune compétence métier renseignée.'];
  }

  return items.map((item, index) => `${index + 1}. ${item.companyLabel}${item.candidateHelp ? ` — ${item.candidateHelp}` : ''}`);
}

function formatOfferContext(
  offer: SerializedJobOffer,
  questionnaire: CompanyQuestionnaireEditorProjection | null = null,
) {
  if (questionnaire && questionnaire.offerId !== offer.id) {
    throw new Error('Le questionnaire chargé n’est pas associé à l’offre actuellement ouverte. La génération a été interrompue.');
  }
  const sectorLabel = findSectorLabel(offer.sectorId) ?? offer.sectorId;
  const familyLabel = findFamilyLabel(offer.jobFamilyId) ?? offer.jobFamilyId;
  const roleLabel = findRoleLabel(offer.jobRoleId) ?? offer.jobRoleLabel ?? offer.jobRoleId;
  const jobSkills = classifyOfferPrerequisites([...offer.requiredPrerequisites, ...offer.preferredPrerequisites]);

  return [
    `Identifiant de l’offre : ${offer.id}`,
    `Offre Seven’O : ${offer.title}`,
    `Métier : ${sectorLabel} > ${familyLabel} > ${roleLabel}`,
    `Localisation : ${offer.location || 'Non renseignée'}`,
    `Mode de travail : ${offer.workMode || 'Non renseigné'}`,
    `Contrat : ${offer.contractType || 'Non renseigné'}`,
    `Temps de travail : ${offer.workingTime || 'Non renseigné'}`,
    `Description : ${offer.description || 'Non renseignée'}`,
    `Missions : ${offer.missions || 'Non renseignées'}`,
    `Résumé du profil : ${offer.profileSummary || 'Non renseigné'}`,
    questionnaire ? `Suggestion de titre existante : ${questionnaire.title}` : 'Suggestion de titre existante : aucune',
    `Le JSON généré remplacera intégralement le contenu actuel du questionnaire. Produis exactement ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT} nouvelles questions.`,
    '',
    'Compétences métier indispensables à évaluer :',
    ...formatPrerequisiteList(jobSkills.requiredJobSkills),
    '',
    'Compétences métier complémentaires à évaluer :',
    ...formatPrerequisiteList(jobSkills.preferredJobSkills),
  ].join('\n');
}

export function buildCompanyQuestionnaireAiPrompt(
  offer: SerializedJobOffer,
  questionnaire: CompanyQuestionnaireEditorProjection | null = null,
) {
  return [
    `Tu es un assistant de rédaction de questionnaire entreprise Seven’O.`,
    `Génère uniquement un JSON valide, sans Markdown, sans commentaire et sans texte autour.`,
    `Le questionnaire sera chronométré, noté et corrigé automatiquement par Seven’O.`,
    `Chaque nouvelle tentative candidat doit présenter les questions dans un ordre aléatoire stocké côté serveur.`,
    `Chaque question dispose de ${COMPANY_QUESTION_TIME_LIMIT_SECONDS} secondes et l’ensemble doit tenir en ${Math.ceil((COMPANY_QUESTIONNAIRE_QUESTION_COUNT * COMPANY_QUESTION_TIME_LIMIT_SECONDS) / 60)} minutes maximum.`,
    '',
    formatOfferContext(offer, questionnaire),
    '',
    'Règles absolues :',
    '- Tous les contenus éditoriaux destinés à être affichés à l’utilisateur doivent être rédigés dans un français naturel, grammaticalement correct et intégralement accentué. Les accents, apostrophes typographiques et caractères français doivent être conservés en UTF-8. Il est interdit de convertir les titres, instructions, questions, options ou explications en ASCII ou de supprimer leurs signes diacritiques.',
    `- Crée exactement ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions.`,
    '- Répartition obligatoire des sources : 75 % / 25 %.',
    '- Répartis exactement les 20 questions selon les deux sources suivantes : exactement 15 questions directement liées aux compétences métier indispensables ou complémentaires transmises dans l’offre ; exactement 5 questions déduites de l’analyse globale du poste, de sa description, de ses missions, de son environnement d’exercice, des contrôles attendus, des risques, de la qualité du travail et des décisions concrètes liées au métier.',
    '- Avant de produire le JSON, analyse silencieusement les compétences, la description, les missions et le profil recherché, puis établis une matrice de couverture avec 15 emplacements « compétences métier » et 5 emplacements « analyse globale du poste ». Ne restitue ni cette matrice ni ton raisonnement.',
    '- Les 15 questions liées aux compétences ne doivent jamais être de simples reformulations déclaratives. Évalue une connaissance, une méthode, un contrôle, un diagnostic, un choix d’action, les conséquences d’une erreur ou une décision concrète.',
    '- Couvre chaque compétence indispensable avec au moins deux questions distinctes lorsque leur nombre le permet. Couvre chaque compétence complémentaire avec au moins une question lorsqu’elle existe. Les compétences indispensables restent prioritaires.',
    '- Les compétences complémentaires ne doivent pas représenter plus d’un tiers des 15 questions liées aux compétences, sauf en l’absence de compétence indispensable.',
    '- Aucun sujet ni aucune compétence ne doit concentrer plus de 5 questions.',
    '- Les 5 questions issues de l’analyse globale doivent compléter les compétences sélectionnées sans les dupliquer, rester directement liées au métier et ne jamais devenir des questions de personnalité, de motivation ou d’expérience personnelle.',
    '- N’invente aucune responsabilité absente ou non raisonnablement déductible de la description, des missions ou du métier.',
    '- Ne génère pas deux questions évaluant la même connaissance avec de simples variations de vocabulaire.',
    '- N’emploie jamais les formulations « Savez-vous faire… ? », « Maîtrisez-vous… ? », « Possédez-vous… ? » ou « Avez-vous déjà… ? ».',
    '- Chaque question doit être indépendante des autres et ne jamais référencer une autre question.',
    '- Utilise uniquement des questions à choix.',
    '- Utilise uniquement single_choice et multiple_choice.',
    '- N’utilise jamais de réponse libre.',
    '- N’utilise jamais le type "text".',
    '- Utilise toujours correctionMode = "automatic".',
    '- Chaque question doit comporter entre 2 et 4 options.',
    '- Chaque question doit comporter une ou plusieurs bonnes réponses explicitement référencées.',
    '- Pour single_choice, expectedAnswer doit être l’identifiant unique d’une option existante.',
    '- Pour multiple_choice, expectedAnswer doit être un tableau d’identifiants d’options existantes contenant au moins deux bonnes réponses.',
    '- Les mauvaises réponses doivent être plausibles pour une personne connaissant partiellement le métier.',
    '- Toutes les options d’une question doivent appartenir à la même catégorie sémantique et présenter un niveau de précision comparable.',
    '- La bonne réponse ne doit pas être identifiable par sa longueur ou son niveau de détail.',
    '- N’utilise aucune option humoristique, absurde ou manifestement hors sujet, ni « toutes les réponses », ni « aucune des réponses ». Évite les doubles négations.',
    `- Pour multiple_choice, indique clairement dans la question que plusieurs réponses sont attendues et conserve des options lisibles dans la limite de ${COMPANY_QUESTION_TIME_LIMIT_SECONDS} secondes.`,
    '- Ne définis jamais de seuil minimum de passage dans ce JSON : il est configuré séparément dans Seven’O.',
    '- N’utilise jamais expectedAnswer = null.',
    '- Ne crée aucune question déclarative, personnelle, de motivation ou de description.',
    '- Ne demande jamais au candidat de confirmer un prérequis déjà reçu par Seven’O.',
    '- Le questionnaire doit évaluer uniquement des compétences utiles à l’exercice du métier. Ne crée aucune question portant sur la possession, la validité ou la vérification d’un diplôme, permis, CACES, habilitation, certification, autorisation, carte professionnelle, véhicule, disponibilité, mobilité ou condition administrative. Ces éléments sont vérifiés séparément par Seven’O.',
    '- N’attribue aucun point.',
    `- Chaque question doit être lisible et répondable en ${COMPANY_QUESTION_TIME_LIMIT_SECONDS} secondes.`,
    `- Respecte exactement la répartition des difficultés : ${COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.easy} easy, ${COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.medium} medium et ${COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.hard} hard.`,
    '- La répartition 15/5 des sources et la répartition 6/10/4 des difficultés sont indépendantes. Les 5 questions issues du poste ne sont pas automatiquement hard.',
    '',
    'NIVEAU PROFESSIONNEL MINIMAL',
    'La difficulté easy ne signifie jamais connaissance scolaire générale, culture générale ou réponse évidente par simple bon sens.',
    'Une question easy doit évaluer une connaissance élémentaire propre au métier analysé. Elle doit être facilement répondable par une personne débutante ayant reçu une formation ou acquis de premières bases pratiques, mais difficilement répondable par une personne extérieure au métier.',
    'Même une question easy doit porter sur au moins l’un des éléments suivants : un outil ou un équipement professionnel ; un matériau ou un composant utilisé dans le métier ; la fonction d’un élément technique ; une méthode d’exécution ; un contrôle professionnel courant ; un ordre d’intervention ; un défaut caractéristique ; une règle technique propre au métier ; le vocabulaire professionnel indispensable ; le choix entre plusieurs solutions techniquement plausibles.',
    'Avant de conserver chaque question easy, applique silencieusement le contrôle suivant : « Une personne sans formation ni expérience dans ce métier pourrait-elle trouver la bonne réponse uniquement grâce à ses connaissances scolaires, à la culture générale, au bon sens ou à l’élimination d’options absurdes ? » Si la réponse est oui, remplace la question par une question simple mais réellement professionnelle.',
    '',
    'Définition des difficultés :',
    '- EASY : connaissance métier directe ; identification ou fonction d’un élément professionnel ; choix d’un outil ou d’une méthode courante ; contrôle élémentaire propre au métier ; une seule étape de raisonnement ; aucune connaissance scolaire autonome.',
    '- MEDIUM : application d’une méthode dans une situation concrète ; choix entre plusieurs solutions plausibles ; combinaison de deux informations ; contrôle d’une exécution ; calcul professionnel contextualisé ; détection d’une erreur courante.',
    '- HARD : diagnostic d’une anomalie ; identification d’une cause probable ; arbitrage entre qualité, sécurité et exécution ; conséquence technique d’une mauvaise décision ; choix d’une action prioritaire ; prévention d’un défaut important ; raisonnement à plusieurs étapes.',
    '- La différence entre les difficultés porte sur la profondeur du raisonnement, jamais sur l’opposition entre questions scolaires et questions métier.',
    '',
    'Questions interdites :',
    '- Ne produis jamais comme question autonome la formule de l’aire d’un rectangle, une multiplication, une addition ou une conversion sans véritable contexte professionnel.',
    '- Ne produis jamais une définition générale directement déductible du mot utilisé, une règle de sécurité évidente pour toute personne raisonnable ni une simple reconnaissance de la formulation présente dans la description de l’offre.',
    '- Ne produis jamais une question scolaire artificiellement habillée avec un contexte métier, une question dont les mauvaises réponses sont absurdes ou étrangères au métier, ni une question résoluble par élimination immédiate sans connaissance professionnelle.',
    '- Un calcul simple reste autorisé uniquement s’il reproduit une opération concrète du métier et nécessite de comprendre ce qui doit réellement être mesuré, déduit, contrôlé ou commandé.',
    '',
    'Qualité professionnelle des options :',
    '- Toutes les options doivent appartenir au même univers professionnel, être techniquement plausibles pour une personne connaissant partiellement le métier et présenter un niveau de précision comparable.',
    '- La bonne réponse ne doit pas être la seule option prudente, raisonnable ou techniquement formulée. Les mauvaises réponses doivent correspondre à des confusions métier crédibles.',
    '- Aucune option ne doit être humoristique, manifestement dangereuse ou totalement hors sujet uniquement pour servir de distracteur.',
    '- Une personne extérieure au métier ne doit pas pouvoir répondre simplement en choisissant l’option la plus longue, la plus prudente ou la plus professionnelle dans sa formulation.',
    '- Déduis les connaissances professionnelles élémentaires exclusivement du titre de l’offre, du métier résolu depuis la taxonomie, de la description, des missions, du résumé du profil et des compétences métier indispensables ou complémentaires transmis dans le contexte.',
    '',
    'Les prérequis de candidature sont déjà demandés séparément par Seven’O.',
    'Ne reformule jamais un prérequis en question déclarative demandant au candidat de confirmer qu’il le possède ou le maîtrise.',
    'Utilise les prérequis uniquement pour adapter le niveau technique, identifier les compétences à évaluer, contextualiser les questions et répartir les sujets.',
    'Chaque question doit évaluer une connaissance, un raisonnement, un diagnostic ou une décision concrète directement liée à l’offre.',
    '',
    'Schéma JSON attendu :',
    `{`,
    `  "schema": "${COMPANY_QUESTIONNAIRE_AI_SCHEMA}",`,
    `  "questionCount": ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT},`,
    `  "creationMode": "ai_import",`,
    `  "title": "Titre du questionnaire",`,
    `  "instructions": "Consignes à afficher au candidat",`,
    `  "questions": [`,
    `    {`,
    `      "id": "question-01",`,
    `      "prompt": "Question à poser",`,
    `      "help": "Aide optionnelle",`,
    `      "type": "single_choice",`,
    `      "required": true,`,
    `      "options": [`,
    `        { "id": "question-01-option-01", "label": "Réponse A", "order": 1 },`,
    `        { "id": "question-01-option-02", "label": "Réponse B", "order": 2 }`,
    `      ],`,
    `      "correctionMode": "automatic",`,
    `      "expectedAnswer": "question-01-option-01",`,
    `      "difficulty": "medium",`,
    `      "explanation": "Pourquoi cette réponse est correcte",`,
    `      "order": 0`,
    `    }`,
    `  ]`,
    `}`,
    '',
    'Règles de sortie :',
    '- Retourne uniquement le JSON.',
    '- Respecte les identifiants stables pour les questions et les options.',
    '- Utilise exactement question-01 à question-20 pour les identifiants des questions.',
    '- Utilise question-01-option-01, question-01-option-02, etc. pour les options de chaque question. Tous les identifiants doivent être uniques.',
    '- Les valeurs order des questions doivent former exactement la séquence 0 à 19. Les valeurs order des options commencent à 1 et forment une séquence continue dans chaque question.',
    '- expectedAnswer reprend exactement les identifiants des options concernées. N’utilise jamais un identifiant d’offre ou de compétence comme identifiant de question.',
    '- Ne définis aucun point.',
    '- N’ajoute aucune question hors sujet.',
    '- N’introduis aucune catégorie supplémentaire.',
    '- N’écris pas de texte en dehors du JSON.',
  ].join('\n');
}

export function parseCompanyQuestionnaireAiImport(raw: unknown): CompanyQuestionnaireAiImportResult {
  const payload = typeof raw === 'string'
    ? JSON.parse(raw) as unknown
    : raw;

  if (!isPlainObject(payload)) {
    throw new Error('Le JSON importé est invalide.');
  }

  const warnings: string[] = [];
  if (payload.schema !== COMPANY_QUESTIONNAIRE_AI_SCHEMA) {
    throw new Error(`schema : valeur reçue ${JSON.stringify(payload.schema)}, valeur attendue ${COMPANY_QUESTIONNAIRE_AI_SCHEMA}.`);
  }
  if (payload.questionCount !== COMPANY_QUESTIONNAIRE_QUESTION_COUNT) {
    throw new Error(`Le JSON importé doit annoncer exactement ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions.`);
  }
  if (payload.creationMode && payload.creationMode !== 'ai_import') {
    throw new Error('Le JSON importé doit utiliser creationMode = ai_import.');
  }
  if ('minimumPassingScorePercent' in payload || 'threshold' in payload) {
    warnings.push('Le seuil minimum présent dans le JSON a été ignoré. Il se configure directement dans Seven’O.');
  }

  const title = cleanText(payload.title, 200);
  const instructions = cleanText(payload.instructions, 3000);
  if (!title) {
    throw new Error('Le JSON importé doit contenir un titre.');
  }
  if (!instructions) {
    throw new Error('Le JSON importé doit contenir des instructions.');
  }

  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    throw new Error('Le JSON importé doit contenir au moins une question.');
  }
  if (payload.questions.length !== COMPANY_QUESTIONNAIRE_QUESTION_COUNT) {
    throw new Error(`Le fichier annonce ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions mais en contient ${payload.questions.length}.`);
  }

  const questions = payload.questions.map((question, index) => normalizeQuestion(question, index));
  const questionIds = new Set(questions.map((question) => question.id));
  if (questionIds.size !== questions.length) {
    throw new Error('Les identifiants des questions doivent être uniques.');
  }
  if (new Set(questions.map((question) => question.order)).size !== questions.length) {
    throw new Error('questions[].order : les ordres des questions doivent être uniques.');
  }
  const difficultyCounts = questions.reduce<Record<CompanyQuestionDifficulty, number>>((counts, question) => {
    counts[question.difficulty ?? 'medium'] += 1;
    return counts;
  }, { easy: 0, medium: 0, hard: 0 });
  if (
    difficultyCounts.easy !== COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.easy
    || difficultyCounts.medium !== COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.medium
    || difficultyCounts.hard !== COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.hard
  ) {
    throw new Error(
      `questions[].difficulty : répartition reçue ${difficultyCounts.easy}/${difficultyCounts.medium}/${difficultyCounts.hard}, `
      + `répartition attendue ${COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.easy}/${COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.medium}/${COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.hard}.`,
    );
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
