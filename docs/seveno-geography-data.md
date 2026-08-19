# Référentiel géographique Seven'O

Seven'O utilise le paquet serveur `@countrystatecity/countries` pour les pays, subdivisions administratives et villes. Les données proviennent du projet [Countries States Cities Database](https://github.com/dr5hn/countries-states-cities-database) et sont distribuées sous licence [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

Le périmètre applicatif exclut les territoires dépendants proposés séparément par la source et conserve les 46 pays européens supportés dans `lib/seveno-geography.ts`. La France est affichée en premier. Les autres pays sont triés par libellé français.

Pour la France, Seven'O expose les 101 départements avec leur code. Le référentiel source mélangeant départements, régions et collectivités, la couche serveur filtre ces niveaux et normalise Paris sous le code `75`. Les départements d'outre-mer restent rattachés au pays `FR`; leurs villes sont lues dans les jeux territoriaux correspondants de la source.

Les identifiants stockés sont les codes ISO alpha-2 pour les pays, les codes de subdivision de la source (codes départementaux pour la France) et l'identifiant numérique de la ville dans le référentiel. Les noms sont conservés uniquement comme libellés d'affichage.
