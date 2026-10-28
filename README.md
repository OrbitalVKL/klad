# Klad (Клад)

Carnet de comptes personnel pour Android. *Klad*, prononcé « KLAT », veut dire « trésor enfoui ».

**État : version 0.3.1 — modèle de données et reprise (Lot 3, correctif).** L'appli lit les comptes, soldes et opérations par Enable Banking
(clé .pem, signature JWT RS256, autorisation bancaire, retour par `klad://eb`). Toutes les données sont chiffrées sur le téléphone
(code à 6 chiffres ou empreinte, depuis la 0.2). Depuis la 0.3 : historique des opérations conservé et dédoublonné, récupération
automatique au déverrouillage, comptes nommés et typés, import de la reprise de l'ancienne version, interface en onglets.

Aucune donnée personnelle n'est présente dans ce dépôt. Chaque utilisateur fournit sa propre application Enable Banking (production restreinte).

## Architecture

| Élément | Rôle |
|---|---|
| `www/` | Interface (HTML/CSS/JS sans outil d'assemblage), intégrée à l'APK. `eb.js` = client Enable Banking, `anon.js` = anonymisation du journal, `format.js` = montants et dates à l'écran, `modele.js` = modèle de données (comptes, opérations, soldes, dédoublonnage, blocs, migration 0.2), `reprise.js` = import de la reprise, `sync.js` = récupération automatique, `coffre.js` = chiffrement des blocs, phrase de récupération, sauvegarde, chargement et migrations, `verrou.js` = verrou, premier lancement, sécurité, `maj.js` = mise à jour depuis l'appli, `vues.js` = rendu de l'accueil et des opérations, `app.js` = coquille (onglets, volets, synchro, banques et accès), `plus.js` = comptes et import de reprise. |
| `android/` | Projet Android versionné. Code Java dans le package fixe `app.klad` : `MainActivity` (FLAG_SECURE) et les plugins locaux `vault/KladVaultPlugin` (coffre), `update/KladUpdatePlugin` (mise à jour) et `reseau/KladReseauPlugin` (adresse IP du téléphone pour l'en-tête « utilisateur présent »). |
| `site/` | Site GitHub Pages : présentation et `retour.html` (retour bancaire → `klad://eb?code=…&state=…`). |
| `scripts/prepare-android.mjs` | Déduit l'identifiant d'appli du compte GitHub et le nom du dépôt, ajoute le lien profond, numérote la version. |
| `scripts/version.mjs` | Étiquette de publication `v<version>` déduite de `package.json`. |
| `.github/workflows/android.yml` | Demande de fusion : vérification légère (tests Node, parcours Chromium, compilation Java et tests JUnit). `main` : fabrication complète en un seul appel Gradle (tests JUnit, APK release, lint), signature, publication dans Releases quand la version change. Gradle en cache (`gradle/actions/setup-gradle`). |
| `.github/workflows/pages.yml` | Publication du dossier `site/` sur GitHub Pages. |
| `test/` | Tests sans réseau, données fictives (clé, JWT, centimes, modèle, dédoublonnage, frontière, reprise, synchro avec un faux client, migration 0.2, blocs chiffrés, phrase, sauvegarde, rendu, réglages Android) et parcours Chromium (`parcours.test.mjs`, sauté sans Playwright). `npm test`. Tests Java du coffre : `android/app/src/test` (`./gradlew testDebugUnitTest`). |

Le dossier `android/` est versionné (code natif). L'identifiant d'appli et la version n'y sont pas écrits : `prepare-android.mjs native` les place dans `android/klad.properties` (non versionné), lu par `android/app/build.gradle`.

Les appels à Enable Banking passent par CapacitorHttp (natif), donc sans restriction CORS. Dans un navigateur ordinaire, la page s'affiche mais les appels sont bloqués par CORS.

## Identifiants dérivés du compte GitHub

Pour un compte `<compte>` et un dépôt `<dépôt>` (`klad` par défaut) :

- site : `https://<compte>.github.io/<dépôt>/`
- **adresse de retour à déclarer chez Enable Banking** : `https://<compte>.github.io/<dépôt>/retour.html`
- identifiant d'appli : `io.github.<compte>.klad`, en minuscules, avec les tirets remplacés par `_`

Le nom du dépôt vient de `GITHUB_REPOSITORY` à la fabrication (ou `KLAD_REPO` en local) ; le site le lit dans sa propre adresse. Cas particulier : un dépôt nommé `<compte>.github.io` est publié à la racine (`https://<compte>.github.io/retour.html`).

## Sécurité des données

| Élément | Protection |
|---|---|
| Clé de données (DEK) | AES-256 aléatoire, créée une fois. Jamais écrite en clair. |
| Enveloppe « code » | DEK chiffrée (AES-GCM) par PBKDF2-HMAC-SHA256(code, sel aléatoire, itérations calibrées ≈ 0,5 s sur le téléphone), puis chiffrée de nouveau par une clé Android Keystore sans authentification, non exportable (StrongBox si disponible). Un fichier copié hors du téléphone ne permet donc pas d'essayer les codes. |
| Enveloppe « empreinte » (facultative) | DEK chiffrée par une clé Keystore exigeant une empreinte forte à chaque usage (BiometricPrompt + CryptoObject), invalidée si une empreinte est ajoutée au téléphone : retour au code, puis proposition de réactiver. |
| Codes faux | Délai après le 5ᵉ : 30 s, puis 1 min, 5 min, 15 min, 30 min, 1 h au plus. Compteur dans le coffre natif, augmenté avant chaque essai. Pas d'effacement automatique. |
| Données | Blocs chiffrés AES-GCM (`KLD` + version + IV 96 bits aléatoire ; nom du bloc en donnée associée) dans `noBackupFilesDir`. Le chiffrement se fait en JavaScript (WebCrypto) avec la DEK importée **non extractible** : les données sont de toute façon en clair en mémoire pour l'affichage, la clé ne traverse le pont natif qu'une fois par déverrouillage, et les tests vérifient le vrai code. |
| Verrou | Après 5 min en arrière-plan, ou par le bouton « Verrouiller » : écritures terminées, puis rechargement de la page (clé et données effacées de la mémoire). Un masque couvre l'écran dès le passage en arrière-plan. Un retour bancaire `klad://eb` reçu appli verrouillée est gardé en mémoire et traité après déverrouillage (`state` vérifié). |
| Téléphone | `allowBackup="false"` et règles d'extraction qui excluent tout ; `FLAG_SECURE` : pas de capture d'écran, aperçu masqué dans les applis récentes. |
| Lot 2 (préparé) | Emplacement d'une seconde clé Keystore sans authentification (`klad.resume`), pour un futur « résumé » lisible appli verrouillée. Non utilisée. |

### Modèle de données (0.3)

| Bloc chiffré | Contenu |
|---|---|
| `cle` | Identifiant et clé Enable Banking, adresse de retour. |
| `modele` | Comptes (id interne aléatoire, libellé, rôle `courant` / `carte_differee` / `paiement_en_ligne` / `epargne` / `commun`, source Enable Banking ou manuelle, rattachement d'une carte à débit différé, ordre, masqué), connexions bancaires, état de synchro, frontières de reprise, index des blocs d'opérations. |
| `soldes` | Dernier solde de chaque type par compte, historique quotidien. |
| `ops-<compte>-<année>` | Opérations d'un compte pour une année. Une synchro ne réécrit que les blocs changés (en pratique l'année en cours). |
| `carnet` | Réglages de l'ancienne version repris tels quels (pour les lots suivants). |
| `journal`, `sauvegarde` | Journal anonyme ; clé de sauvegarde tirée de la phrase. |

- **Montants** : centimes entiers signés, convertis depuis le texte de la banque sans virgule flottante. Le signe n'est jamais affiché : colonnes Débit / Crédit, « débiteur » pour un solde négatif.
- **IBAN** : jamais gardé en entier. Une empreinte salée (HMAC-SHA256, sel aléatoire dans le coffre) retrouve le compte d'une session à l'autre ; seuls les 4 derniers caractères sont affichés.
- **Identifiants** : `<compte>:r:<référence bancaire>` ; sans référence, empreinte (date, montant, libellé normalisé) + rang parmi les identiques du même jour.
- **En cours → comptabilisée** : même compte, même montant, dates à 4 jours au plus, libellés dont l'un prolonge l'autre ou partageant une référence (10 caractères au moins, dont un chiffre) ; on garde la comptabilisée. Deux libellés portant chacun des références différentes ne sont jamais fusionnés. Une opération en cours disparue est retirée 10 jours après sa date.
- **Récupération** : au déverrouillage si la dernière date de plus de 2 h, par la pastille de l'en-tête ou en tirant vers le bas. Par compte, depuis la dernière date comptabilisée − 5 jours, jamais avant la frontière de reprise ni après aujourd'hui (la plus longue période acceptée par la banque pour un nouveau compte). Les en-têtes « utilisateur présent » (`Psu-Ip-Address`, `Psu-User-Agent`, `Psu-Accept-Language`) sont envoyés s'ils couvrent ceux qu'exige la banque, sinon aucun ; l'adresse IP est celle du téléphone (aucun service tiers) ; s'ils sont refusés, un nouvel essai a lieu sans eux.
- **Accès bancaire** : alerte 14 jours avant expiration ; « Renouveler » relance l'autorisation auprès de la même banque et réassocie les comptes par leur empreinte.
- **Événement « données changées »** (`KladModele.surChangement`) : émis après une synchro, un import ou un réglage ; point d'accroche du futur résumé.
- **Migration 0.2 → 0.3** : au premier déverrouillage, les données 0.2 sont converties, écrites, relues et comparées ; l'ancien format n'est supprimé qu'ensuite. En cas d'échec, rien n'est effacé et la conversion est retentée au déverrouillage suivant.

### Import de la reprise (format `klad-reprise` v1)

Fichier JSON produit hors du dépôt depuis l'ancienne version, choisi par *Plus › Import de reprise* :

```json
{ "format": "klad-reprise", "v": 1, "created": "2026-11-01T10:00:00Z", "source": "carnet",
  "accounts": [ { "ref": "r0", "label": "COURANT", "role": "courant", "iban_last4": "1234" },
                { "ref": "r3", "label": "CARTE", "role": "carte_differee", "settle": { "account": "r0", "day": 5 } },
                { "ref": "r5", "label": "LIVRET", "role": "epargne", "manual": true, "balance": { "amount": 500000, "date": "2026-10-20" } } ],
  "transactions": [ { "account": "r0", "date": "2023-01-03", "amount": -1250, "label": "CB BOULANGERIE", "status": "comptabilisee" } ],
  "carnet": { } }
```

- Montants en centimes entiers signés ; `status` : `comptabilisee` (par défaut) ou `en_cours`. Champs facultatifs par opération : `id` (identifiant stable de l'ancienne version, 64 caractères au plus), `value_date`, `counterparty`.
- Aperçu (opérations et période par compte), association de chaque compte à un compte Klad (proposée d'après l'import précédent, la fin d'IBAN, puis le libellé ; sans correspondance : « Créer un compte manuel »), ou « ignorer » ; le nombre de comptes ignorés est signalé avant confirmation.
- **Frontière** : par compte, la reprise fait foi jusqu'à sa dernière date incluse. Les opérations Enable Banking d'avant cette date sont ignorées ; celles du jour même sont gardées, sauf si elles sont déjà dans la reprise (même jour, même montant, libellés compatibles, une pour une) : rien n'est perdu d'une journée d'export.
- **Rejouable** : un nouvel import remplace toutes les opérations de reprise.
- Fichier refusé avec un message qui ne cite que des numéros (« opération n° 12 : montant non entier »).

### Sauvegarde et phrase de récupération

Au premier lancement, Klad affiche une **phrase de récupération** : 24 caractères (120 bits aléatoires) en 6 groupes de 4, alphabet sans I, L, O, U. Elle est affichée une seule fois, à recopier sur papier, puis vérifiée par la ressaisie de 2 groupes.

La sauvegarde exportée (section *Sécurité › Exporter*, sélecteur de fichiers Android) est un fichier `.klad` chiffré par une clé tirée de cette phrase (PBKDF2-SHA256, 600 000 itérations ; sel, itérations et IV dans l'en-tête, format versionné). Elle n'est **pas** chiffrée par le code à 6 chiffres, trop court pour résister à des essais hors du téléphone. Un rappel s'affiche si le dernier export date de plus de 30 jours.

**Code oublié** : désinstaller l'appli, la réinstaller, choisir « Restaurer une sauvegarde » et saisir la phrase.

La sauvegarde contient tous les blocs sauf le journal ; une sauvegarde de la 0.2 reste restaurable (convertie à l'ouverture).

Au premier lancement de la 0.2, les données du prototype (stockées en clair) sont reprises, chiffrées, relues pour vérification, puis effacées.

## Mise à jour depuis l'appli

À chaque déverrouillage (et par *Application › Rechercher une mise à jour*), Klad lit la dernière publication du dépôt (`api.github.com/repos/<compte>/<dépôt>/releases/latest`, lecture anonyme). Si elle est plus récente, un bandeau propose **Mettre à jour** :

1. téléchargement de l'APK de la publication (adresse `https://github.com/…/releases/download/…` uniquement) ;
2. vérification de son empreinte SHA-256 avec celle publiée par GitHub, puis de l'APK : même identifiant d'appli, version plus récente, même certificat de signature ;
3. installation par le service d'installation d'Android, qui demande confirmation. Le coffre et les données sont conservés.

La première fois, Android demande d'autoriser Klad à « installer des applis inconnues » ; Klad ouvre ce réglage. Disponible à partir de la 0.2.1 (la 0.2.0 se met à jour à la main).

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

## Utilisation

1. Dans le Control Panel Enable Banking, ajouter l'adresse de retour à l'application.
2. Installer l'APK. Créer le code (deux saisies), recopier la phrase de récupération, activer l'empreinte si souhaité.
3. *Plus › Banques et accès* : saisir l'identifiant d'application, choisir le `.pem`, puis **Enregistrer** et **Tester la clé**. Le test vérifie aussi que l'application est active et que l'adresse de retour est bien déclarée.
4. **Charger** les banques du pays, puis **Connecter**. Après l'accord à la banque, le retour dans Klad crée la session et lance la première récupération.
5. *Plus › Comptes* : nommer et typer chaque compte (carte à débit différé : compte et jour de prélèvement), ajouter les comptes manuels, régler l'ordre, masquer.
6. *Plus › Import de reprise* : choisir le fichier de reprise, vérifier l'association des comptes, importer.
7. Ensuite, la récupération est automatique au déverrouillage (si la dernière date de plus de 2 h) ; la pastille de l'en-tête indique l'état (✓ heure, ↻, !) et relance une récupération ; tirer vers le bas fait de même. Le **journal** est anonyme (« Banque A · compte 1 », ni noms, ni montants, ni identifiants) et peut être copié pour diagnostic.
8. *Plus › Sauvegarde* et *Plus › Verrou* : exporter ou restaurer une sauvegarde, changer le code, activer ou désactiver l'empreinte, tout effacer.

Dans un navigateur ordinaire (`npm run serve`, après `KLAD_OWNER=<compte> node scripts/prepare-android.mjs web`), l'interface utilise un coffre de démonstration sans Keystore ni empreinte : données fictives uniquement. Un faux client Enable Banking (`window.KladFauxEB`, utilisé par le parcours Chromium) permet d'essayer la connexion et la synchro sans réseau.
