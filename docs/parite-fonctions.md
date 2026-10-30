# Parité des fonctions : ancienne version (Carnet v65) → Klad

État à la version **0.10.8**. Chaque fonction visible de l'ancienne version (interface téléphone **et** ordinateur), écran
par écran et bouton par bouton, avec son équivalent dans Klad. Aucune donnée personnelle : personnes désignées
« personne A / B » ou « l'autre personne », comptes désignés par leur rôle (compte courant principal, compte secondaire,
compte commun, carte à débit différé, portefeuille en ligne, livret). Les exemples chiffrés sont fictifs.

Statuts :
- **Présent identique** : même fonction, même place ou presque.
- **Présent adapté** : la fonction existe, autrement (on dit en quoi). « (0.10.8) » : rétablie ou ajoutée par ce lot.
- **Manquant (9c)** : dépend d'un réglage personnel (complément), à faire avec les réglages modifiables de la 1.0.0.
- **Abandonné** : décision déjà prise (citée de `docs/ETAT.md` ou `docs/ux/architecture.md`).
- **Abandon à décider** : proposé au propriétaire, avec la raison ; reste ouvert tant qu'il n'a pas répondu.

Emplacements Klad : écran pour le propriétaire, puis `fichier:fonction` (dossier `www/`).
Emplacements v65 : fonction JS ou libellé (le JS est dans une seule fonction englobante).

## Synthèse

326 lignes de fonctions (téléphone et ordinateur) :

| Statut | Avant (0.10.6) | Après (0.10.8) |
|---|---|---|
| Présent identique | 225 | 226 |
| Présent adapté | 78 | 85 |
| Manquant | 9 lignes (8 fonctions) | 1 (9c) |
| Abandonné (décision déjà prise) | 12 | 12 |
| Abandon à décider | 2 | 2 |

Livré en 0.10.8 (sans clé ni réglage personnel, petit effort) : renommer et supprimer une catégorie, ajouter une règle à
la main (trois pertes de la 0.10.4), aperçu des opérations concernées par une règle, pastille « équilibre » et un seul
ajout par opération, tri des opérations, total de tous les comptes dont épargne.
Reste pour la 9c (1.0.0) : la pastille « charge récurrente sur le compte secondaire » dans le détail d'un poste (le
compte secondaire est désigné par le complément) ; plus largement, les réglages du complément modifiables dans Klad
(Réglages › Budget : cycle de salaire, personnes du commun ; compte secondaire ; motifs de l'extra Mail).
Abandons à décider : « Liste d'origine » des contrats ; liste des bulletins de paie non lus (voir la fin du document).

---

## 1. Cadre de l'appli téléphone : en-tête, onglets, navigation

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Barre d'onglets du bas (Budget, Opérations, Commun, Plus) | `#app-tb`, `appChrome` | Présent adapté | barre du bas : Accueil, Opérations, Budget, Commun, Plus — `index.html`, `app.js:chrome` | — | Variante A validée (5 onglets, Accueil en tête). |
| Pastille du nombre d'opérations non vues sur l'onglet Opérations (99+, animation) | `appBadge` | Présent identique | onglet Opérations — `app.js:renderBadge` | — | |
| Toucher l'onglet actif = retour en haut de l'écran | gestionnaire `#app-tb a` | Présent identique | `app.js` (clic `[data-tab]`) | — | Défilement doux, réduit si « animations réduites ». |
| Onglet Budget touché en mode commun = repasse en perso | gestionnaire `#app-tb a` | Présent adapté | onglets Budget et Commun séparés | — | Plus de bascule cachée : un onglet par périmètre. |
| Titre de l'en-tête selon l'écran | `APP_TITLES`, `appChrome` | Présent identique | en-tête — `app.js:chrome` | — | |
| Sous-titre de l'en-tête : dates du cycle (« Cycle du … au … · terminé ») ou période des opérations (« Depuis … · Perso ») | `appChrome` (`#ah-e`) | Présent identique | en-tête — `vaccueil.js:surTitre`, `app.js:chrome` | — | |
| Pastille de synchronisation (✓ heure, ↻ Synchro…, ! N en retard, ! Erreur) ; toucher = synchroniser | `appPill`, `#ah-sync` | Présent adapté | en-tête — `app.js:renderPastille` | — | En cas d'erreur, ouvre le détail (volet Synchronisation) au lieu de relancer. |
| Bouton loupe de l'en-tête (Opérations) : ouvre / ferme le champ de recherche | `#ah-search`, classe `q-open` | Présent adapté | Opérations : champ de recherche toujours visible — `index.html #q` | — | Décision UX « recherche visible » (`architecture.md` § 1). |
| Bouton thème dans l'en-tête | `#ah-theme` | Abandonné | Plus › Réglages › Apparence | — | Décision : « thème retiré de l'en-tête (Réglages) » (ETAT, série UX). |
| Menu « Plus » en volet du bas (Équilibre, Impôts, Épargne, Relevés et sauvegarde, Synchroniser maintenant, Thème) | `openPlus` | Présent adapté | onglet Plus en page entière, 6 groupes — `app.js:renderPlus` | — | Décision UX : Plus en page, 6 groupes ; « Synchroniser » sort de Plus (pastille, action rapide). |
| Volet du bas générique (poignée, voile, ✕) | `openSheet`, `closeSheet` | Présent identique | `#volet` — `app.js:ouvrirVolet`, `fermerVolet` | — | Klad ajoute un bouton Retour dans le volet. |
| Glisser le volet vers le bas pour le fermer (> 90 px) | `openSheet` (touchmove) | Présent identique | `app.js` (touch sur `.sheet`) | — | |
| Échap ferme le volet | écouteur `keydown` | Présent identique | `app.js` | — | |
| Tirer la page vers le bas pour synchroniser (> 110 px, flèche qui tourne) | `#app-ptr` | Présent identique | `app.js` (`#app-ptr`) | — | |
| Animation d'entrée d'un écran (`v-in`) | `route` | Présent identique | `app.js:montrer` | — | |
| Position de défilement gardée par écran | `VIEWPOS`, `route` | Présent identique | `app.js:montrer` (`pos[v]`) | — | |
| Pied de page avec numéro de version | `.foot #ver` | Présent adapté | pied de page — `app.js` (`$('ver')`) | — | Le numéro ne sert plus à lancer le mode démo (voir § 25). |
| Navigation par adresse (#budget, #operations, #commun, #appartement, #impots, #epargne, #donnees) | `route` | Présent adapté | navigation interne par écran (`app.js:montrer`), table `RETOUR` | — | Bouton Retour d'en-tête pour les écrans « page ». |

## 2. Interface ordinateur (bureau)

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Onglets du haut (Budget, Équilibre, Impôts, Épargne, Relevés & sauvegarde) | `nav.tabs` | Abandonné | — | — | Klad est une appli Android : seule l'interface téléphone est reprise (ETAT, lot 9a « interface identique à l'ancienne version sur téléphone »). |
| Bouton de thème dans la barre d'onglets | `#theme-btn`, `applyTheme` | Abandonné | Plus › Réglages › Apparence | — | Même décision que l'en-tête. |
| Sélecteur Périmètre « Mes comptes / Compte commun » | `[data-scope]` | Présent adapté | Budget : Perso · Commun en haut ; onglet Commun — `index.html .controls` | — | |
| Bandeau collant (périmètre + navigation de cycle) | `.controls.stick`, `setStickB` | Présent identique | `index.html .controls.stick` | — | |
| Grandes tables en colonnes, transformées en cartes sur écran étroit | `cardTables` | Présent identique | `app.js:cartesTableaux` | — | |
| Panneau « Synchronisation » (état, passages du script à heures fixes, comptes en retard) | `renderFresh`, `syncSlots` | Abandonné | volet Synchronisation (Plus, pastille) — `app.js:preparer.secSync` | — | Passages du script bancaire : décision « synchronisation directe Enable Banking (pas de script ni de Drive) ». |
| Sélecteur de catégorie en ligne sur chaque opération | `.tx-cat` → `.tx-sel` puis `#rulebox` | Présent adapté | volet « Classer » — `vues.js:classer` | — | Sur téléphone, la v65 ouvrait déjà le volet. |
| Bouton « 🏠+ » sur une opération (ajouter à l'équilibre) | `.lkb`, `openLinkBox` | Présent adapté | volet Classer › « Ajouter à l'équilibre » — `app.js:ouvrirEquilibreOp` | — | Masqué sur téléphone dans la v65. |
| Bouton ✓ « vue » sur chaque opération | `.tx-seen` | Présent adapté | glisser à droite ; page de détail « Marquer vue » — `vues.js:detail` | — | Masqué sur téléphone dans la v65. |
| Tri des opérations (plus récentes, plus anciennes, plus grosses dépenses, par catégorie) | `#tsort`, `drawTx` | Présent adapté (0.10.8) | Opérations : liste « Tri » à côté des filtres — `vues.js:ordonner` | fait 0.10.8 | Ordre gardé pour la session ; « plus récentes » et « plus anciennes » gardent les blocs par jour, les deux autres affichent la date sur chaque ligne. |
| Boîte « Classer » en bas de la liste (bureau) avec aperçu | `#rulebox`, `openRuleBox`, `updateRuleBox` | Présent adapté | volet Classer — `vues.js:classer` | — | Aperçu : voir § 16. |

## 3. Haut de l'écran Budget (téléphone) et Accueil

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Grand total « Total des comptes courants » (perso) avec heure du relevé | `appHome` (`#app-hero`) | Présent adapté | Accueil › Soldes « Total disponible (courants et commun) » — `vaccueil.js:soldes` ; Budget — `vues.js:hero` | — | Décision UX : la grande carte devient la ligne « Total disponible ». |
| Grand total « Solde du compte commun » (commun) | `appHome` | Présent identique | Commun — `vues.js:hero` ; Accueil › Commun — `vaccueil.js:commun` | — | |
| Carte « N opérations à voir » avec 4 premiers libellés, mène aux non vues | `#app-seen`, `appHome` | Présent adapté | Accueil › À vérifier ; Budget `#app-seen` — `vues.js:aVoir` | — | Sur l'Accueil, ligne de compteur sans libellés. |
| Carte « Ce mois-ci » : 4 postes les plus consommés, barre, « dépassé de / reste … · presque atteint », jours restants, « Tout le budget › » | `#app-month`, `appHome` | Présent adapté | Accueil › Ce cycle-ci — `vaccueil.js:cycle` | — | Dépassés et à surveiller d'abord. |
| Grand chiffre « Reste à vivre » | (dans le suivi, `drawTrack`) | Présent adapté | Accueil en tête, avec « soit N par jour » et barres du cycle — `vaccueil.js:reste` | — | Plus visible qu'en v65 (décision UX). |
| Prochaines échéances | (liste « échéances non mensuelles » du commun, `communCash`) | Présent adapté | Accueil › Prochaines échéances (31 jours, perso et commun) — `vaccueil.js:echeances` | — | Plus large qu'en v65. |

## 4. Soldes des comptes (tuiles)

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Tuile par compte (pastille de banque, solde, « il y a N h », relevé ancien) | `drawBalances` | Présent adapté | Accueil › Soldes, liste verticale — `vaccueil.js:soldes` ; Budget `#bal-panel` — `vues.js:tuile` | — | « ancien » au-delà de 30 h ; aucun montant négatif : « débiteur ». |
| Tuile de la carte à débit différé : montant à prélever | `drawBalances` + fonction de dette de carte | Présent identique | Accueil › Soldes « à prélever le … · depuis le … » — `classement.js:dette` | — | |
| Tuile « compte principal − carte » (disponible après la carte) | `drawBalances` (`bal-sum`) | Présent adapté | « après les cartes » sur le total — `vaccueil.js:soldes` | — | Calculé sur le total, pas sur le seul compte principal (Grafit garde `main_after_card`). |
| Tuile « Total » tous comptes, « dont épargne » | `drawBalances` (`bal-tot`) | Présent adapté (0.10.8) | Accueil › Soldes : « Tous les comptes : … · dont épargne … » — `vaccueil.js:soldes` | fait 0.10.8 | Ligne sous le total disponible, seulement s'il y a un compte d'épargne. |
| Tuile livret saisi à la main (✎ : montant + date) | `livretBal`, `editLivret` | Présent adapté | Épargne › Livret (ouvert depuis sa ligne de l'Accueil) — `vfisc.js:epargne` | — | Décision ETAT : « le livret saisi à la main s'ouvre sur Épargne depuis sa carte » ; intérêts estimés en plus. |
| Comptes d'épargne lus à la banque | `drawBalances` (`sav`) | Présent identique | Accueil › Soldes — `vaccueil.js:soldes` | — | |
| Commun : tuile « Réserve pour échéances » (détail par poste) | `drawBalances`, `communReserve` | Présent identique | Commun — `vues.js:tuile` | — | |
| Commun : tuile « Fin de mois estimée » (solde − prélèvements à venir + virements attendus − réserve) | `drawBalances` | Présent identique | Commun ; Accueil › Commun — `commun.js:finDeMois` | — | |
| Rangée de tuiles qui défile horizontalement (téléphone) | `.bal-row` | Présent adapté | liste verticale | — | Décision UX : « les cartes horizontales deviennent la liste ». |

## 5. Observations et recommandations (audit)

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Panneau « Observations et recommandations » : en-tête « N à faire » par périmètre | `drawAlerts` (`#obs-head`) | Présent identique | Budget › Suivi, Commun › Ce mois — `vbudget.js:observations` | — | Aussi « N observations à faire » dans Accueil › À vérifier. |
| Liste « À faire » (Action / À faire) triée par gravité puis périmètre | `drawAlerts` | Présent identique | `vbudget.js:observations`, `observations.js:observations` | — | |
| Bouton « c'est fait » sur un point (masqué 40 jours ou jusqu'à ce que la situation change) | `.obs-done`, `dismiss` | Présent identique | `[data-fait]` — `ecranbudget.js`, `observations.js:fait` | — | Klad : annulable. |
| « N points marqués fait : … · réafficher » | `.obs-undo` | Présent identique | `[data-reafficher]` — `observations.js:reafficher` | — | |
| Liste « Observations » (Info / OK) | `drawAlerts` (`#alerts`) | Présent identique | `vbudget.js:observations` | — | |
| Étiquette de périmètre (Perso / Commun / Général) sur chaque point | `drawAlerts` (`sc-tag`) | Présent identique | `vbudget.js:observations` | — | |
| Bouton « Relancer l'audit » (synchronise puis recalcule) | `#audit-btn` | Présent identique | `[data-audit]` — `ecranbudget.js` | — | |
| Date de l'audit (« audit du … · mes comptes et compte commun ») | `#audit-at` | Présent identique | `vbudget.js:observations` | — | |
| Bouton « Analyse de Claude » (6 mois, budget, parts, réponse en continu) | `runAI`, `aiPrompt` | Présent adapté | extra Claude, désactivé par défaut — `extras.js:analyser` | 9b fait | Agrégats seulement, aperçu et coût avant envoi (ETAT, lot 9b). |
| Règle : charges récurrentes prélevées sur le compte secondaire (à basculer) | `audit` | Présent adapté | `observations.js:audit` | complément | Compte secondaire désigné par le complément (ETAT, lot 8). |
| Règle : relevés en retard (> 3 j) | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : virements du commun à l'heure / après l'échéance du prêt / absents du mois | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : ancien contrat résilié encore prélevé / arrêté | `audit` (motif codé en dur) | Présent adapté | `observations.js:audit` (contrat à montant 0 encore prélevé) | — | Rendue générique (ETAT, lot 8). |
| Règle : prélèvement mensuel du commun absent depuis 45 jours | `audit` (motif codé en dur) | Présent adapté | `observations.js:audit` (« … : prélèvement absent », tout contrat mensuel du commun) | — | Rendue générique. |
| Règle : PDF d'appel de fonds pas encore archivé | `audit` (`noPdf`) | Présent adapté | carte de l'appel « PDF pas encore lu » — `vcommun.js:appels` | — | Pas de point dans les observations (archivage par Drive abandonné). |
| Règle : virement à faire au syndic (montant, appels non réglés, coordonnées) | `audit` | Présent identique | `observations.js:audit` | complément | Nom et coordonnées du syndic : complément (`klad.appels`). |
| Règle : portefeuille en ligne pas encore détaillé / détaillé en partie | `audit` | Présent identique | `observations.js:audit` | — | Écart connu sur un prélèvement sans correspondance (ETAT). |
| Règle : opérations à classer (60 derniers jours) | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : aligner un poste sur son contrat | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : virement ponctuel vers le commun (part de chacun) | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : ordre permanent à modifier (par personne) | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : montant reçu différent de l'ordre prévu | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : virements du mois non reçus / reçus / en partie | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : ordres permanents conformes | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : virement récurrent absent de la liste des ordres | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : budget du mois dépassé (3 postes) | `audit` | Présent identique | `observations.js:audit` | — | |
| Règle : balance sur 3 mois (négative / positive) | `audit` | Présent adapté | `observations.js:audit` « Balance déficitaire sur 3 mois » | — | Formulation sans montant négatif (ETAT, 0.10.6). |
| Règle : impôts (taux non personnalisé, solde estimé) | `audit`, `taxAlerts` | Présent identique | `observations.js:audit`, `fisc.js:alertes` | — | |
| Règle : taxe foncière (déclaration d'achèvement, prochaine échéance) | `audit`, `tfAlerts` | Présent identique | `observations.js:audit` | — | |
| Règle : impôt à régulariser entre les deux personnes / estimation de l'année | `audit`, `regulList` | Présent identique | `observations.js:audit` | complément | Noms des personnes : complément. |
| Règle : salaire absent depuis 38 jours / dernier salaire | `audit` | Présent identique | `observations.js:audit` | complément | Critères du salaire : complément (`klad.salaire`). |
| Section repliée par défaut au premier lancement | `carnet.foldv8` | Présent adapté | observations dans Budget › Suivi ; mémoire des plis `klad.replis.v2` | — | |

## 6. Budget — période et cycle

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Cycle de salaire en cours (du dernier salaire à la veille du suivant) | `salaryCycle` | Présent identique | `budget.js` (cycle), `vbudget.js:cycNav` | complément | Critères du salaire : complément ou réglages Klad. |
| Repli sur le mois civil sans salaire | `curPeriod` | Présent identique | `budget.js` | — | |
| Bascule « Depuis le salaire / Depuis le 1er » | `drawCycNav` (`data-cs`), `CSTART` | Abandonné | — | — | Décision du propriétaire (ETAT, 0.9.0 et 0.6). |
| ◀ Précédent / Suivant ▶ cycle par cycle | `drawCycNav`, `goMonth`, `pastCycle` | Présent identique | `[data-nav]` — `vbudget.js:cycNav`, `ecranbudget.js` | — | |
| Bouton « Cycle en cours » (retour) | `.cn-now`, `backToCurrent` | Présent identique | `data-nav="now"` — `vbudget.js:cycNav` | — | |
| Libellé « Cycle du … au … · terminé », durée affichée si cycle anormal (< 26 ou > 35 j) | `cycLab` | Présent identique | `vbudget.js:libellePeriode` | — | |
| Légende téléphone « budget · consommé · reste » | `drawCycNav` (`cn-leg`) | Présent identique | `vbudget.js:cycNav` | — | |
| Bouton « ◀ Mois précédent » dans l'en-tête du budget | `#b-prev` | Présent identique | `vbudget.js:teteBudget` | — | |
| Bandeau « Période clôturée » + « Revenir au cycle en cours » | `drawTrack` (`past-band`, `#b-back`) | Présent identique | `vbudget.js:suivi` | — | |

## 7. Budget — Suivi (mode par défaut)

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Bascule « Suivi / Budget » | `setBMode`, `[data-bmode]` | Présent identique | Budget › Suivi — `vbudget.js:teteBudget`, `ecranbudget.js` | — | |
| Section Revenus : budget, reçu, état (en partie, non reçu, attendu le …) | `drawTrack` | Présent identique | `vbudget.js:suivi`, `budget.js:suivi` | — | |
| Commun : revenus = apports attendus de chaque personne | `drawTrack` (`shareTotals`) | Présent identique | `budget.js:suivi` | complément | Noms des personnes. |
| Déplier un revenu pour voir ses opérations | `drawTrack` (clé `rev`) | Présent identique | `[data-poste]` — `ecranbudget.js` | — | Rétabli en code (commentaire « 0.10.7 »). |
| Sections Charges fixes / courantes / optionnelles / Hors budget avec Budget, Utilisé, Reste | `drawTrack` (`gBud`, `gUse`) | Présent identique | `vbudget.js:suivi` | — | |
| Téléphone : sections repliées, « voir les N ▾ / replier ▴ » | `secOpen`, `secBtn` | Présent identique | `[data-sec]` — `vbudget.js:suivi` | — | Klad met en plus les dépassés en tête (bloc « Dépassés »). |
| Pastilles « N dépassés » / « N à surveiller » / « N à vérifier » sur une section repliée | `drawTrack` | Présent identique | `vbudget.js:suivi` | — | |
| Bureau : ligne de synthèse d'une section repliée (« N à surveiller ci-dessus · M conformes ») | `drawTrack` (`fx-sum`) | Présent adapté | téléphone seulement : bouton « voir les N » | — | |
| Case « consommé / budget » avec barre et repère du jour (« jour N sur M ») | `conso` | Présent identique | `vbudget.js:suivi` | — | |
| État d'un poste : conforme, à surveiller (projection), dépassé, hors budget | `lineState` | Présent identique | `budget.js:suivi` | — | |
| Charges fixes : prélevé, prélevé + écart, pas d'échéance ce mois, provision, payée N échéances | `lineState` | Présent identique | `budget.js:suivi` | — | |
| Projection fin de période d'après le rythme des 90 jours précédents | `drawTrack` (`HR`) | Présent identique | `budget.js:suivi` | — | |
| Déplier un poste : opérations de la période et contrats du poste | `drawTrack` (`more`, `drawLine`) | Présent identique | `[data-poste]` — `vbudget.js:suivi` | — | |
| Lien « classer ▾ » sur une opération du détail (boîte de classement sous la ligne) | `openRuleInline` | Présent adapté | `[data-classer]` ouvre la page de l'opération — `app.js:ouvrirOp` | — | |
| Pastille « charge récurrente sur le compte secondaire » sur une opération du détail | `detRow` (fonction des charges récurrentes) | Manquant (9c) | — | 9c · complément | Le point existe dans les observations ; la pastille dans le détail du poste attend que le compte secondaire soit réglable dans Klad (9c). |
| Ligne « Cause » sous un poste fixe ou du commun dépassé (doublon, contrat > budget, montant changé…) | `causeOf`, `causeRow` | Présent identique | `vbudget.js:suivi`, `budget.js` (cause) | — | |
| Bouton « aligner le budget sur … » dans la cause | `.cz-fix` | Présent identique | `[data-aligner]` — `ecranbudget.js` | — | Klad : annulable. |
| Contribution au commun (perso) : « répartition ▾ » = ma part de chaque poste du commun | `drawLine` (clé `lk split`) | Présent identique | `vbudget.js:suivi` (« Ma part du compte commun ») | — | |
| Barre « Total des dépenses » : dans le budget / hors budget, repère du budget, dépassé de | `totBar` | Présent identique | `vbudget.js:totBar` | — | |
| « Causes du dépassement (N) » sous le total | `drawTrack` (`tb-cz`) | Présent identique | `vbudget.js:suivi` | — | |
| Perso : « Solde prévu par le budget » + réel à ce jour + projeté fin de mois | `drawTrack` (`solrow`) | Présent identique | `vbudget.js:soldeBar` | — | |
| Commun : « Solde du compte commun » + variation réelle + provisions du mois | `drawTrack` | Présent identique | `vbudget.js:soldeBar` | — | |
| Période close : colonne Écart et « Solde de la période » (prévu, écart) | `drawTrack` (`ecCell`) | Présent identique | `vbudget.js:suivi` | — | |
| « Plus gros écarts » (3 postes) | `drawTrack` (`#b-over`) | Présent identique | `vbudget.js:suivi` | — | |
| Répartition des dépenses de la période (par nature, puis 7 catégories + autres) | `drawSplitIn('split-b')` | Présent identique | `vbudget.js:repartition` | — | |
| « Comment c'est calculé » sous le budget | `#budget-note` | Présent identique | `ui.js:comment` (dans `vbudget.js`) | — | |

## 8. Reste à vivre et marge réelle

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Carte dépliable « Reste à vivre jusqu'au … » (sur le dernier salaire · sur les comptes courants) | `drawTrack` (`mg-det`, `#rav-m`) | Présent adapté | Accueil (grand chiffre) et Budget `#rav-m` — `vbudget.js:ravM`, `carteRav` | — | Décision ETAT : le volet « Reste à vivre » séparé disparaît. |
| Tableau Base − Charges fixes = Marge − Variable = Reste à vivre (2 colonnes) | `drawTrack` (`rav-t`) | Présent identique | volet Reste à vivre — `vbudget.js:detailRav` | — | |
| Ligne « commun aux deux » quand les 2 colonnes sont égales | `drawTrack` (`R`) | Présent identique | `vbudget.js:detailRav` | — | |
| Mémoire de la carte ouverte / fermée | `MG_OPEN` | Présent adapté | volet ouvert à la demande | — | |
| Commun : « Marge réelle du commun » (disponible − fixes à venir − reste du variable ; « avec virements attendus ») | `drawTrack` (`cm-rav`) | Présent identique | `vbudget.js:ravM` ; `commun.js:margeReelle` | — | |
| Message « la marge réelle apparaîtra avec les soldes » | `drawTrack` | Présent adapté | message générique « Calcul impossible » / soldes à lire | — | |

## 9. Budget — mode « Budget » (plan)

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Colonnes Poste · Réel habituel · mois en cours · Budget · (commun : part %, ma part, Équilibre) | `drawBudget` (`#bhead`) | Présent identique | `vbudget.js:plan` | — | |
| Base de calcul « depuis » (mois de départ de la référence) | `#bref`, `refWindow`, `budgetRef` | Présent identique | `#bref` — `vbudget.js:teteBudget`, `ecranbudget.js:choisirRef` | — | Klad : annulable ; rappel dans Plus › Réglages › Budget. |
| Base de calcul par défaut (date d'un premier prélèvement de prêt, sinon 6 mois) | `defaultRef` (motif codé en dur) | Présent adapté | `budget.js` (6 derniers mois complets) | — | Motif personnel non repris. |
| « Tout aligner sur le réel habituel » | `#reset-budget` | Présent identique | `[data-alignertout]` — `budget.js:alignerTout` | — | Klad : annulable. |
| Réel habituel : médiane (variables), moyenne (fixes), 12 mois ÷ 12 (non mensuels) | `budgetLines` | Présent identique | `budget.js:postes` | — | |
| Bouton « = » : aligner un poste sur le réel habituel | `.alignbtn` | Présent identique | `[data-paligner]` — `vbudget.js:plan` | — | |
| Toucher le réel habituel : détail mois par mois (barres) | `.refbtn`, `monthsOpen` | Présent identique | `[data-pmois]` — `vbudget.js:plan` | — | Klad ajoute l'explication du calcul. |
| Détail d'un poste : sous-catégories ou montants récurrents, contrats | `.more`, `catsOpen` | Présent identique | `[data-pdet]` — `vbudget.js:plan` | — | |
| Case à cocher : poste compté ou non dans le budget | checkbox `bl-…` | Présent identique | `[data-pon]` — `ecranbudget.js` | — | |
| Saisie du montant (par échéance) | `.planbox input` | Présent identique | `[data-pamt]` — `ecranbudget.js` ; volet « Budget du poste » | — | |
| Périodicité / mois, / trim., / 4 mois, / an (échéance → coût mensuel lissé) | `select.per`, `PER` | Présent identique | `[data-pper]` — `vbudget.js:plan` | — | |
| « + Ajouter un poste » par nature (liste des catégories ou sous-catégories fixes) | `.addpost` | Présent identique | `[data-ajoutposte]`, volet « Ajouter un poste » — `vbudget.js:plan` | — | |
| « ✚ nouveau poste fixe… » (saisie d'un nom) | `.addpost` (`__new`) | Présent identique | `vbudget.js:plan` | — | |
| ✕ Retirer un poste (confirmation, annulable) | `.rm-line`, `armRemove`, `undoToast` | Présent identique | `[data-pretirer]` — `ecranbudget.js`, `budget.js:retirer` | — | |
| Revenus : cocher, médiane, montant prévu | `drawBudget` (revenus) | Présent identique | `vbudget.js:plan` | — | |
| Salaire attendu : moyenne des 3 derniers / dernier / montant libre | `.salmode`, `SAL_MODES` | Présent identique | `[data-psal]` — `KladBudget.MODES_SALAIRE` | — | |
| Total « = Reste / mois (total des dépenses prévues) » | `drawBudget` | Présent identique | `vbudget.js:plan` | — | |
| Contribution au commun liée au total de ma part (lien « = total … du compte commun ») | `budgetLines` (`LINK_KEY`), `.golink` | Présent identique | `vbudget.js:plan` (poste lié) | complément | Libellé du poste lié : réglages du commun. |
| Formule gardée dans un montant (formule réaffichée au toucher) | `calcify`, `p.f` | Présent adapté | `app.js` (`dataset.formule`), `budget.js` (`f`) | — | Gardée pendant la saisie et reprise du carnet. |
| Calculateur carburant (trajet A/R, jours, autres km, consommation, prix ; réel des pleins médiane / moyenne) | `fuelRow`, `fuelCalc` | Présent identique | `[data-fuel]` — `vbudget.js:carburant` | — | Repris en 0.9.0. |
| « Reporter au prévu Carburant » | `#fuel-apply` | Présent identique | `[data-fuelok]` — `ecranbudget.js` | — | |
| Commun : part de la personne A (%) par poste | `.sh-pg`, `shareOf` | Présent identique | `[data-ppg]` ; volet « Ma part (%) » — `vbudget.js:plan` | complément | Noms des personnes. |
| Commun : case « Équilibre » par poste (rattrapage) | `.sh-elig` | Présent identique | `[data-pelig]` — `vbudget.js:plan` | — | |
| Commun : encarts « Virement mensuel » de chaque personne (versé en moyenne) et « Rattrapage par mois » | `#share-sum` | Présent identique | `vbudget.js:plan` | complément | Noms des personnes. |
| Commun : ajouter un poste commun (libellé, montant, part %) | `#sh-add` | Présent identique | `[data-shajout]` — `ecranbudget.js` | — | |
| Commun : ✕ supprimer un poste commun ajouté à la main | `.sh-del` | Présent identique | `[data-pretirer]` | — | |
| Note de bas de tableau (base, mois complets, règles) | `#budget-note` | Présent identique | `vbudget.js:plan` | — | |

## 10. Contrats et virements permanents

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Tableau « Contrats — montants des documents » (perso ou commun) | `drawContracts` | Présent identique | Budget › Contrats ; Commun › Trésorerie — `vbudget.js:contrats` | — | |
| Colonnes Document · Dernier prélèvement · état (conforme, non trouvé, aucun prélèvement, N échéances) | `drawContracts` | Présent identique | `budget.js` (état du contrat) | — | |
| Colonne prévu du poste (aligné / à aligner / poste absent) | `drawContracts` | Présent identique | `vbudget.js:contrats` | — | |
| « → prévu » : reporter le total des contrats dans le budget du poste | `.toplan` | Présent identique | `[data-versprevu]` — `budget.js:versPrevu` | — | |
| « Modifier la liste » / « Terminer » | `#c-edit` | Présent identique | `[data-ctedit]` — `vbudget.js:contrats` | — | |
| Édition d'un contrat : libellé, source, montant (calcul), périodicité, mot du libellé bancaire, poste du budget (dont « nouveau poste ») | `drawContracts` (`.ce`) | Présent adapté | formulaire en volet — `vbudget.js:formContrat` | — | |
| Poste deviné d'après le libellé du contrat | `guessKey` | Présent identique | `vbudget.js:formContrat` / `budget.js` | — | À vérifier à l'usage. |
| « + Ajouter un contrat », « Supprimer » | `#c-add`, `.cdel` | Présent identique | `vbudget.js:contrats` | — | |
| « Liste d'origine » (remettre la liste préremplie) | `#c-reset`, liste codée en dur | Abandon à décider (question au propriétaire) | — | — | La liste d'origine était écrite dans le code avec des données personnelles ; équivalent : Plus › Données › Importer › reprise de l'ancienne version. |
| Échéances à venir (contrats, prélèvements récurrents, carte) | `communCash` (`due`) | Présent adapté | Budget › Contrats (échéances) — `budget.js:echeances` | — | Plus complet que la v65. |
| Ordres permanents vers le commun (qui, depuis, montant, jour, usage, libellé) en édition | `drawContracts` (`#p-virements`, `.ve`) | Présent identique | volet « Ordres permanents » — `vcommun.js:ordres` | complément | Noms des personnes. |
| « + Ajouter un virement », « Supprimer » | `#v-add`, `.vdel` | Présent identique | `[data-vajout]`, `[data-vsuppr]` | — | |
| Repli par défaut des contrats et virements | `carnet.foldv3` | Présent adapté | sous-vue Contrats | — | |

## 11. Tendance

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Graphique « Revenus, dépenses et balance par mois » (barres + courbe, points verts / rouges) | `drawMonthly` | Présent identique | Budget › Tendance — `vbudget.js:tendance` | — | Axes sans montant négatif (ETAT, 0.9.0). |
| Série « Balance mensuelle » (barres vertes / rouges) | `drawTend` (`bal`) | Présent adapté | `vbudget.js:tendance` | — | Légende « positive / déficitaire » sans signe moins. |
| Série « Balance cumulée » | `drawTend` (`cum`) | Présent identique | `vbudget.js:tendance` | — | |
| Série « Solde du compte courant » reconstitué en fin de mois | `drawTend` (`solde`) | Présent identique | `vbudget.js:tendance` | — | |
| Série « Une catégorie » avec budget mensuel en pointillés et barres rouges au-dessus | `drawTend` (`cat:`) | Présent identique | `vbudget.js:tendance` | — | |
| Choix des comptes : comme en haut, mes comptes, compte commun, tous comptes confondus, un compte | `TACC_OPT`, `#tend-acc` | Présent identique | `#tend-acc` — `vbudget.js:tendance` | — | Comptes tirés des données (pas de liste codée). |
| Tous comptes confondus : virements internes et part au commun comptés une fois | `drawTendScoped` | Présent identique | `budget.js` | — | |
| Période d'analyse : ◀ ▶ d'un mois, « Du … au … », raccourcis 1 / 3 / 6 / 12 mois / Tout | `.per-step`, `#from`, `#to`, `[data-preset]`, `#an-lab` | Présent identique | `vbudget.js:panneauTendance` | — | Période gardée (`klad.periode`) ; indépendante de celle des opérations (ETAT). |
| Info-bulle au toucher / survol (mois, valeurs) | `hover` | Présent identique | `vbudget.js:tendance` (`data-i`, `.tip`) | — | |
| Note sous le graphique (balance moyenne, mois déficitaires, meilleur / pire mois) | `drawMonthly` (`#tend-note`) | Présent identique | `vbudget.js:tendance` | — | |
| Légende et « Comment c'est calculé » (comptes retenus) | `#tend-leg`, `#tend-how` | Présent identique | `vbudget.js:tendance` | — | |
| Dessin différé si la section est repliée | `LAZY.tend` | Présent adapté | sous-vue Tendance dessinée à l'affichage | — | |

## 12. Résultats et répartition

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Bilan d'une période close (budget, reçu / consommé, écart par poste) | `drawTrack` (période passée) | Présent identique | Budget › ◀ — `vbudget.js:suivi` | — | La v65 n'a plus de panneau « Résultats » séparé (code mort `drawClosure`). |
| Tableau de clôture Revenus − fixes − courantes − optionnelles − hors budget = solde, épargne réalisée | `periodBlock` (panneau absent de la page) | Présent adapté | volet Résultats — `vfisc.js:resultats` ; Accueil « bilan du cycle précédent » | — | Ajout Klad (lot 8) ; la v65 ne l'affichait plus. |
| Répartition des dépenses (nature, catégories) | `drawSplitIn` | Présent identique | `vbudget.js:repartition` ; `vfisc.js:repartition` | — | |

## 13. Compte commun

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Panneau « Virements à mettre en place » (N ordres à modifier / conformes) | `drawCommunPlan` | Présent identique | Commun › Ce mois — `vcommun.js:plan` | — | |
| Carte par personne : demandé par le budget, ordres par usage, « à garder » / « passer à … » | `drawCommunPlan` (`card`, `vline`, `act`) | Présent identique | `vcommun.js:cartes` | complément | Noms des personnes. |
| Reçu ce mois sur chaque ordre (reçu le …, montant différent, attendu le …, non reçu) | `recvTxt`, `virSeen` | Présent identique | `vcommun.js:cartes`, `commun.js` | — | |
| Virement ponctuel (montant, part de chacun au prorata des charges non mensuelles, date limite) | `communPlanData` (`pon`) | Présent identique | `vcommun.js:cartes`, `commun.js:plan` | — | |
| Phrase de situation (solde, retour au positif, prochain point bas et sa cause) | `drawCommunPlan` (`sit`, `res`) | Présent identique | `vcommun.js:plan` (Creux passager, Manque qui revient) | — | |
| Bouton « Modifier les ordres » | `#v-edit2` | Présent identique | `[data-ouvrir]` volet Ordres permanents | — | |
| Sous-partie « Appels de fonds » (à virer / à jour) | `appelsHtml`, `appelsState` | Présent identique | Commun › Trésorerie — `vcommun.js:appels` | complément | Titre et syndic : complément (`klad.appels.titre`, `klad.appels.syndic`). |
| Appel : trimestre ou avance, exigible le …, source (mail, relevé du syndic), montant estimé ou lu, payé / en partie / en retard | `appelsHtml` (`row`) | Présent identique | `vcommun.js:appels` | — | |
| Appels réglés regroupés (« N appels réglés ✓ ») | `appelsHtml` (`ap-done`) | Présent identique | `vcommun.js:appels` | — | |
| « Virement à faire : … à l'ordre de … » avec coordonnées du syndic | `appelsHtml` (`ap-pay`) | Présent identique | `vcommun.js:appels` | complément | Coordonnées : données du carnet ou complément. |
| Contrôle avec le relevé du syndic (« Conforme au relevé du … ») | `appelsHtml` (`chk`) | Présent identique | `vcommun.js:appels` | — | |
| Liens vers le mail et le PDF de l'appel | `appelsHtml` (`it.url`, `pdf.url`) | Abandonné | — | — | Drive et Gmail hors périmètre (ETAT, « script bancaire Google et Drive ») ; lecture des mails par l'extra IMAP. |
| État de la vérification des mails du syndic | `APPELS._mail`, `syncAppelMails` | Présent adapté | extra Mail, « Lire les mails » — `[data-liremails]`, `mail.js` | 9b fait | Désactivé par défaut. |
| Lecture des appels déposés dans Drive (relevé du syndic) | `syncAppels` | Abandonné | — | — | Drive hors périmètre (ETAT). |
| Sous-partie « Trésorerie · 12 mois » (barres fin de mois, trait du point bas, info-bulle) | `drawCommunPlan` (`cash`), `communCash` | Présent identique | Commun › Trésorerie — `vcommun.js:tresorerie` | — | |
| « Solde le plus bas prévu » (date, découvert si négatif) | `drawCommunPlan` | Présent identique | `vcommun.js:tresorerie` | — | Alerte Grafit `OVERDRAFT_RISK` en plus. |
| « Prochaines échéances non mensuelles » (6) + taxe foncière prévue | `drawCommunPlan`, `tfDueHtml` | Présent identique | `vcommun.js:tresorerie` | — | |
| « Réserve · N mis de côté par mois » et conclusion | `drawCommunPlan` | Présent identique | `vcommun.js:tresorerie` | — | |
| Impôts du commun suivis sur les prélèvements réels (à la source, solde étalé) | `communTaxEv` | Présent identique | `commun.js:impots` | — | Motifs de l'administration fiscale génériques. |
| Sous-partie « D'où vient le solde » / « Ce que le virement ponctuel compense » (solde au départ + apports − budget ± écarts = solde) | `communWhy`, `whyHtml` | Présent identique | `vcommun.js:origine`, `commun.js:origine` | — | |
| Étiquettes passager / récurrent / hors budget / écart / marge | `whyHtml` (`tag`) | Présent identique | `vcommun.js:origine` | — | |
| Sous-parties repliables avec mémoire (ouvertes sur ordinateur, fermées sur téléphone) | `cmSub`, `CMSUB` | Présent identique | `vcommun.js` (`cmSub`) | — | |

## 14. Équilibre (apports au bien commun)

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Écran Équilibre (onglet bureau, Plus téléphone) | `#view-appart`, `renderEq` | Présent adapté | Commun › Équilibre — `vcommun.js:equilibre` | — | Décision UX : Équilibre dans Commun. |
| Barre vers le 50/50, « Reste à combler », « Rattrapage par mois », « Équilibre atteint vers » | `renderEq` (`eq-hero`) | Présent identique | `vcommun.js:equilibre` | complément | Noms, apports initiaux : complément (`klad.equilibre`). |
| Simulateur (ajout mensuel, versement ponctuel → nouvelle date) | `renderEq` (`sim`) | Présent identique | `#eqSimX`… — `vcommun.js:equilibre` | — | |
| « Comment chacun a investi » (apport, versements, part des charges qui ne comptent pas, équipements, total, versé chaque mois) | `renderEq` (`eq-compo`) | Présent identique | `vcommun.js:equilibre` | complément | Apports et historique : complément ou carnet. |
| Graphique « Investissement cumulé » de chacun avec projection en pointillés et info-bulle | `drawEqChart` | Présent identique | `vcommun.js:graphique` | — | |
| « Ce que le compte commun a payé, et avec quel argent » | `renderEq` (`eq-uses`) | Présent identique | `vcommun.js:equilibre` | — | |
| « Dépenses payées en direct » : ajout (date, dépense, montant, payé par A / B / moitié-moitié) | `#ma-add`, `splitPay` | Présent identique | `[data-eqajout]` — `ecranfisc.js` | — | |
| Cocher / décocher ce qui compte ; retirer une dépense ajoutée | `renderEq` (checkbox, `retirer`) | Présent identique | `[data-eqon]`, `[data-eqsuppr]` — `ecranfisc.js` | — | |
| Résumé « N dépenses comptées sur M » + « voir les N ▾ » | `renderEq` (`eq-equip-sum`) | Présent identique | `vcommun.js:equilibre` | — | |
| Ajouter une opération à l'équilibre depuis la liste (libellé, montant, payé par) | `openLinkBox`, `#lk-save` | Présent identique | volet Classer › « Ajouter à l'équilibre » — `app.js:ouvrirEquilibreOp` | — | |
| Pastille « 🏠 appart. » sur une opération déjà comptée ; bouton masqué si déjà ajoutée | `drawTx` (`LK`, `linkedKeys`) | Présent adapté (0.10.8) | pastille « équilibre » sur la ligne ; volet Classer « Déjà dans l'équilibre… » (retirer) — `commun.js:equipementDeOp`, `app.js:ouvrirEquilibreOp` | fait 0.10.8 | Un second ajout est impossible (pas de double compte). |
| « Tous les mouvements du compte commun » : filtre par nature (liste et pastilles de totaux), total | `#eq-kind`, `eqKind`, `eq-ops-nat` | Présent identique | `vcommun.js:equilibre` (filtre, pastilles) | complément | Motifs de nature (prêteurs, syndic) : complément. |
| Repli par défaut de « payé par le commun » et « tous les mouvements » | `carnet.foldv7` | Présent adapté | plis Klad (`klad.replis.v2`) | — | |

## 15. Opérations : liste, filtres, recherche, période

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Liste par jour : en-tête « jour + date » et total du jour | `drawTx` (`tx-day`) | Présent identique | `vues.js:tranche` | — | |
| Ligne : icône, libellé lisible, compte, catégorie · sous-catégorie, montant | `drawTx`, `cleanLab`, `iconFor` | Présent identique | `vues.js:ligne`, `libelleCourt` | — | Klad : ligne nommée pour le lecteur d'écran. |
| Point « non vue » sur la ligne | `.unseen` | Présent identique | `vues.js:ligne` | — | |
| Étiquette « règle » (classée par une de vos règles) | `drawTx` | Présent identique | `vues.js:ligne` | — | Masquée sur téléphone en v65, visible dans Klad. |
| Étiquette « non comptée » (épargne, hors budget, interne) | `drawTx` | Présent adapté | `vues.js:ligne` (« interne », « interne (à la main) », « non comptée ») | — | Opérations internes jamais masquées (ETAT). |
| Montant crédit en vert / non compté grisé | `drawTx` (`amt`) | Présent identique | `vues.js:ligne` | — | |
| Recherche dans les libellés | `#q` | Présent adapté | `#q` — libellé ou catégorie | — | Recherche élargie à la catégorie. |
| Filtre « Toutes » | `[data-ch=all]` | Présent identique | `vues.js:filtres` | — | |
| Filtre « Non vues N » | `[data-ch=unseen]`, `#tx-unseen` | Présent identique | `vues.js:filtres` | — | |
| Filtre « Non classées N » | `[data-ch=nc]`, `fcat=__nc` | Présent identique | `vues.js:filtres` | — | |
| Filtre par catégorie | `#app-fcat`, `#fcat` | Présent identique | `#opsCat` — `vues.js:filtres` | — | |
| « Tout marquer vu » (annulable) | `#tx-allseen`, `#ch-allseen` | Présent identique | `[data-f=toutVu]` — `app.js` | — | |
| Message « ✓ Toutes les opérations de la période ont été vues » | `drawTx` | Présent identique | `app.js:renderOps` | — | |
| Périmètre de la liste = Perso ou Commun selon l'écran | `accIn`, `scope` | Présent adapté | Perso · Commun · Tout — `vues.js:perimetre` | — | Choix visible (0.10.2). |
| Période de la liste = période d'analyse (du … au …) | `drawTx` (`from`, `to`) | Présent adapté | filtre de période propre + dates libres — `#opsPer`, `#opsDu`, `#opsAu` | — | Décision ETAT : période des opérations indépendante de la tendance. |
| 400 opérations au plus, puis « N opérations plus anciennes : affinez » | `drawTx` | Présent adapté | suite chargée par tranches — `app.js`, `vues.js:tranche` | — | UX-7. |
| Tri (plus récentes, plus anciennes, plus grosses dépenses, par catégorie) | `#tsort` | Présent adapté (0.10.8) | Opérations — `vues.js:ordonner` | fait 0.10.8 | Voir § 2. |
| Glisser à droite : vue / non vue | gestes sur `TXR` | Présent identique | `app.js` (`sw-r`) | — | |
| Glisser à gauche : ouvre « Classer » | gestes sur `TXR` | Présent identique | `app.js` (`sw-l`) | — | |
| Toucher la catégorie d'une ligne : ouvre « Classer » | `.tx-cat` → `openCatSheet` | Présent adapté | toucher la ligne ouvre la page de détail, puis « Classer » | — | 0.10.2 : détail en page. |
| Garder l'opération à la même hauteur après un classement | `txAnchor`, `keepTx`, `rowAnchor` | Présent adapté | position de défilement gardée par écran | — | Ancrage fin sur la ligne non repris ; à vérifier à l'usage. |
| Appuis ignorés pendant le recalcul après un classement | `RC_BUSY` | Présent adapté | recalcul unique par changement (`app.js:changed`) | — | |
| Liste masquée hors de l'onglet Opérations (téléphone) | `ops-mode` | Présent identique | `html.ops-mode` | — | |

## 16. Classer une opération (volet et boîte)

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Volet « Classer » : en-tête (icône, libellé, date, compte, montant) | `openCatSheet` | Présent identique | `vues.js:classer` | — | |
| Grille des 7 catégories les plus utilisées (150 derniers jours) + « ⋯ Toutes » | `openCatSheet`, `catFreq` | Présent identique | `vues.js:classer`, `classement.js:frequentes` | — | |
| Sous-catégorie (préremplie, suit la catégorie choisie) | `#cs-sub` | Présent identique | `#clsSub` | — | |
| Interrupteur « Classer aussi les autres » + mot du libellé proposé | `#cs-sw`, `#cs-kw`, `suggestKw` | Présent identique | `#clsAutres`, `#clsMot` | — | Klad ajoute « seulement ce compte » et débits / crédits. |
| Compteur « N opérations contiennent … » / « Seule cette opération sera classée » | `openCatSheet` (`upd`) | Présent identique | `#clsN` — `app.js:nbConcernees` | — | |
| Bouton « Classer en … (N) » ; marque l'opération vue | `#cs-go` | Présent identique | `[data-a=go]` — `app.js:appliquerClasser` | — | |
| « Seulement cette opération » (correction unique) | `#rb-one`, `singles` | Présent adapté | interrupteur coupé = correction de cette seule opération | — | |
| Aperçu des 8 dernières opérations concernées avant de créer la règle | `updateRuleBox` (`#rb-preview`) | Présent identique (0.10.8) | volet Classer et Plus › Classement › Nouvelle règle — `vues.js:apercuRegle` | fait 0.10.8 | Les 8 plus récentes, puis « et N autres ». |
| « Classer ces N opérations et créer la règle » / « Annuler » | `#rb-apply`, `#rb-cancel` | Présent adapté | même volet | — | |
| Annuler un classement | — (toast simple en v65) | Présent adapté | toast « Annuler » — `ecranbudget.js:classementAnnulable` | — | Mieux qu'en v65. |
| Lien « 🏠 Ajouter à l'équilibre » (débit hors commun) | `openCatSheet` (`sh-alt`) | Présent identique | `[data-a=equilibre]` | — | Voir l'écart « déjà ajoutée » au § 14. |

## 17. Catégories

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Liste des catégories avec nature et nombre d'opérations | `renderCats` | Présent identique | Plus › Réglages › Classement — `plus.js:renderClassement` | — | Décision UX : catégories et règles dans Réglages › Classement. |
| Créer une catégorie (nom, nature ; doublon refusé) | `#nc-add` | Présent identique | `plus.js:renderClassement` (`nouvelle`) | — | |
| Changer la nature (revenu, fixe, courante, optionnelle) | `.cn-nat` | Présent identique | `[data-nature]` — `plus.js` | — | Klad : aussi épargne et hors budget. |
| Changer l'icône (grille d'icônes, « par défaut ») | `.icobtn`, `ICON_BANK` | Présent adapté | `[data-icone]` — `plus.js` | — | Pas de bouton « par défaut ». |
| Renommer une catégorie (opérations, règles, corrections et budget suivent) | `.cn-ren` | Présent adapté (0.10.8) | Plus › Classement › catégorie › Renommer — `plus.js:renderClassement`, `classement.js:renommerCategorie` | fait 0.10.8 | Annulable. Perdu en 0.10.4 (section du bas de Budget), rétabli dans Plus › Classement. |
| Supprimer une catégorie (opérations en « Autres », annulable) | `.cn-del` | Présent adapté (0.10.8) | Plus › Classement › catégorie › Supprimer (double appui, annulable) — `classement.js:supprimerCategorie` | fait 0.10.8 | Perdu en 0.10.4, rétabli. |
| Catégories protégées (non modifiables) | `NO_EDIT` | Présent adapté | `classement.js` | — | |

## 18. Règles de classement

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Liste des règles (mot, catégorie › sous-catégorie, nombre d'opérations) | `renderRules` | Présent identique | Plus › Réglages › Classement « Vos règles » — `plus.js:renderClassement` | — | |
| Supprimer une règle | `[data-del]` | Présent identique | `[data-suppr]` (confirmation, annulable) | — | |
| Ajouter une règle à la main (mot du libellé, catégorie, compteur « N opérations concernées ») | `#nr-add`, `#nr-kw` | Présent adapté (0.10.8) | Plus › Classement › « + Nouvelle règle » (mot, catégorie, compteur et aperçu) — `plus.js`, `classement.js:ajouterRegle` | fait 0.10.8 | Annulable. Perdu en 0.10.4, rétabli. |
| Règles de base reprises (nombre) | payload `P.rules` | Présent adapté | « N règle(s) de base, reprises de l'ancienne version » | — | Données, pas de code (ETAT). |
| Priorité : correction > règle utilisateur (mot le plus long) > base > défaut | `classify` | Présent identique | `classement.js:classer` | — | ETAT, décisions en vigueur. |
| Fusion PC ↔ téléphone des règles et corrections (horodatage, suppressions) | `stampRS`, `mergeRS` | Abandonné | — | — | Synchronisation « en ligne » hors périmètre (ETAT). |

## 19. Impôts

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Choix de l'année : « Revenus N (estimation) » / « Revenus N (avis) » | `drawImpots` (`data-txy`) | Présent identique | Impôts › Résumé — `vfisc.js:impots` | — | |
| Encarts estimation : impôt estimé, déjà prélevé, encore prélevé d'ici décembre, solde à payer / remboursement, taux du foyer | `drawImpots` (`kp`) | Présent identique | `vfisc.js:impots` | complément | Noms des personnes. |
| Encarts avis : impôt, prélevé à la source, solde, taux moyen et marginal, revenu fiscal de référence | `drawImpots` | Présent identique | `vfisc.js:impots` | — | |
| Pastille « barème en projet / voté », tranche marginale, décote | `drawImpots` (`tx-meta`) | Présent identique | `vfisc.js:impots` | — | |
| « À régulariser entre vous » (par année, rien à régulariser / qui verse quoi) | `regulList` | Présent identique | `vfisc.js:impots` (`#tx-regul`) | complément | |
| Observations fiscales (taux non personnalisé, taux à revoir…) | `taxAlerts` | Présent identique | `vfisc.js:impots`, `fisc.js:alertes` | — | |
| « Analyse de Claude » (impôts) | `runTaxAI` | Présent adapté | extra Claude — `[data-analyseimpots]` | 9b fait | Désactivé par défaut. |
| Tableau « Prélèvement à la source » (paiement, employeur, net imposable, taux et type, prélevé, cumul ; projection jusqu'à décembre ; acomptes) | `drawImpots` (`#tx-pas`) | Présent identique | Impôts › Prélèvements — `vfisc.js:impots` | — | |
| « Lire les bulletins » (Drive, automatique toutes les 6 h) et nombre de bulletins lus | `syncBulletins`, `#tx-bs-btn` | Présent adapté | « Lire un bulletin » (sélecteur de PDF + Claude) — `[data-lirebs]` | 9b fait | Drive hors périmètre ; lecture une par une, vérifiée avant enregistrement. |
| Liste des bulletins non lus / ignorés (année couverte par l'avis) | `drawImpots` (`#tx-bs-skip`) | Abandon à décider (question au propriétaire) | — | — | Liée à la lecture automatique de Drive ; inutile avec la lecture une par une. |
| « Calcul détaillé » (salaires, abattement ou frais réels, revenus fonciers, revenu imposable, quotient, tranches, décote, capitaux, impôt net, prélèvements sociaux) | `drawImpots` (`#tx-calc`) | Présent identique | `vfisc.js:impots` | — | |
| Comparaison avec l'avis (✓ identique / ≠ montant) | `drawImpots` (`ck`) | Présent identique | `vfisc.js:impots` | — | |
| « Taux et partage » : taux du foyer, taux qui couvrirait l'impôt, taux individualisés (simulation) | `drawImpots` (`#tx-taux`), `tauxIndiv` | Présent identique | `vfisc.js:impots` | — | |
| Règle de partage de l'impôt (choix + description) | `#tx-part-rule`, `PART_RULES` | Présent identique | `#txPartage` — `vfisc.js:impots` | — | |
| Tableau de partage (revenus retenus, impôt si imposé seul, part, dû, déjà payé, reste / a trop payé) + phrase de conclusion | `drawImpots` (`#tx-part`), `shareText` | Présent identique | `vfisc.js:impots` | complément | |
| « Hypothèses » de l'année en cours (salaires de l'autre personne, frais réels, revenus fonciers et à qui, capitaux, taux avant / depuis septembre, barème, part du commun) | `drawImpots` (`data-hyp`) | Présent identique | Impôts › Paramètres — `vfisc.js:impots` | complément | |
| « Avis et barèmes » : tableau des avis (revenu imposable, impôt net, prélevé, solde, solde payé par) | `drawImpots` (`#tx-avis`, `data-soldeby`) | Présent identique | Impôts › Paramètres — `vfisc.js:impots` | — | |
| Barème de l'année | `drawImpots` (`#tx-bar`) | Présent identique | `vfisc.js:impots` | — | |
| « Lire un avis dans Drive » puis formulaire de vérification « Enregistrer l'avis » / « Annuler » | `readAvis`, `avisForm`, `bindAvisForm` | Présent adapté | « Lire un avis » (sélecteur de PDF + Claude, vérification avant enregistrement) — `[data-lireavis]`, `extras.js:lireDocument` | 9b fait | |
| Réglages fiscaux du carnet repris | `loadFisc` | Présent identique | `budget.js` (bloc `fisc`) | — | |

## 20. Taxe foncière

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Tableau sur 5 ans : situation (non imposé, exonération partielle, pleine), base nette, montant, échéance, part de chacun, état (payée le …, avis reçu, estimation) | `drawTF`, `tfYear`, `tfPaid` | Présent identique | Impôts › Taxe foncière — `vfisc.js:taxeFonciere` | complément | Noms des personnes. |
| Déclaration d'achèvement : à confirmer / confirmée | `drawTF` (`h2ok`) | Présent identique | `vfisc.js:taxeFonciere` | — | |
| Paramètres : part de la personne A, surface, base au m², base du parking, taux communal, taxes spéciales, ordures ménagères, exonération, revalorisation | `drawTF` (`data-tf`) | Présent identique | `vfisc.js:taxeFonciere` | complément | Valeurs d'origine codées en dur dans la v65 → données du carnet dans Klad. |
| « Saisir un avis de taxe foncière » (année, total, base) + liste des avis saisis | `bindTF`, `#tf-avis-list` | Présent identique | `vfisc.js:taxeFonciere` | — | |
| Alertes taxe foncière (déclaration, prochaine échéance, rien d'attendu) | `tfAlerts` | Présent identique | `fisc.js:taxeFonciere` | — | |
| Sous-titre avec adresse et description du bien | `#tf-panel .muted` (codé en dur) | Présent adapté | titre générique | — | Donnée personnelle non reprise. |

## 21. Épargne (plan d'épargne salariale et livret)

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Encarts : encours, vos versements (dont l'année), abondement reçu, plus-value, performance | `drawPee`, `peeCalc` | Présent identique | Épargne › Plan d'épargne — `vfisc.js:epargne` | — | |
| Message « plan pas encore ouvert » (démarche) | `drawPee` | Présent identique | `vfisc.js:epargne` | — | |
| Ancien plan soldé (placé, retiré, gain) | `drawPee` (`PEE.closed`) | Présent identique | `vfisc.js:epargne` | — | |
| Recommandations (règles générales) | `peeAdvice` | Présent identique | `vfisc.js:epargne`, `fisc.js:pee` | — | |
| « Règles du plan » : employeur, teneur de compte, date d'entrée, ancienneté, abondement (taux, plafond), durée de blocage | `drawPee` (`data-pl`) | Présent identique | Épargne › Paramètres — `vfisc.js:epargne` | complément | |
| Fonds : nom, catégorie, risque 1 à 7, valeur de part (mise à jour), encours, performance ; ajouter ; retirer (refusé s'il a des versements) | `drawPee`, `#pf-add`, `data-vl`, `data-rmf` | Présent identique | `vfisc.js:epargne`, `ecranfisc.js` | — | |
| Versements : date, origine (volontaire, intéressement, participation, abondement, transfert), fonds, montant, parts, date de disponibilité ; ajouter ; retirer (annulable) | `drawPee`, `#pv-add`, `data-rmv` | Présent identique | `vfisc.js:epargne`, `ecranfisc.js` | — | |
| Performance annuelle (taux de rendement interne) | `xirr` | Présent identique | `fisc.js` | — | |
| Livret : solde saisi à la main avec sa date | `editLivret` | Présent adapté | Épargne › Livret — `vfisc.js:epargne` (« Enregistrer le solde ») | — | Klad ajoute le taux et les intérêts estimés. |

## 22. Relevés, import manuel, synchronisation

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Tableau « Relevés des comptes » : compte, du, au, opérations (auto / manuelles), dernière synchro, état (à jour, N j, jamais importé), à faire | `renderImports`, `acctState` | Présent identique | Plus › Comptes et banques › Relevés des comptes — `vues.js:releves` | — | |
| Carte et portefeuille : « détail … · prélèvements bancaires écartés … » | `renderImports` (`recon`) | Présent identique | `vues.js:releves` | — | |
| Bouton « Synchroniser » (lecture des relevés déposés dans Drive) | `#imp-sync`, `syncDrive` | Présent adapté | « Synchroniser » — synchronisation directe Enable Banking | — | Décision ETAT. |
| Conseils d'export par banque (« Comptes › Historique › Télécharger ») | `HOWTO` (noms de banques) | Présent adapté | textes génériques par format — `plus.js` (`TEXTE_RELEVE`) | — | |
| « Ajouter un relevé à la main » : compte au choix ou « Détection automatique » (carte, portefeuille) | `#imp-acc`, `detectKind`, `importAuto` | Présent adapté | comptes manuels seulement ; compte choisi — `vues.js:releves`, `plus.js:importerReleve` | — | Les comptes bancaires viennent d'Enable Banking ; pas de détection automatique. |
| Formats CSV, Excel (.xlsx, .xls), JSON | `parseTable`, `loadXLSX` (bibliothèque externe) | Présent adapté | CSV, .xlsx (lecteur embarqué), JSON — `releve.js`, `xlsx.js` | — | Ancien .xls refusé avec un message (enregistrer en .xlsx ou CSV). |
| Détection de l'ordre des dates (jour/mois ou mois/jour) | `detectOrder` | Présent identique | `releve.js` | — | |
| Message de résultat (ajoutées, doublons, écartées) | `importMsg`, `diagnose` | Présent identique | `plus.js:importerReleve` | — | Klad : annulable. |
| « Retirer les imports manuels » (annulable) | `#imp-clear` | Présent identique | `[data-retirerimports]` — `vues.js:releves` | — | Repris en 0.9.0. |
| Relecture automatique toutes les heures et au retour sur la page (15 min) | `setInterval`, `visibilitychange` | Présent adapté | synchronisation à l'ouverture si la dernière lecture a plus de 2 h | — | |
| Écart des crédits de règlement de carte / portefeuille à l'import | `cleanImported`, `buildRows` | Présent identique | motif « remboursements » de la fiche du compte | — | ETAT, décision 0.9.3. |
| Dédoublonnage des opérations en attente / comptabilisées | `dedupPending`, `samePend` | Présent identique | `modele.js` | — | |
| Soldes lus deux fois par jour par le script | `storeBalances` | Présent adapté | soldes lus à chaque synchronisation Enable Banking | — | |

## 23. Sauvegarde et stockage

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| « Exporter mes réglages » (fichier JSON en clair) | `#bk-export`, `fullState` | Présent adapté | Plus › Données › Sauvegarde « Exporter ma sauvegarde » (fichier chiffré) | — | Décision ETAT : « sauvegarde par export chiffré ». |
| « Restaurer depuis un fichier » avec « Annuler » pendant 10 s | `#bk-import`, `applyState`, `undoToast` | Présent adapté | restauration complète par la phrase de récupération — `verrou.js` | — | Pas d'annulation : la restauration remplace le coffre. |
| État de la sauvegarde (où sont les données) | `#sync-detail` | Présent adapté | « État : … » — `index.html #sauvState` ; ligne « sauvegarde » dans À vérifier | — | |
| Fichier de données lié (créer, ouvrir, reconnecter) | `renderSyncPanel`, `initFile` | Abandonné | — | — | ETAT : « fichier de données lié » hors périmètre. |
| Espace en ligne : fusion PC ↔ téléphone, relecture toutes les 5 min | `pullMerge`, `persist`, `applyRemote` | Abandonné | — | — | ETAT : « synchronisation en ligne » hors périmètre. |
| Réglages gardés dans le stockage du navigateur | `store`, `LS_KEYS` | Présent adapté | coffre chiffré ; préférences d'affichage seules en stockage local | — | ETAT, liste fermée `KladUI.PREFS`. |

## 24. Extras liés aux services en ligne

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Script bancaire Google et dépôt dans Drive | `syncDrive`, `DRIVE` | Abandonné | Enable Banking direct | — | ETAT, hors périmètre. |
| Lecture des mails du syndic (Gmail) | `syncAppelMails` | Présent adapté | extra Mail (IMAP, lecture seule) — `mail.js`, `extras.js:lireMails` | 9b fait | Désactivé par défaut ; motifs dans le complément (`klad.mail`). |
| Analyse par Claude (budget, impôts), lecture des bulletins et avis | `runAI`, `runTaxAI`, `syncBulletins`, `readAvis` | Présent adapté | extra Claude — `claude.js`, `extras.js` | 9b fait | Clé saisie dans l'appli, chiffrée. |

## 25. Affichage, confort et accessibilité

| Fonction (v65) | Où dans la v65 | Statut Klad | Où dans Klad | Effort / lot | Remarque |
|---|---|---|---|---|---|
| Thème clair / sombre (automatique au premier lancement, puis bascule à 2 états) | `THEME`, `applyTheme` | Présent adapté | Automatique / Clair / Sombre — `affichage.js`, `plus.js:renderAffichage` | — | Décision ETAT (clé `klad.theme`). |
| Suivi du thème du téléphone en direct | `matchMedia(...).addEventListener` | Présent identique | `app.js` (redessin en automatique) | — | |
| Mode démo : montants multipliés par un facteur au hasard, noms et numéros masqués, champs en lecture seule, rien d'enregistré | `demoToggle`, `demoScrub` | Présent identique | `affichage.js` (mode démo) | — | |
| Lancement du mode démo par 3 appuis sur le numéro de version | écouteur sur `#ver` | Présent adapté | bouton « Passer en mode démo » dans Réglages › Apparence | — | Geste caché remplacé par un bouton. |
| Bandeau « MODE DÉMO · chiffres fictifs » + « Quitter » | `demoOn` | Présent identique | `affichage.js` | — | |
| Sections repliables (toucher le titre), mémoire par appareil, migrations successives | `decorateFolds`, `toggleFold`, `carnet.folded` | Présent identique | `ui.js:plier`, `klad.replis.v2`, `ui.js:migrerPlis` | — | |
| Entrée / Espace sur un titre replie la section | écouteur `keydown` | Présent identique | `ecranbudget.js` | — | |
| Calcul dans les champs de montant (« 12,50+8 », « =90/3 »), message si non reconnu | `calcEval`, `calcify` | Présent identique | `ui.js:calcul`, `app.js` | — | |
| Toasts, toasts avec « Annuler », double appui de confirmation | `toast`, `undoToast`, `armRemove` | Présent identique | `app.js:toast`, `toastAnnuler`, `confirmInline` | — | Klad : annulation généralisée. |
| Garder le même endroit à l'écran quand le contenu change (périmètre, période) | `keepPos` | Présent adapté | redessin par écran, position gardée | — | À vérifier à l'usage. |
| Pas de redessin pendant une saisie (clavier ouvert) | `editing`, `pendingRedraw` | Présent identique | `ecranfisc.js:poser` (focus repris) | — | |
| Animations réduites si demandé | `prefers-reduced-motion` | Présent identique | `style.css`, `app.js` | — | |
| Recalcul de la largeur au redimensionnement | écouteur `resize` | Présent identique | `ecranbudget.js` (resize) | — | |
| Rubrique « Comment c'est calculé » sur chaque panneau | `howTo`, `.bnote` | Présent identique | `ui.js:comment` | — | |
| Montants négatifs affichés (signe moins devant les montants et sur les axes) | `fmt`, `svgFrame` | Abandonné | « débiteur », « dépassé de », « déficit » | — | Décision ETAT (0.9.0) et règle de `CLAUDE.md`. |

---

## Sans objet (absents de la v65, rien à reprendre)

- **Raccourcis clavier** : la v65 n'en a pas (seulement Échap pour fermer un volet, Entrée / Espace pour replier une section, repris).
- **Impression** : aucune feuille d'impression ni bouton dans la v65.
- **Export CSV / Excel des opérations** : la v65 importe seulement ; son seul export est la sauvegarde JSON des réglages (§ 23). Klad a en plus le relevé de contrôle (JSON).
- **Saisie libre d'un avis d'impôt sur le revenu** : ni dans la v65 (lecture seulement), ni dans Klad.
- **Opérations « exceptionnelles » hors référence du budget** : prévues dans le code de la v65 (`EXC`) mais jamais activables par l'utilisateur.
- **Panneaux « Résultats », « Répartition », « Analyse » séparés** : code encore présent dans la v65 (`drawClosure`, `periodBlock`) mais panneaux retirés de la page ; Klad affiche le bilan dans le suivi (◀) et un volet Résultats (§ 12).
- **Suggestions de virements récurrents et comparaison au budget dans « Contrats »** : calculées dans la v65 (`drawContracts`) mais jamais affichées ; Klad en fait une observation (§ 5).
- Ajouts Klad sans équivalent v65 (palette Grafit, filtre « À rapprocher », bloc « Dépassés », page de détail d'une opération, « Trier une à une », Lien Grafit, verrou, relevé de contrôle) : hors du tableau.

## Récapitulatif des fonctions manquantes à la 0.10.6

| Fonction | Effort | Statut à la 0.10.8 |
|---|---|---|
| Renommer une catégorie | petit | fait (Plus › Classement) |
| Supprimer une catégorie | petit | fait (Plus › Classement) |
| Ajouter une règle à la main | petit | fait (Plus › Classement) |
| Aperçu des opérations concernées par une règle | petit | fait (volet Classer, nouvelle règle) |
| Pastille « équilibre » et un seul ajout par opération | petit | fait (Opérations, volet Classer) |
| Tri des opérations | petit | fait (Opérations) |
| Total de tous les comptes, dont épargne | petit | fait (Accueil › Soldes) |
| Pastille « charge récurrente sur le compte secondaire » | petit | 9c (réglage personnel) |

## Abandons à décider (question au propriétaire)

- « Liste d'origine » des contrats : liste écrite dans le code avec des données personnelles ; la reprise de l'ancienne
  version la remplace. Recommandation : abandonner.
- Liste des bulletins de paie non lus / ignorés : liée à la lecture automatique de Drive, sans objet avec la lecture une
  par une (extra Claude). Recommandation : abandonner.

## Points à vérifier sur le téléphone (statut « adapté » à confirmer)

- Position de la liste après un classement (la v65 gardait l'opération à la même hauteur).
- Poste du budget deviné d'après le libellé d'un nouveau contrat.
