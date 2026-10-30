# Klad — état du projet

Mémoire entre sessions (générique et public : aucune donnée personnelle). Une session neuve repart de ce fichier,
de `CLAUDE.md` et du `README.md`. À tenir à jour à chaque lot.

## Version

**0.10.3** — série UX, lot UX-4 « Plus » : Plus devient une page (onglet) : « Verrouiller maintenant » en tête, puis
6 groupes : Comptes et banques (Banques et accès, Comptes, Relevés des comptes), Données (Sauvegarde, Importer : relevé
d'un compte, reprise de l'ancienne version, complément ; Contrôle), Modules (Impôts, Épargne, Équilibre jusqu'à UX-5,
Lien Grafit), Extras (Mail et Claude), Réglages (Apparence : thème Auto / Clair / Sombre et palette Klad / Grafit, mode
démo ; Verrou ; Classement), Aide et à propos (Version et mise à jour, Journal). « Relevés et sauvegarde » coupé en deux
écrans. Synchroniser, Thème et Observations quittent Plus (pastille et Accueil). L'icône de thème quitte l'en-tête.
Écran ouvert depuis Plus : bouton Retour (en-tête, retour d'Android) vers l'écran d'où l'on vient.
(0.10.2 — UX-3 : opérations ; 0.10.1 — UX-2 : Accueil ; 0.10.0 — UX-1 : socle lisible ; 0.9.4 et avant : lots 9 à 1.)

## Feuille de route

| Lot | Contenu | Version | État |
|---|---|---|---|
| 1–2 | Socle Android, Enable Banking, coffre chiffré, verrou, sauvegarde, mise à jour depuis l'appli | 0.1 → 0.2 | fait |
| 3 | Modèle de données, dédoublonnage, synchro automatique, reprise de l'ancienne version, coquille en onglets | 0.3 | fait |
| 4 | Lien Grafit (résumé v1 : soldes, totaux, alertes) | 0.4 | fait |
| 5 | Classement, opérations vues, carte à débit différé, paiements en ligne, réassociation, « À vérifier » | 0.5 | fait |
| 6 | Budget par cycle (salaire), reste à vivre, contrats et charges fixes, tendance ; Grafit : `month`, reste à vivre, `upcoming` | 0.6 | fait |
| 7 | Module compte commun + équilibre ; Grafit : `commun` | 0.7 | fait |
| 8 | Impôts, épargne salariale, taxe foncière, livret, observations, résultats, répartition | 0.8 | fait |
| 9a | Interface identique à l'ancienne version, fonctions restantes, icône | 0.9.0 | fait |
| — | Relevé de contrôle (export Klad, outil de comparaison avec l'ancienne version) | 0.9.1 | fait |
| 9b | Extras (IMAP, Claude, sélecteur de PDF), désactivés par défaut | 0.9.2 | fait |
| — | Correctif : import incomplet (`_payload`), migration, crédits de règlement de carte, icône rouge et noire | 0.9.3 | fait |
| — | Retours d'usage : mode clair, opérations internes visibles, filtre de période des opérations | 0.9.4 | fait |
| UX | Étude UX : audit, nouvelle organisation (2 variantes), maquette, plan (`docs/ux/`) ; aucun code de l'appli | — | fait, validée (variante A) |
| UX-1 | Socle lisible : couleurs AA, palettes Klad / Grafit, 48 dp, 12 px, lignes nommées | 0.10.0 | fait |
| UX-2 | Accueil (onglet en tête, 5 onglets) | 0.10.1 | fait |
| UX-3 | Opérations : périmètre visible, tri une à une, détail en page | 0.10.2 | fait |
| UX-4 | Plus en page (6 groupes), Apparence (thème et palette) | 0.10.3 | fait |
| UX-5 → UX-7 | Budget et Commun, Modules, rapidité (`docs/ux/plan.md`) | 0.10.4 → 0.10.6 | en cours |
| 9c | Réglages du complément et du carnet dans Klad, sauvegarde vérifiée, bascule | 1.0.0 | après « recette OK » |

## Série UX (0.10.x, en cours)

Décisions du propriétaire sur l'étude : variante A (Accueil, Opérations, Budget, Commun, Plus) ; Accueil complet ;
Équilibre dans Commun ; Plus en page entière en 6 groupes ; thème retiré de l'en-tête (Réglages) ; **palette au choix**
dans Réglages › Apparence, indépendante du thème : « Klad » ou « Grafit » (noir et rouge) ; les deux en AA, vérifiées
en test ; choix gardé et appliqué dès le démarrage, sans flash ; le résumé Grafit n'est pas concerné. 9c (1.0.0) après la série.

- Mesures (même protocole à chaque lot) : `tools/mesures/` (jeu fictif de 3 ans, date figée 28/10/2026, coffre de
  démonstration) : `node tools/mesures/mesurer.mjs [--www dossier] [--palette grafit] [--detail]` ; relevé
  d'accessibilité dans la page (`audit.mjs` : contrôles sous 48 dp, zone d'appui comprise : marge invisible `::after`
  ou étiquette ; contrastes AA ; police minimale) ; rapidité à CPU × 4 (déverrouillage → soldes et reste à vivre,
  changement d'onglet, 40 défilements de la liste : nombre, maximum et total des tâches longues).
- Garde-fous de chaque lot : `test/ux.test.mjs` (chiffres de l'accueil = fonctions de calcul et écrans d'origine ;
  accessibilité des écrans principaux sous des seuils qui ne remontent jamais, palettes Klad et Grafit, clair et sombre),
  lancé dans le parcours Chromium de la fabrication ; `test/contraste.test.mjs` (jetons) ; parité privée par le fichier
  de reprise (relevé de contrôle de Klad identique avant / après, hors formulations voulues).
- Mesures 0.9.4 (référence) : écrans principaux 331 contrôles, 187 sous 48 dp, 406 textes sous AA en clair, 35 en sombre,
  police 10 px ; tous écrans 578 / 373 / 648 / 41 ; déverrouillage → reste à vivre 390 à 510 ms ; défilement : 23 à 27
  tâches longues, 206 à 259 ms au plus, 3 080 à 3 570 ms au total.
- Le banc ouvre les opérations sur le périmètre perso (comme en 0.9.4) pour comparer les mêmes listes.
- 0.10.3 : écrans principaux (Plus en page compris) 283 contrôles, 0 sous 48 dp, 0 sous AA ; tous écrans 523 / 0 / 0 ;
  déverrouillage 335 à 390 ms ; défilement 25 tâches, 263 ms au plus, 3 540 ms au total.
- 0.10.2 : écrans principaux 285 contrôles, 0 sous 48 dp, 0 sous AA ; déverrouillage 390 à 440 ms ; défilement 23 tâches,
  253 ms au plus, 3 210 ms au total (même ordre que 0.9.4).
- 0.10.1 : écrans principaux (Accueil compris) 275 contrôles, 0 sous 48 dp, 0 sous AA ; déverrouillage → soldes et reste
  à vivre de l'Accueil 370 à 440 ms ; défilement 22 tâches, 208 ms au plus, 2 950 ms au total.
- 0.10.0 : écrans principaux et tous écrans : 0 sous 48 dp, 0 sous AA (clair et sombre, deux palettes), police 12 px ;
  déverrouillage 390 à 430 ms ; défilement 23 à 26 tâches, 211 à 240 ms au plus, 3 060 à 3 320 ms au total.

## Étude UX (docs/ux, validée)

- `docs/ux/audit.md` : inventaire des écrans de la 0.9.4, tâches (appuis avant / après), heuristiques, accessibilité
  (contrastes, 48 dp, texte à 130 %), performance (déverrouillage 0,9 s à CPU × 4 dans le navigateur), 25 problèmes
  priorisés ; captures sur données fictives dans `docs/ux/captures/`.
- `docs/ux/architecture.md` : variante A (Accueil, Opérations, Budget, Commun, Plus ; recommandée) et variante B
  (4 onglets, commun dans Budget) ; Plus en 6 groupes ; place de chaque fonction.
- `site/maquette/` : maquette cliquable (données fictives, variantes A / B, thème, palette Klad / Grafit, compteur d'appuis).
- `docs/ux/plan.md` : 7 lots 0.10.0 → 0.10.6, sans changement de calcul ; parité par le relevé de contrôle ; migration
  de `klad.replis` par table de correspondance.
- Les scripts de mesure (Playwright) sont restés hors dépôt ; ils peuvent être recréés à partir de la méthode de l'audit.

## Ce qui est fait (résumé)

- Données chiffrées par blocs (AES-GCM), clé protégée par le Keystore (code à 6 chiffres ou empreinte), sauvegarde par
  phrase de récupération, mise à jour signée depuis l'appli.
- Enable Banking : connexion, renouvellement, récupération incrémentale, dédoublonnage, en cours → comptabilisée.
- Reprise de l'ancienne version (`klad-reprise` v1), rejouable, frontière par compte ; carnet gardé chiffré.
- Lien Grafit (résumé v1, lecture seule, appelant contrôlé par signature).
- Lot 5 : moteur de classement générique (`www/classement.js`), import du carnet (`www/carnet.js`), écrans (détail,
  « Classer », filtres, gestes, « À vérifier »), dette de carte, anti-double-comptage des portefeuilles, réassociation,
  avertissement au réimport, résumé Grafit enrichi (`due`, `due_since`, `total.all` avec carte, `main_after_card`,
  `attention`, alertes `TO_REVIEW`, `ACCOUNT_CHECK`, `BACKUP_DUE`, `UPDATE_AVAILABLE`).
- Lot 6 : moteur de budget (`www/budget.js`, calculs de l'ancienne version : `budgetLines`, `salaryCycle`, `pastCycle`,
  `drawTrack`, reste à vivre), rendu (`www/vbudget.js`), onglet Budget (`www/ecranbudget.js`), bloc chiffré `budget`
  (import du carnet au premier déverrouillage), carte « Reste à vivre », contrats, échéances, tendance, prélèvements de
  portefeuille à rapprocher (« À vérifier », marquer interne), résumé Grafit enrichi.

## Décisions en vigueur

- Thème : valeur gardée `auto` / `clair` / `sombre` (clé `klad.theme`), attribut de la page `data-theme="light"` /
  `"dark"` (absent en automatique) ; tests sur la couleur réellement affichée, téléphone en thème sombre puis clair.
- Opérations : une opération interne n'est jamais masquée ; « Marquer interne » depuis « À rapprocher » bascule la liste
  sur le filtre « Internes ». La période des opérations est indépendante de la période d'analyse de la tendance.

- Parité (dépôt privé) : toujours par le **fichier de reprise** (payload sous `carnet._payload`, écrit puis relu, comme
  sur le téléphone) et par les étapes du premier déverrouillage ; la lecture directe de la page ne suffit pas (c'est ce
  qui a masqué l'import incomplet jusqu'à la 0.9.2). Voies `reprise`, `migration` (état de la 0.9.2 puis migration),
  `page`.
- Migrations des données du coffre : idempotentes (marque dans `S.modele.migrations`), réversibles (état d'avant gardé),
  sans écraser ce qui a été modifié dans Klad, testées en sautant des versions (`test/migrations.test.mjs`).
- Crédits de règlement des cartes et portefeuilles (« prélèvement automatique … merci », « paiement reçu ») : écartés à
  l'import comme dans l'ancienne version, selon le motif « remboursements » de la fiche du compte (données, pas de code) ;
  choisi plutôt que de les exclure seulement de l'empreinte du contrôle, pour que les compteurs (non vues, non classées)
  restent ceux de l'ancienne version.
- Icône : К cyrillique à empattements, rouge `#9E4A4A` sur noir `#0A0C0E` (valeurs de l'icône de Grafit), source unique
  `scripts/icone.mjs` ; l'identifiant d'appli et la signature ne changent pas.

- Lot 9a (0.9.0) : interface copiée de l'ancienne version (feuille de style d'origine, reprise telle quelle, plus une
  section Klad pour le verrou, les volets et les réglages). Écrans comparés un à un avec captures (hors dépôt) sur les
  données réelles : Budget, Opérations, Commun, Équilibre, Impôts, Épargne, Relevés, volet Plus, thème sombre.
  Écarts volontaires : aucun montant négatif affiché (l'ancienne version écrivait « -438 € » et « -2 k€ » sur les axes :
  Klad écrit le montant sans signe, en rouge, ou « débiteur », « déficit ») ; pas de bascule « Depuis le salaire /
  Depuis le 1er » (choix du propriétaire) ; synchronisation directe Enable Banking (pas de script ni de Drive) ;
  sauvegarde par export chiffré (pas de fichier lié). Pastilles de banques et couleurs de catégories : génériques dans
  le code, surchargées par le complément (`klad.pastilles` { motif: [initiales, couleur] }, `klad.couleurs`) ; nom de la
  résidence et du syndic des appels de fonds : `klad.appels.titre`, `klad.appels.syndic`. Le livret saisi à la main
  s'ouvre sur Épargne depuis sa carte (le ✎ de l'ancienne version). Les sections « Résultats » et le volet « Reste à
  vivre » disparaissent : la v65 les affiche dans le suivi (période clôturée) et dans la carte dépliable.
- Relevé de contrôle (0.9.1) : `www/controle.js` (`KladControle.construire(S, B, ctx, now, ext)`), écran
  `www/ecrancontrole.js`, enregistrement par le sélecteur Android (`exportFile` avec type `application/json`).
  Montants en centimes, références de comptes de la reprise (`r0`…, `livret`), identifiants d'opérations de la reprise
  (après `:x:`) sinon de Klad ; opérations en cours comprises (comme le budget). Outil public `tools/controle`
  (`carnet-controle.mjs`, `comparer.mjs`, mode d'emploi et format dans son README) : code seulement, aucune donnée ;
  la page de l'ancienne version est lue par ses propres fonctions (repères de code, pas de ligne de données).
  Vérifié en privé sur les données réelles (28/10, 15/10, 20/09) : points 2 à 7 identiques au centime ; restent les
  deux écarts connus des observations (prélèvement de paiement en ligne sans correspondance, balance des 3 mois) et
  trois titres d'observations formulés autrement (signalés « identiques au titre près »).
- `OVERDRAFT_RISK` (Grafit) gradué : `crit` si le compte commun passe sous zéro dans les 31 jours (premier jour sous
  zéro de la trésorerie, ou fin du mois si les prélèvements à venir dépassent le solde), `caut` plus tard dans les
  12 mois, aucune alerte sinon (`KladCommun.risqueDecouvert`). Format du résumé inchangé.
- La clé Claude et le mot de passe de messagerie (Lot 9b) ne passent jamais par les secrets GitHub : saisis dans
  l'appli, chiffrés dans le coffre comme la clé Enable Banking.
- Lot 9b (0.9.2) : extras dans Plus › Extras, désactivés par défaut ; désactivé, un extra n'affiche aucun bouton.
  Réglages non secrets dans `S.modele.extras` (`mail` : hôte, port, adresse, expéditeurs, mots-clés, jours, dernière
  lecture ; `claude` : modèle) ; secrets dans `S.cle.mailMdp` et `S.cle.claude` (bloc `cle`, chiffré, compris dans la
  sauvegarde). Mail : plugin natif `KladMail` (Angus Mail, IMAPS seulement, dossier ouvert en lecture seule, PDF
  seulement) ; tri et rapprochement en JavaScript (`www/mail.js`), motifs du propriétaire dans le complément
  (`klad.mail` : `expediteurs`, `motsCles`, `piece` (nature, année, mois, jour), `codeAvance`, `cp` { copropriété : motif },
  `total`) ; montants lus dans les PDF par pdf.js embarqué (`www/pdfjs`, version « legacy » pour les WebView plus anciennes, Apache-2.0). Claude : appels directs à l'API
  (`www/claude.js`, en-tête `anthropic-version: 2026-10-21`), modèle par défaut Claude Opus 5.5 (Sonnet 5.5 et Haiku 5.5 au
  choix), repli serveur `fallbacks: "default"` en cas de refus (Opus et Sonnet), sortie JSON stricte pour les documents ;
  avant chaque appel : aperçu de ce qui part et coût estimé (comptage de jetons gratuit) ; après : coût réel et
  vérification avant enregistrement (annulable). Analyses : agrégats seulement (`KladExtras.agregats`), personnes
  désignées « personne A / B », gardées pour la session. Sélecteur de PDF : sélecteur Android (Drive compris).
- Préférences d'affichage gardées hors du coffre (`localStorage`) : seulement `klad.replis` (sections repliées),
  `klad.periode`, `klad.tendance`, `klad.opsPerimetre` (0.10.2 : `perso` / `commun` / `tout`) (liste fermée, `KladUI.pref`),
  `klad.theme` et `klad.palette` (0.10, `klad` / `grafit`) ;
  aucune donnée.

- Lot 8 (0.8) : chiffres identiques à l'ancienne version (parité `outils/parite/lot8.mjs` : impôts avis et estimation,
  partage, régularisations, taxe foncière, livret, résultats perso et commun ; 0 écart). Observations : mêmes règles,
  formulations génériques (noms de comptes et de contrats tirés des données) ; règles propres au propriétaire rendues
  génériques (contrat à montant 0 encore prélevé ; prélèvement mensuel du commun absent depuis 45 jours ; compte
  secondaire désigné par le complément). Écrans dans Plus (Observations, Impôts, Épargne) et Budget › Résultats.
  Pas de lecture de mail, de Drive ni d'analyse par Claude (Lot 9).

- Compte commun (0.7) : chiffres identiques à l'ancienne version (parité `outils/parite/commun.mjs` dans klad-ref :
  0 écart). Noms des personnes, motifs (virements de l'autre personne, syndic, prêteurs), apports initiaux, historique
  et équipements de l'équilibre : complément (`klad.commun.motifAutre`, `klad.appels`, `klad.equilibre`) ou carnet ;
  motifs des impôts (administration fiscale) génériques dans le code. Appels de fonds : données du carnet (mails et
  relevé du syndic déjà connus), aucune lecture de mail (Lot 9). Alerte Grafit `OVERDRAFT_RISK` dès qu'un découvert est
  prévu sur 12 mois.

- Aucune règle, enseigne, nom de banque, d'employeur ou de personne dans le code : ce sont des données (carnet ou Klad).
- Priorité de classement identique à l'ancienne version : correction > règle de l'utilisateur (mot le plus long) >
  règles de base (ordre) > défaut ; puis règlement de carte ou de portefeuille détaillé ailleurs → interne.
- Natures : `fixe`, `courante`, `optionnelle`, `revenu`, `interne`, plus `epargne` et `hors_budget` (types de
  l'ancienne version, nécessaires au budget du Lot 6).
- Opérations vues : date de départ (celle du carnet, sinon le jour de la première ouverture de la 0.5) ; avant, tout
  est vu sauf décoché. Comptées sur tous les comptes visibles (commun compris).
- « Non classées » dans « À vérifier » et dans Grafit : 90 derniers jours.
- Portefeuille : prélèvement interne si son montant est retrouvé dans le détail du portefeuille, de 2 j avant à 7 j
  après ; recherche sur tous les comptes courants et commun.
- Carte : dette depuis le dernier règlement sur le compte de prélèvement ; règlement interne s'il est daté dans la
  période couverte par le détail de la carte (+45 j), sur tout compte courant ou commun (comme l'ancienne version).
- Motifs de règlement : réglés dans la fiche du compte ; pré-remplis par le carnet (extension `klad`) ou déduits des
  règles « à détailler » ; propositions = débits récurrents du compte de prélèvement.
- Encart « À vérifier » : remplace les anciens bandeaux (mise à jour, sauvegarde, comptes, accès) ; chaque ligne mène à
  l'écran concerné.
- Réassociation manuelle : seulement pour un compte « à réassocier », vers un compte bancaire d'une connexion active.

- Budget (0.6) : chiffres identiques à l'ancienne version (parité dans klad-ref, `outils/parite/budget.mjs` : 0 écart
  sur le cycle en cours et 3 cycles passés, perso et commun, avec le complément ; seul écart connu à d'autres dates : un
  prélèvement de portefeuille sans correspondance, désormais signalé « à rapprocher »).
- Cycle perso = cycle de salaire, sans bascule « depuis le 1er » (choix du propriétaire) ; repli sur le mois civil.
- Réglages propres au propriétaire (critères du salaire, noms des personnes du commun) : `klad.salaire`, `klad.commun` du
  complément ou du carnet, surchargés par `S.budget.reglages` ; jamais dans le code.
- Reste à vivre : colonne « comptes courants » prioritaire pour Grafit (`left_to_live_basis` = `accounts`), sinon `budget`.

## Inventaire des écarts avec l'ancienne version (0.9.0)

Repris en 0.9.0 : interface ; tendance complète (revenus, dépenses, balance, balance cumulée, solde reconstitué ou une
catégorie face à son budget ; comptes et période au choix) ; parts du commun par poste (Personne A / B) ; équilibre
détaillé (composition, graphique cumulé, utilisation du compte commun, dépenses payées en direct, tous les mouvements) ;
livret sur sa carte ; calculateur carburant ; import Excel (.xlsx, lecteur embarqué sans bibliothèque) ; « Retirer les
imports manuels » ; calcul dans les champs de montant (« 29,99+64 ») ; libellés et titres de la v65.

Restent :
- Repris en 0.9.2 (extras désactivés par défaut, à activer par le propriétaire) : lecture des bulletins de paie et des
  avis par Claude (l'ancienne version passait par Drive et Claude), appels de fonds par mail, « Analyse de Claude ».
- Observations : mêmes règles, 18 points de chaque côté sur les données réelles ; titres formés avec les libellés des
  contrats et des comptes de Klad (« Eau (…) : prélèvement absent ») là où l'ancienne version avait des titres écrits à la
  main ; deux écarts de calcul connus (un prélèvement de paiement en ligne sans correspondance → « détaillé en partie », et la balance
  des 3 derniers mois qui en dépend).
- Hors périmètre (choix de conception) : script bancaire Google et Drive, fichier de données lié, synchronisation
  « en ligne ».

## Points d'appui pour le Lot 9c (1.0.0, à publier seulement après « recette OK »)

- Complément et carnet en réglages ordinaires : aujourd'hui lus dans `S.carnet` (racine `KladBudget.racine`), sous-objets
  `klad.*` du complément (`klad.mail`, `appels.titre`, `appels.syndic`, pastilles…) ; réglages saisis dans Klad dans
  `S.modele.extras` et `S.budget`. Priorité actuelle : complément < réglages de Klad.
- Sauvegarde : tous les blocs sauf le journal (bloc `cle` compris : clé Enable Banking, clé Claude, mot de passe
  d'application) ; à vérifier par un export puis une restauration complète sur un téléphone vierge.
- Relevé de contrôle (`tools/controle`) : à rejouer après chaque changement de calcul.
- Bascule : arrêt des scripts Google de l'ancienne version, archivage de l'ancienne version, retrait de l'ancienne adresse
  de retour chez Enable Banking (liste à remettre au propriétaire, rien à faire dans le code).

## Points d'appui pour le Lot 9b (historique)

- Interface : `KladUI` (format, pastilles, sections repliables, préférences, graduation des axes, calcul) ; écrans
  `KladVues*` (rendu) et `ecran*.js` (événements) ; volets dans `#rangement` ouverts par `KladApp.ouvrirVolet(id)`.
- Crochets prévus pour les extras (`window.KladExtras`) : `actif(S, nom)`, `analyse(scope)`, `analyser(...)`,
  `lireDocument(...)`, `etatMail(S)` ; boutons `data-lirebs`, `data-lireavis`, `data-analyseimpots` dans Impôts,
  « Analyse de Claude » dans les observations du Budget.
- Impôts : bulletins (`S.budget.fisc.bs`) et avis (`fisc.avis`) au format de l'ancienne version
  (`{ p, emp, m, pay, ni, pas, taux, type, brut }`, avis `{ rev, sal, ded, … }`).
- Appels de fonds : `S.budget.appels[cp].items`, `mails`, `pdfs` (format de l'ancienne version).
- Import manuel : `KladReleve.lireFichier(octets, role, auj)` (CSV, JSON, .xlsx) puis `integrer(S, cid, lignes, now)`.

## Points d'appui pour le Lot 9 (historique)

- Impôts : `KladFisc` (`contexte`, `annee`, `partage`, `regularisations`, `alertes`, `taxeFonciere`, `pee`, `livret`).
- Observations : `KladObservations.audit(B)` (points), `observations(B, scope)` (à faire, masqués, infos).

## Points d'appui pour le Lot 8 (historique)

- Compte commun : `KladCommun` (`tresorerie`, `origine`, `plan`, `finDeMois`, `margeReelle`, `appels`, `equilibre`,
  `impots`) ; rendu `KladVuesCommun`. Bloc `budget` en version 2 (appels, équilibre importés).
- Réglages du carnet encore inexploités : `fisc`, `tf`, `livret`, `pee`, `dismiss`, `excl`, `fuel`.

## Points d'appui pour le Lot 7 (historique)

- Budget : `KladBudget.contexte(S, now, ctxClassement)` → B (une fois par affichage, `KladApp.budget()`) ;
  `suivi(B, scope, nav)`, `postes(B, sc)`, `parts(B)` (répartition du commun : `pg` par poste), `reserveCommun(B)`,
  `moisProchaineEcheance`, `echeances(B, 31)`, `contrats(B, sc)` ; virements permanents dans `S.budget.virements`
  (`qui` : `moi` / `autre`, `montant`, `jour`, `usage`).
- Réglages du carnet encore inexploités : `appels`, `eq`, `eqItems`, `split` (déjà dans `bplan.commun`), `fisc`, `tf`,
  `livret`, `pee`, `dismiss`, `excl`, `fuel` ; payload `eqops`, `equip` (équilibre).

## Points d'appui pour le Lot 6 (historique)

- Résultat de classement d'une opération : `KladClasse.classer(ctx, op)` → `{ type, cat, sub, src, nc }` ;
  `ctx = KladClasse.contexte(S, now)` (une fois par affichage) ; nature d'une catégorie : `KladClasse.natureDe`.
- Date de dépense d'une opération de carte : `KladClasse.dateDepense(op)` (à utiliser pour le budget, comme
  l'ancienne version).
- Dette de carte : `KladClasse.dette(S, carte, now)` → `{ centimes, depuis, n, le }`.
- Réglages de l'ancienne version encore inexploités dans le carnet : `bplan`, `budgets`, `budgetRef`, `revprev`,
  `contrats`, `virements`, `appels`, `fisc`, `tf`, `livret`, `split`, `dismiss`… (bloc chiffré `carnet`).
- Comptes de l'ancienne version : références `r0`… de la reprise (`S.modele.reprise.map`, libellés dans `libelles`).
- Résumé Grafit : `KladResume.construire(S, now, ext)` ; ajouter `month` et `upcoming` sans casser la v1.

## Écarts connus

- Les quelques règles codées en dur dans l'ancienne version (et non dans son carnet) ne sont reprises que si elles sont
  fournies en données (extension `klad` : `regles`, `bars`) ; sinon, un geste « Classer aussi les autres » suffit.
- Le libellé du règlement de carte dans les sous-catégories (« Règlement <carte> (détaillé) ») suit le libellé du compte
  dans Klad.
