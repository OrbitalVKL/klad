# Klad (Клад)

Carnet de comptes personnel pour Android. *Klad*, prononcé « KLAT », veut dire « trésor enfoui ».

**État : version 1.0.0 (maintenance) — version complète : tous les réglages du complément se font dans Klad, sauvegarde vérifiée, nouvelle organisation de l'interface (Accueil, Opérations, Budget, Commun, Plus ; palettes Klad et Grafit), parité des fonctions avec l'ancienne version (`docs/parite-fonctions.md`), mode démo. Notes de version : `docs/NOTES.md`.** L'appli lit les comptes, soldes et opérations par Enable Banking
(clé .pem, signature JWT RS256, autorisation bancaire, retour par `klad://eb`). Toutes les données sont chiffrées sur le téléphone
(code à 6 chiffres ou empreinte, depuis la 0.2). Depuis la 0.3 : historique des opérations conservé et dédoublonné, récupération
automatique au déverrouillage, comptes nommés et typés, import de la reprise de l'ancienne version, interface en onglets.
Depuis la 0.4 : **lien Grafit** (facultatif) — Grafit Mobile, sur le même téléphone, lit un résumé de Klad (soldes, totaux,
alertes), même Klad verrouillé, sans réseau ni fichier partagé. Depuis la 0.5 : **classement** des opérations (catégories,
règles, corrections, repris de l'ancienne version), **opérations vues**, carte à débit différé (somme à prélever), paiements
en ligne comptés une seule fois, réassociation manuelle d'un compte, encart **« À vérifier »** sur l'accueil (et dans Grafit).

L'état du projet, les décisions en vigueur et les points d'appui du lot suivant sont tenus dans [`docs/ETAT.md`](docs/ETAT.md).

Aucune donnée personnelle n'est présente dans ce dépôt. Chaque utilisateur fournit sa propre application Enable Banking (production restreinte).

## Architecture

| Élément | Rôle |
|---|---|
| `www/` | Interface (HTML/CSS/JS sans outil d'assemblage), intégrée à l'APK. `eb.js` = client Enable Banking, `anon.js` = anonymisation du journal, `format.js` = montants et dates à l'écran, `modele.js` = modèle de données (comptes, opérations, soldes, dédoublonnage, blocs, migration 0.2), `reprise.js` = import de la reprise, `classement.js` = classement des opérations (catégories, règles, corrections, opérations vues, dette de carte, paiements en ligne), `carnet.js` = classement repris du carnet de l'ancienne version, `budget.js` = budget par cycle, reste à vivre, contrats, échéances, tendance (calculs), `commun.js` = compte commun (virements, trésorerie, appels de fonds, équilibre), `vbudget.js` = rendu de l'onglet Budget, `vcommun.js` = rendu du compte commun et de l'équilibre, `fisc.js` = impôt du foyer, taxe foncière, PEE, livret, `observations.js` = observations, résultats d'une période, répartition, `vfisc.js` et `ecranfisc.js` = écrans Impôts, Épargne, Observations, Résultats, `ecranbudget.js` = onglet Budget (navigation, édition), `sync.js` = récupération automatique, `coffre.js` = chiffrement des blocs, phrase de récupération, sauvegarde, chargement et migrations, `verrou.js` = verrou, premier lancement, sécurité, `maj.js` = mise à jour depuis l'appli, `controle.js` et `ecrancontrole.js` = relevé de contrôle (Plus › Contrôle, format `klad-controle` v1), `extras.js` = Plus › Extras (réglages, envois à Claude confirmés), `claude.js` = requêtes à l'API Claude et conversions, `mail.js` = tri des appels de fonds lus par mail, `lecturepdf.js` = texte d'un PDF (pdf.js embarqué dans `www/pdfjs/`, Apache-2.0), `ui.js` = interface commune (format des montants, pastilles de banques et de catégories, sections repliables mémorisées, préférences d'affichage, graduation des axes, calcul dans les champs de montant), `vaccueil.js` = rendu de l'onglet Accueil (0.10.1 : reste à vivre, à vérifier, soldes, cycle, commun, échéances), `vues.js` = rendu du haut de Commun, de la liste des opérations (blocs par jour, 0.10.6) (grande carte, cartes des comptes, « À voir », « À vérifier »), des opérations, du détail, du volet « Classer » et des relevés, `app.js` = coquille (onglets, volets, synchro, banques et accès, filtres, gestes, « Classer »), `plus.js` = comptes (carte, portefeuille, réassociation), import de reprise et réglages du classement, `resume.js` = résumé lu par Grafit (construction, écritures limitées aux changements), `grafit.js` = réglage « Lien Grafit », `icones.js` = banque d'icônes des catégories (0.10.7 : recherche en français, suggestions d'après le nom ; icônes « lu:<nom> »), `icones-donnees.js` = tracés des icônes Lucide choisies et leurs mots-clés (généré par `scripts/banque-icones.mjs`, licence ISC dans `www/licences/lucide.txt`), `selicone.js` = sélecteur d'icône et de couleur d'une catégorie (volet du bas), `diagaff.js` = diagnostic d'affichage (0.10.9, Plus › Aide et à propos : mesures de l'écran copiées, sans donnée personnelle), `affichage.js` = thème, palette et mode démo (balayage de l'écran, captures), `demo.js` = dictionnaire du mode démo (0.10.10 : libellés, catégories, postes, personnes, numéros remplacés par des noms génériques), `reglages.js` = réglages du complément dans Klad (1.0.0 : Plus › Réglages › Budget et › Complément, éditeur avancé, import du complément avec aperçu). |
| `www/style.css`, `www/polices/` | Apparence de l'ancienne version (Carnet v63–v65 sur téléphone), thèmes Auto / Clair / Sombre ; polices libres (Schibsted Grotesk, JetBrains Mono, licence OFL) embarquées, jamais chargées d'Internet. |
| `www/xlsx.js` | Lecture des classeurs Excel (.xlsx) pour l'import manuel d'un relevé (`releve.js`), sans bibliothèque ni réseau : ZIP lu à la main (entrées stockées ou compressées, décompression native), chaînes partagées, texte riche, formats de date (base 1900 et 1904). Refuse proprement les anciens .xls, les classeurs chiffrés ou binaires (.xlsb) ; tailles limitées contre les bombes ZIP. |
| `android/` | Projet Android versionné. Code Java dans le package fixe `app.klad` : `MainActivity` (FLAG_SECURE) et les plugins locaux `vault/KladVaultPlugin` (coffre), `update/KladUpdatePlugin` (mise à jour), `reseau/KladReseauPlugin` (adresse IP du téléphone pour l'en-tête « utilisateur présent »), `grafit/` (lien Grafit : `GrafitProvider`, plugin `KladGrafitPlugin`, contrôle de l'appelant `Appelant`, configuration `GrafitConfig`) et `mail/KladMailPlugin` (lecture seule d'une boîte IMAP, voir *Lecture des courriels*). |
| `tools/mesures/` | Mesures de la série UX (accessibilité, rapidité) sur un jeu fictif de 3 ans : `node tools/mesures/mesurer.mjs` ; mêmes fonctions reprises par `test/ux.test.mjs`. Code seulement, données fictives. |
| `tools/controle/` | Contrôle automatique Klad / ancienne version : relevé calculé par l'ancienne version (exécutée dans Chromium à date figée) et comparaison de deux relevés, rapport en français ; mode d'emploi et format dans `tools/controle/README.md`. Code seulement, aucune donnée. |
| `site/` | Site GitHub Pages : présentation, `retour.html` (retour bancaire → `klad://eb?code=…&state=…`) et `maquette/` (maquette cliquable de l'étude UX, données fictives). |
| `docs/ux/` | Étude UX : audit, nouvelle organisation proposée, plan de lots, captures (données fictives). |
| `docs/parite-fonctions.md` | Inventaire des fonctions de l'ancienne version (téléphone et ordinateur) et leur statut dans Klad (0.10.9). |
| `scripts/prepare-android.mjs` | Déduit l'identifiant d'appli du compte GitHub et le nom du dépôt, ajoute le lien profond, numérote la version. |
| `scripts/version.mjs` | Étiquette de publication `v<version>` déduite de `package.json`. |
| `scripts/banque-icones.mjs` | Régénère `www/icones-donnees.js` à partir de `lucide-static` (sélection d'environ 400 icônes, mots-clés français) ; aucun réseau à l'exécution de l'appli. |
| `scripts/icone.mjs` | Source unique de l'icône (К rouge sur noir) : régénère les ressources Android ; le même tracé sert au logo de l'appli et du site. |
| `.github/workflows/android.yml` | Demande de fusion : vérification légère (tests Node, parcours Chromium, compilation Java et tests JUnit). `main` : fabrication complète en un seul appel Gradle (tests JUnit, APK release, lint), signature, publication dans Releases quand la version change. Gradle en cache (`gradle/actions/setup-gradle`). |
| `.github/workflows/pages.yml` | Publication du dossier `site/` sur GitHub Pages. |
| `test/` | Tests sans réseau, données fictives (clé, JWT, centimes, modèle, dédoublonnage, frontière, reprise, réassociation, classement, carnet de l'ancienne version, synchro avec un faux client, migration 0.2, blocs chiffrés, phrase, sauvegarde, rendu, résumé Grafit, réglages Android) et parcours Chromium (`parcours.test.mjs`, `ux.test.mjs`, `champs.test.mjs` : champs et textes des cartes à 320–412 px et texte à 100–200 %, `debord.test.mjs` : rien hors de l'écran, `demo.test.mjs` : rien de réel à l'écran en mode démo, `reglages.test.mjs` et `sauvegarde.test.mjs` : réglages du complément, sauvegarde vérifiée et restauration ; sautés sans Playwright). `npm test`. Tests Java (coffre, lien Grafit) : `android/app/src/test` (`./gradlew testDebugUnitTest`). |

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
| Résumé Grafit | Chiffré (AES-GCM) par une seconde clé Keystore **sans authentification** (`klad.resume`) pour rester lisible appli verrouillée ; fichier dans `noBackupFilesDir`. Il ne contient que soldes, totaux et alertes (voir *Lien Grafit*). Supprimé si le lien est désactivé ; la clé est supprimée par « Tout effacer ». |

### Modèle de données (0.3)

| Bloc chiffré | Contenu |
|---|---|
| `cle` | Identifiant et clé Enable Banking, adresse de retour. |
| `modele` | Comptes (id interne aléatoire, libellé, rôle `courant` / `carte_differee` / `paiement_en_ligne` / `epargne` / `commun`, source Enable Banking ou manuelle, rattachement d'une carte à débit différé, ordre, masqué), connexions bancaires, état de synchro, frontières de reprise, index des blocs d'opérations. |
| `soldes` | Dernier solde de chaque type par compte, historique quotidien. |
| `ops-<compte>-<année>` | Opérations d'un compte pour une année. Une synchro ne réécrit que les blocs changés (en pratique l'année en cours). |
| `carnet` | Réglages de l'ancienne version repris tels quels (classement repris au Lot 5 ; budget et suivants aux lots suivants). |
| `classement` | Catégories (nature, icône), règles de base, règles de l'utilisateur, compte rendu de l'import du carnet (0.5). |
| `budget` | Budget par périmètre (postes `f|`, `c|`, `r|`, `m|` : montant, périodicité, part du commun), base de calcul, contrats, virements permanents, réglages du cycle (0.6) ; appels de fonds, équipements de l'équilibre (0.7, `v` = 2) ; impôts, taxe foncière, PEE, livret, points « fait » (0.8, `v` = 3). |
| `journal`, `sauvegarde` | Journal anonyme ; clé de sauvegarde tirée de la phrase. |

- **Montants** : centimes entiers signés, convertis depuis le texte de la banque sans virgule flottante. Le signe n'est jamais affiché : colonnes Débit / Crédit, « débiteur » pour un solde négatif.
- **IBAN** : jamais gardé en entier. Une empreinte salée (HMAC-SHA256, sel aléatoire dans le coffre) retrouve le compte d'une session à l'autre ; seuls les 4 derniers caractères sont affichés.
- **Identifiants** : `<compte>:r:<référence bancaire>` ; sans référence, empreinte (date, montant, libellé normalisé) + rang parmi les identiques du même jour.
- **En cours → comptabilisée** : même compte, même montant, dates à 4 jours au plus, libellés dont l'un prolonge l'autre ou partageant une référence (10 caractères au moins, dont un chiffre) ; on garde la comptabilisée. Deux libellés portant chacun des références différentes ne sont jamais fusionnés. Une opération en cours disparue est retirée 10 jours après sa date.
- **Récupération** : au déverrouillage si la dernière date de plus de 2 h, par la pastille de l'en-tête ou en tirant vers le bas. Par compte, depuis la dernière date comptabilisée − 5 jours, jamais avant la frontière de reprise ni après aujourd'hui (la plus longue période acceptée par la banque pour un nouveau compte). Les en-têtes « utilisateur présent » (`Psu-Ip-Address`, `Psu-User-Agent`, `Psu-Accept-Language`) sont envoyés s'ils couvrent ceux qu'exige la banque, sinon aucun ; l'adresse IP est celle du téléphone (aucun service tiers) ; s'ils sont refusés, un nouvel essai a lieu sans eux.
- **Accès bancaire** : alerte 14 jours avant expiration ; « Renouveler » relance l'autorisation auprès de la même banque et réassocie les comptes par leur empreinte.
- **Classement (0.5)** : voir *Classement des opérations* ci-dessous. Sur chaque opération : `categorie` (correction ponctuelle
  `{ cat, sub }`) et `vue` (`true` vue, `0` remise en non vue, sinon d'après la date de départ `modele.vues.depuis`).
- **Événement « données changées »** (`KladModele.surChangement`) : émis après une synchro, un import, un réglage ou une connexion, regroupé sur 300 ms ; le résumé Grafit s'y abonne.
- **Migration 0.2 → 0.3** : au premier déverrouillage, les données 0.2 sont converties, écrites, relues et comparées ; l'ancien format n'est supprimé qu'ensuite. En cas d'échec, rien n'est effacé et la conversion est retentée au déverrouillage suivant.
- **Migration 0.9.3** (`www/migrations.js`) : au premier déverrouillage, ce qui manquait de l'import de l'ancienne
  version jusqu'à la 0.9.2 (`_payload` non lu) est complété : règles de base et catégories absentes, postes de budget et
  mois de revenu prévu absents (rien de ce qui a été modifié dans Klad n'est écrasé), crédits de règlement des cartes
  retirés ; puis reclassement, calculs et résumé Grafit refaits. Idempotente (marque `modele.migrations.payload`),
  réversible (état d'avant gardé), testée en sautant des versions. *Plus › Contrôle* affiche l'état de l'import
  (règles de base, postes de budget, mouvements d'équilibre) pour repérer un import incomplet.

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
- **Rejouable** : un nouvel import remplace toutes les opérations de reprise. Un compte repris au dernier import et
  « ignoré » cette fois est signalé avant confirmation (ses opérations de reprise vont disparaître) ; s'il est bancaire,
  Klad propose de relire tout son historique bancaire à la synchro suivante.
- **Carnet** : s'il contient de quoi classer, le classement est repris tout de suite (voir ci-dessous). Les données figées
  de l'ancienne version (règles de base, budgets par défaut, revenu prévu, mouvements et équipements de l'équilibre) sont
  lues sous `P`, `payload` ou `_payload` (forme du fichier de reprise).
- Fichier refusé avec un message qui ne cite que des numéros (« opération n° 12 : montant non entier »).

### Classement des opérations (0.5)

Aucune règle ni aucun mot-clé propre à l'utilisateur dans le code : règles, enseignes et motifs de libellé sont des données,
reprises du carnet de l'ancienne version ou créées dans Klad (bloc chiffré `classement`).

- **Catégories** : nom, nature (`fixe`, `courante`, `optionnelle`, `revenu`, `interne`, plus `epargne` et `hors_budget`
  pour reproduire l'ancienne version), icône. Le type d'une opération (dépense, revenu, interne, épargne, hors budget) vient
  de la nature de sa catégorie, ou du type d'une règle de base.
- **Priorité** (celle de l'ancienne version) : correction ponctuelle de l'opération ; règle de l'utilisateur (le mot-clé
  le plus long contenu dans le libellé, sans casse ni accents ; compte et sens facultatifs) ; règles de base, dans l'ordre
  (motif, comptes, sens ; une carte ou un portefeuille est vu à travers son compte de prélèvement) ; défaut
  (« Autres › Non classé », « Autres revenus », achats d'une carte). Puis, sur un compte courant ou commun :
  - **règlement de carte** (motif réglé dans la fiche de la carte) daté dans la période couverte par le détail de la carte
    (jusqu'à 45 jours après sa dernière opération) → interne ;
  - **prélèvement d'un portefeuille** (motif réglé dans sa fiche) dont le montant se retrouve dans son détail, de 2 jours
    avant à 7 jours après → interne. La dépense comptée est celle du portefeuille, avec le vrai marchand. La recherche porte
    sur tous les comptes courants et commun ; le rattachement « prélevé sur » est facultatif.
- **Non classée** : classement par défaut (ou catégorie « Autres »). « À vérifier » compte celles des 90 derniers jours.
- **Opérations vues** : point bleu, pastille sur l'onglet, filtre « Non vues », « Tout marquer vu » (annulable). Gestes :
  glisser à droite = vue / non vue, à gauche = « Classer » ; les mêmes actions sont dans le détail de l'opération (appui).
- **Filtres des opérations (0.9.4)** : « Internes » (virements entre comptes et règlements détaillés ailleurs, comptés
  automatiquement ou marqués à la main : toujours visibles dans la liste, étiquette « interne », jamais comptés dans le
  budget) ; période (toute période, cycle en cours ou précédent, ce mois-ci, mois précédent, 30 derniers jours, 12 derniers
  mois, personnalisée par le sélecteur de dates du téléphone), combinable avec compte, catégorie, non vues, non classées,
  internes et recherche ; pastille de la période avec une croix, totaux débit / crédit de la sélection en bas de la liste.
  La période est gardée tant que l'appli reste ouverte (« Toute période » au démarrage).
- **Marquer interne** (prélèvement de portefeuille à rapprocher) : l'opération reste dans la liste (filtre « Internes »),
  son détail porte « marquée interne à la main » et « Annuler : compter en dépense » (annulable), qui la remet dans
  « À vérifier ».
- **Volet « Classer »** : catégories les plus utilisées (dépenses des 150 derniers jours), sous-catégorie, « Classer aussi
  les autres » (mot-clé proposé, nombre d'opérations concernées, compte et sens facultatifs), un seul bouton ; annulable.
- **Carte à débit différé** : dette = opérations de la carte après le dernier règlement débité sur son compte de
  prélèvement (sans rattachement : sur un compte courant ou commun), hors remboursements (motif facultatif) ; jamais
  négative. Accueil : « à prélever le JJ/MM » (jour du prélèvement) ; le total des comptes courants déduit la dette.
  Date de dépense : date de paiement lue dans le libellé (« CARTE JJ/MM … », « PAIEMENT CB JJMM … »), affichée dans le détail.
  Crédits de règlement sur la carte ou le portefeuille (« prélèvement automatique … merci », « paiement reçu ») : écartés
  à l'import, comme dans l'ancienne version, selon le motif « remboursements » de la fiche du compte (pré-rempli par le
  complément) ; sans motif, rien n'est écarté.
- **Réassociation manuelle** (*Plus › Comptes*, compte « à réassocier ») : un compte bancaire disponible est fusionné dans
  le compte : opérations (identifiants refaits, sans doublon), soldes et source bancaire.

**Import du carnet** (format de l'ancienne version, bloc `carnet` de la reprise, racine ou objet `state`) :
`cats` (`custom` : natures, `icons`, `renamed`, `removed`), `P.rules` (règles de base `[motif, type, catégorie,
sous-catégorie, noms de comptes]`), `rules` (`{ kw, cat, sub }`), `singles` et `seen` (`cut`, `k`) indexés par la clé
d'opération de l'ancienne version. Une clé est retrouvée par l'identifiant stable de la reprise
(`k` + SHA-256(clé) sur 20 caractères hexadécimaux + `.` + rang : tous les rangs) ou, pour une opération venue de la banque
après la reprise, par la clé recalculée. Les catégories renommées au fil des versions de l'ancienne version sont suivies.
Extension facultative `klad` (dans le carnet, ou par un fichier `{ "format": "klad-complement", "v": 1, "klad": { … } }`
importé dans *Plus › Classement*) : `regles` (règles de base supplémentaires, en tête), `bars` (motif qui sépare bars et
restaurants), `comptes` (noms de comptes de l'ancienne version, rang = référence `r<rang>`), `cartes` et `portefeuilles`
(`{ "r3": { "motif": "…", "remboursements": "…" } }`). Sans motif de règlement, Klad le déduit des règles de base
« à détailler », sinon il reste à choisir dans la fiche du compte (débits récurrents proposés).

### Budget, reste à vivre, contrats (0.6)

Calculs identiques à l'ancienne version (parité mesurée hors du dépôt, sur le cycle en cours et 3 cycles passés) ; aucun nom
d'employeur, de personne ou de banque dans le code : ce sont des données (carnet, complément, réglages de Klad).

- **Périmètres** : *Perso* (comptes courants, cartes à débit différé, paiements en ligne) et *Commun* (compte commun).
- **Cycle** : perso = du dernier salaire reçu à la veille du même jour le mois suivant (prolongé jusqu'à aujourd'hui si le
  salaire suivant est en retard). Salaire = opération de catégorie *Salaire* sur un compte perso ; critères facultatifs en
  données (`klad.salaire` du complément : `compte`, `motif`, `paie`, `min`, `minCycle`, `ecart`) : le cycle en cours part du
  dernier crédit du compte qui contient le motif et (le mot de paie ou au moins `min` €) ; à défaut, du dernier salaire. Un
  salaire ouvre un nouveau cycle s'il arrive au moins `ecart` jours (15) après le précédent. Sans salaire : mois civil.
  Commun : mois civil. Navigation ◀ ▶, cycles passés en lecture.
- **Postes** : charges fixes par sous-catégorie, dépenses courantes et optionnelles par catégorie ; budget = montant du
  poste (une charge trimestrielle ou annuelle ne compte que le cycle où elle est prélevée ; au commun elle est provisionnée
  chaque mois) ; utilisé = opérations de la période, paiements carte à leur date de paiement ; réel habituel sur la base de
  calcul (moyenne pour les charges fixes, médiane des mois pour les autres, 12 derniers mois ÷ 12 pour un poste non
  mensuel). *Hors budget* = postes sans budget. Virements internes, épargne et natures `hors_budget` exclus.
- **Revenus** : salaire attendu (moyenne des 3 derniers mois, dernier salaire ou montant libre), autres revenus saisis ;
  commun : apports attendus de chaque personne selon la répartition des postes (`klad.commun` : `moi`, `autre`).
  Le poste perso *Contribution compte commun* vaut ma part du budget commun.
- **Reste à vivre** (perso, cycle en cours) : colonne *dernier salaire* = salaire du cycle − charges fixes prélevées −
  variable dépensé ; colonne *comptes courants* = soldes des comptes courants − charges fixes encore à venir − reste du
  budget variable.
- **Contrats** : montant du document, périodicité, dernier prélèvement trouvé (motif), écart, prochaine échéance.
  **Échéances sur 31 jours** : contrats, prélèvements récurrents détectés (même compte, mêmes premiers mots, au moins 2 des
  3 derniers mois, montants proches), dette des cartes au jour du prélèvement.
- **Tendance** : dépenses des 12 derniers cycles (ou mois) par nature, ou pour une catégorie avec son budget.
- **Import** : `bplan` (ou `budgets` et `fixedPrefs`), `budgetRef`, `revprev`, `contrats`, `virements` du carnet, au
  premier déverrouillage de la 0.6 ou à l'import d'une reprise ; le carnet reste intact.
- **Portefeuille** : un prélèvement sans opération de même montant dans le détail (période couverte par le détail) reste une
  dépense, apparaît dans « À vérifier » (« n prélèvement(s) de portefeuille à rapprocher ») et peut être marqué interne
  depuis son détail (annulable).

### Compte commun et équilibre des apports (0.7)

Calculs identiques à l'ancienne version (parité mesurée hors du dépôt : trésorerie sur 12 mois, d'où vient le solde,
virements, fin de mois, appels de fonds, équilibre). Noms des deux personnes, motifs de libellé (virements de l'autre
personne, syndic, prêteurs), apports initiaux, historique de l'équilibre et équipements : données (`klad.commun`,
`klad.appels`, `klad.equilibre` du complément, ou `appels`, `eq`, `eqItems`, `P.eqops`, `P.equip` du carnet).

- **Budget › Commun** (mois en cours) : *marge réelle* (solde − charges fixes à venir − reste du budget variable, avec les
  virements attendus), *fin de mois estimée* (solde − prélèvements mensuels des contrats pas encore passés − impôts du mois
  + virements attendus − réserve pour échéances ; découvert signalé), *virements* (par personne : en place, demandé par le
  budget selon « ma part » de chaque poste et par usage, reçu ou non ce mois ; *virement ponctuel* si un découvert est
  prévu, réparti au prorata des charges non mensuelles), *trésorerie sur 12 mois* (virements à leur jour, prélèvements
  mensuels au jour du dernier prélèvement et au montant du contrat, échéances trimestrielles, impôts prélevés : solde de
  fin de mois et point bas), *appels de fonds* (chaque virement règle l'appel le plus ancien ; reste à payer ; comparaison
  au relevé du syndic), *d'où vient le solde* (depuis le début des virements actuels, poste par poste).
- **Impôts** : prélèvements de l'administration fiscale sur le commun (prélèvement à la source jusqu'à 11 mois, solde
  étalé jusqu'en décembre) ; le poste « Impôts » du budget ne sert alors qu'à la répartition (pas de double comptage).
- **Ordres permanents** : liste tenue dans Klad (qui, libellé, montant, jour, usage), modifiable et annulable.
- **Équilibre des apports** (bouton *Équilibre*) : investi par chacun = apport initial + versements − part des charges
  qui ne comptent pas (réparties selon la répartition des postes non éligibles) + équipements payés en direct (cochés) ;
  reste à combler, qui doit combien de plus, rattrapage par mois (postes « équilibre »), date d'équilibre, simulation
  (ajout mensuel, versement ponctuel), mouvements par sorte.

### Impôts, épargne, observations, résultats (0.8)

Calculs identiques à l'ancienne version (parité mesurée hors du dépôt). Le barème légal est dans le code ; avis
d'impôt, bulletins de paie déjà lus, hypothèses, logement, plan d'épargne et livret sont des données (`fisc`, `tf`,
`pee`, `livret`, `dismiss` du carnet ; `klad.fisc`, `klad.tf`, `klad.pee`, `klad.livret`, `klad.observations` du complément).

- **Plus › Impôts** : impôt sur le revenu du foyer (déclaration commune, 2 parts) par année — avis (recalculé et comparé)
  ou estimation de l'année en cours (bulletins lus, projection jusqu'à décembre, acomptes prélevés sur le commun, taux du
  foyer) ; solde ou remboursement ; régularisations entre les deux personnes (règle de partage au choix : impôt de chacun
  seul, taux individualisés, prorata des revenus) ; calcul détaillé ; hypothèses modifiables (annulables) ; avis et
  barèmes. **Taxe foncière** : estimation par année (base, exonération des premières années, revalorisation), avis saisis,
  paiement retrouvé sur le commun, part de chacun, déclaration H2.
- **Plus › Épargne** : livret (solde saisi + virements repérés depuis), plan d'épargne entreprise (encours, versements,
  abondement, plus-value, rendement annuel, conseils ; fonds, versements et règle d'abondement saisis dans Klad).
- **Plus › Observations** (et « À vérifier » sur l'accueil) : points à faire et observations, perso et commun —
  charges récurrentes sur un compte secondaire, relevés en retard, virements du commun et échéance du prêt, contrat
  résilié encore prélevé, prélèvement mensuel absent, appels de fonds, portefeuille détaillé, opérations à classer,
  contrats au-dessus du budget, virement ponctuel, ordres à modifier, virements reçus, budget dépassé, balance sur 3 mois,
  impôts, taxe foncière, régularisations, salaire. « C'est fait » masque un point jusqu'à ce que la situation se reproduise.
- **Budget › Résultats** : bilan du cycle (ou du mois) précédent ou de la période affichée — revenus, sections, hors
  budget, solde, épargne réalisée, plus gros écarts — et répartition des dépenses (par nature, par catégorie).
- Pas de lecture de mail, de Drive ni d'analyse par Claude (bulletins, avis, appels de fonds) : Lot 9.

### Écarts comblés (0.8.1)

- **Budget › Contrats** : ajout, modification et suppression d'un contrat (libellé, montant du document, périodicité, mot
  du libellé bancaire, poste — deviné d'après le libellé, ou nouveau poste fixe —, source, note), annulables ; « Prévu du
  poste et contrats » compare le budget de chaque poste au total mensuel de ses contrats, « → prévu » l'y aligne.
- **Budget › Base de calcul** (en bas du cycle en cours) : mois de début du réel habituel (par défaut les 6 derniers mois
  complets) et « Tout aligner sur le réel habituel », annulables.
- **Plus › Affichage** : thème automatique, clair ou sombre (gardé sur le téléphone, hors coffre ; appliqué avant le premier
  affichage par `www/theme.js` ; la WebView n'assombrit jamais la page d'elle-même ; barres d'état et de navigation
  accordées par le plugin natif `KladAffichage`) ; mode démo (montants
  multipliés par un facteur pris au hasard, noms des personnes et des banques remplacés, champs de saisie floutés ; en
  mémoire seulement, rien n'est modifié).
- **Plus › Comptes › (compte manuel) › Importer un relevé** : fichier CSV (relevé bancaire, relevé de carte, historique de
  paiement en ligne, selon le rôle du compte ; lecture de l'ancienne version) ou JSON (`[{ date, label, amount }]` ou
  opérations Enable Banking) ; opérations déjà présentes ignorées ; import annulable. Fichiers en UTF-8 ou Windows-1252.

### Interface de l'ancienne version (0.9)

- **Apparence** identique à l'ancienne version sur téléphone : feuille de style d'origine, thèmes Auto / Clair / Sombre
  (bouton ☀ / ☾ de l'en-tête), polices embarquées, sections repliables dont l'état est gardé sur le téléphone,
  animations coupées si le téléphone demande moins d'animations.
- **Onglets** : Budget (grande carte, cartes des comptes, « À voir », « À vérifier », observations, reste à vivre,
  budget mensuel en mode Suivi ou Budget, tendance, contrats, catégories, règles), Opérations (par jour, recherche,
  puces de filtre, gestes : vers la droite = vue, vers la gauche = Classer), Commun (virements à mettre en place, appels
  de fonds, trésorerie sur 12 mois, d'où vient le solde, marge réelle, budget du commun), Plus (Équilibre, Impôts,
  Épargne, Relevés et sauvegarde, puis les réglages de Klad).
- **Montants** : jamais de signe moins ; débit sans signe, crédit précédé de « + », solde négatif suivi de « débiteur »,
  graduations sous zéro en rouge. Les champs de montant acceptent un calcul (« 29,99+64 », « =566,19/3 »).
- **Données propres au propriétaire** (jamais dans le code) : pastilles de banques (`klad.pastilles`), couleurs de
  catégories (`klad.couleurs`), nom de la résidence et du syndic (`klad.appels.titre`, `klad.appels.syndic`) dans le
  complément.
- **Icône** (0.9.3) : К cyrillique à empattements, bras courbe terminé par une goutte, rouge sur noir (couleurs de
  l'icône de Grafit) ; icône adaptative (avant-plan, fond, monochrome pour les icônes à thème d'Android 13 et plus),
  ronde, écran de démarrage, logo de l'appli (verrou, masque) et du site. Source unique : `scripts/icone.mjs`.
  L'identifiant d'appli et la signature ne changent pas.

### Relevé de contrôle (0.9.1)

- **Plus › Contrôle › Exporter le relevé de contrôle** : fichier `klad-controle-AAAAMMJJ-HHMM.json` enregistré par le
  sélecteur Android (Drive compris), après confirmation (« fichier personnel en clair, à supprimer après le contrôle »).
  Il reprend les chiffres affichés au centime : comptes, reste à vivre, budget du cycle en cours et précédent, compte
  commun, équilibre, contrats et échéances, impôts, observations, « À vérifier », résumé Grafit, et l'empreinte des
  opérations d'entrée (par cycle et par mois du commun). Ni IBAN, ni clé, ni journal.
- **`tools/controle/`** : le même relevé calculé par l'ancienne version, puis la comparaison point par point avec un
  diagnostic (« données d'entrée différentes » ou « même entrée, calcul différent »).

### Extras (0.9.2)

Fonctions facultatives de *Plus › Extras*, **désactivées par défaut** ; désactivée, une fonction n'affiche ni bouton ni
écran. Secrets (mot de passe d'application, clé Claude) **saisis dans l'appli** et chiffrés dans le bloc `cle` du coffre,
comme la clé Enable Banking : jamais dans les secrets GitHub, jamais dans le journal (`KladAnon.scrub` masque aussi les
clés `sk-ant-…` et les adresses e-mail), compris dans la sauvegarde chiffrée.

- **Mail** (appels de fonds) : boîte de réception lue par le plugin `KladMail` (voir *Lecture des courriels*), en lecture
  seule. Expéditeurs, mots-clés et motifs propres au propriétaire (nommage des pièces, copropriétés) sont des données :
  réglages de l'extra, pré-remplis par le complément (`klad.mail`). Chaque courriel retenu donne un appel
  (`S.budget.appels.mails` : date d'exigibilité, nature, copropriété) et le total lu dans son PDF (`appels.pdfs`), au format
  de l'ancienne version ; seuls les courriels nouveaux sont ajoutés, et « Annuler » rétablit l'état d'avant. Bouton
  « Lire les mails » dans Commun › Appels de fonds.
- **Claude** : appels directs à l'API (`anthropic-version: 2026-10-21`, aucune bibliothèque) avec la clé du propriétaire,
  facturés sur ses crédits API. Modèle au choix : Claude Opus 5.5 (par défaut), Sonnet 5.5, Haiku 5.5 ; repli serveur
  (`fallbacks: "default"`) si un modèle refuse (Opus et Sonnet). Usages :
  - **lire un bulletin de paie, un avis d'impôt, un appel de fonds** (PDF choisi par le sélecteur Android, Drive
    compris ; 20 Mo au plus) : réponse en JSON strict (`output_config.format`), convertie au format de Klad
    (`fisc.bs`, `fisc.avis`, `appels.pdfs`), affichée pour vérification puis enregistrée (annulable) ;
  - **Analyse de Claude** (Budget, Commun, Impôts) : seulement des agrégats (totaux, postes, soldes calculés, tendance
    sur 6 mois) ; ni opération, ni libellé bancaire, ni compte, ni IBAN ; les deux personnes du foyer sont « personne A »
    et « personne B ». Le texte de l'analyse reste en mémoire pour la session.
  - **Avant chaque envoi** : aperçu exact de ce qui part et coût estimé (jetons d'entrée comptés par l'API, gratuitement) ;
    **après** : coût réel (jetons envoyés et reçus). Erreurs en phrases fixes (clé refusée, crédits épuisés, refus…).
- Tests sans réseau : faux serveur Anthropic et faux plugin `KladMail` dans le parcours Chromium, PDF fictifs fabriqués
  par Chromium.

### Sauvegarde et phrase de récupération

Au premier lancement, Klad affiche une **phrase de récupération** : 24 caractères (120 bits aléatoires) en 6 groupes de 4, alphabet sans I, L, O, U. Elle est affichée une seule fois, à recopier sur papier, puis vérifiée par la ressaisie de 2 groupes.

La sauvegarde exportée (section *Sécurité › Exporter*, sélecteur de fichiers Android) est un fichier `.klad` chiffré par une clé tirée de cette phrase (PBKDF2-SHA256, 600 000 itérations ; sel, itérations et IV dans l'en-tête, format versionné). Elle n'est **pas** chiffrée par le code à 6 chiffres, trop court pour résister à des essais hors du téléphone. « Vérifier une sauvegarde » (1.0.0) ouvre un fichier avec la phrase et compare chaque bloc aux données actuelles, sans rien remplacer. Un rappel s'affiche tant qu'aucune sauvegarde n'est vérifiée, puis 30 jours après la date du fichier vérifié.

**Code oublié** : désinstaller l'appli, la réinstaller, choisir « Restaurer une sauvegarde » et saisir la phrase.

La sauvegarde contient tous les blocs sauf le journal (clés Enable Banking et Claude, mot de passe de messagerie, complément et réglages compris), plus le thème et la palette ; une sauvegarde de la 0.2 reste restaurable (convertie à l'ouverture).

Au premier lancement de la 0.2, les données du prototype (stockées en clair) sont reprises, chiffrées, relues pour vérification, puis effacées.

## Lien Grafit

Grafit Mobile (`fr.orbitalvkl.grafit`), installé sur le même téléphone, lit un résumé de Klad : sans réseau, sans fichier
partagé, même Klad verrouillé. Réglage *Plus › Modules › Lien Grafit*, **désactivé par défaut**.

- **Accès** : `content://<identifiant d'appli>.grafit/summary` (`GrafitProvider`), en lecture seule. Le provider est exporté
  sans permission (Grafit est une autre appli) et sans délégation d'accès (`grantUriPermissions="false"`). Au début de chaque
  lecture, il contrôle l'appelant : l'UID appelant (`Binder.getCallingUid()`) doit être celui de `fr.orbitalvkl.grafit`, signé
  par le certificat d'empreinte SHA-256 `D3FB8A67…BE5E82FC` (`hasSigningCertificate`) ; sinon `SecurityException`. Paquet et
  empreinte sont regroupés dans `GrafitConfig` (ce ne sont pas des secrets : ils figurent dans tout APK de Grafit).
  `insert`, `update` et `delete` sont refusés. Aucun autre composant n'est exporté que l'activité principale.
- **Réponse** : une ligne, colonnes `v` (1), `updated_at` (ms) et `json` (moins de 32 Ko). Sans résumé : `{"v":1,"state":"empty"}`.
  Le provider ne calcule rien et ne lance jamais de synchro : il relit le dernier résumé enregistré ; Grafit juge la fraîcheur
  d'après `generated` et `statement_at`.
- **Écriture** : après une synchro, un import, un réglage, un classement, une opération vue ou une connexion, au déverrouillage et à chaque retour au premier plan,
  seulement si le résumé a changé (à `generated` près). Grafit est prévenu (`notifyChange`). Désactiver le lien, « Tout
  effacer » ou créer un nouveau coffre efface le résumé.

Résumé v1 (palier du Lot 4), montants en euros, dates `AAAA-MM-JJ`, instants en ms ; un champ impossible à calculer est omis :

```json
{ "v": 1, "state": "ok", "generated": 1793260800000, "statement_at": 1793257200000,
  "accounts": [ { "id": "a1b2c3d4", "label": "COURANT", "kind": "current", "balance": 1234.56, "available": 1200.00, "as_of": "2026-10-28", "stale": false },
                { "id": "e5f6g7h8", "label": "LIVRET", "kind": "savings", "balance": 5000.00, "manual": true, "as_of": "2026-10-20" } ],
  "total": { "all": 6234.56, "savings": 5000.00 },
  "alerts": [ { "level": "info", "code": "STALE", "text": "COURANT · 2 J" } ] }
```

- `accounts` : comptes visibles, dans l'ordre de Klad ; `id` interne (8 caractères) ; `label` en majuscules sans accents,
  sans numéro (un compte encore « à vérifier » reçoit un libellé générique : son libellé peut venir de la banque) ;
  `kind` : `current` (courant, commun), `card` (carte à débit différé), `wallet` (paiement en ligne), `savings` (épargne) ;
  `balance` = solde affiché, `available` = solde disponible s'il diffère ; `as_of` = date de référence du solde (sinon date
  de lecture) ; `stale` = relevé de plus de 30 h ; `manual` pour un compte manuel. Carte à débit différé : pas de solde brut ;
  `due` = somme à prélever (positive) et `due_since` = date du dernier règlement, si le motif du règlement est connu (0.5).
- `total` : `savings` = comptes épargne ; `all` = courants, commun et épargne, moins la dette des cartes à débit différé
  visibles. Un total dont un compte n'a pas de solde (ou une carte pas de dette) connu est omis ; les comptes hors euros ne
  sont pas comptés.
- `main_after_card` (0.5) : solde du compte de prélèvement de la première carte à débit différé visible, moins sa dette.
- `attention` (0.5) : `{ "unseen": n, "unclassified": n, "accounts_to_check": n, "backup_days": n }` — opérations à voir,
  non classées des 90 derniers jours, comptes à vérifier ou à réassocier, jours depuis la dernière sauvegarde exportée ;
  chaque champ est omis s'il est nul ou inconnu.
- `statement_at` : fin de la dernière lecture réussie, tous comptes confondus.
- `alerts` (textes courts en majuscules, sans montant), triées `crit`, `caut`, `info` : `NEGATIVE_BALANCE` (`crit`, compte
  courant ou commun débiteur), `BANK_CONSENT_EXPIRING` (`caut`, `crit` à 3 jours ou moins ou expiré, « LIBELLÉ · n J »),
  `SYNC_FAILED` (`caut`, dernière lecture en erreur), `STALE` (`info`, « LIBELLÉ · n J ») ; depuis la 0.5 :
  `ACCOUNT_CHECK` (`caut`, « n COMPTES À VÉRIFIER »), `TO_REVIEW` (`info`, « n OPÉRATIONS À VOIR »), `BACKUP_DUE`
  (`info`, « SAUVEGARDE · n J » à partir de 30 jours, « SAUVEGARDE · JAMAIS »), `UPDATE_AVAILABLE` (`info`, « KLAD x.y.z »).
  Grafit affiche un code inconnu par son seul texte.
- Jamais : IBAN ni fin d'IBAN, identifiant ou jeton, opération, nom de banque, libellé bancaire brut.
- `month` (0.6) : cycle perso en cours — `cycle` (`salary` ou `calendar`), `from`, `to`, `spent`, `budget`, `left`
  (budget − dépensé, négatif si dépassé), `income` (revenus reçus), `top` (5 postes au plus, triés par dépassement puis par
  montant : `label` en majuscules sans numéro ni nom de banque, `spent`, `budget`), `left_to_live` et `left_to_live_basis`
  (`accounts` si les soldes des comptes courants sont connus, sinon `budget`, comme la carte de l'accueil).
- `upcoming` (0.6) : 10 échéances au plus sur 31 jours, par date : `date`, `label`, `amount` (négatif : sortie), `kind`
  (`contract`, `recurring`, `card`).
- `attention.wallet_to_match` (0.6) : prélèvements de portefeuille à rapprocher. Alerte `BUDGET_OVER` (`caut`,
  « CATÉGORIE +n % ») pour chaque poste dépassé du cycle en cours (3 au plus).
- `commun` (0.7) : `balance`, `debits_due` (prélèvements mensuels encore à venir ce mois), `transfers_expected`
  (virements attendus pas encore reçus), `reserve` (mise de côté pour les échéances non mensuelles), `end_of_month`,
  `overdraft_risk` (découvert ce mois ou dans les 12 prochains mois), `low` (`date`, `amount` du point bas s'il est sous
  zéro), `due` (échéances non mensuelles des 3 prochains mois : `month`, `amount` négatif, `late`). Alerte `OVERDRAFT_RISK`
  graduée (0.9) : `crit` si le compte commun passe sous zéro dans les 31 jours, `caut` plus tard dans les 12 mois
  (« COMPTE COMMUN · JJ/MM », premier jour sous zéro).

## Lecture des courriels (plugin `KladMail`)

Plugin natif local, en **lecture seule**, qui lit une boîte aux lettres IMAP pour retrouver des courriels (factures, avis,
appels de fonds) et leurs pièces PDF. Bibliothèque : Eclipse Angus Mail (implémentation maintenue de Jakarta Mail).

- `tester({ hote, port, adresse, motDePasse })` → `{ ok: true, nb }` (nombre de courriels de la boîte de réception).
- `chercher({ hote, port, adresse, motDePasse, expediteurs, motsCles, jours, max })` →
  `{ messages: [ { id, date, expediteur, sujet, texte, pieces: [ { nom, type, taille, base64 } ] } ] }`, du plus récent
  au plus ancien. Recherche sur le serveur (reçu depuis `jours` jours, 800 au plus ; expéditeur), puis dans Klad : adresse
  de l'expéditeur contenant l'un des `expediteurs`, au moins un des `motsCles` dans le sujet ou le texte (sans casse ni
  accents ; liste vide : pas de filtre). `max` : 50 par défaut, 100 au plus ; 300 courriels lus au plus par appel.
- **TLS obligatoire** : protocole `imaps` seulement (chiffré dès le premier octet, port 993 par défaut), certificat et nom
  du serveur vérifiés ; IMAP en clair et STARTTLS refusés (port 143 refusé). Délais de 20 s.
- **Lecture seule** : boîte ouverte en lecture seule, lecture sans marquer « lu » ; aucun drapeau posé, rien de déplacé,
  supprimé ni envoyé. Le dossier et la connexion sont fermés à la fin de chaque appel.
- **PDF seulement** : seules les pièces PDF (type `application/pdf` ou nom en `.pdf`) sont renvoyées, 3 Mo au plus chacune
  et 15 Mo au plus par appel ; une pièce plus grosse est listée avec sa taille, sans contenu. Texte : partie texte, sinon
  HTML sans balises, 8 000 caractères au plus. `id` : en-tête Message-ID (à défaut, UID du dossier).
- **Aucun mot de passe dans le journal** : rien n'est journalisé (ni adresse, ni mot de passe, ni sujet, ni texte) ; les
  erreurs sont des phrases fixes (« Identifiants refusés (mot de passe d'application ?) », « Serveur injoignable »,
  « Délai dépassé », « Réglages invalides »…), sans le texte renvoyé par le serveur.
- Réglages contrôlés avant toute connexion : serveur sans espace ni schéma, port 1 à 65535, adresse avec « @ », mot de
  passe non vide. Tests JUnit sans réseau (`android/app/src/test/java/app/klad/mail/`), sur des courriels fictifs construits
  en mémoire.

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
5. *Plus › Comptes* : nommer et typer chaque compte (carte à débit différé : compte, jour et libellé du prélèvement ; paiement en ligne : libellé des prélèvements), ajouter les comptes manuels, régler l'ordre, masquer, réassocier un compte « à réassocier ».
6. *Plus › Import de reprise* : choisir le fichier de reprise, vérifier l'association des comptes, importer.
7. Ensuite, la récupération est automatique au déverrouillage (si la dernière date de plus de 2 h) ; la pastille de l'en-tête indique l'état (✓ heure, ↻, !) et relance une récupération ; tirer vers le bas fait de même. Le **journal** est anonyme (« Banque A · compte 1 », ni noms, ni montants, ni identifiants) et peut être copié pour diagnostic.
8. *Plus › Sauvegarde* et *Plus › Verrou* : exporter ou restaurer une sauvegarde, changer le code, activer ou désactiver l'empreinte, tout effacer.
9. *Plus › Modules › Lien Grafit* : partager le résumé avec Grafit (désactivé par défaut).
10. *Opérations* : appui = détail ; glisser à droite = vue / non vue, à gauche = « Classer » ; filtres non vues, non classées, catégorie. *Plus › Classement* : catégories (nature, icône), règles, reprise du carnet.
11. *Budget* : Perso / Commun, ◀ ▶ entre cycles ; un appui sur un poste montre ses opérations, « Modifier le budget » ouvre
   le volet d'édition (annulable) ; *Contrats* et *Tendance* en haut. Accueil : carte « Reste à vivre » (détail au toucher).
   *Commun* : marge réelle, fin de mois, virements (ordres permanents modifiables), trésorerie, appels de fonds, d'où vient
   le solde ; bouton *Équilibre*. *Résultats* : bilan de la période précédente et répartition des dépenses.
12. *Plus › Observations, Impôts, Épargne* : points à faire, impôt du foyer et taxe foncière, livret et plan d'épargne.

Dans un navigateur ordinaire (`npm run serve`, après `KLAD_OWNER=<compte> node scripts/prepare-android.mjs web`), l'interface utilise un coffre de démonstration sans Keystore ni empreinte : données fictives uniquement. Un faux client Enable Banking (`window.KladFauxEB`, utilisé par le parcours Chromium) permet d'essayer la connexion et la synchro sans réseau.
