import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import type { PublicTestQuestion, QuestionBank, TestQuestion, TestQuestionOption } from '@/types/seveno';

export const SEVENO_TEST_DEFAULT_DURATION_SECONDS = 20 * 60;
export const SEVENO_TEST_DEFAULT_THRESHOLD = 70;

export type QuestionBankTemplate = Omit<QuestionBank, 'createdAt' | 'updatedAt'> & {
  durationSeconds: number;
  threshold: number;
};

function createOption(id: string, label: string, order?: number, score?: number): TestQuestionOption {
  return {
    id,
    label,
    ...(typeof order === 'number' ? { order } : {}),
    ...(typeof score === 'number' ? { score } : {}),
  };
}

const ASSESSMENT_SCALE_OPTIONS = [
  createOption('never', 'Jamais ou presque jamais', 1, 1),
  createOption('rarely', 'Rarement', 2, 2),
  createOption('sometimes', 'Parfois', 3, 3),
  createOption('often', 'Souvent', 4, 4),
  createOption('always', 'Tres souvent', 5, 5),
];

function createAssessmentQuestion(
  id: string,
  question: string,
  dimension: NonNullable<TestQuestion['dimension']>,
): TestQuestion {
  return {
    id,
    question,
    dimension,
    options: ASSESSMENT_SCALE_OPTIONS.map((option) => ({ ...option })),
    type: 'single_choice',
  };
}

function createQuestion(
  id: string,
  question: string,
  options: TestQuestionOption[],
  correctOptionId: string,
  difficulty: QuestionBankTemplate['questions'][number]['difficulty'] = 'medium',
): TestQuestion {
  return {
    id,
    question,
    options,
    type: 'single_choice',
    difficulty,
    correctOptionId,
  };
}

export const SEVENO_TEST_BANK_TEMPLATES: QuestionBankTemplate[] = [
  {
    code: 'seveno-general-v1',
    label: "Questionnaire general Seven'O",
    description: 'Evaluation generale de la maniere de travailler et des atouts professionnels.',
    assessmentType: 'seveno_general',
    version: '1.0.0',
    isActive: true,
    durationSeconds: 15 * 60,
    threshold: 0,
    questions: [
      createAssessmentQuestion('collaboration-listen', "J'ecoute les points de vue differents avant de proposer une solution.", 'collaboration'),
      createAssessmentQuestion('collaboration-share', "Je partage spontanement les informations utiles avec l'equipe.", 'collaboration'),
      createAssessmentQuestion('collaboration-feedback', 'Je sais demander et utiliser un retour constructif.', 'collaboration'),
      createAssessmentQuestion('adaptability-change', "Je reste efficace lorsque les priorites changent.", 'adaptability'),
      createAssessmentQuestion('adaptability-learn', "J'apprends rapidement un nouvel outil ou une nouvelle methode.", 'adaptability'),
      createAssessmentQuestion('adaptability-uncertainty', "J'avance meme lorsque toutes les informations ne sont pas encore disponibles.", 'adaptability'),
      createAssessmentQuestion('autonomy-plan', "J'organise mon travail sans attendre des consignes detaillees.", 'autonomy'),
      createAssessmentQuestion('autonomy-alert', "J'alerte assez tot lorsque je rencontre un blocage.", 'autonomy'),
      createAssessmentQuestion('autonomy-prioritize', 'Je distingue facilement les taches urgentes des taches importantes.', 'autonomy'),
      createAssessmentQuestion('problem-solving-analyze', "Je prends le temps d'identifier la cause d'un probleme avant d'agir.", 'problem_solving'),
      createAssessmentQuestion('problem-solving-options', "Je compare plusieurs solutions avant de faire un choix.", 'problem_solving'),
      createAssessmentQuestion('problem-solving-review', "Apres une difficulte, j'analyse ce qui pourrait etre ameliore.", 'problem_solving'),
    ],
  },
  {
    code: 'full-stack-foundations-v1',
    label: 'Test full stack socle',
    description: 'Questionnaire de base pour les developpeurs full stack.',
    sectorCode: 'informatique-et-numerique',
    familyCode: 'informatique-et-numerique-developpement-logiciel',
    roleCode: 'informatique-et-numerique-developpement-logiciel-developpeur-full-stack',
    version: '1.0.0',
    isActive: true,
    durationSeconds: SEVENO_TEST_DEFAULT_DURATION_SECONDS,
    threshold: SEVENO_TEST_DEFAULT_THRESHOLD,
    questions: [
      createQuestion(
        'html-navigation',
        'Quelle balise HTML structure une zone de navigation principale ?',
        [
          createOption('nav', 'nav'),
          createOption('section', 'section'),
          createOption('figure', 'figure'),
          createOption('footer', 'footer'),
        ],
        'nav',
        'easy',
      ),
      createQuestion(
        'css-spacing',
        'Quelle propriete CSS ajoute de lespace a lintérieur dun element ?',
        [
          createOption('margin', 'margin'),
          createOption('padding', 'padding'),
          createOption('gap', 'gap'),
          createOption('border', 'border'),
        ],
        'padding',
        'easy',
      ),
      createQuestion(
        'js-variable',
        'Quel mot-cle JavaScript declare une variable non reassignee ?',
        [
          createOption('var', 'var'),
          createOption('let', 'let'),
          createOption('const', 'const'),
          createOption('function', 'function'),
        ],
        'const',
        'easy',
      ),
      createQuestion(
        'react-effect',
        'Quel hook React declenche un effet apres le rendu ?',
        [
          createOption('useMemo', 'useMemo'),
          createOption('useEffect', 'useEffect'),
          createOption('useRef', 'useRef'),
          createOption('useState', 'useState'),
        ],
        'useEffect',
        'easy',
      ),
      createQuestion(
        'http-create',
        'Quelle methode HTTP sert le plus souvent a creer une ressource ?',
        [
          createOption('GET', 'GET'),
          createOption('POST', 'POST'),
          createOption('PUT', 'PUT'),
          createOption('DELETE', 'DELETE'),
        ],
        'POST',
        'easy',
      ),
      createQuestion(
        'api-format',
        'Quel format est le plus courant pour echanger des donnees avec une API REST ?',
        [
          createOption('xml', 'XML'),
          createOption('json', 'JSON'),
          createOption('csv', 'CSV'),
          createOption('yaml', 'YAML'),
        ],
        'json',
        'easy',
      ),
      createQuestion(
        'sql-read',
        'Quelle requete SQL lit des lignes dans une table ?',
        [
          createOption('select', 'SELECT'),
          createOption('insert', 'INSERT'),
          createOption('update', 'UPDATE'),
          createOption('delete', 'DELETE'),
        ],
        'select',
        'easy',
      ),
      createQuestion(
        'http-401',
        'Quel code HTTP signifie non autorise ?',
        [
          createOption('200', '200'),
          createOption('301', '301'),
          createOption('401', '401'),
          createOption('404', '404'),
        ],
        '401',
        'easy',
      ),
      createQuestion(
        'browser-storage',
        'Quelle API du navigateur conserve des donnees apres fermeture de l onglet ?',
        [
          createOption('localStorage', 'localStorage'),
          createOption('sessionStorage', 'sessionStorage'),
          createOption('cookieOnly', 'Uniquement les cookies'),
          createOption('memory', 'La memoire vive'),
        ],
        'localStorage',
        'medium',
      ),
      createQuestion(
        'flex-main-axis',
        'Quelle propriete Flexbox aligne les elements sur l axe principal ?',
        [
          createOption('align-items', 'align-items'),
          createOption('justify-content', 'justify-content'),
          createOption('flex-wrap', 'flex-wrap'),
          createOption('order', 'order'),
        ],
        'justify-content',
        'medium',
      ),
      createQuestion(
        'js-async-object',
        'Quel objet JavaScript represente une operation asynchrone ?',
        [
          createOption('Promise', 'Promise'),
          createOption('Array', 'Array'),
          createOption('Map', 'Map'),
          createOption('Set', 'Set'),
        ],
        'Promise',
        'medium',
      ),
      createQuestion(
        'secret-management',
        'Quelle pratique evite dexposer des secrets cote client ?',
        [
          createOption('browserStorage', 'Les stocker dans le navigateur'),
          createOption('clientCode', 'Les ecrire dans le code client'),
          createOption('serverEnv', 'Les placer dans des variables denvironnement cote serveur'),
          createOption('urlParams', 'Les mettre dans l URL'),
        ],
        'serverEnv',
        'medium',
      ),
      createQuestion(
        'git-status',
        'Quelle commande Git affiche letat du depot local ?',
        [
          createOption('git status', 'git status'),
          createOption('git init', 'git init'),
          createOption('git push', 'git push'),
          createOption('git tag', 'git tag'),
        ],
        'git status',
        'easy',
      ),
      createQuestion(
        'typescript-role',
        'Quel est le role principal de TypeScript ?',
        [
          createOption('staticTyping', 'Ajouter du typage statique a JavaScript'),
          createOption('runtime', 'Executer le code dans le navigateur'),
          createOption('cssTooling', 'Compiler les feuilles de style'),
          createOption('domApi', 'Remplacer le DOM'),
        ],
        'staticTyping',
        'easy',
      ),
      createQuestion(
        'content-type',
        'Quel en-tete HTTP precise le type du contenu envoye ?',
        [
          createOption('Content-Type', 'Content-Type'),
          createOption('Authorization', 'Authorization'),
          createOption('Cache-Control', 'Cache-Control'),
          createOption('Accept', 'Accept'),
        ],
        'Content-Type',
        'medium',
      ),
      createQuestion(
        'react-key',
        'Quel element React aide a conserver une liste stable lors du rendu ?',
        [
          createOption('stableKey', 'Une key unique et stable'),
          createOption('arrayIndex', 'Lindex du tableau dans tous les cas'),
          createOption('noKey', 'Aucune key'),
          createOption('useMemo', 'useMemo'),
        ],
        'stableKey',
        'medium',
      ),
      createQuestion(
        'web-security',
        'Quel protocole securise le plus souvent les echanges web ?',
        [
          createOption('HTTP', 'HTTP'),
          createOption('HTTPS', 'HTTPS'),
          createOption('FTP', 'FTP'),
          createOption('Telnet', 'Telnet'),
        ],
        'HTTPS',
        'easy',
      ),
      createQuestion(
        'database-index',
        'Quel est le principal objectif dun index de base de donnees ?',
        [
          createOption('speedReads', 'Accelerer certaines lectures'),
          createOption('encryptRows', 'Chiffrer les lignes'),
          createOption('forceSort', 'Forcer un tri automatique'),
          createOption('removeDuplicates', 'Supprimer tous les doublons'),
        ],
        'speedReads',
        'medium',
      ),
      createQuestion(
        'async-await',
        'Quelle instruction JavaScript attend la resolution dune promesse ?',
        [
          createOption('await', 'await'),
          createOption('throw', 'throw'),
          createOption('yield', 'yield'),
          createOption('catch', 'catch'),
        ],
        'await',
        'medium',
      ),
      createQuestion(
        'http-redirect',
        'Quel code HTTP indique quune ressource a ete deplacee temporairement ?',
        [
          createOption('200', '200'),
          createOption('302', '302'),
          createOption('401', '401'),
          createOption('500', '500'),
        ],
        '302',
        'easy',
      ),
    ],
  },
];

export function getSevenoTestBankTemplateByRole(roleCode: string): QuestionBankTemplate | null {
  return SEVENO_TEST_BANK_TEMPLATES.find((bank) => bank.isActive && bank.roleCode === roleCode) ?? null;
}

export function getSevenoGeneralAssessmentTemplate(): QuestionBankTemplate {
  const template = SEVENO_TEST_BANK_TEMPLATES.find(
    (bank) => bank.isActive && bank.assessmentType === 'seveno_general',
  );

  if (!template) {
    throw new Error("La banque d'evaluation generale Seven'O est absente.");
  }

  return template;
}

export function getSevenoTestBankTemplateByCode(code: string): QuestionBankTemplate | null {
  return SEVENO_TEST_BANK_TEMPLATES.find((bank) => bank.isActive && bank.code === code) ?? null;
}

export function materializeQuestionBank(template: QuestionBankTemplate): QuestionBank {
  const now = Timestamp.now();

  return {
    ...template,
    createdAt: now,
    updatedAt: now,
  };
}

export function toPublicTestQuestion(question: TestQuestion): PublicTestQuestion {
  return {
    id: question.id,
    question: question.question,
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      ...(typeof option.order === 'number' ? { order: option.order } : {}),
    })),
    ...(question.type ? { type: question.type } : {}),
    ...(question.difficulty ? { difficulty: question.difficulty } : {}),
    ...(question.skillTags ? { skillTags: [...question.skillTags] } : {}),
    ...(question.dimension ? { dimension: question.dimension } : {}),
  };
}

export function toPublicTestQuestions(questions: TestQuestion[]): PublicTestQuestion[] {
  return questions.map((question) => toPublicTestQuestion(question));
}
