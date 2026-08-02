# Système colorimétrique Seven’O

## Statut

Cette palette est provisoire. Le dépôt ne contient actuellement ni SVG source du logo ni charte graphique officielle. Les couleurs de marque ont été extraites prudemment des ressources matricielles existantes. Les variables de `app/globals.css` constituent l’unique source d’exécution ; Tailwind les référence sans dupliquer leurs valeurs.

Cette première phase rend les tokens disponibles sans les appliquer aux pages ou composants existants.

## Couleurs de marque

| Token | Référence | Rôle |
| --- | --- | --- |
| `brand-cyan` | `#00D8F8` | Action principale, progression, focus, questionnaire général et entrée d’un parcours |
| `brand-blue` | `#0078F0` | Structure, navigation active, compétence, conversation et liaison |
| `brand-blue-strong` | `#0048B8` | Variante profonde du bleu structurel |
| `brand-warm` | `#F76800` | Décision humaine, double accord, levée de l’anonymat et détail identitaire rare |

## Surfaces

| Token | Référence | Fonction |
| --- | --- | --- |
| `surface-page` | `#020817` | Fond global |
| `surface-section` | `#08111F` | Grande section |
| `surface-panel` | `#0B1728` | Carte ou panneau |
| `surface-elevated` | `#102238` | Menu, modal ou surface élevée |
| `surface-active` | `#12304A` | Élément actif |
| `surface-hover` | `#102A40` | Survol |
| `surface-overlay` | `#020817` | Base opaque d’un overlay, avec opacité appliquée par le composant |

La dette existante `body { @apply bg-zinc-50 text-zinc-900; }` reste volontairement inchangée pendant cette phase.

## Textes, bordures, actions et états

- `text-primary`, `text-secondary`, `text-muted`, `text-disabled`, `text-on-accent` et `text-link` définissent la hiérarchie éditoriale.
- `text-disabled` est réservé aux éléments réellement désactivés. Il ne doit pas servir de texte informatif normal.
- `border-subtle`, `border-default`, `border-strong`, `border-active` et `border-focus` séparent bordure décorative, contrôle et focus.
- `action-primary` référence le cyan de marque ; son texte doit utiliser `text-on-accent`.
- `action-secondary` référence `surface-active` et son survol `surface-hover`.
- `state-success`, `state-warning`, `state-error`, `state-info` et `state-pending` restent distincts des couleurs de marque.
- L’orange Seven’O ne remplace pas `state-warning`.

## Tokens produit

- `assessment-general` référence `brand-cyan`.
- `assessment-job` référence `brand-blue`.
- `skill` référence `brand-blue`.
- `prerequisite` référence `text-muted` et reste volontairement neutre afin de ne pas être confondu avec une compétence évaluée.
- `candidate` référence `brand-cyan` et `company` référence `brand-blue`.
- `conversation` référence `brand-blue`.
- `reciprocal-agreement` et `identity-reveal` référencent `brand-warm`.
- Les scores qualifié, proche du seuil et sous le seuil référencent respectivement les états succès, avertissement et erreur.

## Dosage

- 80 à 90 % de l’interface doit rester composé de surfaces sombres neutres.
- Un bloc principal utilise au maximum une couleur dominante.
- Deux couleurs d’accent visibles simultanément constituent le maximum recommandé.
- Le cyan porte l’action principale, la progression, le focus et le questionnaire général.
- Le bleu électrique porte la structure, la navigation active, les compétences, la conversation et les liaisons.
- Le bleu électrique porte le questionnaire métier, l’analyse, certains résultats et les étapes avancées.
- L’orange représente moins de 5 % de la surface visible et reste réservé aux décisions humaines et moments identitaires importants.
- Emerald est réservé au succès, amber à l’avertissement ou l’attente, rose à l’erreur, au refus ou à la destruction.
- Aucune information ne dépend uniquement de la couleur.

## Accessibilité

- Texte normal : ratio WCAG AA minimal de 4,5:1.
- Grand texte : ratio minimal de 3:1.
- Focus et limites de contrôles importants : contraste minimal de 3:1 avec les couleurs adjacentes.
- `text-disabled` et les équivalents de slate-500 ne servent pas de texte informatif normal.
- Tout texte clair sur `brand-blue` doit être vérifié dans son contexte réel.
- Le focus reste visible indépendamment de l’état actif.
- La présence d’un token ne garantit pas automatiquement la conformité de toutes ses combinaisons futures.

## Migration future

1. Migrer les primitives partagées, les boutons, les liens, les focus et les champs.
2. Utiliser la page Entreprise comme pilote visuel.
3. Migrer progressivement les espaces candidat et entreprise, les questionnaires, les résultats et la messagerie.
4. Terminer par l’administration et retirer les anciennes valeurs arbitraires après validation.

Les remplacements globaux, les substitutions par expression régulière et les migrations simultanées de toutes les pages sont interdits. Chaque migration doit être revue par composant, testée aux différents breakpoints et contrôlée en contraste.
