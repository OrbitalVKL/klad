# Klad — état du projet (maintenance)

Mémoire entre sessions (générique et public : aucune donnée personnelle). Une session neuve repart de ce fichier,
de `CLAUDE.md` et du `README.md`. Depuis la **1.0.0**, le projet est en **maintenance** : correctifs et petites
demandes, une version publiée par lot. Notes de version publiques : `docs/NOTES.md` (ouvertes depuis Plus › À propos).

## Statut

**1.0.1** — correctif de la recette 1.0.0 (plantage à l'export de la sauvegarde, journal des plantages, reprise du
classement proposée, messages flottants, banque momentanément indisponible). La bascule (arrêt de l'ancienne version)
reste suspendue tant qu'aucune sauvegarde vérifiée n'existe sur le téléphone.

**1.0.0** — version complète (Lot 9c) : l'ancienne version peut être arrêtée (liste de bascule remise au propriétaire).
Toutes les fonctions de l'ancienne version sont présentes ou abandonnées par décision (`docs/parite-fonctions.md` :
0 manquante). Aucun calcul n'a changé : relevé de contrôle de la 0.10.10 identique à la référence 0.9.4 sur les données
réelles (contrôle de l'architecte) ; 1.0.0 identique à la 0.10.11 sur les jeux fictifs (relevé et résumé Grafit).

### Ce que fait Klad (état final)
- Comptes bancaires lus par Enable Banking (synchro automatique, dédoublonnage), comptes manuels et relevés importés.
- Données chiffrées par blocs sur le téléphone (code ou empreinte), sauvegarde chiffrée par la phrase de récupération,
  **vérifiable** sans rien remplacer, restauration sur un téléphone neuf ; mise à jour signée depuis l'appli.
- Classement (catégories, règles, corrections), opérations vues, carte à débit différé, paiements en ligne.
- Budget par cycle de salaire (ou mois civil), reste à vivre, contrats, échéances, tendance ; compte commun, trésorerie,
  appels de fonds, équilibre ; impôts, taxe foncière, épargne salariale, livret ; observations.
- Lien Grafit (résumé lu par Grafit, sans donnée identifiante) ; relevé de contrôle ; extras (mail, Claude), désactivés
  par défaut ; mode démo ; palettes Klad et Grafit ; thème clair / sombre.
- **Tous les réglages se font dans Klad** (1.0.0) ; le complément importé n'est plus qu'une source de valeurs de départ.

### 1.0.1 — détails techniques
- **Cause du plantage à l'export (1.0.0)** : `exportFile` recevait toute la sauvegarde (base64 d'un JSON contenant un
  base64) dans la demande Capacitor ; pendant le sélecteur, Capacitor recopie la demande en attente dans l'état
  sauvegardé de l'activité (`Bridge.saveInstanceState`, deux fois : options et bundle du plugin) ; au passage en
  arrière-plan, Android l'envoie au système (limite ≈ 1 Mo) : `TransactionTooLargeException` levée dans `onStop`,
  appli fermée sans trace JS. S'y ajoutaient 6 à 8 copies complètes en mémoire (JSON, octets, chiffré, base64, JSON,
  octets, base64, puis côté Java String, JSObject, décodage) et l'écriture sur le fil principal.
- **Fichiers par morceaux** (`android/.../vault/Transfert.java`, pur, JUnit `TransfertTest`) : fichiers temporaires
  dans `noBackupFilesDir/klad/echanges` (jeton de 16 hexadécimaux), morceaux ≤ 512 Ko (`MAX_MORCEAU`), fichier ≤ 512 Mo ;
  `enregistrer(jeton, destination)` : copie par blocs de 64 Ko, relecture et comparaison (taille, SHA-256), en cas
  d'échec destination supprimée (`DocumentsContract.deleteDocument`) sinon vidée, temporaire supprimé ;
  `noter` / `dernier` / `oublier` : résultat gardé sur disque (`resultat.properties`) ; `nettoyer` : temporaires de plus
  de 24 h. Plugin `KladVault` : `tmpOuvrir`, `tmpAjouter`, `tmpLire`, `tmpAbandon`, `enregistrerFichier({ jeton, name,
  type, nature })` (copie sur un fil à part ; demande « orpheline » après recréation de l'activité traitée aussi),
  `resultatEnregistrement`, `oublierEnregistrement`, `choisirFichier({ type })` (copie du fichier choisi en temporaire,
  lu ensuite par `tmpLire`). `exportFile` et `importFile` retirés.
- **Format de sauvegarde v2** (`KladCoffre.ecrireSauvegarde`, `enteteSauvegarde`, `ouvrirSauvegarde`, `MORCEAU` = 256 Ko) :
  ligne d'en-tête JSON (format, v 2, kdf, date, morceau) puis enregistrements « longueur | IV | AES-GCM », donnée associée
  = en-tête + rang ; clair = `{ n: bloc, i, f }` + octets, dernier enregistrement `{ fin, app, v, blocs, prefs, n }`
  (fichier tronqué, altéré ou réordonné refusé). Un seul bloc en clair à la fois. Lecture des v1 (1.0.0) gardée.
  Test node `test/morceaux.test.mjs` (5 000 opérations, 3 ans, 3 Mo de PDF fictifs).
- `verrou.js` : `enregistrer(nom, type, nature, produire)`, `choisirSource`, `resultatsEnAttente()` (appelé après chaque
  enregistrement et à chaque déverrouillage : « Sauvegarde enregistrée (x Mo, fichier relu et identique) », ou l'échec ;
  `B.dernier` posé à ce moment) ; `exportNow` prépare le fichier avant le sélecteur (état et clé de sauvegarde pris au
  départ : un verrouillage pendant le sélecteur n'y change rien). Coffre de démonstration : mêmes méthodes, compteur
  `KladDemoCoffre.messages` (taille du plus gros message), crochet `avantSelecteur` (arrière-plan, verrouillage,
  échec, annulation simulés) ; données trop grosses pour sessionStorage gardées en mémoire.
- **Journal des plantages** (`android/.../arret/Arret.java`, `KladArretPlugin`, JUnit `ArretTest`) : gestionnaire des
  exceptions non attrapées installé dans `MainActivity` (puis gestionnaire d'Android), `onRenderProcessGone` (Capacitor
  `WebViewListener`, comportement inchangé ensuite) ; ligne « Klad s'est arrêté pendant <action> : <Type ← Cause>,
  <Classe:ligne> (le JJ/MM à HH:MM) » dans `noBackupFilesDir/klad/arret.txt` ; jamais de message d'erreur ; action
  posée par l'appli (`window.KladArret.action` : export, vérification, restauration, relevé, synchronisation), mots
  filtrés (lettres seulement). Recopiée au journal au déverrouillage (`verrou.js:arretPrecedent`), puis effacée.
- **Reprise du classement** : `KladCarnet.signature` (bars et règles du complément effectif) gardée dans
  `C.import.ext` ; `aReprendre(S)` (sans signature, reprise d'avant 1.0.1 : vrai si bars ou règles réglés dans Klad) ;
  `apercuReprise(S)` (reprise sur une copie → opérations dont catégorie, sous-catégorie ou nature changerait) ;
  `instantane` / `restaurer` (classement, catégories et « vues » des opérations, `modele.vues`, motifs des cartes).
  Encart `[data-encart-reprise]` (`plus.js:remplirEncarts`, `KladApp.encartsReprise`) dans Plus › Classement,
  Réglages › Listes de mots-clés et l'éditeur avancé ; « Plus tard » écarte ce changement pour la session.
- **Éléments flottants** (inventaire) : messages `#toast` (simple, erreur, « Annuler ») ; bandeau du mode démo
  `#demoBar` ; indicateur « tirer pour synchroniser » `.app-ptr` (transitoire, `pointer-events: none`, inchangé) ;
  compteur `#tb-badge`. Anciennes règles `.toast` (inutilisées) retirées. Messages (`app.js`) : `cacherToast`,
  `montrerToast`, 5 / 6 / 8 s, appui = fermeture (« Annuler » : action puis fermeture), glissement (`pointer*`), le
  suivant remplace le précédent, `html.toast-on` ; position `bottom: var(--tbh) + 10px` (`--tbh` = hauteur réelle de la
  barre d'onglets, `poserBarre`), en haut quand un volet est ouvert (`html.volet-ouvert`). Bandeau démo : replié en
  pastille « DÉMO » (`KladAffichage.replierDemo`, appui, glissement, 6 s), masqué pendant un message. Compteur :
  16 px, à droite de l'icône, sans chevauchement.
- **Banque momentanément indisponible** (`KladSync.passager`, `etatPassager`, `passagerDe`) : 400 + « ASPSP » →
  `c.sync.passager { n, depuis }`, `erreur` reste nul (pas de pastille rouge, de « compte à vérifier », de
  `SYNC_FAILED`) ; erreur à partir de 3 fois de suite ou après 24 h ; succès : tout effacé. Message neutre dans le
  détail de la synchro, Plus › Banques et après une synchro lancée à la main.
- Tests : `test/morceaux.test.mjs` (node) ; `test/sauvegarde.test.mjs` (Chromium : jeu `repriseGrande` de
  `tools/mesures/donnees.mjs`, 5 200 opérations et 3 « PDF » de 1 Mo ; export pendant arrière-plan + verrouillage
  de 5 min, plus gros message < 512 Ko, vérification, restauration, échec et annulation) ; `test/reglages.test.mjs`
  (encart, aperçu, Plus tard, reprise, Annuler) ; `test/debord.test.mjs` étendu aux éléments flottants (contre-épreuve
  1.0.0 : 9 défauts) ; `test/sync.test.mjs` (panne passagère) ; `test/android.test.mjs` (aucune donnée dans les demandes
  du sélecteur, journal des plantages) ; JUnit `TransfertTest`, `ArretTest`.

### 1.0.0 (Lot 9c) — détails techniques
- Complément effectif : `KladBudget.complement(S)` = complément importé (`S.carnet` › `klad`) surchargé par
  `S.modele.reglages.complement` (`KladBudget.surcharger` : une rubrique présente remplace celle du complément, `null` la
  retire). Sans réglage saisi, l'objet du complément tel quel : aucun calcul ne change. Lecteurs branchés : `budget.js`
  (`reglages`), `commun.js`, `observations.js`, `fisc.js` (`complement`), `mail.js`, `ui.js` (`reglerApparence`),
  `carnet.js` (`ext` : bars, règles, noms de comptes, à la reprise du classement), `demo.js`.
- `www/reglages.js` : `KladReglages` (pur, testé dans node) : thèmes et champs (`THEMES`), magasins `r`
  (`S.budget.reglages` : salaire, commun, cycle), `b` (`S.budget` : tf, livret.taux, pee.plan, carburant), `x`
  (`S.modele.extras` : mail), `c` (`S.modele.reglages.complement`) ; `valeur` (valeur et source : réglé dans Klad, du
  complément, valeur par défaut), `convertir` (saisie → valeur, erreurs en français), `ecrire` (champ vidé → retour au
  complément ; compte « Aucun » = choix prioritaire, `null`), `instantane` / `restaurer` (annulation), `apercuComplement`,
  `lireComplement`, `importerComplement`, `brutEffectif`, `validerBrut`, `enregistrerBrut`, `recurrentsSecondaire`.
  Écrans (même fichier) : Plus › Réglages › Budget (`secReglBudget`), › Complément (`secReglages` → `secReglTheme`,
  `secReglAvance`), Plus › Données › Importer (`secImporter`, aperçu `#complementApercu`). Enregistrement → `changed`,
  donc écrans et résumé Grafit recalculés aussitôt ; « Annuler » sur chaque enregistrement.
- Nouveaux réglages (sans effet tant qu'ils ne sont pas changés) : `S.budget.reglages.cycle` (`salaire` par défaut ou
  `mois` : `cycleCourant` → null, `debuts` → [], navigation par mois) ; `S.budget.reglages.commun.part` (part de « moi »
  par défaut d'un poste du commun, 50 par défaut, `KladBudget.partDe`).
- Pastille « récurrent sur <compte secondaire> » (`vbudget.js:suivi`, `detRow`) : même règle que l'observation
  (`KladObservations.recurrentsSecondaire`, montant récurrent sur au moins 2 mois ou poste fixe, récent).
- Sauvegarde : `KladCoffre.contenuSauvegarde(S, prefs)` (tous les blocs sauf le journal, plus thème et palette),
  `comparerSauvegarde(payload, S, prefs)` → `{ lisible, complete, differents, manquants, enTrop, cles }` ; écran
  Sauvegarde : « Vérifier une sauvegarde » (`verrou.js:verifierSauvegarde`, rien n'est remplacé) ; bloc `sauvegarde` :
  `verifiee: { le, date }` (aussi posé par une restauration) ; rappel (« À vérifier », `BACKUP_DUE`) : tant qu'aucune
  sauvegarde n'est vérifiée (« SAUVEGARDE · À VÉRIFIER » si exportée, « · JAMAIS » sinon), puis 30 jours après la date du
  fichier vérifié.
- À propos (Plus › Aide et à propos) : version, date de fabrication (`KLAD_CONFIG.date`, `prepare-android.mjs`), notes
  de version (`docs/NOTES.md` à l'étiquette `v<version>`, `KladMaj.notesUrl`).
- Nettoyage : vues `categories` et `regles` de l'ancien Budget retirées (`vbudget.js`, gestionnaires d'`ecranbudget.js`,
  sections `cats-panel` / `rules-panel`) ; l'import du complément quitte Plus › Classement pour Plus › Données › Importer.
- Tests : `test/reglages.test.mjs` (node et Chromium : modifications visibles dans les écrans et le résumé Grafit,
  compte secondaire, import avec aperçu, éditeur avancé, annulation), `test/sauvegarde.test.mjs` (node et Chromium :
  export → vérification → tout effacer → restauration sur installation neuve → mêmes écrans, même relevé de contrôle,
  même résumé Grafit), débordements étendus aux écrans de réglages.

## Historique des versions avant la 1.0.0

**0.10.11** — correctif avant la recette finale : le bandeau du mode démo dépassait de l'écran (texte sur une ligne).
- Bandeau `#demoBar` : texte replié sur plusieurs lignes, largeur bornée à l'écran moins 24 px, « Quitter » jamais coupé.
- Autres débordements trouvés par le nouveau test et corrigés : compte et étiquette d'une opération (repliés plutôt que
  coupés), chiffres clés de Plus › Impôts et Épargne (une colonne quand l'écran est étroit pour la taille du texte :
  classe `html.etroit` posée par `KladUI.ajuster`, largeur / taille du texte sous 230), titres des observations
  (`min-width: 0`), montant des lignes de l'Accueil en mode démo (réduit par `KladUI.ajuster`, `.ac-li .v`).
- Test `test/debord.test.mjs` (parcours Chromium de la fabrication) : relevé `releveDebord` (tout élément visible dans
  l'écran une fois rogné par ses ancêtres, zones qui défilent exclues) et `releveTextes` sur toute la page ; écrans
  principaux et sous-vues, entrées de Plus, volets, écran de verrouillage, bandeau du mode démo sur chaque onglet,
  messages (simple, erreur, « Annuler ») ; 320 / 360 / 412 px, texte 100 / 150 / 200 %. Contre-épreuve :
  `KLAD_WWW=<www de la 0.10.10> node --test test/debord.test.mjs` signale le bandeau sur les 9 configurations
  (même à 412 px et texte à 100 %), 174 défauts en tout (162 liés au bandeau) ; 0 sur la 0.10.11.
- Banc (`tools/mesures/banc.mjs`) : changer la taille du texte relance les ajustements (comme au démarrage du téléphone).

(0.10.10) — correctif avant la recette finale (réponse au rapport 0.10.9 ; icônes dessinées pour stationnement et
courses, et texte agrandi simulé dans Chromium : validés).
- Mode démo : rien de réel à l'écran (`www/demo.js`, `KladDemo`). Au démarrage du mode, un dictionnaire est tiré des
  données : libellé de chaque opération (complet, court, 3 premiers mots, forme des observations), contrepartie → sa
  sous-catégorie, sinon sa catégorie ; catégories créées par le propriétaire → « Catégorie N » (catégories d'office
  gardées) ; postes (sous-catégories) qui ne sont pas faits que de mots courants (liste `KladDemo.MOTS`) → « Poste N »
  (numéros stables : ordre alphabétique) ; personnes du commun (nom complet et chaque mot) → « Personne A / B » ;
  employeurs (bulletins, PEE) → « Employeur » ; banques, intitulés, titulaires ; libellés de comptes qui ne sont pas des
  mots courants → « Compte courant 1 »… ; contrats (nom et motif → poste, justificatif, note) ; virements permanents ;
  copropriétés et syndics ; équilibre (mouvements → leur nature, équipements → « Équipement N ») ; motifs des réglages
  et des règles ; messagerie. Motifs : adresses e-mail et web, identifiants (avant le dictionnaire), IBAN, références de
  6 chiffres ou plus, « ABC-1234 », fins de carte « …1234 » (après). Appliqué au texte (y compris caché et aux données des
  infobulles des graphiques), aux infobulles, `aria-label`, `placeholder` et aux valeurs des champs ; pastilles de
  banque tirées du nom masqué. Champs en lecture seule (sauf les recherches), valeurs textuelles masquées « ••• »,
  nombres multipliés. Rien n'est enregistré (sauvegarde bloquée, état d'avant rendu en sortant si quelque chose a
  changé), ni synchronisé, ni écrit pour Grafit. Trois appuis sur le numéro de version (pied de page, Plus › Version)
  activent ou arrêtent le mode. Bandeau « MODE DÉMO · chiffres et libellés fictifs · captures d'écran autorisées ».
  Test `test/demo.test.mjs` : dictionnaire (node) ; parcours Chromium de tous les écrans et volets, postes dépliés,
  séries de la tendance, recherche, comptes, sur le jeu fictif « personnel » (`tools/mesures/donnees.mjs`,
  `reprisePersonnelle`, liste `PERSONNEL`) : aucun libellé d'opération, nom de catégorie créée, nom de personne,
  employeur, banque, numéro ni adresse dans le DOM (contre-épreuve : sans le dictionnaire, 81 fuites) ; aucun champ
  modifiable ; aucun bloc écrit ; état rendu en sortant. Outils : `test/demo-outils.mjs`.
- Écran étroit (320 px) et texte agrandi (jusqu'à 200 %) : titres repliés à la ligne (césure française), rangées
  libellé / montant repliées, grilles en `minmax(0, 1fr)` ; montants jamais coupés (`white-space: nowrap`) ;
  réduction progressive (`KladUI.ajuster` : `zoom` de 8 % en 8 % jusqu'à 50 %) des titres, boutons de barres et montants
  qui dépassent encore ; rien ne bouge sur un écran d'au moins 360 px avec un texte sous 110 % (cas ordinaire).
  Libellés de la barre d'onglets en points de suspension. Test `test/champs.test.mjs` étendu aux textes des cartes
  (`test/textes-outils.mjs`) : Accueil, Budget, Commun et leurs sous-vues, 320 / 360 / 412 px, texte 100 / 150 / 200 %.

(0.10.9) — correctif sur les retours de la 0.10.8. Décisions du propriétaire reportées : abandons « Liste d'origine »
des contrats et liste des bulletins de paie non lus (`docs/parite-fonctions.md`, « abandonné, décision du propriétaire ») ;
base du reste à vivre « dernier salaire » par défaut et ordre des opérations gardé pour la session : validés.
- Icônes : tout en icônes dessinées. Catégories d'office en `lu:<nom>` ; migration `dessins` (émojis d'office et repris,
  icônes reprises `svg:<nom>`, icônes vides → icône Lucide la plus proche, table `KladIcones.EMOJIS` / `SVG_REPRIS`,
  sinon proposée d'après le nom ; couleur de pastille inchangée ; en une fois, réversible `annulerDessins`) ; l'import du
  carnet convertit aussi ; affichage : toute icône non dessinée est montrée en icône dessinée (`KladIcones.versDessin`).
- Champ « Nouvelle catégorie » tronqué sur le téléphone : zone défilante du volet élargie ; test `test/champs.test.mjs`.
- Plus › Aide et à propos › Diagnostic d'affichage (`www/diagaff.js`, plugin `KladAffichage.diagnostic()`).
- Captures d'écran autorisées seulement en mode démo (`KladAffichage.captures`, FLAG_SECURE rétabli en sortant, au
  verrouillage et en arrière-plan).

(0.10.8) — parité des fonctions avec l'ancienne version : `docs/parite-fonctions.md` (326 fonctions de la v65,
téléphone et ordinateur ; 226 identiques, 85 adaptées, 12 abandonnées par décision, 2 abandons à décider, 1 manquante
pour la 9c). Rétablies ou ajoutées : renommer et supprimer une catégorie, ajouter une règle à la main (perdus en 0.10.4,
rétablis dans Plus › Classement, annulables) ; aperçu des 8 opérations concernées par une règle (volet Classer, nouvelle
règle) ; pastille « équilibre » sur une opération ajoutée à l'équilibre et un seul ajout par opération (retrait
possible) ; tri des opérations (plus récentes, plus anciennes, plus grosses dépenses, par catégorie ; gardé pour la
session) ; Accueil › Soldes : « Tous les comptes … dont épargne ». Aucun calcul modifié. Test `test/parite.test.mjs`.

(0.10.7) — retours du propriétaire sur la série UX (acceptée). Corrections :
- Budget › Suivi : toucher un poste (son nom ou « N op. ▾ », « contrat ▾ ») déplie de nouveau ses opérations et contrats
  (le gestionnaire `[data-poste]` avait disparu en 0.9.0) ; poste sans opération : « Aucune opération sur cette période ».
  Test `test/budgetdetail.test.mjs` : pour chaque poste et revenu (accents, « & », « / », postes c|/f|, cycle vide le
  jour du salaire, reprise et complément), le détail liste exactement les opérations comptées dans « utilisé ».
- Plus › Classement : « + Nouvelle catégorie » en haut de la section, formulaire pleine largeur (champs `sh-in`) ;
  champs des volets bornés à la largeur (aucun débordement à 360 / 412 px, texte à 130 %).
- Icônes des catégories : banque Lucide embarquée (396 icônes, ISC), sélecteur en volet du bas (recherche par mots
  français, suggestions d'après le nom, couleur de la pastille) ; migration `icones` (catégories sans icône ou avec la
  lettre de repli → icône proposée ; icônes reprises gardées ; réversible).
- Reste à vivre : interrupteur « Dernier salaire / Comptes courants » sur la carte de l'Accueil, dans son détail, dans
  Budget et dans Réglages › Budget ; réglage `S.budget.reglages.rav` (`salaire` par défaut) ; le résumé Grafit suit
  (`left_to_live`, `left_to_live_basis`). Aucun calcul modifié (choix d'une des deux colonnes).
- Gestes sur les opérations : action affichée sous la ligne pendant le glissement (« Vue » / « Non vue », « Classer »),
  fond soutenu au seuil, vibration légère au seuil (permission Android `VIBRATE`) ; « réduire les animations » : la
  ligne ne bouge pas, l'action s'affiche par-dessus.
(0.10.6 — fin de la série UX (UX-1 → UX-7, `docs/ux/plan.md`, variante A) ; 0.10.0 → 0.10.5 : socle lisible, Accueil,
Opérations, Plus en page, Budget et Commun en sous-vues, Impôts et Épargne ; 0.9.4 → 0.6 : correctifs et lots 9 à 6.)

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
| UX-5 | Budget et Commun en sous-vues, migration des sections repliées | 0.10.4 | fait |
| UX-6 | Impôts et Épargne en sous-vues, Réglages › Budget | 0.10.5 | fait |
| UX-7 | Rapidité : Accueil d'abord, liste allégée | 0.10.6 | fait |
| — | Retours sur la série UX : détail des postes, icônes des catégories, base du reste à vivre, gestes | 0.10.7 | fait |
| — | Parité des fonctions avec l'ancienne version (`docs/parite-fonctions.md`) et petites fonctions manquantes | 0.10.8 | fait |
| — | Correctif : icônes toutes dessinées, champs des volets, diagnostic d'affichage, captures en mode démo | 0.10.9 | fait |
| — | Correctif : mode démo sans rien de réel à l'écran, titres et montants à 320 px et texte à 200 % | 0.10.10 | fait |
| — | Correctif : bandeau du mode démo dans l'écran, test de débordement de tous les écrans, volets, bandeaux et messages | 0.10.11 | fait |
| 9c | Réglages du complément et du carnet dans Klad (dont Réglages › Budget modifiable), sauvegarde vérifiée, bascule | 1.0.0 | fait, maintenance ensuite |
| — | Correctif : export de la sauvegarde (plantage), journal des plantages, reprise du classement, messages flottants, panne passagère de la banque | 1.0.1 | fait |

## Série UX (0.10.0 → 0.10.6, faite)

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
- **Bilan 0.9.4 → 0.10.6** (même protocole, même session pour la rapidité) :

  | Mesure | 0.9.4 | 0.10.6 |
  |---|---|---|
  | Écrans principaux : contrôles sous 48 dp | 187 sur 331 | 0 sur 396 (sous-vues comprises) |
  | Écrans principaux : textes sous AA, clair / sombre | 406 / 35 | 0 / 0 (palettes Klad et Grafit) |
  | Tous écrans : sous 48 dp ; sous AA clair / sombre | 373 ; 648 / 41 | 0 ; 0 / 0 (708 contrôles) |
  | Plus petite police | 10 px | 12 px |
  | Texte à 130 % : débordement horizontal | aucun | aucun (Accueil, Opérations, Budget, Commun, Plus) |
  | Déverrouillage → soldes et reste à vivre (CPU × 4) | 359 à 426 ms | 231 à 302 ms |
  | Changement d'onglet (CPU × 4) | 51 à 227 ms | 86 à 204 ms (Plus est une page, plus un volet) |
  | 40 défilements rapides : tâches longues, max, total | 22, 214 ms, 2 935 ms | 1, 50 ms, 50 ms |
- 0.10.5 : écrans principaux 396 contrôles, 0 / 0 ; tous écrans (sous-vues d'Impôts et d'Épargne comprises) 708 / 0 / 0 ;
  déverrouillage 335 à 390 ms ; défilement 26 tâches, 256 ms au plus, 3 320 ms au total.
- 0.10.4 : écrans principaux (sous-vues comprises) 395 contrôles, 0 sous 48 dp, 0 sous AA ; tous écrans 611 / 0 / 0 ;
  déverrouillage 337 à 412 ms ; défilement 23 tâches, 274 ms au plus, 3 290 ms au total.
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
- Captures d'écran (0.10.9) : interdites (FLAG_SECURE) sauf pendant le mode démo, au premier plan ; décision du
  propriétaire. Hors mode démo, rien ne change.
- Mode démo (0.10.10) : rien de réel à l'écran (dictionnaire tiré des données, `KladDemo`), champs en lecture seule
  (sauf les recherches : ce qu'on y tape soi-même reste affiché), rien d'enregistré ni synchronisé ; décisions prises par
  défaut, à valider : un poste fait seulement de mots courants (« Courses », « Assurance habitation ») garde son nom,
  sinon « Poste N » ; libellé d'un compte fait de mots courants (« Commun ») gardé ; nombres des champs multipliés comme
  les montants.
- Textes (0.10.10) : titres repliés puis réduits, montants entiers, de 320 à 412 px et texte de 100 à 200 % (Accueil,
  Budget, Commun).
- Champs de saisie (0.10.9) : jamais hors de leur conteneur ni de l'écran, contour entier, de 320 à 412 px et texte de
  100 à 200 % (`test/champs.test.mjs`, lancé dans le parcours Chromium de la fabrication).
- Préférences d'affichage gardées hors du coffre (`localStorage`) : seulement `klad.replis` (sections repliées, jusqu'à la
  0.10.3) puis `klad.replis.v2` et sa marque `klad.replis.v` (0.10.4),
  `klad.periode`, `klad.tendance`, `klad.opsPerimetre` (0.10.2 : `perso` / `commun` / `tout`) (liste fermée, `KladUI.pref`),
  `klad.theme` et `klad.palette` (0.10, `klad` / `grafit`) ; l'ordre de la liste des opérations (0.10.8) est gardé pour la session seulement ;
  aucune donnée. La base du reste à vivre n'en fait pas partie : elle est dans le coffre (budget), lue par le résumé Grafit.

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
- Reste à vivre (0.10.7) : base affichée au choix du propriétaire (`S.budget.reglages.rav` : `salaire` par défaut, ou
  `comptes`), même valeur sur l'Accueil et dans Grafit (`left_to_live_basis` = `budget` ou `accounts`) ; sans solde
  connu, colonne « dernier salaire ». Avant la 0.10.7, Grafit prenait d'office les comptes courants.
- Icônes de catégories (0.10.7) : `C.categories[n].icone` = émoji, `svg:<nom>` (repris) ou `lu:<nom>` (banque Lucide,
  `KladIcones`) ; depuis la 0.10.9, uniquement `lu:<nom>` (migration `dessins`, import du carnet converti) ; `C.categories[n].couleur` = `#rrggbb` (choisie dans Klad, prioritaire sur le complément). Plus de lettre
  de repli : une icône est proposée d'après le nom (`KladIcones.proposer`).
- Décisions validées par le propriétaire sur la série UX : catégorie en texte dans les lignes (option A), liste ouverte
  sur « Tout » depuis l'Accueil, recherche par catégorie, contrats et tendance du commun dans Commun › Trésorerie,
  sous-vue gardée pour la session seulement, palette dès UX-1. Réglages › Budget devient modifiable en 9c.

- 1.0.0 (décisions validées par le propriétaire en 1.0.1) : un champ de réglage vidé revient à la valeur du complément ; un
  compte mis sur « Aucun » est un choix de Klad (prioritaire) ; dans l'éditeur avancé, chaque rubrique différente du
  complément importé devient un réglage de Klad, une rubrique supprimée est retirée (`null`) ; une sauvegarde est
  « vérifiée » si elle se déchiffre et contient tous les blocs attendus, même si des données ont changé depuis (les
  différences sont listées) ; le rappel compte 30 jours depuis la date du fichier vérifié ; une restauration vaut
  vérification ; le thème et la palette voyagent avec la sauvegarde ; l'import du complément exige la reprise.

- 1.0.1 (décisions prises par défaut, à valider) : nouveau format de sauvegarde par morceaux (v2), les fichiers v1
  restant lisibles ; messages 5 s, erreurs 6 s, « Annuler » 8 s ; un message plus récent remplace un « Annuler » en
  cours ; message en haut de l'écran quand un volet est ouvert ; bandeau du mode démo replié en pastille après 6 s ;
  l'encart « Reprendre le classement » reste jusqu'au choix (« Plus tard » : écarté pour la session) ; panne passagère
  limitée à la réponse 400 contenant « ASPSP ».

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

## Points d'appui laissés par la 0.10.10

- Mode démo : `KladDemo.construire(S, { ctx, B })` → dictionnaire ; `KladDemo.masquer(texte, D)` ; balayage du DOM et
  origines rendues en sortant dans `KladAffichage` (`texteDemo`, `surVersion`) ; `KladApp.demoDebut` / `demoFin`
  (état d'avant gardé en JSON, journal à part). Un nouvel écran qui affiche une donnée nouvelle (autre que celles du
  dictionnaire) doit l'ajouter dans `construire` ; le test du parcours (`test/demo.test.mjs`) le signale si le jeu
  « personnel » la contient (ajouter alors la donnée au jeu et à `PERSONNEL`).
- Textes : `KladUI.ajuster` (sélecteurs `AJUSTER`, cadres `CADRE`) ; relevé `releveTextes` réutilisable pour d'autres
  écrans (Opérations, volets) si un débordement est signalé.
- Diagnostic d'affichage (0.10.9) : à demander au propriétaire si un défaut d'affichage persiste sur le téléphone.

## Points d'appui laissés par la 0.10.8 (parité des fonctions)

- `docs/parite-fonctions.md` : inventaire des fonctions de la v65 (téléphone et ordinateur) et statut dans Klad.
- Catégories et règles gérées dans Plus › Classement (`plus.js:renderClassement`) ; les anciennes vues `categories` et
  `regles` du Budget ont été retirées en 1.0.0.
- Abandons tranchés en 0.10.9 (décision du propriétaire) : « Liste d'origine » des contrats, liste des bulletins de paie
  non lus. Manquant pour la 9c : pastille « charge récurrente sur le compte secondaire » (compte secondaire réglable).
- Mesures : `tools/mesures/banc.mjs` parcourt aussi Plus › Classement (nouvelle catégorie, catégorie dépliée) et le
  sélecteur d'icône (0.10.7 : 671 contrôles sur les écrans principaux, 0 sous 48 dp, 0 sous AA).

## Maintenance : comment faire

### Rejouer le contrôle (à chaque changement de calcul)
1. Sur le téléphone : Plus › Données › Contrôle › « Exporter le relevé de contrôle » (fichier personnel en clair,
   `klad-controle-AAAAMMJJ-HHMM.json`, à supprimer après le contrôle).
2. Relevé de l'ancienne version (dépôt privé de référence, jamais copié ici) puis comparaison :
   `node tools/controle/carnet-controle.mjs …` et `node tools/controle/comparer.mjs <relevé Klad> <relevé ancienne version>`
   (mode d'emploi : `tools/controle/README.md`). Attendu : points 2 à 7 identiques au centime ; écarts connus listés plus bas.
3. Entre deux versions de Klad, sans donnée réelle : le banc (`tools/mesures/banc.mjs`, option `www`) ouvre une autre
   version de `www/` sur le même jeu fictif ; comparer `KladControle.construire` et `KladResume.construire` à date fixe
   (méthode de `test/sauvegarde.test.mjs`). Un écart sur un calcul : s'arrêter et le signaler.

### Ajouter une donnée au mode démo
Un écran qui affiche une donnée nouvelle (nom, libellé, motif…) : l'ajouter au dictionnaire dans `KladDemo.construire`
(`www/demo.js`) ; ajouter la même donnée au jeu fictif « personnel » (`tools/mesures/donnees.mjs`, `reprisePersonnelle`)
et à la liste `PERSONNEL` ; `test/demo.test.mjs` parcourt tous les écrans en mode démo et signale toute fuite. Les
valeurs des champs sont masquées « ••• » d'office, les nombres multipliés.

### Ajouter un réglage du complément
Ajouter le champ dans `KladReglages.THEMES` (`www/reglages.js`) avec son magasin (`ou`) et son type ; le lecteur du
calcul passe par `KladBudget.complement(S)` (jamais `S.carnet` directement) ; un test dans `test/reglages.test.mjs`.

### Publier un correctif
Branche, `npm test` (parcours Chromium compris), version dans `package.json`, demande de fusion, vérification
« APK Android » verte sans test sauté, fusion ; la fabrication sur `main` publie l'APK signé ; note dans `docs/NOTES.md`
et dans ce fichier ; recette manuelle remise au propriétaire.

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
