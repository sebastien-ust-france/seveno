# Import des prerequis Seven'O

Le format officiel est un objet JSON contenant `schemaVersion: 1` et un tableau `items` de definitions. Le fichier `examples/prerequisites-import.example.json` constitue la reference executable.

Chaque import doit d'abord etre envoye avec `dryRun: true`. Une ecriture reelle utilise ensuite le meme tableau avec `dryRun: false`. La mise a jour des codes existants exige `updateExisting: true`.

```json
{
  "dryRun": true,
  "updateExisting": false,
  "items": []
}
```

Regles principales :

- `code` est unique, immuable, en minuscules et separe par des tirets ;
- les categories, types, operateurs, statuts, portees et politiques sont des listes fermees ;
- une option utilise une `value` stable, un `candidateLabel` et un `rank` pour un niveau ;
- tous les identifiants d'applicabilite proviennent de la taxonomie Seven'O ;
- l'import ne supprime rien et les exemples restent en `draft` ;
- les lots contiennent au maximum 200 definitions, soit 400 ecritures avec les snapshots de version.

L'export admin retourne ce meme format sans donnee personnelle ni champ d'audit.
