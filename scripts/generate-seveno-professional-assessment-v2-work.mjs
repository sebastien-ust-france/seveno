import fs from 'node:fs';
import path from 'node:path';

const REVIEW_SOURCE = path.resolve('scripts/data/seveno-professional-assessment-v1-review.json');
const OUTPUT_PATH = path.resolve('scripts/data/seveno-professional-assessment-v2-work.json');

const DIMENSION_CONFIGURATIONS = [
  {
    code: 'information_understanding',
    label: "Compréhension et intégration de l'information",
    description: 'Capacité à lire une consigne, extraire les éléments utiles et les relier correctement.',
    weight: 15,
    displayOrder: 1,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    isActive: true,
  },
  {
    code: 'organization_prioritization',
    label: 'Organisation et priorisation',
    description: 'Capacité à structurer son action, prioriser les tâches et garder un cap clair.',
    weight: 20,
    displayOrder: 2,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    isActive: true,
  },
  {
    code: 'problem_solving',
    label: 'Résolution de problèmes',
    description: 'Capacité à analyser une difficulté, tester des pistes et choisir une solution pertinente.',
    weight: 20,
    displayOrder: 3,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    isActive: true,
  },
  {
    code: 'autonomy_initiative',
    label: 'Autonomie et initiative',
    description: 'Capacité à agir sans assistance permanente et à proposer des actions utiles.',
    weight: 15,
    displayOrder: 4,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    isActive: true,
  },
  {
    code: 'adaptability',
    label: 'Adaptabilité',
    description: 'Capacité à ajuster sa méthode et son comportement selon le contexte.',
    weight: 10,
    displayOrder: 5,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    isActive: true,
  },
  {
    code: 'collaboration',
    label: 'Collaboration',
    description: 'Capacité à coopérer, partager l’information et contribuer à un objectif commun.',
    weight: 10,
    displayOrder: 6,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    isActive: true,
  },
  {
    code: 'rigor_reliability',
    label: 'Rigueur et fiabilité',
    description: 'Capacité à tenir un cadre, vérifier son travail et sécuriser les engagements.',
    weight: 10,
    displayOrder: 7,
    minimumEssentialObservations: 6,
    minimumExtendedObservations: 12,
    isActive: true,
  },
];

const INDEPENDENT_AXES = new Set([
  'leadership_activation',
  'influence',
  'followership',
  'collective_support',
  'value_creation',
  'alerting_behavior',
]);

const QUESTION_TYPE_BY_CODE = {
  essential_information_04: 'behavioral_situation',
  essential_organization_05: 'tradeoff',
  essential_problem_solving_06: 'behavioral_situation',
  essential_autonomy_04: 'direct_self_report',
  essential_adaptability_02: 'behavioral_situation',
  essential_collaboration_03: 'tradeoff',
  essential_rigor_03: 'work_preference',
  essential_information_05: 'direct_self_report',
  essential_organization_06: 'behavioral_situation',
  essential_problem_solving_07: 'tradeoff',
  extended_information_04: 'direct_self_report',
  extended_organization_05: 'behavioral_situation',
  extended_problem_solving_04: 'behavioral_situation',
  extended_autonomy_04: 'work_preference',
  extended_adaptability_04: 'tradeoff',
  extended_collaboration_03: 'direct_self_report',
  extended_rigor_03: 'behavioral_situation',
  extended_information_05: 'tradeoff',
  extended_organization_06: 'work_preference',
  extended_problem_solving_05: 'behavioral_situation',
};

const SIGNAL_RELIABILITY_BY_CODE = {
  essential_information_04: 'medium',
  essential_organization_05: 'high',
  essential_problem_solving_06: 'high',
  essential_autonomy_04: 'descriptive',
  essential_adaptability_02: 'medium',
  essential_collaboration_03: 'medium',
  essential_rigor_03: 'descriptive',
  essential_information_05: 'low',
  essential_organization_06: 'high',
  essential_problem_solving_07: 'medium',
  extended_information_04: 'descriptive',
  extended_organization_05: 'high',
  extended_problem_solving_04: 'medium',
  extended_autonomy_04: 'low',
  extended_adaptability_04: 'medium',
  extended_collaboration_03: 'descriptive',
  extended_rigor_03: 'high',
  extended_information_05: 'medium',
  extended_organization_06: 'low',
  extended_problem_solving_05: 'medium',
};

const DIFFICULTY_BY_CODE = {
  essential_information_04: 'introductory',
  essential_organization_05: 'introductory',
  essential_problem_solving_06: 'standard',
  essential_autonomy_04: 'introductory',
  essential_adaptability_02: 'standard',
  essential_collaboration_03: 'standard',
  essential_rigor_03: 'introductory',
  essential_information_05: 'advanced',
  essential_organization_06: 'standard',
  essential_problem_solving_07: 'advanced',
  extended_information_04: 'standard',
  extended_organization_05: 'standard',
  extended_problem_solving_04: 'advanced',
  extended_autonomy_04: 'standard',
  extended_adaptability_04: 'standard',
  extended_collaboration_03: 'advanced',
  extended_rigor_03: 'advanced',
  extended_information_05: 'advanced',
  extended_organization_06: 'advanced',
  extended_problem_solving_05: 'advanced',
};

const SCORE_PATTERNS = {
  b1: [[4, 3], [3, 2], [2, 4], [1, 1]],
  b2: [[3, 4], [4, 2], [2, 3], [1, 1]],
  b3: [[4, 2], [2, 4], [3, 1], [1, 1]],
  b4: [[2, 3], [4, 1], [3, 4], [1, 2]],
  b5: [[3, 1], [2, 4], [4, 3], [1, 2]],
  b6: [[1, 4], [4, 3], [3, 2], [2, 1]],
  b7: [[4, 1], [3, 4], [2, 3], [1, 2]],
  b8: [[2, 4], [4, 2], [1, 3], [3, 1]],
  i1: [[2, 2], [1, 1], [0, 0], [1, 0]],
  i2: [[1, 2], [2, 0], [0, 1], [1, 1]],
  i3: [[2, 1], [0, 2], [1, 0], [0, 1]],
  i4: [[2, 2], [0, 1], [1, 0], [0, 0]],
  i5: [[1, 1], [0, 2], [2, 0], [1, 0]],
  i6: [[0, 2], [2, 1], [1, 0], [0, 1]],
};

const BEHAVIOR_CONTEXT_VARIANTS = [
  {
    riskLevel: 'low',
    reversibility: 'high',
    urgency: 'low',
    authorityContext: 'present',
    informationCompleteness: 'partial',
    collectiveImpact: 'individual',
    priorFailure: 'none',
    socialPressure: 'low',
    helpAvailability: 'available',
    waitingCost: 'low',
    smallScaleTestPossible: true,
  },
  {
    riskLevel: 'medium',
    reversibility: 'medium',
    urgency: 'medium',
    authorityContext: 'directive',
    informationCompleteness: 'partial',
    collectiveImpact: 'team',
    priorFailure: 'suspected',
    socialPressure: 'medium',
    helpAvailability: 'limited',
    waitingCost: 'medium',
    smallScaleTestPossible: false,
  },
  {
    riskLevel: 'high',
    reversibility: 'low',
    urgency: 'high',
    authorityContext: 'disagreement',
    informationCompleteness: 'uncertain',
    collectiveImpact: 'organization',
    priorFailure: 'confirmed',
    socialPressure: 'high',
    helpAvailability: 'unavailable',
    waitingCost: 'high',
    smallScaleTestPossible: null,
  },
];

const BEHAVIOR_AXIS_PROFILES = {
  information_understanding: [
    { primary: 'analysis_experimentation', secondary: ['speed_precision'] },
    { primary: 'ambiguity_tolerance', secondary: ['method_exploration'] },
    { primary: 'speed_precision', secondary: ['decision_pace'] },
  ],
  organization_prioritization: [
    { primary: 'leadership_activation', secondary: ['followership'] },
    { primary: 'influence', secondary: ['collective_support'] },
    { primary: 'followership', secondary: ['leadership_activation'] },
  ],
  problem_solving: [
    { primary: 'method_exploration', secondary: ['analysis_experimentation'] },
    { primary: 'analysis_experimentation', secondary: ['speed_precision'] },
    { primary: 'persistence_switching', secondary: ['ambiguity_tolerance'] },
  ],
  autonomy_initiative: [
    { primary: 'initiative_validation', secondary: ['risk_orientation'] },
    { primary: 'risk_orientation', secondary: ['decision_pace'] },
    { primary: 'value_creation', secondary: ['initiative_validation'] },
  ],
  adaptability: [
    { primary: 'framework_adaptation', secondary: ['persistence_switching'] },
    { primary: 'persistence_switching', secondary: ['ambiguity_tolerance'] },
    { primary: 'ambiguity_tolerance', secondary: ['framework_adaptation'] },
  ],
  collaboration: [
    { primary: 'collective_support', secondary: ['influence'] },
    { primary: 'influence', secondary: ['followership'] },
    { primary: 'followership', secondary: ['collective_support'] },
  ],
  rigor_reliability: [
    { primary: 'alerting_behavior', secondary: ['value_creation'] },
    { primary: 'value_creation', secondary: ['alerting_behavior'] },
    { primary: 'execution_improvement', secondary: ['alerting_behavior'] },
  ],
};

const INTERVIEW_TEMPLATES = {
  information_understanding: [
    'Pouvez-vous me donner un exemple récent où vous avez dû vérifier une consigne avant d’agir ?',
    'Comment repérez-vous qu’une information mérite une confirmation avant exécution ?',
    'Qu’est-ce qui vous aide à distinguer l’essentiel du détail dans un message ?',
    'Comment réagissez-vous lorsque deux sources donnent des indications différentes ?',
    'Quel réflexe gardez-vous pour éviter une mauvaise interprétation d’un document ?',
  ],
  organization_prioritization: [
    'Comment décidez-vous quel sujet traiter en premier lorsque tout semble urgent ?',
    'Pouvez-vous décrire une journée où vous avez dû réorganiser votre plan en cours de route ?',
    'Qu’est-ce qui vous aide à garder une séquence claire quand plusieurs demandes arrivent ?',
    'Comment arbitrez-vous entre avancer vite et sécuriser l’ordre des tâches ?',
    'Quel exemple montre votre manière de stabiliser une organisation imprévue ?',
  ],
  problem_solving: [
    'Pouvez-vous raconter une situation où vous avez cherché la cause avant de corriger ?',
    'Comment choisissez-vous une première piste quand une anomalie apparaît ?',
    'Qu’est-ce qui vous pousse à creuser plutôt qu’à appliquer une correction immédiate ?',
    'Comment vérifiez-vous qu’un problème ne va pas réapparaître après une solution provisoire ?',
    'Quel exemple illustre votre manière d’enchaîner diagnostic et action ?',
  ],
  autonomy_initiative: [
    'Quand avez-vous pris une initiative utile sans attendre qu’on vous la demande ?',
    'Comment décidez-vous qu’une action peut être lancée de façon autonome ?',
    'Qu’est-ce qui vous aide à avancer seul tout en restant dans le cadre ?',
    'Pouvez-vous décrire un moment où vous avez proposé une action concrète de votre propre chef ?',
    'Comment savez-vous qu’il faut informer ensuite plutôt qu’attendre un arbitrage ?',
  ],
  adaptability: [
    'Pouvez-vous donner un exemple de changement de plan que vous avez absorbé rapidement ?',
    'Comment ajustez-vous votre méthode lorsque le contexte évolue en cours de journée ?',
    'Qu’est-ce qui vous aide à garder de l’efficacité quand un imprévu survient ?',
    'Comment faites-vous pour ne pas perdre le fil après une réorganisation soudaine ?',
    'Quel exemple montre votre capacité à changer de rythme sans vous disperser ?',
  ],
  collaboration: [
    'Comment contribuez-vous quand une coordination collective devient nécessaire ?',
    'Pouvez-vous raconter un exemple où vous avez aidé un collectif à avancer ?',
    'Qu’est-ce qui vous aide à partager l’information au bon moment avec les autres ?',
    'Comment réagissez-vous quand un échange d’équipe manque de clarté ?',
    'Quel exemple illustre votre façon de soutenir un groupe sous pression ?',
  ],
  rigor_reliability: [
    'Comment sécurisez-vous une tâche avant de la considérer comme terminée ?',
    'Pouvez-vous décrire un exemple où vous avez repéré un point sensible à temps ?',
    'Qu’est-ce qui vous aide à garder une trace fiable de ce que vous faites ?',
    'Comment réagissez-vous lorsqu’un détail mineur peut fragiliser un dossier ?',
    'Quel exemple montre votre façon de vérifier avant de valider ?',
  ],
};

const NEW_QUESTIONS = [
  {
    questionId: 'essential_information_04',
    path: 'essential',
    situation: 'Dans un point de service, une note affichée ne correspond plus à l’information donnée au dernier échange.',
    instruction: 'Quelle réaction adoptez-vous ?',
    primaryDimensionCode: 'information_understanding',
    secondaryDimensionCode: 'rigor_reliability',
    questionType: 'behavioral_situation',
    signalReliability: 'medium',
    difficulty: 'introductory',
    adminRationale: 'Vérification de consigne avant action.',
    behaviorVariant: 0,
    scorePattern: 'b1',
    options: [
      ['Je compare la note et le dernier échange avant d’agir.', 'Sécurise l’information avant le démarrage.'],
      ['Je fais le plus sûr tout de suite puis je confirme le point douteux.', 'Avance sur le connu sans laisser le doute s’installer.'],
      ['Je demande une validation claire avant de lancer l’action.', 'Recherche un accord explicite pour réduire l’ambiguïté.'],
      ['Je traite d’abord l’urgence visible et je reviens ensuite sur le doute.', 'Gère le rythme mais laisse un risque en suspens.'],
    ],
  },
  {
    questionId: 'essential_organization_05',
    path: 'essential',
    situation: 'Deux demandes simples arrivent en même temps juste avant une échéance courte.',
    instruction: 'Que faites-vous en premier ?',
    primaryDimensionCode: 'organization_prioritization',
    secondaryDimensionCode: 'followership',
    questionType: 'tradeoff',
    signalReliability: 'high',
    difficulty: 'introductory',
    adminRationale: 'Arbitrage simple sous contrainte de temps.',
    behaviorVariant: 0,
    scorePattern: 'i1',
    options: [
      ['Je fixe l’ordre des tâches et j’annonce le point de passage.', 'Pose une séquence lisible pour tout le monde.'],
      ['Je traite d’abord le blocage le plus visible.', 'Va vite sur le point bloquant mais peut laisser un reste à coordonner.'],
      ['Je coordonne les personnes concernées avant d’avancer.', 'Sécurise la circulation d’information mais ralentit un peu l’action.'],
      ['Je conserve le plan initial sans arbitrage immédiat.', 'Reste stable mais diffère la décision.'],
    ],
  },
  {
    questionId: 'essential_problem_solving_06',
    path: 'essential',
    situation: 'Un écart déjà corrigé une fois revient sur un support simple et vous devez comprendre ce qui le provoque.',
    instruction: 'Comment réagissez-vous ?',
    primaryDimensionCode: 'problem_solving',
    secondaryDimensionCode: 'rigor_reliability',
    questionType: 'behavioral_situation',
    signalReliability: 'high',
    difficulty: 'standard',
    adminRationale: 'Recherche de cause avant répétition.',
    behaviorVariant: 0,
    scorePattern: 'b6',
    options: [
      ['Je cherche la cause avant de refaire la correction.', 'Évite de répéter une solution partielle.'],
      ['Je teste une première piste pour voir ce qui change.', 'Avance par hypothèse sans figer trop vite le diagnostic.'],
      ['Je sécurise le point sensible puis je complète l’analyse.', 'Reste prudent tout en gardant une logique de diagnostic.'],
      ['Je corrige tout de suite et j’observe si le problème réapparaît.', 'Va vite mais peut masquer la cause réelle.'],
    ],
  },
  {
    questionId: 'essential_autonomy_04',
    path: 'essential',
    situation: 'Une petite action utile n’est pas prévue mais reste dans votre périmètre habituel.',
    instruction: 'Que faites-vous ?',
    primaryDimensionCode: 'autonomy_initiative',
    secondaryDimensionCode: 'information_understanding',
    questionType: 'direct_self_report',
    signalReliability: 'descriptive',
    difficulty: 'introductory',
    adminRationale: 'Autonomie dans un cadre connu.',
    behaviorVariant: 1,
    scorePattern: 'b3',
    options: [
      ['Je prends l’initiative dans le cadre prévu et j’informe ensuite.', 'Agit sans attendre tout en gardant la transparence.'],
      ['Je vérifie la limite de mon rôle puis je lance ce qui est clair.', 'Reste prudent mais ne bloque pas l’action utile.'],
      ['Je propose un petit ajustement concret avant de le faire valider.', 'Cherche une marge d’action partagée.'],
      ['J’attends une consigne explicite même si l’action est simple.', 'Sécurise le cadre mais ralentit l’exécution.'],
    ],
  },
  {
    questionId: 'essential_adaptability_02',
    path: 'essential',
    situation: 'En milieu de matinée, le planning change et une tâche doit être déplacée sans casser le reste de la journée.',
    instruction: 'Comment vous adaptez-vous ?',
    primaryDimensionCode: 'adaptability',
    secondaryDimensionCode: 'organization_prioritization',
    questionType: 'behavioral_situation',
    signalReliability: 'medium',
    difficulty: 'standard',
    adminRationale: 'Ajustement concret du déroulé.',
    behaviorVariant: 0,
    scorePattern: 'b2',
    options: [
      ['Je recompose mon ordre de priorité et je garde le cap.', 'Adapte le déroulé sans se disperser.'],
      ['Je conserve ce qui peut l’être puis j’absorbe le changement.', 'Garde une base stable tout en absorbant l’imprévu.'],
      ['Je modifie la méthode pour tenir compte du nouveau contexte.', 'S’adapte de façon visible mais peut demander un temps d’ajustement.'],
      ['Je prends un moment pour mesurer l’impact avant de décider.', 'Évite une réaction trop rapide mais ralentit l’ajustement.'],
    ],
  },
  {
    questionId: 'essential_collaboration_03',
    path: 'essential',
    situation: 'Un collègue vous transmet un dossier incomplet juste avant de partir.',
    instruction: 'Quel réflexe privilégiez-vous ?',
    primaryDimensionCode: 'collaboration',
    secondaryDimensionCode: 'influence',
    questionType: 'tradeoff',
    signalReliability: 'medium',
    difficulty: 'standard',
    adminRationale: 'Coordination et relais.',
    behaviorVariant: 0,
    scorePattern: 'i2',
    options: [
      ['Je complète le relais en partageant ce qui manque.', 'Soutient le collectif et sécurise la continuité.'],
      ['Je vérifie d’abord ce qui peut être reconstitué seul.', 'Garde de l’autonomie avant d’alerter.'],
      ['Je demande un complément ciblé pour éviter l’erreur.', 'Recherche une coordination courte et utile.'],
      ['Je note le manque pour l’aborder au prochain échange.', 'Préserve le rythme mais repousse la clarification.'],
    ],
  },
  {
    questionId: 'essential_rigor_03',
    path: 'essential',
    situation: 'Avant une clôture, une trace manque sur un point simple et pourrait fragiliser le dossier.',
    instruction: 'Que faites-vous ?',
    primaryDimensionCode: 'rigor_reliability',
    secondaryDimensionCode: 'value_creation',
    questionType: 'work_preference',
    signalReliability: 'descriptive',
    difficulty: 'introductory',
    adminRationale: 'Sécurisation du résultat avant validation.',
    behaviorVariant: 0,
    scorePattern: 'i4',
    options: [
      ['Je vérifie le point manquant avant de valider.', 'Sécurise la fiabilité du dossier.'],
      ['Je trace ce que j’ai fait pour garder une base claire.', 'Garde une base exploitable sans tout bloquer.'],
      ['Je fais relire le point sensible avant de clôturer.', 'Cherche une confirmation extérieure pour éviter l’oubli.'],
      ['Je termine d’abord puis je reviens sur le détail après.', 'Reste réactif mais prend un risque de non-conformité.'],
    ],
  },
  {
    questionId: 'essential_information_05',
    path: 'essential',
    situation: 'Deux consignes se ressemblent mais un détail change l’ordre des actions.',
    instruction: 'Quelle attitude adoptez-vous ?',
    primaryDimensionCode: 'information_understanding',
    secondaryDimensionCode: 'organization_prioritization',
    questionType: 'direct_self_report',
    signalReliability: 'low',
    difficulty: 'advanced',
    adminRationale: 'Repérage fin d’une nuance de consigne.',
    behaviorVariant: 1,
    scorePattern: 'b2',
    options: [
      ['Je vérifie précisément le détail qui change l’ordre.', 'Privilégie la lecture fine et évite l’inversion.'],
      ['Je pars du point le plus certain puis j’ajuste l’ordre.', 'Avance sans figer trop tôt l’enchaînement.'],
      ['Je demande une reformulation courte pour sécuriser le sens.', 'Recherche une confirmation claire du message.'],
      ['Je garde le premier ordre par défaut pour aller vite.', 'Gagne du temps mais peut ignorer une nuance importante.'],
    ],
  },
  {
    questionId: 'essential_organization_06',
    path: 'essential',
    situation: 'Plusieurs petites tâches et un retour client doivent être gérés dans un délai court.',
    instruction: 'Comment organisez-vous l’ordre ?',
    primaryDimensionCode: 'organization_prioritization',
    secondaryDimensionCode: 'problem_solving',
    questionType: 'behavioral_situation',
    signalReliability: 'high',
    difficulty: 'standard',
    adminRationale: 'Ordonnancement simple sous pression.',
    behaviorVariant: 1,
    scorePattern: 'i3',
    options: [
      ['Je pose l’ordre des actions et je traite le blocage en premier.', 'Met le travail en séquence dès le départ.'],
      ['Je traite d’abord la tâche la plus rapide pour libérer du temps.', 'Cherche un effet rapide sans perdre la vue d’ensemble.'],
      ['Je coordonne le retour client avant de lancer le reste.', 'Sécurise la relation avant l’exécution.'],
      ['Je garde la liste telle quelle et j’avance sans arbitrage.', 'Répond au volume mais laisse la priorité implicite.'],
    ],
  },
  {
    questionId: 'essential_problem_solving_07',
    path: 'essential',
    situation: 'Une première piste ne suffit pas à expliquer une anomalie simple.',
    instruction: 'Que faites-vous ensuite ?',
    primaryDimensionCode: 'problem_solving',
    secondaryDimensionCode: 'autonomy_initiative',
    questionType: 'tradeoff',
    signalReliability: 'medium',
    difficulty: 'advanced',
    adminRationale: 'Poursuite du diagnostic sans se précipiter.',
    behaviorVariant: 1,
    scorePattern: 'b5',
    options: [
      ['Je compare plusieurs hypothèses avant de choisir.', 'Évite de s’arrêter à une explication trop vite.'],
      ['Je lance une vérification rapide pour trier le vrai du faux.', 'Cherche une preuve simple avant d’aller plus loin.'],
      ['Je demande un avis ciblé pour recouper l’analyse.', 'Complète le diagnostic par un regard utile.'],
      ['Je garde la première piste tant qu’elle reste plausible.', 'Gagne du temps mais peut entretenir une erreur de lecture.'],
    ],
  },
  {
    questionId: 'extended_information_04',
    path: 'extended',
    situation: 'Un dossier plus dense contient une information utile mais dispersée entre plusieurs sources.',
    instruction: 'Quelle approche choisissez-vous ?',
    primaryDimensionCode: 'information_understanding',
    secondaryDimensionCode: 'problem_solving',
    questionType: 'direct_self_report',
    signalReliability: 'descriptive',
    difficulty: 'standard',
    adminRationale: 'Lecture multi-sources dans un contexte plus dense.',
    behaviorVariant: 2,
    scorePattern: 'b7',
    options: [
      ['Je croise les sources avant de conclure.', 'Sécurise la décision en consolidant l’information.'],
      ['Je commence par la source la plus fiable puis j’élargis.', 'Avance de façon structurée.'],
      ['Je signale le point ambigu pour éviter une lecture hâtive.', 'Préserve la qualité du diagnostic.'],
      ['Je me concentre sur l’élément utile immédiatement exploitable.', 'Va vite mais peut laisser un doute de fond.'],
    ],
  },
  {
    questionId: 'extended_organization_05',
    path: 'extended',
    situation: 'Une journée déjà structurée doit absorber un changement de priorité avec un autre service.',
    instruction: 'Que faites-vous en premier ?',
    primaryDimensionCode: 'organization_prioritization',
    secondaryDimensionCode: 'leadership_activation',
    questionType: 'behavioral_situation',
    signalReliability: 'high',
    difficulty: 'standard',
    adminRationale: 'Réorganisation coordonnée entre plusieurs acteurs.',
    behaviorVariant: 2,
    scorePattern: 'i5',
    options: [
      ['Je redéfinis l’ordre et je l’annonce clairement.', 'Assume un cap partagé pour la suite.'],
      ['Je garde la structure existante et j’ajuste seulement le strict nécessaire.', 'Préserve l’organisation déjà en place.'],
      ['Je fais valider l’impact avec l’autre service avant d’agir.', 'Sécurise la coordination avant le changement.'],
      ['Je prends en charge le point critique puis je réorganise le reste.', 'Réagit sur le blocage mais peut laisser le reste en attente.'],
    ],
  },
  {
    questionId: 'extended_problem_solving_04',
    path: 'extended',
    situation: 'Une erreur déjà corrigée risque de revenir si la cause de fond n’est pas traitée.',
    instruction: 'Comment procédez-vous ?',
    primaryDimensionCode: 'problem_solving',
    secondaryDimensionCode: 'information_understanding',
    questionType: 'behavioral_situation',
    signalReliability: 'medium',
    difficulty: 'advanced',
    adminRationale: 'Diagnostic approfondi et prévention de récidive.',
    behaviorVariant: 2,
    scorePattern: 'b8',
    options: [
      ['Je remonte à la cause avant d’agir à nouveau.', 'Cherche à stabiliser durablement la situation.'],
      ['Je vérifie ce qui a changé depuis la dernière correction.', 'Cherche à isoler le déclencheur réel.'],
      ['Je fais un test court pour confirmer la cause probable.', 'Avance par hypothèse avec un contrôle rapide.'],
      ['Je corrige immédiatement ce qui se voit puis je surveille.', 'Va vite mais peut laisser la cause intacte.'],
    ],
  },
  {
    questionId: 'extended_autonomy_04',
    path: 'extended',
    situation: 'Un responsable attend un point rapide mais vous pouvez déjà avancer sur une action utile sans attendre.',
    instruction: 'Quelle est votre réaction habituelle ?',
    primaryDimensionCode: 'autonomy_initiative',
    secondaryDimensionCode: 'risk_orientation',
    questionType: 'work_preference',
    signalReliability: 'low',
    difficulty: 'standard',
    adminRationale: 'Autonomie avec information de suivi.',
    behaviorVariant: 2,
    scorePattern: 'b4',
    options: [
      ['J’avance sur ce qui est utile et je signale ensuite.', 'Favorise l’autonomie tout en gardant la visibilité.'],
      ['Je vérifie la marge de manœuvre puis j’agis immédiatement.', 'Reste autonome mais encadre le risque.'],
      ['Je propose une première action claire avant de l’exécuter.', 'Cherche un accord minimal pour démarrer.'],
      ['J’attends le retour avant d’engager quoi que ce soit.', 'Sécurise le cadre mais perd du temps utile.'],
    ],
  },
  {
    questionId: 'extended_adaptability_04',
    path: 'extended',
    situation: 'Une organisation prévue doit être revue après un changement d’équipe en cours de route.',
    instruction: 'Comment vous ajustez-vous ?',
    primaryDimensionCode: 'adaptability',
    secondaryDimensionCode: 'organization_prioritization',
    questionType: 'tradeoff',
    signalReliability: 'medium',
    difficulty: 'standard',
    adminRationale: 'Adaptation à une réorganisation réelle.',
    behaviorVariant: 1,
    scorePattern: 'b6',
    options: [
      ['Je réorganise la journée et je garde le rythme.', 'Adapte le plan sans perdre la structure.'],
      ['Je préserve ce qui peut l’être puis j’intègre le changement.', 'Garde une base stable malgré le nouveau contexte.'],
      ['Je reformule les priorités avec les personnes présentes.', 'Cherche un accord opérationnel rapide.'],
      ['Je prends le temps d’évaluer l’impact avant de décider.', 'Évite un ajustement trop rapide mais ralentit la réaction.'],
    ],
  },
  {
    questionId: 'extended_collaboration_03',
    path: 'extended',
    situation: 'Une décision collective doit être prise alors que tout le monde n’a pas la même information.',
    instruction: 'Quel comportement adoptez-vous ?',
    primaryDimensionCode: 'collaboration',
    secondaryDimensionCode: 'influence',
    questionType: 'direct_self_report',
    signalReliability: 'descriptive',
    difficulty: 'advanced',
    adminRationale: 'Coordination dans un contexte d’information incomplète.',
    behaviorVariant: 1,
    scorePattern: 'i6',
    options: [
      ['Je partage ce que je sais pour aider le groupe à décider.', 'Renforce la base collective d’information.'],
      ['Je m’assure d’abord que chacun dispose des mêmes éléments.', 'Privilégie l’égalité d’information avant la décision.'],
      ['Je fais avancer l’échange pour éviter l’attente inutile.', 'Donne du rythme tout en restant collectif.'],
      ['Je clarifie mon rôle puis je me cale sur la décision du groupe.', 'Garde le cadre relationnel avant l’initiative.'],
    ],
  },
  {
    questionId: 'extended_rigor_03',
    path: 'extended',
    situation: 'Avant diffusion, un détail mineur peut fragiliser la fiabilité globale du dossier.',
    instruction: 'Que privilégiez-vous ?',
    primaryDimensionCode: 'rigor_reliability',
    secondaryDimensionCode: 'value_creation',
    questionType: 'behavioral_situation',
    signalReliability: 'high',
    difficulty: 'advanced',
    adminRationale: 'Fiabilisation avant diffusion.',
    behaviorVariant: 1,
    scorePattern: 'i1',
    options: [
      ['Je vérifie le point sensible avant de diffuser.', 'Sécurise la qualité du dossier.'],
      ['Je trace ce qui a été contrôlé pour garder une preuve claire.', 'Renforce la fiabilité du suivi.'],
      ['Je fais relire le passage délicat avant validation.', 'Recherche une confirmation complémentaire.'],
      ['Je diffuse d’abord puis je corrige si besoin ensuite.', 'Va vite mais expose le dossier à une erreur évitable.'],
    ],
  },
  {
    questionId: 'extended_information_05',
    path: 'extended',
    situation: 'Plusieurs documents convergent mais un point reste ambigu.',
    instruction: 'Quelle attitude adoptez-vous ?',
    primaryDimensionCode: 'information_understanding',
    secondaryDimensionCode: 'rigor_reliability',
    questionType: 'tradeoff',
    signalReliability: 'medium',
    difficulty: 'advanced',
    adminRationale: 'Consolidation d’une lecture partagée.',
    behaviorVariant: 0,
    scorePattern: 'b4',
    options: [
      ['Je recoupe les documents avant de conclure.', 'Sécurise la lecture sur plusieurs sources.'],
      ['Je pars du document le plus fiable puis je complète.', 'Avance sur une base solide sans bloquer.'],
      ['Je pose une question ciblée pour lever l’ambiguïté.', 'Clarifie le point qui empêche de trancher.'],
      ['Je garde l’interprétation la plus probable et j’avance.', 'Reste opérationnel mais peut laisser un doute.'],
    ],
  },
  {
    questionId: 'extended_organization_06',
    path: 'extended',
    situation: 'Une fermeture de journée impose de séquencer trois actions et d’alerter la bonne personne.',
    instruction: 'Que faites-vous ?',
    primaryDimensionCode: 'organization_prioritization',
    secondaryDimensionCode: 'alerting_behavior',
    questionType: 'work_preference',
    signalReliability: 'low',
    difficulty: 'advanced',
    adminRationale: 'Séquençage et signalement dans le bon ordre.',
    behaviorVariant: 1,
    scorePattern: 'i3',
    options: [
      ['Je pose l’ordre des actions puis je signale le point à suivre.', 'Séquence le travail et garde l’alerte utile.'],
      ['Je traite d’abord ce qui bloque la clôture.', 'Va au plus critique pour éviter l’encombrement.'],
      ['Je préviens la bonne personne avant d’aller plus loin.', 'Sécurise le relais avec les bons interlocuteurs.'],
      ['Je conserve le plan initial et je traite le reste ensuite.', 'Préserve la routine mais peut retarder l’ajustement.'],
    ],
  },
  {
    questionId: 'extended_problem_solving_05',
    path: 'extended',
    situation: 'Un dysfonctionnement revient après une correction précédente et il faut éviter la répétition.',
    instruction: 'Comment réagissez-vous ?',
    primaryDimensionCode: 'problem_solving',
    secondaryDimensionCode: 'adaptability',
    questionType: 'behavioral_situation',
    signalReliability: 'medium',
    difficulty: 'advanced',
    adminRationale: 'Recherche de cause et ajustement durable.',
    behaviorVariant: 2,
    scorePattern: 'b7',
    options: [
      ['Je repars de la cause pour comprendre pourquoi ça revient.', 'Cherche un traitement durable plutôt qu’un correctif répété.'],
      ['Je compare les conditions de la première et de la deuxième occurrence.', 'Aide à isoler ce qui a changé.'],
      ['Je sécurise le point bloquant puis je teste une autre piste.', 'Combine prudence et exploration.'],
      ['Je refais la correction en surveillant l’effet obtenu.', 'Réagit vite mais peut laisser la cause intacte.'],
    ],
  },
];

function uniqueStrings(values) {
  return [...new Set(values)];
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function getQuestionNumber(questionId) {
  const match = questionId.match(/_(\d{2})$/);
  return match ? Number(match[1]) : 1;
}

function getDimensionCode(question) {
  return question.primaryDimensionCodes?.[0] ?? 'information_understanding';
}

function getSecondaryDimensionCode(question) {
  return question.secondaryDimensionCode ?? question.primaryDimensionCodes?.[1] ?? null;
}

function pickQuestionType(questionId, instruction) {
  if (QUESTION_TYPE_BY_CODE[questionId]) {
    return QUESTION_TYPE_BY_CODE[questionId];
  }

  if (/préfér/i.test(instruction) || /préfèr/i.test(instruction)) {
    return 'work_preference';
  }

  if (/hésitez|arbitr|trade-off/i.test(instruction)) {
    return 'tradeoff';
  }

  if (/Dans mon travail/i.test(instruction)) {
    return 'direct_self_report';
  }

  return 'behavioral_situation';
}

function pickSignalReliability(questionId, path) {
  return SIGNAL_RELIABILITY_BY_CODE[questionId] ?? (path === 'essential' ? 'high' : 'medium');
}

function pickDifficulty(questionId, path) {
  return DIFFICULTY_BY_CODE[questionId] ?? (path === 'essential' ? 'standard' : 'advanced');
}

function buildBehaviorProfile(dimensionCode, variantIndex) {
  const profiles = BEHAVIOR_AXIS_PROFILES[dimensionCode] ?? BEHAVIOR_AXIS_PROFILES.information_understanding;
  const profile = profiles[variantIndex % profiles.length];
  return {
    primaryAxisCode: profile.primary,
    secondaryAxisCodes: [...profile.secondary],
    signalReliability: null,
    context: BEHAVIOR_CONTEXT_VARIANTS[variantIndex % BEHAVIOR_CONTEXT_VARIANTS.length],
  };
}

function buildBehaviorSignals(behaviorModel, patternKey) {
  const pattern = SCORE_PATTERNS[patternKey];
  if (!pattern) {
    throw new Error(`Unknown score pattern ${patternKey}`);
  }

  const primaryIndependent = INDEPENDENT_AXES.has(behaviorModel.primaryAxisCode);
  const secondaryIndependent = behaviorModel.secondaryAxisCodes.some((axisCode) => INDEPENDENT_AXES.has(axisCode));
  const expectedKind = primaryIndependent || secondaryIndependent ? 'independent' : 'bipolar';

  return pattern.map(([primaryValue, secondaryValue]) => {
    if (expectedKind === 'independent') {
      return {
        [behaviorModel.primaryAxisCode]: Math.max(0, Math.min(2, primaryValue)),
        [behaviorModel.secondaryAxisCodes[0]]: Math.max(0, Math.min(2, secondaryValue)),
      };
    }

    return {
      [behaviorModel.primaryAxisCode]: Math.max(-2, Math.min(2, primaryValue)),
      [behaviorModel.secondaryAxisCodes[0]]: Math.max(-2, Math.min(2, secondaryValue)),
    };
  });
}

function toV2Question(question, index) {
  const primaryDimensionCode = question.primaryDimensionCodes?.[0] ?? 'information_understanding';
  const secondaryDimensionCode = question.secondaryDimensionCode ?? (question.primaryDimensionCodes?.length > 1 ? question.primaryDimensionCodes[1] : null);
  const questionId = question.questionId ?? question.code;
  const questionNumber = getQuestionNumber(questionId);
  const behaviorProfile = buildBehaviorProfile(primaryDimensionCode, questionNumber - 1);
  const questionType = pickQuestionType(questionId, question.instruction ?? '');
  const signalReliability = pickSignalReliability(questionId, question.path);
  const difficulty = pickDifficulty(questionId, question.path);
  const behaviorModel = {
    primaryAxisCode: behaviorProfile.primaryAxisCode,
    secondaryAxisCodes: uniqueStrings(behaviorProfile.secondaryAxisCodes),
    signalReliability,
    context: behaviorProfile.context,
  };
  const independentAxes = INDEPENDENT_AXES.has(behaviorModel.primaryAxisCode)
    || behaviorModel.secondaryAxisCodes.some((axisCode) => INDEPENDENT_AXES.has(axisCode));
  const behaviorSignalsByOption = buildBehaviorSignals(
    behaviorModel,
    independentAxes
      ? (question.path === 'essential'
        ? (questionNumber % 2 === 0 ? 'i2' : 'i1')
        : (questionNumber % 2 === 0 ? 'i4' : 'i3'))
      : (question.path === 'essential'
        ? (questionNumber % 2 === 0 ? 'b2' : 'b1')
        : (questionNumber % 2 === 0 ? 'b6' : 'b5')),
  );

  return {
    questionId,
    path: question.path,
    situation: question.situation,
    instruction: question.instruction,
    primaryDimensionCodes: [primaryDimensionCode],
    ...(secondaryDimensionCode ? { secondaryDimensionCode } : {}),
    questionType,
    signalReliability,
    behaviorModel,
    options: question.options.map((option, optionIndex) => ({
      id: option.id ?? `${questionId}-option-${optionIndex + 1}`,
      label: option.label,
      order: option.order ?? option.position ?? optionIndex + 1,
      dimensionScores: { ...option.dimensionScores },
      adminExplanation: option.adminExplanation,
      behaviorSignals: behaviorSignalsByOption[optionIndex] ?? behaviorSignalsByOption[0] ?? {},
    })),
    difficulty,
    adminRationale: question.justificationAdministrateur ?? question.adminRationale ?? '',
  };
}

function buildNewQuestion(def) {
  const behaviorModel = buildBehaviorProfile(def.primaryDimensionCode, def.behaviorVariant);
  const behaviorSignalsByOption = buildBehaviorSignals(
    {
      primaryAxisCode: behaviorModel.primaryAxisCode,
      secondaryAxisCodes: behaviorModel.secondaryAxisCodes,
      signalReliability: def.signalReliability,
      context: behaviorModel.context,
    },
    def.scorePattern,
  );

  const scores = SCORE_PATTERNS[def.scorePattern];
  const primary = def.primaryDimensionCode;
  const secondary = def.secondaryDimensionCode ?? null;

  return {
    questionId: def.questionId,
    path: def.path,
    situation: def.situation,
    instruction: def.instruction,
    primaryDimensionCodes: [primary],
    ...(secondary ? { secondaryDimensionCode: secondary } : {}),
    questionType: def.questionType,
    signalReliability: def.signalReliability,
    behaviorModel: {
      primaryAxisCode: behaviorModel.primaryAxisCode,
      secondaryAxisCodes: behaviorModel.secondaryAxisCodes,
      signalReliability: def.signalReliability,
      context: behaviorModel.context,
    },
    options: def.options.map(([label, adminExplanation], optionIndex) => ({
      id: `${def.questionId}-option-${optionIndex + 1}`,
      label,
      order: optionIndex + 1,
      dimensionScores: {
        [primary]: scores[optionIndex][0],
        [secondary ?? primary]: scores[optionIndex][1],
      },
      adminExplanation,
      behaviorSignals: behaviorSignalsByOption[optionIndex],
    })),
    difficulty: def.difficulty,
    adminRationale: def.adminRationale,
  };
}

function buildInterpretationBlocks() {
  const bands = [
    { interpretationCode: 'very_low', minScore: 0, maxScore: 39, strengthLabel: 'À consolider' },
    { interpretationCode: 'low_mid', minScore: 40, maxScore: 59, strengthLabel: 'Base partielle' },
    { interpretationCode: 'solid_base', minScore: 60, maxScore: 74, strengthLabel: 'Base fiable' },
    { interpretationCode: 'strong_point', minScore: 75, maxScore: 89, strengthLabel: 'Point d’appui solide' },
    { interpretationCode: 'very_strong', minScore: 90, maxScore: 100, strengthLabel: 'Point d’appui marqué' },
  ];

  return DIMENSION_CONFIGURATIONS.map((dimension) => {
    const interviewIds = Array.from({ length: 5 }, (_, index) => `interview-${dimension.code.replaceAll('_', '-')}-${index + 1}`);
    return {
      dimensionCode: dimension.code,
      blocks: bands.map((band, index) => ({
        interpretationCode: `${dimension.code}-${band.interpretationCode}`,
        minScore: band.minScore,
        maxScore: band.maxScore,
        candidateSummary: `${dimension.label} se situe dans une zone ${band.strengthLabel.toLowerCase()}.`,
        companySummary: `${dimension.label} offre un niveau ${band.strengthLabel.toLowerCase()} à exploiter au recrutement.`,
        strengthLabel: band.strengthLabel,
        interviewFocus: `Explorer ${dimension.label.toLowerCase()} avec un exemple concret.`,
        limitations: ['Lecture indicative à confirmer par des exemples de terrain.'],
        interviewQuestionIds: [interviewIds[index]],
      })),
    };
  });
}

function buildInterviewQuestions() {
  return DIMENSION_CONFIGURATIONS.flatMap((dimension) => {
    const prompts = INTERVIEW_TEMPLATES[dimension.code];
    return prompts.map((prompt, index) => ({
      questionId: `interview-${dimension.code.replaceAll('_', '-')}-${index + 1}`,
      dimensionCode: dimension.code,
      prompt,
      rationale: `Question d’entretien pour ${dimension.label.toLowerCase()}.`,
    }));
  });
}

function buildV2BankDocument() {
  const base = JSON.parse(fs.readFileSync(REVIEW_SOURCE, 'utf8'));
  const baseQuestions = base.questions.map((question, index) => toV2Question(question, index));
  const additionalQuestions = NEW_QUESTIONS.map((question) => buildNewQuestion(question));
  const questions = [...baseQuestions, ...additionalQuestions];

  const essentialQuestionPool = questions.filter((question) => question.path === 'essential');
  const extendedQuestionPool = questions.filter((question) => question.path === 'extended');

  return {
    versionMetadata: {
      name: 'Questionnaire professionnel Seven’O V2',
      version: '1.0.1',
      description: 'Banque V2 comportementale complète pour le questionnaire professionnel Seven’O.',
      generatedPromptVersion: 'seveno_professional_assessment_bank_v2_behavioral_1',
      essentialPoolSize: 30,
      extendedPoolSize: 30,
      essentialDrawSize: 20,
      extendedDrawSize: 20,
      schemaVersion: 2,
    },
    essentialQuestionPool,
    extendedQuestionPool,
    dimensionConfigurations: clone(DIMENSION_CONFIGURATIONS),
    interpretationBlocks: buildInterpretationBlocks(),
    interviewQuestions: buildInterviewQuestions(),
  };
}

const bankDocument = buildV2BankDocument();

if (bankDocument.essentialQuestionPool.length !== 30 || bankDocument.extendedQuestionPool.length !== 30) {
  throw new Error(`Invalid pool size: ${bankDocument.essentialQuestionPool.length}/${bankDocument.extendedQuestionPool.length}`);
}

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(bankDocument, null, 2)}\n`, 'utf8');
console.log(OUTPUT_PATH);
