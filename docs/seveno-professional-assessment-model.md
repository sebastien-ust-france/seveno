# Seven’O Professional Assessment Model

## Objectif

Ce document décrit le socle technique du nouveau modèle versionné de l’évaluation professionnelle Seven’O. Il reste isolé du modèle legacy et ne remplace pas l’historique existant.

## Séparation legacy / nouveau modèle

- `LegacySevenoAssessmentSummary` reste un historique de l’ancienne évaluation Seven’O.
- `SevenoProfessionalAssessmentReport` représente le nouveau rapport versionné.
- Aucun ancien résultat ne doit être recalculé, converti ou renommé silencieusement.
- Le nouveau moteur refuse toute lecture d’un payload legacy comme s’il s’agissait d’une analyse moderne.

## Parcours

- `essential` : parcours essentiel, suffisant à lui seul.
- `extended` : parcours approfondi facultatif.
- Le parcours approfondi ajoute des observations, mais ne crée aucun bonus artificiel.
- Les deux parcours appartiennent à la même version de l’évaluation.

## Sept dimensions

Le modèle repose sur sept dimensions professionnelles :

1. Compréhension et intégration de l’information
2. Organisation et priorisation
3. Résolution de problèmes
4. Autonomie et initiative
5. Adaptabilité
6. Collaboration
7. Rigueur et fiabilité

Chaque dimension possède :

- un code stable ;
- un libellé ;
- une description ;
- un poids interne ;
- un ordre d’affichage ;
- un minimum d’observations essentielles ;
- un minimum d’observations approfondies ;
- des seuils d’interprétation versionnés ;
- des identifiants de questions d’entretien.

Les poids internes totalisent 100. Ils ne doivent jamais être présentés comme un pourcentage de personnalité ou comme un score global candidat.

## Échelle interne des options

Les options de réponse utilisent une échelle interne bornée de 0 à 4 :

- 0 : contribution très faible ou inexistante
- 1 : contribution faible
- 2 : contribution intermédiaire
- 3 : contribution solide
- 4 : contribution forte

Cette échelle reste technique. Elle ne doit pas être exposée comme une note brute au candidat ou à l’entreprise.

## Normalisation sur 100

Le moteur calcule, par dimension :

1. les points obtenus ;
2. le minimum théorique disponible sur les questions réellement présentées ;
3. le maximum théorique disponible sur les questions réellement présentées ;
4. la normalisation sur 100 entre ces deux bornes ;
5. l’arrondi déterministe avec `Math.round()`.

La formule retenue est :

`score = round(((points_obtenus - points_minimum) / (points_maximum - points_minimum)) * 100)`

Si aucune question ne contribue à la dimension, ou si la plage théorique est nulle, la dimension est marquée `not_measured`.

## Couverture

La couverture conserve :

- le nombre total de questions disponibles ;
- le nombre de questions répondues ;
- le minimum d’observations attendu ;
- le ratio de couverture obtenu.

La couverture sert à nuancer l’interprétation et à déclencher un niveau de prudence lorsque les données sont incomplètes.

## Niveaux de précision

- `caution` : données insuffisantes, parcours incomplet ou couverture partielle.
- `standard` : parcours essentiel terminé avec couverture suffisante.
- `reinforced` : parcours approfondi terminé avec couverture suffisante.

Le niveau de précision n’est pas une mesure scientifique. Il s’agit d’un indicateur de lecture opérationnelle.

## Absence de score global

Le nouveau modèle ne produit pas :

- `overallScore`
- `globalScore`
- `employabilityScore`
- `candidateRankingScore`
- `compatibilityScore`

Le rapport expose uniquement :

- les résultats par dimension ;
- les niveaux de précision ;
- la synthèse ;
- les points d’appui ;
- les points à approfondir ;
- les questions d’entretien ;
- la version utilisée.

## Versionnement

Une version comporte au minimum :

- `id`
- `code`
- `version`
- `status`
- `name`
- `description`
- `createdAt`
- `updatedAt`
- `publishedAt`
- `archivedAt`
- `createdBy`
- `dimensions`
- `questions`
- `essentialQuestionCount`
- `extendedQuestionCount`
- `estimatedEssentialDurationMinutes`
- `estimatedExtendedDurationMinutes`
- `scoringEngineVersion`
- `interpretationEngineVersion`
- `legalNoticeVersion`
- `revisionNotes`

Les statuts `active` et `archived` sont immuables. Une version `pilot` devient également bloquée dès qu’une session a commencé.

## Projections

### Projection candidat

La projection candidat conserve la lecture utile à la personne concernée :

- parcours réalisé ;
- précision ;
- scores par dimension ;
- synthèse ;
- points d’appui ;
- éléments à approfondir ;
- limites ;
- version ;
- date de réalisation.

Elle ne doit pas exposer les barèmes internes, les explications administrateur, les clés de correction ou les données des autres candidats.

### Projection entreprise

La projection entreprise conserve la lecture utile à l’entretien :

- parcours réalisé ;
- précision ;
- scores par dimension ;
- synthèse entreprise ;
- points d’appui ;
- éléments à approfondir ;
- questions d’entretien ;
- version ;
- date.

Elle ne doit pas exposer les réponses brutes, les barèmes complets, le détail des calculs ou toute décision automatique.

Les projections doivent rester déterministes à version et réponses identiques.

## Validations

Les validateurs purs couvrent notamment :

- code de version manquant ;
- numéro de version manquant ;
- somme des poids différente de 100 ;
- dimension inconnue ou dupliquée ;
- question dupliquée ;
- option dupliquée ;
- score hors bornes ;
- question sans parcours ;
- question sans dimension ;
- question mesurant trop de dimensions ;
- réponse vers une option inexistante ;
- réponse vers une question absente ;
- session mélangeant deux versions ;
- version active ou archivée modifiable.

## Limites d’interprétation

Ce modèle technique ne constitue pas une validation scientifique ou psychométrique du questionnaire.

Il fournit uniquement un socle déterministe, explicable et testable pour préparer la publication future des analyses professionnelles Seven’O.

## Éléments encore à valider avant la phase 3

- rédaction finale des textes métier de chaque dimension ;
- banque de questions réelle ;
- rythme de publication ;
- règles de présentation dans les interfaces ;
- choix éditoriaux finaux pour les résumés candidats et entreprises.
