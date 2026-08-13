import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AssessmentDimensionCode } from '@/types/seveno-assessment';

export const PHASE2_SOURCE_PATH = 'scripts/data/seveno-professional-assessment-v2-content-rebuild.json';
export const PHASE2_OUTPUT_PATH = 'scripts/data/seveno-professional-assessment-v2-dimension-rebuild-1.2.0.json';
export const PHASE2_AUDIT_PATH = 'scripts/data/seveno-professional-assessment-v2-dimension-audit-1.2.0.json';

export type QuestionClassification = 'A' | 'B' | 'C';

type SourceOption = {
  id: string;
  order: number;
  label: string;
  dimensionScores: Partial<Record<AssessmentDimensionCode, number>>;
  adminExplanation: string;
  behaviorSignals?: Record<string, number>;
};

type SourceQuestion = {
  questionId: string;
  path: 'essential' | 'extended';
  situation: string;
  instruction: string;
  primaryDimensionCodes: AssessmentDimensionCode[];
  secondaryDimensionCode?: AssessmentDimensionCode;
  options: SourceOption[];
  adminRationale: string;
  [key: string]: unknown;
};

type BankDocument = {
  versionMetadata: {
    name: string;
    version: string;
    description: string;
    generatedPromptVersion: string;
    [key: string]: unknown;
  };
  essentialQuestionPool: SourceQuestion[];
  extendedQuestionPool: SourceQuestion[];
  dimensionConfigurations: Array<{
    code: AssessmentDimensionCode;
    label: string;
    description: string;
    [key: string]: unknown;
  }>;
  interpretationBlocks: unknown[];
  interviewQuestions: unknown[];
};

type QuestionPlan = {
  classification: QuestionClassification;
  dimension: AssessmentDimensionCode;
  scores: readonly [number, number, number, number];
  rationale: string;
};

type QuestionRewrite = {
  situation: string;
  options: readonly [string, string, string, string];
};

export const DIMENSION_RUBRICS: Record<AssessmentDimensionCode, readonly [string, string, string, string, string]> = {
  information_understanding: [
    'Ne distingue pas les faits utiles, les inconnues et les hypothèses nécessaires à la décision.',
    'Repère partiellement l’information utile mais agit ou attend sans sécuriser le point décisif.',
    'Identifie les éléments principaux avec une vérification encore incomplète ou peu structurée.',
    'Structure les faits, les inconnues et les critères utiles avant une action proportionnée.',
    'Isole l’information décisive, vérifie sa fiabilité et explicite les hypothèses avec précision.',
  ],
  organization_prioritization: [
    'N’établit ni priorité, ni ordre d’action, ni protection des engagements.',
    'Suit l’ordre apparent ou change de priorité sans critère explicite.',
    'Organise l’action avec des critères partiels ou une anticipation limitée.',
    'Priorise selon l’impact, l’urgence et les engagements, puis ajuste le plan.',
    'Arbitre explicitement les priorités, séquence l’action et sécurise les dépendances.',
  ],
  problem_solving: [
    'Agit sans diagnostic ni apprentissage exploitable.',
    'Retient une piste intuitive sans vérifier suffisamment la cause ou le résultat.',
    'Explore une solution plausible avec une analyse ou une mesure partielle.',
    'Formule des hypothèses, teste de façon contrôlée et compare les résultats.',
    'Conduit un diagnostic structuré, choisit un test discriminant et capitalise le résultat.',
  ],
  autonomy_initiative: [
    'Reste passif ou transfère une décision clairement située dans son périmètre.',
    'Attend une validation non nécessaire avant d’engager une action utile.',
    'Agit sur un périmètre limité avec un besoin de cadrage ou de validation fréquent.',
    'Prend une initiative utile dans son périmètre et informe aux moments pertinents.',
    'Prend en charge l’action, sécurise les limites de son mandat et crée une avancée durable.',
  ],
  adaptability: [
    'Maintient une méthode devenue inadaptée sans examiner les signaux disponibles.',
    'N’ajuste qu’après blocage ou remplace la méthode sans préserver l’objectif.',
    'Adapte certains éléments avec une lecture encore partielle du nouveau contexte.',
    'Ajuste la méthode aux contraintes tout en préservant l’objectif et les règles essentielles.',
    'Reconfigure rapidement et de façon maîtrisée la méthode à partir des résultats observés.',
  ],
  collaboration: [
    'Ignore l’impact collectif ou entretient un blocage relationnel évitable.',
    'Coopère uniquement sur sollicitation ou recherche un accord sans traiter le fond.',
    'Contribue au collectif avec un partage ou un soutien ponctuel mais peu structuré.',
    'Partage l’information, traite les désaccords sur le fond et soutient l’action commune.',
    'Facilite activement la coopération, la décision partagée et la réussite collective.',
  ],
  rigor_reliability: [
    'N’effectue pas les contrôles indispensables et ne trace pas les risques ou écarts.',
    'Sécurise insuffisamment l’engagement, la vérification ou l’alerte nécessaire.',
    'Protège les points principaux avec des contrôles ou une traçabilité partiels.',
    'Vérifie les points sensibles, trace les écarts et tient un engagement réaliste.',
    'Dimensionne les contrôles au risque, documente les décisions et sécurise la continuité.',
  ],
};

const QUESTION_PLANS: Record<string, QuestionPlan> = {
  essential_profile_01: { classification: 'A', dimension: 'autonomy_initiative', scores: [4, 3, 2, 1], rationale: 'Décision autonome dans un périmètre explicite.' },
  essential_profile_02: { classification: 'B', dimension: 'organization_prioritization', scores: [2, 4, 3, 1], rationale: 'Qualité des critères utilisés pour ordonner plusieurs demandes.' },
  essential_profile_03: { classification: 'A', dimension: 'collaboration', scores: [4, 3, 2, 1], rationale: 'Soutien utile au collectif sans abandon du périmètre.' },
  essential_profile_04: { classification: 'C', dimension: 'information_understanding', scores: [1, 4, 3, 1], rationale: 'Identification et sécurisation de l’information qui change la décision.' },
  essential_profile_05: { classification: 'B', dimension: 'problem_solving', scores: [3, 4, 3, 1], rationale: 'Diagnostic puis test discriminant d’une hypothèse.' },
  essential_profile_06: { classification: 'C', dimension: 'adaptability', scores: [1, 2, 4, 2], rationale: 'Ajustement proportionné de la méthode face à un changement réel.' },
  essential_profile_07: { classification: 'A', dimension: 'organization_prioritization', scores: [1, 3, 4, 2], rationale: 'Structuration des options et des prochaines étapes du groupe.' },
  essential_profile_08: { classification: 'B', dimension: 'organization_prioritization', scores: [3, 4, 4, 2], rationale: 'Arbitrage explicite du contenu, du délai et des contrôles.' },
  essential_profile_09: { classification: 'C', dimension: 'collaboration', scores: [1, 2, 4, 2], rationale: 'Traitement respectueux et factuel d’un désaccord bloquant.' },
  essential_profile_10: { classification: 'C', dimension: 'problem_solving', scores: [1, 3, 4, 2], rationale: 'Comparaison mesurée d’une méthode lorsque sa performance baisse.' },
  essential_profile_11: { classification: 'A', dimension: 'collaboration', scores: [1, 3, 4, 4], rationale: 'Alignement constructif après une décision collective.' },
  essential_profile_12: { classification: 'C', dimension: 'rigor_reliability', scores: [2, 4, 4, 1], rationale: 'Sécurisation d’un essai réversible par des limites et des critères.' },
  essential_profile_13: { classification: 'A', dimension: 'autonomy_initiative', scores: [1, 2, 4, 3], rationale: 'Initiative utile et proportionnée au-delà de la tâche prescrite.' },
  essential_profile_14: { classification: 'B', dimension: 'adaptability', scores: [1, 3, 4, 2], rationale: 'Changement de méthode fondé sur les résultats observés.' },
  essential_profile_15: { classification: 'A', dimension: 'collaboration', scores: [2, 3, 4, 4], rationale: 'Contribution argumentée à une décision collective.' },
  essential_profile_16: { classification: 'A', dimension: 'autonomy_initiative', scores: [1, 2, 4, 4], rationale: 'Signalement actif d’un risque et proposition d’une alternative.' },
  essential_profile_17: { classification: 'B', dimension: 'adaptability', scores: [2, 3, 4, 1], rationale: 'Adaptation maîtrisée en cours d’exécution.' },
  essential_profile_18: { classification: 'C', dimension: 'information_understanding', scores: [2, 4, 2, 1], rationale: 'Qualification des faits utiles avant traitement ou alerte.' },
  essential_profile_19: { classification: 'C', dimension: 'autonomy_initiative', scores: [4, 3, 2, 1], rationale: 'Action autonome dans des limites explicites sur une mission nouvelle.' },
  essential_profile_20: { classification: 'B', dimension: 'organization_prioritization', scores: [2, 4, 3, 1], rationale: 'Arbitrage par le critère réellement décisif.' },
  essential_profile_21: { classification: 'A', dimension: 'collaboration', scores: [1, 2, 4, 3], rationale: 'Soutien spontané et utile à l’équilibre de charge.' },
  essential_profile_22: { classification: 'C', dimension: 'information_understanding', scores: [1, 4, 4, 1], rationale: 'Structuration des certitudes et ambiguïtés d’une demande contradictoire.' },
  essential_profile_23: { classification: 'B', dimension: 'problem_solving', scores: [2, 4, 4, 3], rationale: 'Test contrôlé produisant une information utile au diagnostic.' },
  essential_profile_24: { classification: 'B', dimension: 'adaptability', scores: [1, 2, 4, 3], rationale: 'Adaptation du cadre en préservant son objectif.' },
  essential_profile_25: { classification: 'A', dimension: 'autonomy_initiative', scores: [1, 3, 4, 2], rationale: 'Prise en charge utile d’un démarrage non structuré.' },
  essential_profile_26: { classification: 'B', dimension: 'rigor_reliability', scores: [2, 4, 4, 1], rationale: 'Contrôles proportionnés au risque et au délai.' },
  essential_profile_27: { classification: 'C', dimension: 'collaboration', scores: [1, 2, 4, 2], rationale: 'Résolution d’un désaccord par des faits et des critères partagés.' },
  essential_profile_28: { classification: 'B', dimension: 'problem_solving', scores: [1, 2, 4, 3], rationale: 'Comparaison contrôlée d’une méthode nouvelle et d’une méthode fiable.' },
  essential_profile_29: { classification: 'A', dimension: 'collaboration', scores: [1, 3, 4, 4], rationale: 'Soutien loyal et constructif d’une décision collective.' },
  essential_profile_30: { classification: 'C', dimension: 'rigor_reliability', scores: [1, 4, 4, 1], rationale: 'Vérification, traçabilité et traitement proportionné d’un risque émergent.' },
  extended_profile_01: { classification: 'A', dimension: 'problem_solving', scores: [1, 2, 4, 3], rationale: 'Identification et réalisation d’une amélioration utile.' },
  extended_profile_02: { classification: 'B', dimension: 'adaptability', scores: [1, 3, 4, 2], rationale: 'Réorientation fondée sur la progression observée.' },
  extended_profile_03: { classification: 'C', dimension: 'information_understanding', scores: [1, 4, 2, 4], rationale: 'Vérification des faits, critères et incompréhensions avant reformulation.' },
  extended_profile_04: { classification: 'A', dimension: 'autonomy_initiative', scores: [1, 2, 3, 4], rationale: 'Prise d’initiative argumentée face à une décision contestable.' },
  extended_profile_05: { classification: 'B', dimension: 'organization_prioritization', scores: [1, 2, 4, 3], rationale: 'Amélioration structurée d’une organisation inefficace.' },
  extended_profile_06: { classification: 'C', dimension: 'information_understanding', scores: [2, 4, 4, 2], rationale: 'Séparation explicite des observations, hypothèses et inconnues.' },
  extended_profile_07: { classification: 'A', dimension: 'autonomy_initiative', scores: [1, 2, 3, 4], rationale: 'Décision réversible prise dans le périmètre avec traçabilité.' },
  extended_profile_08: { classification: 'B', dimension: 'organization_prioritization', scores: [2, 4, 3, 1], rationale: 'Choix du critère permettant un arbitrage sous pression.' },
  extended_profile_09: { classification: 'A', dimension: 'collaboration', scores: [1, 3, 4, 4], rationale: 'Contribution active et partage utile au collectif.' },
  extended_profile_10: { classification: 'B', dimension: 'information_understanding', scores: [1, 4, 3, 2], rationale: 'Résolution du point contradictoire qui change l’action.' },
  extended_profile_11: { classification: 'B', dimension: 'problem_solving', scores: [2, 4, 4, 1], rationale: 'Analyse d’hypothèses suivie d’un essai contrôlé.' },
  extended_profile_12: { classification: 'B', dimension: 'adaptability', scores: [1, 2, 4, 3], rationale: 'Adaptation locale sans perte des règles essentielles.' },
  extended_profile_13: { classification: 'A', dimension: 'autonomy_initiative', scores: [1, 3, 4, 2], rationale: 'Activation utile d’une décision et de prochaines actions.' },
  extended_profile_14: { classification: 'B', dimension: 'rigor_reliability', scores: [2, 4, 3, 1], rationale: 'Vérification ciblée et traçabilité d’un écart.' },
  extended_profile_15: { classification: 'C', dimension: 'collaboration', scores: [1, 2, 4, 1], rationale: 'Résolution respectueuse d’un conflit à partir des faits.' },
  extended_profile_16: { classification: 'B', dimension: 'problem_solving', scores: [4, 3, 3, 1], rationale: 'Vérification de l’exécution avant exploration de causes nouvelles.' },
  extended_profile_17: { classification: 'A', dimension: 'adaptability', scores: [1, 3, 4, 4], rationale: 'Alignement actif sur une nouvelle méthode collective.' },
  extended_profile_18: { classification: 'C', dimension: 'rigor_reliability', scores: [2, 4, 4, 1], rationale: 'Essai réversible sécurisé par des limites et un retour arrière.' },
  extended_profile_19: { classification: 'C', dimension: 'organization_prioritization', scores: [2, 4, 4, 1], rationale: 'Protection de l’engagement tout en qualifiant une opportunité.' },
  extended_profile_20: { classification: 'B', dimension: 'problem_solving', scores: [1, 3, 4, 3], rationale: 'Changement de méthode après apprentissage suffisant.' },
  extended_profile_21: { classification: 'C', dimension: 'information_understanding', scores: [2, 4, 1, 4], rationale: 'Comparaison des options à partir de faits et critères partagés.' },
  extended_profile_22: { classification: 'B', dimension: 'information_understanding', scores: [1, 3, 4, 4], rationale: 'Compréhension des conséquences et formulation d’une alternative.' },
  extended_profile_23: { classification: 'C', dimension: 'organization_prioritization', scores: [1, 3, 4, 2], rationale: 'Planification et mesure d’une amélioration de l’organisation.' },
  extended_profile_24: { classification: 'A', dimension: 'rigor_reliability', scores: [2, 4, 3, 4], rationale: 'Correction, traçabilité et information proportionnées à l’impact.' },
  extended_profile_25: { classification: 'A', dimension: 'organization_prioritization', scores: [1, 3, 4, 2], rationale: 'Coordination temporaire structurée d’un sujet urgent.' },
  extended_profile_26: { classification: 'B', dimension: 'organization_prioritization', scores: [3, 2, 4, 4], rationale: 'Arbitrage explicite entre soutien collectif et engagement propre.' },
  extended_profile_27: { classification: 'A', dimension: 'adaptability', scores: [1, 3, 4, 3], rationale: 'Adoption cohérente d’une méthode collective nouvelle.' },
  extended_profile_28: { classification: 'C', dimension: 'problem_solving', scores: [2, 3, 4, 2], rationale: 'Diagnostic puis amélioration vérifiable d’une difficulté concrète.' },
  extended_profile_29: { classification: 'C', dimension: 'information_understanding', scores: [1, 4, 3, 4], rationale: 'Qualité et vérification des éléments soutenant une proposition.' },
  extended_profile_30: { classification: 'B', dimension: 'rigor_reliability', scores: [1, 3, 4, 2], rationale: 'Alerte proportionnée distinguant faits établis et incertitudes.' },
};

const QUESTION_REWRITES: Record<string, QuestionRewrite> = {
  essential_profile_04: { situation: 'Une demande contient des zones floues, mais une seule information peut réellement changer la décision. Que faites-vous ?', options: ['Attendre une clarification complète sans identifier le point décisif.', 'Identifier le point qui change la décision, le faire préciser, puis avancer.', 'Séparer les faits certains des hypothèses et avancer sur la partie sans risque.', 'Choisir immédiatement une interprétation sans la vérifier ni la tracer.'] },
  essential_profile_06: { situation: 'Une condition importante change pendant une mission et la méthode prévue n’est plus entièrement adaptée. Que faites-vous ?', options: ['Continuer avec la méthode initiale malgré le changement.', 'Attendre de nouvelles instructions avant tout ajustement.', 'Adapter la méthode en préservant l’objectif et les règles essentielles.', 'Remplacer immédiatement toute la méthode sans vérifier les effets du changement.'] },
  essential_profile_09: { situation: 'Un désaccord professionnel bloque une décision et menace le délai collectif. Que faites-vous ?', options: ['Éviter le sujet pour ne pas créer de tension.', 'Chercher rapidement un compromis avant d’examiner le fond.', 'Comparer les faits et les critères avec l’autre personne afin de décider.', 'Affirmer directement que l’autre solution est incorrecte sans construire de critère commun.'] },
  essential_profile_10: { situation: 'Une méthode jusque-là fiable produit désormais des résultats moins bons. Que faites-vous ?', options: ['La conserver sans analyser la baisse de résultat.', 'Identifier sa principale limite et ajuster le point concerné.', 'Comparer sur un périmètre contrôlé la méthode actuelle et une alternative.', 'Changer régulièrement de méthode sans mesurer laquelle fonctionne mieux.'] },
  essential_profile_12: { situation: 'Une méthode peu éprouvée pourrait améliorer le résultat et son essai est réversible. Comment sécurisez-vous la décision ?', options: ['Écarter la méthode malgré le faible risque de l’essai.', 'Définir un test limité, des critères de réussite et un retour arrière.', 'L’utiliser sur un périmètre maîtrisé, tracer le résultat puis décider.', 'La déployer rapidement sans limite ni critère, puis corriger si nécessaire.'] },
  essential_profile_18: { situation: 'Vous remarquez une anomalie sans conséquence visible. Quelle est votre première étape ?', options: ['La corriger localement sans chercher les faits utiles ni conserver de trace.', 'Noter les faits observés et vérifier l’information qui détermine l’impact.', 'Alerter immédiatement sans distinguer ce qui est constaté de ce qui est supposé.', 'Demander à quelqu’un si le point est important sans effectuer votre propre vérification.'] },
  essential_profile_19: { situation: 'Vous recevez une mission nouvelle dont l’objectif et les limites sont explicites. Comment démarrez-vous ?', options: ['Identifier les points de vigilance puis agir dans le périmètre en informant au besoin.', 'Définir quelques points de validation puis avancer entre ces étapes.', 'Attendre des instructions détaillées avant les décisions courantes.', 'Demander une validation à chaque étape, y compris dans le périmètre prévu.'] },
  essential_profile_22: { situation: 'Une demande contient des informations incomplètes et partiellement contradictoires. Comment la traitez-vous ?', options: ['Attendre que tout soit clarifié sans analyser les éléments disponibles.', 'Isoler la contradiction qui change la décision et demander sa clarification.', 'Structurer ce qui est certain, incertain et vérifiable avant d’avancer sans risque.', 'Retenir l’interprétation la plus intuitive sans expliciter l’hypothèse.'] },
  essential_profile_27: { situation: 'Un collègue et vous défendez deux solutions différentes et le travail ne peut plus avancer. Que faites-vous ?', options: ['Éviter de prolonger le désaccord et laisser la situation en attente.', 'Chercher un compromis rapide sans vérifier quelle solution répond au besoin.', 'Comparer les faits, les contraintes et les effets attendus pour décider ensemble.', 'Expliquer directement que sa solution est mauvaise sans établir de critères partagés.'] },
  essential_profile_30: { situation: 'Un risque commence à apparaître sans être encore totalement confirmé. Comment sécurisez-vous la suite ?', options: ['Attendre une certitude complète avant toute vérification ou trace.', 'Identifier les faits critiques, vérifier leur fiabilité et conserver une trace.', 'Agir avec des limites explicites, documenter l’incertitude et prévoir une alerte.', 'Poursuivre sans contrôle particulier en comptant sur un ajustement ultérieur.'] },
  extended_profile_03: { situation: 'Votre proposition est écartée rapidement et vous soupçonnez une incompréhension. Que faites-vous ?', options: ['Laisser la décision suivre son cours sans rechercher l’information manquante.', 'Vérifier le point mal compris et fournir les faits qui permettent de l’évaluer.', 'Reformuler surtout pour convaincre avant de vérifier les objections.', 'Demander les critères et objections, puis distinguer les faits des préférences.'] },
  extended_profile_06: { situation: 'Vous découvrez une anomalie dont la cause n’est pas encore connue. Comment préparez-vous son traitement ?', options: ['Essayer de la corriger avant de documenter les faits observés.', 'Séparer les observations, les hypothèses et les informations à vérifier.', 'Alerter en précisant clairement ce qui est établi et ce qui reste inconnu.', 'Chercher un second avis avant d’organiser les informations déjà disponibles.'] },
  extended_profile_15: { situation: 'Un désaccord tendu bloque une décision importante pour l’équipe. Comment contribuez-vous à le résoudre ?', options: ['Éviter le sujet pour préserver les relations, même si le blocage demeure.', 'Chercher une solution acceptable avant d’examiner les causes du désaccord.', 'Faire expliciter les faits et critères, puis organiser un échange respectueux sur le fond.', 'Critiquer directement la position défendue sans séparer l’idée de la personne.'] },
  extended_profile_18: { situation: 'Une option incertaine peut apporter un meilleur résultat et un retour arrière est possible. Comment décidez-vous ?', options: ['Écarter l’option uniquement parce que son résultat est incertain.', 'Comparer l’impact, définir des limites et prévoir le retour arrière avant l’essai.', 'Réaliser un test contrôlé avec critères de réussite et traçabilité.', 'Lancer l’option sans garde-fou puisque l’échec paraît réversible.'] },
  extended_profile_19: { situation: 'Vous repérez une opportunité utile hors périmètre alors qu’un engagement prioritaire reste à tenir. Que faites-vous ?', options: ['Ignorer définitivement l’opportunité pour rester sur le plan initial.', 'La consigner avec les informations utiles puis protéger la priorité en cours.', 'Évaluer son impact et reprioriser explicitement si le bénéfice le justifie.', 'Interrompre immédiatement le travail prévu pour explorer l’idée.'] },
  extended_profile_21: { situation: 'Un groupe doit choisir entre plusieurs options avec des informations inégales. Quel rôle prenez-vous ?', options: ['Présenter votre préférence sans proposer de critères communs.', 'Rassembler les faits vérifiés et les critères qui soutiennent votre choix.', 'Chercher l’adhésion à votre solution sans exposer ses limites.', 'Structurer la comparaison en distinguant faits, hypothèses et inconnues.'] },
  extended_profile_23: { situation: 'Votre organisation produit le résultat attendu mais consomme trop de temps. Que faites-vous ?', options: ['La conserver sans mesurer l’inefficacité puisqu’elle fonctionne.', 'Noter les principaux goulots et planifier leur analyse.', 'Tester une amélioration prioritaire et mesurer son effet avant de l’étendre.', 'Remplacer toute l’organisation immédiatement sans plan de transition.'] },
  extended_profile_28: { situation: 'Une tâche atteint son résultat mais laisse une difficulté récurrente pour les utilisateurs. Que faites-vous ?', options: ['Clore la tâche sans vérifier l’origine de la difficulté.', 'Identifier la cause principale et améliorer un point précis.', 'Tester puis mettre en place une amélioration dont l’effet peut être vérifié.', 'Proposer une possibilité future sans traiter la difficulté actuelle.'] },
  extended_profile_29: { situation: 'Une idée importante nécessite l’adhésion d’autres personnes et les informations disponibles sont encore incomplètes. Que faites-vous ?', options: ['Transmettre l’idée sans contexte ni élément de vérification.', 'Présenter les faits disponibles, leurs sources et les bénéfices attendus.', 'Adapter votre présentation pour convaincre tout en répondant aux objections connues.', 'Faire vérifier et compléter les éléments par une personne compétente avant la décision.'] },
};

// Les options restent liées à leur ID, score et signal; seule leur position de présentation varie.
const OPTION_ROTATIONS: Record<string, 1 | 2 | 3> = {
  essential_profile_03: 1,
  essential_profile_05: 2,
  essential_profile_07: 3,
  essential_profile_10: 1,
  essential_profile_13: 2,
  essential_profile_14: 3,
  essential_profile_17: 1,
  essential_profile_21: 2,
  extended_profile_02: 3,
  extended_profile_05: 1,
  extended_profile_09: 2,
  extended_profile_12: 3,
  extended_profile_13: 1,
  extended_profile_17: 2,
  extended_profile_23: 3,
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function loadSource(): BankDocument {
  return JSON.parse(readFileSync(resolve(process.cwd(), PHASE2_SOURCE_PATH), 'utf8')) as BankDocument;
}

function rewriteQuestion(question: SourceQuestion): SourceQuestion {
  const plan = QUESTION_PLANS[question.questionId];
  assert.ok(plan, `Plan absent pour ${question.questionId}`);
  assert.equal(question.options.length, 4, `${question.questionId} doit conserver quatre options.`);
  const rewrite = QUESTION_REWRITES[question.questionId];
  assert.equal(Boolean(rewrite), plan.classification === 'C', `${question.questionId}: réécriture incohérente avec la classe.`);

  const dimensionRubric = DIMENSION_RUBRICS[plan.dimension];
  const { secondaryDimensionCode: _secondaryDimensionCode, ...questionWithoutSecondary } = clone(question);
  const scoredOptions = question.options.map((option, index) => {
    const score = plan.scores[index];
    return {
      ...clone(option),
      ...(rewrite ? { label: rewrite.options[index] } : {}),
      dimensionScores: { [plan.dimension]: score },
      adminExplanation: `${plan.dimension} — niveau ${score}/4 : ${dimensionRubric[score]}`,
    };
  });
  const rotation = OPTION_ROTATIONS[question.questionId] ?? 0;
  const presentedOptions = [...scoredOptions.slice(rotation), ...scoredOptions.slice(0, rotation)]
    .map((option, index) => ({ ...option, order: index + 1 }));

  return {
    ...questionWithoutSecondary,
    ...(rewrite ? { situation: rewrite.situation } : {}),
    primaryDimensionCodes: [plan.dimension],
    options: presentedOptions,
    adminRationale: `Classe ${plan.classification}. ${plan.rationale} Le signal comportemental ${String((question.behaviorModel as { primaryAxisCode?: string } | undefined)?.primaryAxisCode ?? 'existant')} reste descriptif et indépendant du score dimensionnel.`,
  };
}

export function buildPhase2Bank(): BankDocument {
  const source = loadSource();
  const sourceQuestions = [...source.essentialQuestionPool, ...source.extendedQuestionPool];
  assert.equal(source.versionMetadata.version, '1.1.0');
  assert.equal(sourceQuestions.length, 60);
  assert.deepEqual(Object.keys(QUESTION_PLANS).sort(), sourceQuestions.map((question) => question.questionId).sort());

  return {
    ...clone(source),
    versionMetadata: {
      ...clone(source.versionMetadata),
      name: 'Questionnaire professionnel Seven’O V2',
      version: '1.2.0',
      description: 'Banque générale Seven’O — mesure dimensionnelle et profil comportemental — reconstruction méthodologique 1.2.0',
      generatedPromptVersion: 'seveno_professional_assessment_bank_v2_dimension_rebuild_1_2_0',
    },
    essentialQuestionPool: source.essentialQuestionPool.map(rewriteQuestion),
    extendedQuestionPool: source.extendedQuestionPool.map(rewriteQuestion),
  };
}

export function buildPhase2Audit() {
  const bank = buildPhase2Bank();
  const questions = [...bank.essentialQuestionPool, ...bank.extendedQuestionPool];
  const classifications = { A: 0, B: 0, C: 0 };
  for (const plan of Object.values(QUESTION_PLANS)) classifications[plan.classification] += 1;

  return {
    sourceVersion: '1.1.0',
    targetVersion: bank.versionMetadata.version,
    dimensions: bank.dimensionConfigurations.map((dimension) => ({
      code: dimension.code,
      label: dimension.label,
      definition: dimension.description,
      rubric: DIMENSION_RUBRICS[dimension.code],
    })),
    classificationCounts: classifications,
    rewrittenQuestionCount: Object.keys(QUESTION_REWRITES).length,
    rewrittenOptionCount: Object.keys(QUESTION_REWRITES).length * 4,
    questions: questions.map((question) => ({
      questionId: question.questionId,
      path: question.path,
      classification: QUESTION_PLANS[question.questionId].classification,
      dimension: QUESTION_PLANS[question.questionId].dimension,
      scores: question.options.map((option) => option.dimensionScores[QUESTION_PLANS[question.questionId].dimension] ?? 0),
      rationale: QUESTION_PLANS[question.questionId].rationale,
      rewritten: Boolean(QUESTION_REWRITES[question.questionId]),
    })),
  };
}

export function writePhase2BankFiles() {
  const bank = buildPhase2Bank();
  const audit = buildPhase2Audit();
  writeFileSync(resolve(process.cwd(), PHASE2_OUTPUT_PATH), `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
  writeFileSync(resolve(process.cwd(), PHASE2_AUDIT_PATH), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  return { bank, audit };
}
