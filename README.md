# Klad (Клад)

Carnet de comptes personnel pour Android. *Klad*, prononcé « KLAT », veut dire « trésor enfoui ».

**État : prototype de faisabilité (étape 2).** Le prototype sert à vérifier, sur un vrai téléphone et de vraies banques :

- l'import d'une clé d'application Enable Banking (.pem PKCS#8, ou PKCS#1 converti automatiquement) ;
- la signature JWT RS256 dans l'appli ;
- la liste des banques, l'autorisation bancaire et le retour dans l'appli par `klad://eb` ;
- la lecture des comptes, des soldes et des opérations.

Aucune donnée personnelle n'est présente dans ce dépôt. Chaque utilisateur fournit sa propre application Enable Banking (production restreinte).

## Architecture du prototype

| Élément | Rôle |
|---|---|
| `www/` | Page de test (HTML/CSS/JS sans outil d'assemblage), intégrée à l'APK. `eb.js` = client Enable Banking, `app.js` = écran. |
| `site/` | Site GitHub Pages : présentation et `retour.html` (retour bancaire → `klad://eb?code=…&state=…`). |
| `scripts/prepare-android.mjs` | Déduit l'identifiant d'appli du compte GitHub et le nom du dépôt, ajoute le lien profond, numérote la version. |
| `scripts/version.mjs` | Étiquette de publication `v<version>` déduite de `package.json`. |
| `.github/workflows/android.yml` | Tests, fabrication Capacitor, signature de l'APK ; sur `main`, publication dans Releases quand la version change. Vérification sur chaque demande de fusion. |
| `.github/workflows/pages.yml` | Publication du dossier `site/` sur GitHub Pages. |
| `test/` | Tests sans réseau (clé, JWT, mise en forme). `npm test`. |

Le dossier `android/` n'est pas versionné : il est régénéré à chaque fabrication par `npx cap add android`.

Les appels à Enable Banking passent par CapacitorHttp (natif), donc sans restriction CORS. Dans un navigateur ordinaire, la page s'affiche mais les appels sont bloqués par CORS.

## Identifiants dérivés du compte GitHub

Pour un compte `<compte>` et un dépôt `<dépôt>` (`klad` par défaut) :

- site : `https://<compte>.github.io/<dépôt>/`
- **adresse de retour à déclarer chez Enable Banking** : `https://<compte>.github.io/<dépôt>/retour.html`
- identifiant d'appli : `io.github.<compte>.klad`, en minuscules, avec les tirets remplacés par `_`

Le nom du dépôt vient de `GITHUB_REPOSITORY` à la fabrication (ou `KLAD_REPO` en local) ; le site le lit dans sa propre adresse. Cas particulier : un dépôt nommé `<compte>.github.io` est publié à la racine (`https://<compte>.github.io/retour.html`).

## Mise en ligne

### 1. Dépôt

Le dépôt doit être **public**. Son nom est libre (`klad` conseillé) : il est déduit à la fabrication. Le code est poussé sur la branche `main`.

### 2. GitHub Pages

Dans *Settings › Pages › Build and deployment › Source*, choisir **GitHub Actions**. Le site est publié à chaque modification de `site/`.

### 3. Secrets de signature

Dans *Settings › Secrets and variables › Actions*, créer ces quatre secrets :

| Secret | Contenu |
|---|---|
| `KLAD_KEYSTORE_B64` | Fichier `.jks` encodé en base64, sur une seule ligne |
| `KLAD_KEYSTORE_PASSWORD` | Mot de passe du magasin |
| `KLAD_KEY_ALIAS` | Alias de la clé (`klad`) |
| `KLAD_KEY_PASSWORD` | Mot de passe de la clé |

Sans ces secrets, la fabrication produit seulement un APK *debug* (artefact de l'action), non publiable et non mis à jour.

> ⚠️ Conserver le fichier `.jks` et ses mots de passe hors du dépôt, dans un endroit sûr. Sans eux, impossible de publier une mise à jour installable par-dessus l'appli existante.

### 4. Publication

Automatique : changer `version` dans `package.json` (par exemple `0.1.0` → `0.2.0`), puis fusionner dans `main`. La fabrication voit que `v0.2.0` n'est pas encore publiée : elle crée l'étiquette et la publication dans *Releases*, avec l'APK signé. Sans changement de version, l'APK est fabriqué (artefact de l'action) sans être publié.

Ne pas créer de publication à la main dans *Releases*. Le site renvoie vers la dernière version (`releases/latest`, qui ignore les pré-versions).

## Utilisation du prototype

1. Dans le Control Panel Enable Banking, ajouter l'adresse de retour à l'application.
2. Installer l'APK.
3. Saisir l'identifiant d'application, choisir le `.pem`, puis **Enregistrer** et **Tester la clé**. Le test vérifie aussi que l'adresse de retour est bien déclarée.
4. **Charger** les banques du pays, puis **Connecter**. Après l'accord à la banque, le retour dans Klad crée la session.
5. **Récupérer** sur chaque compte. Le **journal** (sans montants ni libellés) peut être copié pour diagnostic.
6. En fin de test : **Déconnecter** chaque banque, puis **Tout effacer**.

⚠️ Prototype : la clé et les opérations sont stockées **sans chiffrement**. Le verrou (code, empreinte) et le chiffrement AES-GCM arrivent à l'étape 6.
