# Audit strict des performances de la page d’accueil Seven’O

**Date d’audit :** 21 juillet 2026  
**Périmètre :** uniquement la page publique `/` et sa chaîne de rendu.  
**Contraintes respectées :** aucune modification du code applicatif, aucune action de déploiement, aucun commit, aucun push.

## Méthode

- J’ai vérifié la chaîne de rendu réelle de `/` dans le code.
- J’ai mesuré la réponse locale sur le serveur de production déjà lancé en local.
- J’ai relevé les tailles des bundles et des actifs réellement impliqués par la page d’accueil.
- J’ai distingué ce qui est vérifié directement, ce qui est très probable, et ce qui doit encore être confirmé dans une trace Chrome complète.

## Mesures locales vérifiées

### Réponse serveur sur `/`

Le serveur local de production répond en `200 OK`.

- `Cache-Control: no-store, must-revalidate`
- `Content-Type: text/html; charset=utf-8`

Mesures `curl` réalisées sur `http://localhost:3000/` :

- 0.344991 s
- 0.306009 s
- 0.322620 s
- 0.272861 s
- 0.311850 s

Statistiques :

- premier chargement observé : **0.344991 s**
- minimum : **0.272861 s**
- moyenne : **0.3116662 s**
- médiane : **0.311850 s**

### Bundles et ressources chargés

Ressources confirmées par le serveur local :

- `/_next/static/chunks/main-app.js` : **7,610,073 bytes**
- `/_next/static/chunks/app/page.js` : **6,667,387 bytes**
- `/_next/static/css/app/layout.css` : **111,595 bytes**
- `/images/icone-tdb-seveno.png` : **1,564,815 bytes**
- `/images/favicon-seveno.png` : **1,308,430 bytes**

Observations importantes :

- Les réponses HTTP relevées localement ne montrent pas de `Content-Encoding` sur ces ressources.
- Le serveur local expose donc un payload brut très élevé au premier chargement.
- Le favicon est un PNG de plus d’1,3 Mo.
- Le logo du header est un PNG de plus d’1,5 Mo.

## Chaîne de rendu réellement impliquée

### Route et composition

- `app/page.tsx`
- `components/public/PublicSiteShell.tsx`
- `components/public/PublicSiteHeader.tsx`
- `components/public/PublicAccountActions.tsx`
- `components/public/PublicSiteFooter.tsx`
- `components/public/HomeFaqSection.tsx`
- `lib/study-public.ts`
- `lib/auth.ts`
- `lib/seveno-users.ts`
- `lib/firebase.ts`
- `lib/firebase-admin.ts`

### Directement vérifié dans le code

- `app/page.tsx` force le rendu dynamique avec `export const dynamic = 'force-dynamic';`
- `app/page.tsx` appelle `getPublicStudyResponseCount()`.
- `lib/study-public.ts` exécute `adminDb.collection('study_responses').count().get()`.
- `components/public/PublicSiteHeader.tsx` est un composant client.
- `components/public/PublicAccountActions.tsx` est un composant client.
- `lib/auth.ts` initialise Firebase Auth côté navigateur et attend `auth.authStateReady()`.
- `lib/seveno-users.ts` lit `users/{uid}` côté navigateur via Firestore.
- `app/layout.tsx` référence `'/images/favicon-seveno.png'` dans les metadata globales.
- `components/public/PublicSiteHeader.tsx` charge `'/images/icone-tdb-seveno.png'` avec `priority`.
- `components/public/PublicSiteFooter.tsx` reste serveur et utilise un logo webp léger.

## Résumé exécutif

La page d’accueil n’est pas lente à cause d’un seul composant, mais à cause d’un cumul de coûts sur le premier affichage :

1. **Rendu dynamique systématique** de `/` à cause du compteur de l’étude.
2. **Hydratation client** d’un header public qui embarque la logique de session Firebase.
3. **Lecture Firestore conditionnelle** dans l’interface de compte publique.
4. **Actifs image trop lourds** pour un usage de type favicon et logo de navigation.
5. **Bundles JavaScript très volumineux** pour une page d’accueil publique.
6. **Effets visuels coûteux** qui ajoutent de la pression sur le rendu et la peinture.

Le TBT mesuré dans Chrome à **960 ms** est cohérent avec un ensemble de tâches de parsing, compilation, hydratation et initialisation Firebase sur la première visite.

## Constats critiques

### 1. Le compteur d’étude rend `/` dynamique et ajoute une dépendance serveur sur le chemin critique

**Niveau : CRITIQUE**

**Preuves :**

- `app/page.tsx:7` force le rendu dynamique.
- `app/page.tsx:251` appelle `getPublicStudyResponseCount()`.
- `lib/study-public.ts:15` interroge `study_responses` avec `count().get()`.
- La réponse HTTP de `/` est marquée `no-store, must-revalidate`.

**Impact performance :**

- La page d’accueil ne peut pas être servie comme contenu statique simple.
- Chaque chargement paie une requête Firestore côté serveur.
- Le rendu est moins cacheable, donc plus sensible à la latence document/serveur.

**Lecture produit :**

- Le compteur de l’étude n’est pas au centre de la valeur utilisateur immédiate.
- Il occupe pourtant le chemin critique de la page d’accueil.

**Priorité de correction recommandée :**

1. sortir ce compteur du chemin critique,
2. ou le charger de façon différée,
3. ou le sérialiser via cache contrôlé si la donnée n’a pas besoin d’être live à chaque requête.

---

### 2. Le header public hydrate Firebase Auth et Firestore sur toutes les pages publiques

**Niveau : CRITIQUE**

**Preuves :**

- `components/public/PublicSiteHeader.tsx:1`
- `components/public/PublicAccountActions.tsx:1`
- `components/public/PublicAccountActions.tsx:53-91`
- `lib/auth.ts:1-94`
- `lib/seveno-users.ts:1-300`

**Chemin exact :**

`PublicSiteShell` -> `PublicSiteHeader` -> `PublicAccountActions` -> `getCurrentAuthUser()` -> `auth.authStateReady()` -> `getSevenoUser(uid)`

**Impact performance :**

- Le premier affichage doit hydrater un composant client présent dans le header.
- Le composant interroge l’état d’authentification Firebase.
- Si un utilisateur est connecté, il déclenche en plus une lecture Firestore de `users/{uid}`.
- Cela ajoute du travail main-thread et du temps de démarrage sur une page censée être légère.

**Lecture produit :**

- Le CTA de compte public est utile, mais sa mise en œuvre actuelle coûte trop cher pour une home.

**Priorité de correction recommandée :**

1. réduire ou déporter la logique d’authentification du header,
2. éviter de faire attendre le premier rendu sur `auth.authStateReady()`,
3. ne charger la lecture `users/{uid}` qu’en cas de besoin réel.

---

### 3. Le favicon global est trop lourd

**Niveau : CRITIQUE**

**Preuves :**

- `app/layout.tsx` référence `'/images/favicon-seveno.png'`
- `public/images/favicon-seveno.png` : **1,308,430 bytes**

**Impact performance :**

- Le favicon est demandé très tôt par les navigateurs.
- Ici, il pèse plus d’1 Mo alors qu’il s’agit d’un petit pictogramme d’interface.
- Ce coût est disproportionné pour un élément de metadata.

**Priorité de correction recommandée :**

1. remplacer ce PNG par un actif beaucoup plus léger,
2. ou utiliser un format plus adapté au favicon,
3. puis conserver la même référence globale si le design doit rester stable.

---

### 4. Le logo du header est un PNG de 1,56 Mo et il est chargé en priorité

**Niveau : CRITIQUE**

**Preuves :**

- `components/public/PublicSiteHeader.tsx:80-87`
- `public/images/icone-tdb-seveno.png` : **1,564,815 bytes**

**Impact performance :**

- Le logo est affiché à environ 44–52 px de large, mais charge un fichier énorme.
- L’attribut `priority` oblige le navigateur à le traiter comme ressource importante dès le départ.
- C’est une charge visuelle et réseau majeure sur chaque page publique.

**Priorité de correction recommandée :**

1. réduire drastiquement le poids de cet actif,
2. supprimer `priority` si le logo n’est pas critique au-dessus de la ligne de flottaison,
3. ou remplacer le PNG par un format bien plus compact.

---

### 5. Les bundles JS de route sont très volumineux

**Niveau : CRITIQUE**

**Preuves :**

- `/_next/static/chunks/main-app.js` : **7,610,073 bytes**
- `/_next/static/chunks/app/page.js` : **6,667,387 bytes**

**Impact performance :**

- Le navigateur doit télécharger, parser et compiler un volume JS très élevé.
- Le TBT de 960 ms est compatible avec ce type de charge.
- Même si la page reste visuellement sobre, le coût d’exécution est nettement supérieur à ce qu’on attend d’une home marketing publique.

**Interprétation prudente :**

- Ces tailles ne prouvent pas à elles seules le TBT exact.
- Elles confirment toutefois un budget JS anormalement haut pour une page publique.

**Priorité de correction recommandée :**

1. réduire l’empreinte client du header,
2. découper les dépendances hydratées,
3. éviter d’embarquer des bibliothèques de compte / Firestore là où elles ne sont pas indispensables.

---

## Constats importants

### 6. Les effets visuels du home augmentent le coût de peinture

**Niveau : IMPORTANT**

**Preuves dans le code :**

- `app/page.tsx` utilise de nombreux fonds en dégradé, ombres larges et cartes imbriquées.
- `components/public/PublicSiteHeader.tsx` utilise `backdrop-blur`.
- Les sections principales emploient plusieurs `shadow-[...]`, `bg-[linear-gradient(...)]` et surfaces translucides.

**Impact performance :**

- Ces styles ne sont pas la source principale du TBT.
- Ils augmentent toutefois le coût de peinture et de composition.
- Sur une machine moyenne, ils amplifient le ressenti de lourdeur dès la première vue.

**Lecture produit :**

- Le design fonctionne visuellement, mais il est très coûteux pour une home publique.

**Priorité de correction recommandée :**

1. limiter les couches translucides les plus profondes,
2. réserver le flou et les grands ombrages aux zones réellement utiles,
3. vérifier l’impact sur le rendu mobile.

---

### 7. Le back/forward cache n’est pas compromis par un `beforeunload` visible, mais le chemin public reste peu favorable

**Niveau : IMPORTANT**

**Vérifié :**

- Je n’ai pas trouvé de `beforeunload` ou `unload` dans la chaîne directe du home.
- `components/public/PublicSiteHeader.tsx` ajoute des écouteurs `keydown` et `resize`.
- `PublicAccountActions` déclenche une résolution d’authentification asynchrone à l’initialisation.

**Interprétation prudente :**

- Je n’ai pas confirmé une cause bfcache bloquante au sens Chrome strict.
- Le coût de l’état client, la présence d’un header hydraté et la résolution Firebase à l’entrée peuvent néanmoins dégrader l’expérience de retour arrière.

**À confirmer manuellement dans Chrome :**

- état `back-forward cache` du navigateur,
- éventuels disqualifiants réels côté runtime,
- comportement après navigation avant/arrière.

---

### 8. Aucun stockage applicatif explicite n’est utilisé sur le home, mais Firebase Auth reste une source de stockage navigateur implicite

**Niveau : IMPORTANT**

**Vérifié :**

- Je n’ai pas trouvé de `localStorage` direct dans la chaîne de rendu propre à `/`.
- Je n’ai pas trouvé de `sessionStorage` direct dans la chaîne de rendu propre à `/`.
- `lib/auth.ts` utilise `auth.authStateReady()` et `getIdToken()`.
- `lib/firebase.ts` initialise Firebase client dès que les variables d’environnement sont présentes.

**Interprétation :**

- Le home n’écrit pas lui-même dans le stockage navigateur.
- En revanche, Firebase Auth peut utiliser sa persistance interne et des mécanismes de stockage navigateur, ce qui ajoute du travail d’initialisation.

**Priorité de correction recommandée :**

1. ne pas laisser l’authentification client démarrer avant d’en avoir besoin,
2. isoler la résolution de session du premier rendu public quand c’est possible.

---

### 9. La FAQ et le footer ne sont pas les principaux responsables

**Niveau : MINEUR**

**Vérifié :**

- `components/public/HomeFaqSection.tsx` est un composant serveur.
- `components/public/PublicSiteFooter.tsx` est aussi côté serveur.
- Le footer utilise `'/images/logo-seveno.webp'`, un actif compact de **74,334 bytes**.

**Conclusion :**

- La FAQ et le footer ne sont pas les premiers suspects du TBT.
- Le coût vient plutôt du header client, des dépendances Firebase et des gros actifs du haut de page.

---

## Ce qui est vérifié directement

- La route `/` est bien la page d’accueil.
- La route est dynamique.
- Le compteur d’étude passe par `study_responses`.
- Le header public est client.
- Le bouton de compte public dépend de Firebase Auth et Firestore.
- Le favicon est un PNG très lourd.
- Le logo du header est un PNG très lourd et prioritaire.
- Les bundles `main-app.js` et `app/page.js` sont massifs.
- La page répond `200 OK` en local.

## Ce qui est inféré à partir du code et des mesures

- Le TBT de 960 ms provient surtout du parsing / compil / hydratation JS et de l’initialisation Firebase.
- La latence document importante observée par l’audit est amplifiée par le rendu dynamique et la requête Firestore sur la home.
- Le bfcache est fragilisé par le contexte client hydrant et les résolutions de session, même sans `beforeunload` explicite sur la home.

## Ce qui doit encore être testé manuellement dans Chrome

- Tracer le TBT avec un profil Lighthouse ou Performance.
- Vérifier le back/forward cache dans l’onglet Application.
- Mesurer l’effet exact du `auth.authStateReady()` sur un appareil lent.
- Vérifier la différence entre visite anonyme et visite connectée.
- Comparer le poids réseau avec et sans cache navigateur.

## Ordre conseillé des interventions

1. **Alléger les images critiques**
   - favicon
   - logo du header

2. **Réduire l’hydratation client du header**
   - ne pas bloquer le premier rendu sur Firebase Auth
   - limiter la lecture Firestore dans la zone publique

3. **Sortir le compteur d’étude du chemin critique**
   - découpler la donnée dynamique de la home
   - éviter le rendu non cacheable si la fraîcheur n’est pas indispensable

4. **Réduire le coût JS**
   - couper les dépendances client inutiles
   - revoir ce qui doit vraiment hydrater la page d’accueil

5. **Ajuster les effets visuels**
   - limiter les couches lourdes
   - vérifier le rendu mobile et la peinture

6. **Revalider les navigateurs**
   - Lighthouse
   - Performance trace
   - bfcache

## Conclusion

La page d’accueil `/` fonctionne, mais elle paie un coût technique disproportionné pour une page publique de première entrée :

- rendu dynamique systématique,
- gros bundles JS,
- header client Firebase,
- favicon trop lourd,
- logo de navigation trop lourd,
- effets visuels coûteux.

Le problème principal n’est pas la structure éditoriale. Le problème est l’empilement de coûts de chargement et d’hydratation au premier affichage.
