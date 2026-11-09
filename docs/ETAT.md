# Klad — état du projet (maintenance)

Mémoire entre sessions (générique et public : aucune donnée personnelle). Une session neuve repart de ce fichier,
de `CLAUDE.md` et du `README.md`. Depuis la **1.0.0**, le projet est en **maintenance** : correctifs et petites
demandes, une version publiée par lot. Notes de version publiques : `docs/NOTES.md` (ouvertes depuis Plus › À propos).

## Statut

**2.2.0** — lecture rapide : infos additionnelles (dates, formules, explications, sous-titres) derrière un ⓘ dans toute
l'appli ; montant du cadran à la couleur du côté ; plus de postes dépassés en tête du budget ; « + Ajouter un poste »
seulement dans « Régler le budget » (retour du propriétaire du 09/11, maquette validée : ⓘ partout, toute l'appli).

**2.1.0** — budget fusionné dans l'Aperçu (retour du propriétaire, 08/11 : « l'Aperçu est une surcouche redondante, on
devait juste améliorer l'interface », « la nouvelle interface doit suivre pour le réglage du budget, ne perdre aucune
information » ; maquettes validées puis « go »). Aperçu Moi = écran Budget, Aperçu Nous = écran Commun ; budget en
sections et postes repliables, réglage du budget dans la même carte, sous-vues ouvertes depuis la carte. Aucun calcul
changé.

**2.0.1** — correctif (retour du propriétaire, 08/11) : compteurs de l'écran Opérations à jour dès qu'une opération est
vue (glissement, détail). Lot suivant : 2.1.0, budget fusionné dans l'Aperçu (maquettes validées le 08/11).

**2.0.0** — nouvelle interface (demande du propriétaire, 08/11 : « trop de texte », navigation intuitive, puis « conserver
toutes les infos, trouver un entre-deux » ; maquettes et prototype en artefact validés au fil de la journée ; « travaille
directement sur la nouvelle version »). Barre du bas Aperçu · Opérations · Trier · Patrimoine · Plus ; Aperçu en deux pages
(Moi, Nous) qui remplace l'Accueil sans rien retirer ; Budget, Commun et Équilibre ouverts depuis l'Aperçu. Aucun calcul
changé. Publiée avec les corrections 1.3.5 et 1.3.6 (jamais publiées seules).

**1.3.6** — écrans allégés (analyse de l'architecte, 08/11 ; développé et publié par l'architecte) : Accueil (cycle
une fois, bilan dans « Ce cycle-ci », un seul raccourci, « À mettre en place » par personne) ; « Trier une à une » depuis
« À vérifier » ; Commun › Ce mois sans le solde répété ; fin de cycle au prochain jour de paie habituel et observation
« Salaire attendu » ; « prélèvement absent » pour tous les contrats ; projection à partir du 7e jour ; affichage à
390 px (Classer, contrats, graphiques, titres).

**1.3.5** — correctif (analyse complète de l'appli par l'architecte, 08/11 ; développé et publié par l'architecte) :
reste à vivre « comptes courants » sans la somme due sur les cartes à débit différé ; projection de fin de période avec
les charges fixes réelles ; opération en cours plus renvoyée par la banque : plus comptée ; relecture bancaire de 30 jours
une fois par semaine ; deux opérations identiques déjà connues jamais fusionnées ; une seule ligne « à vérifier » sur
l'Accueil (même nombre que la pastille « Tout ») ; observation « Opérations à classer » sur 3 mois ; recherche par
montant ; enregistrement du coffre plus sûr (échec, arrière-plan) ; date locale du fichier de sauvegarde.

**1.3.4** — contrats : numéro de contrat (prélèvement reconnu par son numéro avant le mot du libellé ; plusieurs contrats
chez le même organisme ; numéros proposés d'après les prélèvements) et fin du contrat (résiliation) : un prélèvement après
la fin est « non prévu » (compté à part du poste, pastille, observation, alerte Grafit `CANCELLED_CONTRACT_DEBIT` CAUT
tant qu'il n'est pas vu) ; plus d'échéance après la fin (demande du propriétaire, 07/11).

**1.3.3** — correctif d'affichage (retour du propriétaire, 07/11 ; développé et publié par l'architecte) : Tendance
repliable dans Commun › Trésorerie ; sous-sections des contrats (liste, prévu du poste, échéances) repliables, état gardé
sur le téléphone ; « Confirmer ? » du journal en rouge ; un virement reçu sur le commun et classé virement interne ou
déblocage, affecté à la main, compte enfin (son affectation était ignorée et « Confirmer » ne faisait rien) ; détail
d'un virement ponctuel réécrit (état, effet sur l'équilibre, proposition, choix).

**1.3.2** — correctif (retour du propriétaire, 07/11 ; développé et publié par l'architecte) : (1) une opération
comptabilisée que la banque ne renvoie plus n'est plus jamais retirée à la synchro (cause probable : virements perso → commun
au bord de la période relue, disparus des dépenses perso, reste à vivre faussé dans les deux colonnes) ; relecture unique de
l'historique bancaire ; (2) suivi des avances au commun à partir d'une date (réglage, posée au 01/10/2026 pour un coffre
passé par la 1.3.0) : avant, chaque virement ponctuel garde son classement d'origine dans l'équilibre (affectations
gardées, non comptées ; seule l'enveloppe Impôts s'applique) ; déblocage de prêt jamais proposé comme virement ponctuel ;
(3) résumé Grafit : `commun.unplanned` et alerte `COMMUN_UNPLANNED` (débits imprévus du commun du mois en cours) ; (4) journal : « Vider » confirmé (second appui) et annulable.

**1.3.1** — correctif de la 1.3.0 (retour du propriétaire, 06/11 ; développé et publié par l'architecte) : carte
« Provisions en cours » du commun lisible (ancienne « Réserve pour échéances », qui affichait « [object Object] ») ;
sous-vue Commun › Plan retirée (redondante avec le budget du commun et « Virements à mettre en place »), détail par poste
déplié sous « Virements à mettre en place » ; test garde-fou des textes illisibles sur tous les écrans.

**1.3.0** — compte commun remis à plat (points 1 à 7 du propriétaire, 05/11) : statut prévu / écart / imprévu de chaque
mouvement du commun, virements ponctuels affectés, enveloppes, avances au commun dans l'équilibre, réserve fixe et
renflouement partagé, Commun › Plan (retiré en 1.3.1), fiche du mois, bloc « communPlan » du relevé. Point 8 (échéances ponctuelles :
impôt estimé, taxe foncière, provisions) : lot 1.4.0.

**1.2.0** — lot validé par le propriétaire le 05/11 (développé et publié par l'architecte) : pastilles « à vérifier » par
périmètre dans les Opérations, reste à vivre sans montant par jour avec une barre du cycle « jour N/T », tendance sur une
période au jour près, « Total perso » sans le commun (Accueil et résumé Grafit).

**1.1.4** — réponse de l'architecte au relevé de contrôle 1.1.3 : fausse observation « virements de <nom> après
l'échéance » (virements ponctuels du mois précédent comptés en retard), « Virements du mois » sans montants.

**1.1.3** — réponse de l'architecte au relevé de contrôle 1.1.2 (accepté) : virement « en route » 5 jours ouvrés,
observation « virements après l'échéance » (retards réels seulement, qui est en retard), « Budget du mois dépassé » sur
la période du Budget, journal anonyme des fusions et retraits de la synchronisation et des modifications du budget,
mode démo des nouveautés de la 1.1.2, diagnostic d'affichage (mesure et cadre du texte).

**1.1.2** — correctif prioritaire (relevé de contrôle 1.1.1 du 01/11 analysé par l'architecte) : opérations bancaires
enregistrées deux fois (relues à une autre date avec une référence), échéances réglées d'avance rattachées à leur
échéance, virements « en route » et marge prévue du commun, alerte de découvert alignée sur la trésorerie.

**1.1.1** — correctif de la 1.1.0 (réponse de l'architecte au rapport 1.1.0) : tolérance des charges plafonnée à 10 €
et réglable, écart de rapprochement à la main gardé en dépense (confirmation, affichage, « À vérifier »), mode démo
vérifié sur les nouveautés de la 1.1.0.

**1.1.0** — retours d'usage de la 1.0.1 (sauvegarde et lecture confirmées sur le téléphone : la bascule peut
reprendre). Saisie du Budget, reste à vivre simplifié, « à surveiller » à 90 %, tolérance des charges, commun sur le
cycle de salaire, historique des observations, carburant en fenêtre, onglet Patrimoine (dont crypto), rapprochement
à la main des portefeuilles.

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

### 2.2.0 — détails techniques
- Mécanisme (`ui.js`) : `.inf` = info masquée (CSS `display:none!important`), visible quand un ancêtre `.inf-l` a
  `.inf-on` ou, reliée à un bouton (`data-inf-of` ↔ `data-inf-k`), quand elle a `.inf-vu` ; `.inf.inl` se montre dans la
  ligne, `.inf.enc` en encart. `U.ib(nom, k)` : bouton ⓘ (`.inf-b`, `aria-expanded`, zone d'appui 48 dp par `::after`) ;
  `U.inf(html, cls)`. Clic global en capture sur `.inf-b` / `.inf-t` (`preventDefault` + `stopPropagation` : ni repli
  du titre, ni ouverture de la ligne). Titre dépliant (`h2.fold`) : le ⓘ est posé à côté, pas dedans ; `summary` : tout à
  droite.
- Pose automatique (`U.infos`, observateur de mutations sur `body`) : 1) aide de formulaire `.muted.small`, `.rg-aide` →
  ⓘ sur le libellé (`label`, `.rg-l`) ou le titre qui précède ; 2) zones `.inf-auto` (`#cm-plan`, `#cm-com`, `#cm-tres`,
  `#tend-panel`, `#ctr-zone`, `#view-appart`, `#view-impots`, `#view-epargne`, `#view-crypto`, `#view-plus`,
  `#view-data`, `#view-save`, `#voletCorps`) : `.subs`, `small`, `.muted`, `p.note` sans montant (`.num`), sans alerte
  ni état (`.bad-t`, `.warn-t`, `.pos-t`, `.chip`), hors `.vis`, `[aria-live]`, `label`, `summary`, titres, dépliants
  (sauf `.cm-sub`, `.ctr-sub`) et états vides (« Aucun… ») → un ⓘ par bloc (`details`, carte, `.panel`, `section`…)
  posé sur son titre. Garder un texte visible : classe `vis`.
- Pose explicite : `vapercu.js` (cadran : `cadran(…, apres)` reçoit le ⓘ, encart `.ap-enc` ; `.ap-hero.moi/.nous` pour la
  couleur du montant ; carte `carteInf` pour Prochains jours ; tuiles sans date), `vaccueil.js` (`li(…, etat)` : sous-texte
  en info sauf état ; carte avec infos → ⓘ du titre ; heure du relevé en info), `vbudget.js` (en-tête : ⓘ de la carte à côté
  du titre, dates de la période ; `pastille(st, tout)` ; résumé des sections `.bg-ss.inf` ; poste replié : sous-texte,
  repères et cause en info ; plus de compteurs de section ni de « + Ajouter un poste » ; bilan `br()` et écarts : ⓘ par
  ligne ; réglage : aides en info ; `ravM` commun : calcul `.cr-calc.inf` ; À faire : explication par ⓘ), `vcommun.js`
  (`part()` : ⓘ par part), `vfisc.js` (`kpi`/`kp` : ⓘ par case ; barème ; résultat crypto visible), `vues.js` (compte et
  « règle » d'une opération en info), `app.js` (Plus : `it(…, etat)`), `ecranbudget.js` (plus de bandeau des dépassés ;
  `#budget-main` est `.inf-l`).
- Tests : banc `B.infos()` (montre toutes les infos, pour vérifier que rien n'est perdu) ; tests adaptés : `ux`, `lot11`
  (ⓘ du cadran), `parcours` (ⓘ de la période et du cadran Nous), `parite` (ⓘ des soldes), `demo`.

### 2.1.0 — détails techniques
- Navigation (`app.js`) : `montrer('accueil')` ouvre `budget` (côté Moi) ou `commun` (côté Nous) sur leur page
  principale (`EB.ui.sv` = `suivi` / `mois`) dès qu'un compte existe (`apercuBudget()`) ; sans compte, l'ancien écran
  Accueil (`#view-accueil`, « Connectez une banque ») ; `rendre()` bascule dès l'arrivée du premier compte. `apCote`
  suit `budget` / `commun` ; `choisirCote` et le glisser horizontal (page principale seulement) changent d'écran.
  `chrome()` : titre « Aperçu » sur la page principale, nom de la sous-vue sinon ; `retourPossible()` / `retourEcran()` :
  sous-vue → page principale, Équilibre (`appartement`) → Nous. Un appui sur l'onglet Aperçu déjà ouvert remonte en haut.
- `index.html` (`#view-budget`) : `#ap-haut` (seg Moi / Nous, cadran, …), `#rav-m`, `#cm-plan`, `#cm-com`, `#cm-tres`,
  `#budget-main`, `#an-zone`, `#ctr-zone`, `#actions` (« À faire »), `#ap-bas` (prochains jours), `#ap-fin`
  (Verrouiller). `.controls.stick` (Perso / Commun, `#cyc-nav`) masqué ; `#sv-bar` vide et masqué sur la page
  principale, affiché dans les sous-vues ; `#app-hero`, `#bal-panel`, `#app-seen` toujours masqués (leur contenu est dans
  `#ap-haut` : soldes, calcul de la fin de mois, provisions, opérations à voir du commun).
- `vapercu.js` : `haut(d, scope)` (Moi : cadran + interrupteur des bases avec leurs valeurs, où va l'argent, à vérifier,
  soldes ; Nous : cadran, calcul de la fin de mois, à vérifier du commun `data-av="averifier-commun"` → Opérations
  périmètre Commun filtre à vérifier, tuiles), `bas(d, scope)` (prochains jours), `tuiles`. `ecran()` reste pour
  l'Accueil sans compte et les tests.
- `vbudget.js` : `teteBudget` (titre, jour, ‹ › `data-nav`, « Revenir au cycle en cours », seg `data-bmode`
  Suivi / Régler le budget ; en réglage : `#bref`, `data-alignertout`, `data-ouvrir="secReglBudget"`) ; `suivi` en
  `div` : sections `.bg-sec` (bouton `.bg-sh.sec-tog[data-sec]`, ouvertes par défaut sauf `rev` et `hb` ; `ui.ouverts`
  `m|<k>` ouverte / `f|<k>` repliée), postes `.bg-po` (bouton `.poste-nom.bg-pb[data-poste]`, anneau `anneau()`,
  pastille d'état, opérations `.det` avec `data-op` / `data-classer`, contrats, projection, `data-editer`, `data-fuel`,
  cause et `data-aligner`, répartition `lk|split`) ; `bilan()` remplace `totBar` / `soldeBar` dans le suivi (gardés
  exportés) ; accès `data-aller` (tendance, contrats-perso / tresorerie, equilibre, contrats-commun) et `data-av="bilan"`
  (5 premiers jours du cycle). `plan` en `div` : `.bg-rg` par poste (`data-pon`, `data-pdet`, `data-fuel`,
  `data-pretirer`, barres réel habituel / budget, `data-pmois`, `data-pamt`, `data-pper`, `data-paligner`, au commun
  `data-ppg`, `data-pelig`), sections `data-psec` (`ui.ouvertsPlan` `ps|<k>` = repliée), `#share-box` inchangé.
  `ravM` commun : carte « Où va l'argent du commun » (barre + calcul de la marge). `observations` : carte « À faire »
  (points du périmètre + général, `data-ouvrir="secObs"` pour tout, `data-reafficher`, audit, analyse).
- `ecranbudget.js` : bandeau des postes dépassés `.bg-dep` ; `data-psec` ; `#rav-m` seulement au commun.
- `ui.js` : `interrupteurRav(base, avecComptes, valeurs)` ; `#actions` ouvert par défaut. `vues.js` : `nomsAVoir`,
  `provisionsTexte` exportés.
- CSS : bloc « 2.1 » en fin de `style.css` (`.bg-*`). Piège : `all:unset` remet `position` à `static` ; les classes
  anciennes à zone d'appui élargie (`.poste-nom::after`, `.linkbtn::after`) doivent garder `position:relative` (sinon
  la zone couvre l'écran).
- Banc : `onglets` = barre + `nous` ; `budget` / `commun` = Aperçu Moi / Nous ; `avecSousVues` visite aussi les accès
  `#budget-main [data-aller]` (retour par `#ah-back`). Tests adaptés : `parcours`, `ux`, `lot11`, `lot133`, `champs`,
  `demo-outils`, `budget`, `budgetdetail`, `lot136`, `vues`.

### 2.0.1 — détails techniques
- `app.js` : `compteursListe()` (pastilles `#ops-scope`, badge, filtres `#app-chips`, `#ops-tri`) extrait de
  `renderOps(true)` et appelé aussi par `basculerVue` (glissement à droite, bouton « vue » du détail) : avant, seul
  `renderHaut` (badge, Aperçu) suivait. La liste n'est pas reconstruite (ligne et position gardées).
- Test : `test/lot201.test.mjs` (glissement tactile simulé dans Chromium, aller-retour vue / non vue).

### 2.0.0 — détails techniques
- Navigation (`index.html`, `app.js`) : `#app-tb` = `accueil` (« Aperçu »), `operations`, `trier` (bouton central
  `.tb-fab`, porte `#tb-badge` ; appui = `trier('nv','tout')`), `patrimoine`, `plus`. `chrome()` rattache `budget`,
  `commun`, `appartement` à l'onglet `accueil` ; `RETOUR` les ramène à l'Aperçu (`#ah-back`). Liens de l'Aperçu :
  `data-aller` = `budget`, `commun`, `contrats-perso`, `contrats-commun`, `tendance` (Budget › Tendance), `tresorerie`
  (Commun › Trésorerie), `equilibre` (`appartement`), `rav` (volet) ; `data-av="bilan"`, `data-av="observations"`.
- Aperçu (`www/vapercu.js`, `KladVuesApercu`) : `ecran(d, cote)` (mêmes données que `KladVuesAccueil.ecran`), `moi`,
  `nous`, `cadran`, `barreArgent`, `filJours`, `budget`, `etat`. Aucun calcul propre : `KladBudget.suivi`, `ravChoisi`,
  `echeances` ; `KladCommun.finDeMois`, `plan`, `decomposition`, `equilibre`, `tresorerie` ; `KladObservations`.
  Réutilise `KladVuesAccueil.aVerifier`, `soldes`, `bilan`, `reste` (repli sans reste à vivre) et `actions` (Verrouiller).
  Montants arrondis à l'euro (`e0`), jamais de signe moins (pastilles « excédent » / « déficit » / « à l'équilibre »,
  « débiteur »). Ordre Moi : cadran, où va l'argent, à vérifier, soldes, budget du cycle (bilan + boutons `.ap-ab`),
  prochains jours, à faire, Verrouiller. Ordre Nous : cadran, virements, tuiles équilibre / 12 mois, répartition du solde,
  budget du commun, prochains jours, à faire, Verrouiller.
- Côté affiché (`app.js`) : `apCote` en mémoire seulement (remis à « moi » à chaque déverrouillage, `open()`), jamais dans
  le stockage local (test « aucune donnée en clair dans localStorage ») ; glisser horizontal sur `#view-accueil`.
- Détails : « À vérifier » de l'Aperçu sans la ligne « N observations à faire » (la carte « À faire » les montre) ;
  cadran : « dépassé » sous un reste à vivre négatif ; fil des jours : montant court (« 1,3 k€ ») dès 1 000 €, montant
  exact dans la liste et le nom accessible ; mode démo : initiales « A » / « B » (le masquage ne touche pas une lettre seule) ;
  « montant / budget » coupable avant la barre oblique (`/\u00a0`).
- CSS : bloc « 2.0 : Aperçu Moi / Nous » en fin de `style.css` (classes `.ap-*`, jetons `--ap-moi`, `--ap-nous`, …) ;
  `.ap-page .ap-card` en une colonne bornée (`minmax(0,1fr)`) : rien ne sort d'une carte à 320 px et texte à 200 % ;
  textes de 12 px au moins, cibles de 48 dp (pastilles Moi / Nous, boutons `.ap-ab`, liens `.ap-lien`) ; barre du bas en
  5 colonnes (`html.appm nav.app-tb`).
- Banc (`tools/mesures/banc.mjs`) : `barre` (onglets réels) et `onglets` = barre + `nous`, `budget`, `commun` ouverts
  depuis l'Aperçu (`onglet()`) ; `mesurer.mjs` chronomètre la barre seule. Tests adaptés : `parcours` (helper `ecran`),
  `ux` (chiffres de l'Aperçu = calculs, arrondis à l'euro ; échéances dans « Prochains jours »).
- Outils (hors appli) : `tools/artefact/prototype.mjs` (page unique sur le jeu fictif, pour itérer sur l'interface sans
  APK) et `tools/artefact/construire.mjs` (copie web de l'appli avec données fictives, usage local).

### 1.3.6 — détails techniques
- Cycle (`budget.js:cycleCourant`) : `attendu = salaireAttendu(B, last)`, `end = attendu − 1` (prolongé à aujourd'hui
  comme avant). `jourDePaie` : jour du mois le plus fréquent des 6 derniers salaires (à égalité, le plus tardif) ;
  `salaireAttendu` : ce jour le mois suivant (le mois d'après si moins de 20 jours), avancé au jour ouvré précédent
  (week-end, `KladCommun.ferie` si chargé). Cycles passés (`debuts`, `cyclePasse`) inchangés. Relevés des jeux fictifs
  inchangés (salaire le 27).
- Observations (`observations.js`) : « Salaire » : `cycleCourant().attendu` dépassé de plus de 2 jours sans salaire →
  « Salaire attendu le …, pas encore arrivé (dernier le …) » (sinon règle des 38 jours) ; « <contrat> : prélèvement
  absent » : tout contrat avec montant, sans fin passée, dernier prélèvement à plus de `per × 31 + 14` jours (avant :
  commun, mensuel, 45 jours).
- Accueil (`vaccueil.js`) : `surTitre` sans le jour ; `cycle` : sous-titre « dépenses courantes et optionnelles », lien
  `data-av="bilan"` (5 premiers jours) ; `bilan` n'est plus ajouté à « À vérifier » ; `commun` : « À mettre en place »
  regroupé par personne ; `actions` : Verrouiller seul (`.ac-quick.ac-seul`).
- Opérations (`app.js:renderOps`) : bouton « Trier une à une » aussi avec le filtre `__av` (`opsListe.filter(aTrier)`).
- Commun : `vcommun.js:mois` sans la ligne « Solde » (titre « répartition du solde ») ; `vbudget.js:soldeBar` (commun,
  mois en cours) : « Mouvements du mois », variation réelle en avant, provisions. `vbudget.js` : `projete(s)` (« à
  partir du 7e jour » si `s.jour < 7`). Contrats : `.ctr-pp` (pastille et bouton sous le texte). `vfisc.js` : « À régler et
  à suivre », « Points à suivre ». `vcommun.js` : « 12 prochains mois » (ancien « Trésorerie · 12 mois »).
- CSS : `.cat-t` `hyphens:auto` ; `.chartbox{height:auto;min-height:240px}` (graphiques de 300 px dans une boîte de
  240 px à moins de 520 px de large).
- Tests : `test/lot136.test.mjs` ; `accueil`, `parcours`, `commun`, `lot130` adaptés.

### 1.3.5 — détails techniques
- Reste à vivre (`budget.js:resteAVivre`, `detteCartes(B)`) : colonne comptes `cartes` = somme des `KladClasse.dette`
  des `carte_differee` visibles en euros dont le compte de prélèvement est un courant (ou non choisi) ; `marge` et `reste`
  la retirent. `vbudget.js:detailRav` : ligne « − Carte à débit différé » (colonne comptes seule) si > 0. Relevé de
  contrôle (`controle.js:colonne`) : `cartes` seulement s'il est > 0 (références des jeux fictifs inchangées : dette nulle
  au 28/10). Grafit `left_to_live` (base comptes) suit.
- Projection (`budget.js:suivi`) : `t.proj` aussi pour le fixe (`max(a.proj, a.cur)`, `a.proj = max(cur, pm)`) ;
  `Dp = T.fixe.proj + T.courante.proj + T.optionnelle.proj` (avant : `T.fixe.p`).
- Opérations en cours plus renvoyées (`o.absente`) : exclues de `B.rows` (`budget.js:contexte`) et de
  `KladClasse.dette` ; liste : classe `absente` (libellé barré), étiquette « en cours · plus renvoyée » ; détail : ligne
  « État ». Retrait inchangé (10 jours après la date, `PURGE_JOURS`).
- Synchro : `modele.js:bornesRecuperation` → `{ from, ramenee, large }` ; relecture large (`RELIRE_JOURS` = 30) si
  `c.sync.large` (AAAA-MM-JJ) date de `RELIRE_TOUS` (7) jours ou plus ; `large: true` aussi pour la première lecture et
  la relecture complète ; `sync.js` garde `c.sync.large` (journal : « relecture des 30 derniers jours »). Fusion des
  opérations relues (`integrer`) : un candidat déjà connu (`connues`) de même date et même libellé normalisé est écarté
  (deux achats identiques réels) ; le cas 1.1.2 (autre date ou référence ajoutée) fusionne toujours.
- À vérifier (`vues.js:lignesAVerifier`) : avec le contexte (`ext.ctx`), une ligne `averifier` = `compteursAVerifier().tout`
  (sous-ligne : non vues, non classées, à rapprocher) à la place de `nonvues` / `nonclassees` / `rapprocher` (gardées
  sans contexte) ; `app.js` : `averifier` → `versOps({ cat: '__av', perimetre: 'tout' })`. `observations.js` :
  « Opérations à classer » = `KladClasse.attention().unclassified` (3 mois, tous comptes visibles ; avant 60 jours,
  dépenses).
- Recherche (`vues.js:montantCherche`, `filtrer`) : texte en forme de montant (séparateur décimal ou « € ») → égalité
  sur `|o.montant|` ; un entier sans « € » reste une recherche de libellé.
- Coffre (`verrou.js:flush`) : sur échec d'écriture, les blocs de l'échec et suivants sont retirés d'`ecrits` et remis
  dans `dirty` (`*`, `journal` ou `sauvegarde`) ; `setActive(false)` appelle `flush()` ; nom du fichier de sauvegarde
  par `KladModele.jourLocal`.
- Tests : `test/lot135.test.mjs` ; `budget.test.mjs` (colonne comptes, `left_to_live` 1 240 au lieu de 1 280 : dette
  de 40 € du jeu), `modele.test.mjs` (bornes avec `large`), `vues.test.mjs` (ligne `averifier`).

### 1.3.4 — détails techniques
- `budget.js` : `numContrat(c)` (c.num sans espaces), `appartient(B, c, libellé)` (numéro, sinon mot et aucun numéro d'un
  autre contrat du périmètre), `contratDe(B, sc, libellé)` (contrats à numéro d'abord), utilisés par `dernierDebit`,
  `rattacher`, `echeances` (récurrents) et `commun.js:statuts`. `apresFin(B)` → `B.np` (Map id de ligne → contrat) au
  contexte : débit dont la date de comptage dépasse `c.fin`. `cleDe` et `postes` : clé `c|Après la fin d'un contrat`
  (ligne hors budget, `APRES_FIN`). `contrats()` : état « prélevé après la fin » (bad) ou « fin le JJ/MM » (info), pas de
  prochaine échéance après la fin ; `echeances` : rien après la fin. `enregistrerContrat` : `num` (sans espaces, 40 car.),
  `fin` (AAAA-MM-JJ), absents si vides. `numerosProposes(B, c)` : jetons « lettres + chiffres » des prélèvements reconnus
  par le mot (12 mois ; sans RMS, FR, RUM, ICS), contrat qui l'a déjà.
- Écrans : formulaire du contrat (`vbudget.js:formContrat`) : « Numéro de contrat », puces des numéros trouvés
  (`data-ctnum`, `ecranbudget.js`), « Fin du contrat (résiliation) » ; liste : « n° … · fin le … ». Opérations : pastille
  « non prévu » (`app.js:statutsCommun` fusionne `B.np` ; `vues.js:pastilleStatut`, sorte `apresfin`) ; détail : ligne
  « Non prévu ». Commun : statut `imprevu` (sorte `apresfin`). `observations.js` : « <contrat> prélevé après la fin du
  contrat » (nombre, total, dernier). `resume.js` : alerte `CANCELLED_CONTRACT_DEBIT` (caut) « CONTRAT RÉSILIÉ PRÉLEVÉ »
  (« · n » si plusieurs) pour les prélèvements après la fin non vus des 90 derniers jours ; jamais de numéro. `demo.js` :
  numéro masqué. Relevé : `contrats.liste[].fin` et `etat` seulement pour un contrat avec une fin (références inchangées).
- Tests : `test/lot134.test.mjs`.

### 1.3.3 — détails techniques
- `ecranbudget.js` : `force-open` seulement sur la section seule de la sous-vue (périmètre perso : `tend-panel` en
  Tendance, `p-contrats` en Contrats) ; retiré ailleurs (Commun › Trésorerie). Écouteur `toggle` (capture) sur
  `details[data-pli]` → `U.plier(clé, !open)`.
- `vbudget.js:contrats` : sous-sections `details.ctr-sub[data-pli="p-contrats-<périmètre>-liste|postes|echeances"]`,
  ouvertes sauf repliées sur ce téléphone (`U.replie`) ; liste toujours ouverte en modification ; résumé dans le titre
  (nombre de contrats et à vérifier, postes à aligner, échéances). `style.css` : `.ctr-sub` (résumé ≥ 48 px).
- `app.js` (#btnClearLog) : classe `danger` pendant « Confirmer ? ».
- `commun.js:ponctuels` : virement interne ou crédit `dp` exclu seulement s'il n'est pas affecté (l'affectation à la main
  compte) ; `propositionOp(B, id)` (proposition hors liste), utilisée par l'action « proposee » (`app.js`) et le détail.
  `vues.js:detailCommun` : affectation lue dans le statut (`s.aff`) ; « Affectation de ce virement » : « Affecté : … » et
  son effet (montant en faveur de qui pour une avance, hors équilibre pour Impôts, sans effet sinon), ou « Pas encore
  affecté » + proposition + « Accepter la proposition » ; puis « Changer l'affectation » / « Ou choisir ».
  Choix en cartes (`.cm-choix` / `.cm-ch`) : bouton du choix (rond coché pour le choix actuel, `aria-pressed`), effet en
  une phrase, champ propre au choix dans la même carte (poste pour Avance, année pour Impôts, précision pour Autre) ;
  un champ modifié sur le choix actuel le réapplique (`app.js`, écouteur `change`). « Remettre à affecter ». Pastille
  « imprévu · affecté » (vert) pour un virement ponctuel affecté ou antérieur au suivi des avances.
- « Autre » avec effet dans l'équilibre (`o.commun.aff.eq` : `hors`, `moi-tout`, `moi-moitie`, `autre-tout`,
  `autre-moitie` ; absent : classement d'origine) : `commun.js:equilibre` (hors équilibre, ou `autMoi` / `autAutre`
  ajoutés à l'investi, liste `autres`), ligne « + Autres virements affectés » (`vcommun.js`), `origineEq(B, r)` (classement
  d'origine en clair : versement de …, remboursement de charges, déblocage, non compté), `texteEqAutre`. Réserve et
  Remboursement : texte corrigé (« comme son classement d'origine (…) », et non plus « aucun effet »). Relevé :
  `communPlan.equilibre.autres` seulement s'il y en a (références des jeux fictifs inchangées).
- Tests : `test/lot133.test.mjs` (rendu, plis, Chromium : Commun › Trésorerie et Budget › Tendance), ajouté à l'étape
  Chromium du workflow. Relevé de contrôle et résumé Grafit inchangés (références 1.3.2).

### 1.3.2 — détails techniques
- Synchro (`modele.js:integrer`) : une opération comptabilisée lue auparavant, plus renvoyée sur la période relue et sans
  version relue (`memeOperation`) n'est plus retirée. À 5 jours ou plus du début de la période relue : gardée, `o.nonRenvoyee`
  (date), `o.vue = 0` (« à vérifier » par les non vues), journal « opération gardée, à vérifier » (`st.gardees`) ; une fois
  par opération ; effacé si la banque la renvoie. Au bord de la période : gardée sans signalement. Détail de l'opération :
  note et bouton « Retirer (opération en double) » (`data-a="retirerop"`, confirmé, annulable). Fusion des opérations
  relues : inchangée. Migration `relecture132` (`migrations.js:relecture`) : `c.sync.relire` sur chaque compte Enable
  Banking, une fois (relecture depuis la frontière de reprise à la synchro suivante).
- Équilibre (`commun.js`) : `affEff(B, r)` = affectation qui compte : celle de l'opération, sauf avant
  `B.R.commun.debutAvances` (réglage `commun.debutAvances`, AAAA-MM-JJ, null : depuis toujours ; Réglages › Personnes du
  commun) où seule `impots` compte. Utilisée par `liensEquilibre`, `ponctuels` (et donc `avances`, `enveloppes`, plan /
  renflouement) et `statuts` (crédit ponctuel antérieur : `avant: true`, « avant le suivi des avances (classement
  d'origine) », pas compté « à affecter » dans la fiche). `ponctuels` : depuis le plus tardif de 12 mois glissants et du
  début du suivi ; crédits classés `dp` (déblocage) dans l'équilibre exclus (`deblocages`). Les affectations restent
  enregistrées (`o.commun.aff`) : vider le réglage les fait compter de nouveau. Migration `avances`
  (`migrations.js:debutAvances`) : pose `2026-10-01` si au moins un virement du commun est affecté et qu'aucun réglage
  n'existe, une fois.
- Grafit (`commun.js:imprevusMois`, `resume.js`) : `commun.unplanned` { n, amount (euros, positif), unseen (omis si 0), last }
  = débits du commun au statut `imprevu` (corrections à la main comprises) dont la date de comptage est dans le mois en
  cours ; alerte `COMMUN_UNPLANNED` (`crit`) si `unseen` > 0, texte « n DÉBIT(S) IMPRÉVU(S) · COMMUN » (n = non vus). Résumé
  réécrit par `M.signaler('vu')` et `changed('classement')` (déjà en place). Jeux fictifs : un débit imprévu non vu.
- Journal (`app.js`, #btnClearLog) : `confirmInline` puis `toastAnnuler` (journal d'avant remis devant les lignes ajoutées depuis).
- Tests : `test/lot132.test.mjs` (Grafit vu / non vu, correction prévu ↔ imprévu, crédit et mois précédent exclus, jeu de
  démonstration ; suivi des avances ; déblocage ; migrations ; détail « Retirer ») ; `doublons.test.mjs` et
  `lot113.test.mjs` : retrait → gardée. Références `test/references/releve-*-1.3.2.json` : seuls
  `grafit.calcule.commun.unplanned` et l'alerte `COMMUN_UNPLANNED` changent depuis la 1.3.0.

### 1.3.1 — détails techniques
- `vues.js:rangee` (cartes du commun) : `provisionsTexte(f.reserveDet)` — `reserveDet` (budget.js `reserveCommun`) est une
  liste `{ label, montant }` (centimes) ; libellés courts Copropriété / Parking. Carte et texte de fin de mois : « Provisions
  en cours » (extras.js : texte envoyé à Claude idem).
- `ecranbudget.js` : `SOUSVUES.commun` = Ce mois · Trésorerie · Équilibre ; une sous-vue mémorisée qui n'existe plus
  retombe sur la première. `index.html` : section #cm-planp retirée ; `style.css` : règles #cm-planp / .cm-plan-t retirées,
  `.cm-dp*` (détail par poste).
- `vcommun.js:plan` : `detailPostes(qui, tot)` dans chaque carte (`details.cm-dp`, état gardé dans `ui.cartes` avec la clé
  `cm|dp-moi` / `cm|dp-autre`), lignes de `KC.planPostes(B)`, total = `plan().T`. `KC.planPostes` garde des montants
  exacts (plus d'arrondi à l'euro).
- Tests : `test/lot131.test.mjs` (carte des provisions ; sous-vue retirée ; garde-fou Chromium « textes illisibles » :
  textes du DOM y compris cachés, title / aria-label / placeholder, valeurs des champs ; jeux « mesures » et
  « personnel », hors et en mode démo). `test/lot130.test.mjs` : plan poste par poste → détail par poste.
- Relevé de contrôle et résumé Grafit inchangés (références 1.3.0).

### 1.3.0 — détails techniques
Tout est dans `commun.js` (section « 1.3.0 ») pour rester chargé par les tests existants ; données sur l'opération
(`o.commun` : `aff` { k: impots | reserve | avance | remb | autre, an, pour ('renflouement' | clé de poste), qui, pg, txt },
`statut` 'prevu' | 'imprevu', `lien` clé d'enveloppe | 'aucun') et dans `S.budget.renflouement` { le, montant } ; réglage
`S.budget.reglages.commun.reserveFixe` (euros) → `B.R.commun.reserveFixe` (centimes, 0 par défaut).
- `virementsVus(B)` : Map id → { v, m } (virements permanents reconnus par `virementVu`, mois par mois).
- `ponctuels(B)` : crédits du commun hors virements permanents et hors internes, depuis 12 mois glissants (`debutAff`),
  ou affectés ; `proposition(B, r)` : « IMPOT(S) » + année à 4 chiffres → impots ; motif impôts → remb ; REMB/RETRO/AVOIR
  → remb ; même montant débité dans les 5 jours sur un poste du commun → avance pour ce poste ; sinon avance
  (renflouement, `qui` d'après `motifAutre`). `affecter`, `corriger`, `restaurer` (annulation : JSON d'avant).
- `enveloppes(B)` : impots|<an> et avance|<poste> ; paiements reliés dans l'ordre des dates (lien à la main, sinon impôt
  hors prélèvement à la source avec la même année si le libellé en porte une, ou débit du poste), plus ancienne enveloppe
  d'abord ; `parOp` Map id → clé.
- `statuts(B)` : Map id → { statut, quoi, ecart, main, sorte }. Crédits : virement permanent (montant `toleranceDe`, date :
  départ connu ou arrivée, au plus `ROUTE_JOURS` jours ouvrés après le jour prévu, au plus `echeance.avant` jours avant)
  sinon ponctuel imprévu. Débits : enveloppe → prévu (écart si payé en partie hors enveloppe) ; appel de fonds (paiement
  qui couvre au moins un appel de `appels(B)` : plusieurs appels, retard au-delà de `echeance.apres`, montant) ; impôt (à
  la source → prévu ; sinon imprévu) ; contrat du commun (montant ; jour habituel ± fenêtre si non rattaché) ; poste du
  budget commun (montant pour les charges fixes et non mensuelles) ; sinon imprévu. Statut forcé à la main en dernier.
- `avances(B)` : avances affectées, `faveur` = montant × part de l'autre (pg de l'affectation, sinon part du poste
  « pour », sinon `commun.part`). `equilibre(B, { brut })` : `liensEquilibre` relie chaque mouvement de l'équilibre
  (historique de l'ancienne version et nouveaux) à son opération (date + montant) ; enveloppe Impôts (versement et
  paiements) retirée (`hors`) ; avance retirée des versements et comptée pour sa `faveur` (`avMoi`, `avAutre`) ;
  `skip`, `mentions` pour l'écran et `serieEquilibre`. `brut` : calcul d'avant (relevé : écart avant / après).
- `decomposition(B)`, `enveloppesDetournees(B)` (dépense en cause : premier débit hors enveloppe après lequel le solde
  passe sous le total des enveloppes), `partsEnCause(B, C)` (prélèvements prévus de la trésorerie jusqu'au point bas, ou
  31 jours si le point bas est aujourd'hui ; `tresorerie().ev` porte la clé du poste), `renflouement(B)` (= `plan().pon`
  : seuil = réserve fixe, arrondi à 10 €, parts des postes en cause ; « fait » gardé 7 jours), `fiche(B, m)`,
  `planPostes(B)`.
- `plan()` : `seuil`, `cause` ; `pon` dès que le point bas passe sous la réserve fixe (0 : comme avant), réparti selon
  les postes en cause (avant : charges non mensuelles). Observation « Renflouement » (au-dessus de zéro, sous la réserve),
  « L'enveloppe … finance autre chose ».
- Écrans : `vcommun.js:mois` (#cm-com, sous-vue Ce mois) ; `planPostes` (#cm-planp, sous-vue « Plan ») retirés en
  1.3.1 : `KC.planPostes(B)` (montants exacts en centimes) sert au « Détail par poste » de `vcommun.js:plan` ;
  Équilibre : ligne « + Avances au commun », « Hors équilibre », mention sur chaque mouvement ; `vues.js` :
  `pastilleStatut`, filtres `__imp` / `__eca` (avec `f.statuts`), `detailCommun` (affectation, enveloppe, statut) ;
  `app.js` : `statutsCommun()`, actions `affecter` / `relier` / `statutcm` (annulables) ; `ecranbudget.js` : `data-fiche`,
  `data-renfl`, `data-cmconf`, `data-cmop`. Mode démo : texte libre d'affectation dans le dictionnaire.
- Changement voulu de `plan().ponMoi` / `ponAutre` quand un virement ponctuel est proposé (jeu de `test/commun.test.mjs` :
  18 000 / 17 000 → 21 000 / 14 000, le prêt 60/40 étant le poste en cause) ; jeux « mesures » et « personnel » : aucun
  virement ponctuel, relevé inchangé hors `communPlan`.
- Relevé : `communPlan` (toujours présent) ; références `test/references/releve-*-1.3.0.json` = 1.2.0 + ce bloc.
- Tests : `test/lot130.test.mjs` (scénario fictif : impôts mis de côté, deux appels payés ensemble et en retard, solde
  d'impôt prélevé, trois renflouements).

### 1.2.0 — détails techniques
- **Total perso** (`modele.js:totalPerso(S, dettes, livrets)`, `ROLES_TOTAL_PERSO`) : comptes visibles en euros de rôle
  `courant`, `paiement_en_ligne` et `epargne` (livret : estimation `KladFisc.livretCarte` si fournie, sinon solde affiché),
  moins `dettes[id].centimes` des `carte_differee` ; le commun n'y est jamais. → `{ centimes, n, manque }` (`manque` :
  libellés d'un courant ou épargne sans solde, d'une carte sans dette ; un portefeuille sans solde compte pour 0).
  Accueil (`vaccueil.js:soldes`) : une ligne « Total perso » (sous-ligne : ce qui est compté, « incomplet : … » le cas
  échéant), à la place de « Total disponible (courants et commun) · après les cartes » et « Tous les comptes · dont
  épargne ». Résumé Grafit (`resume.js:totaux`) : `total.all` = même fonction, mêmes dettes, mêmes livrets (contexte du
  budget du résumé) ; omis si `manque` n'est pas vide. Changement voulu du relevé de contrôle (`grafit.calcule.total.all`
  seul) : références `test/references/releve-*-1.2.0.json` (les 1.1.3 gardées : le test vérifie que seul ce champ diffère).
  Format du résumé inchangé (v1) ; README › Lien Grafit mis à jour.
- **Reste à vivre** (`vaccueil.js:reste`, `barreCycle(debut, N, T)`) : « jusqu'au JJ/MM · jour N/T » (`res.jour`,
  `res.nbJours` de `KladBudget.suivi`), SVG `aria-hidden` en pourcentages : fond, écoulé jusqu'à la fin du jour N, T − 1
  traits (`.jr`, `.sem` plus haut et plus épais avant un lundi, semaines calendaires), repère `.ici` au milieu du jour N.
  Détail (`vbudget.js:detailRav(rav, base)`) : ligne « Par jour » retirée (`app.js:preparer.secRav` ne passe plus les jours).
- **Pastilles « à vérifier »** : `classement.js:limiteNC(ctx, now)`, `aVerifierOp(ctx, o, limite)` (non vue, ou non
  classée depuis `NC_JOURS`, ou `aRapprocher`) ; `vues.js:compteursAVerifier(S, ctx)` → `{ perso, commun, tout }` en un
  passage (périmètres de `opsDuScope` : perso sans commun ni épargne, tout = tous les comptes visibles),
  `nAVerifier(S, scope, ctx)`, `filtrer` avec `cat: '__av'`, `perimetre(p, nb)` (pastille `.pst`, `data-av-n`, nom
  « Perso, n à vérifier »), puce « À vérifier » dans `filtres`. `app.js` : `compteursAV()` (mémo `avMemo`, remis à zéro
  par `renderBadge` et `renderOps(true)`), `afficherBadge()` = total « Tout » (avant : non vues seules) ; appui sur un
  choix à pastille → périmètre + `filtre.cat = '__av'`, période « Toute période » ; sans pastille → comme avant (et
  retire `__av`). Outils de mesure (`banc.mjs:operationsPerso`, `demo-outils.mjs`) : reviennent à « Toutes » après le choix.
- **Tendance** (`budget.js:tendanceMois`, `TENDANCE_JOURS` = 62) : `o.du`, `o.au` (prioritaires sur `from` / `to`, remis
  dans l'ordre) ; `pas` = `jour` si la période fait moins de 62 jours (clés `AAAA-MM-JJ`), sinon `mois` (seules les
  opérations de la période comptent, même coupée en milieu de mois) ; solde « en fin de journée » ; repère du budget
  mensuel d'une catégorie seulement par mois. `app.js:periode()` : `{ n: 'perso', du, au }` gardé (préférence `periode`),
  sinon `du` / `au` déduits des mois (préréglage « 1 mois » → par jour). `ecranbudget.js` : champs `#tend-du`, `#tend-au`
  (à la place des listes de mois `#from`, `#to`), ◀ ▶ décalent une période personnalisée de sa propre longueur.
  `vbudget.js:tendance` : libellés JJ/MM, titres et notes « par jour ».
- Tests : `test/lot120.test.mjs` ; parcours adaptés (pastille de l'onglet, « jour N/T », « Total perso »).

### 1.1.4 — détails techniques
- **Cause du défaut 1** : le 02/11, le prêt du mois n'étant pas encore passé, l'observation jugeait le mois du dernier
  prêt (octobre) sur **tous les apports** de ce mois arrivés après le prêt ; deux virements ponctuels (rattrapage) du
  propriétaire, mi-octobre, étaient comptés comme deux virements en retard. Le rapprochement départ ↔ arrivée
  (`departDe`) n'était pas en cause : il est recalculé à chaque contexte et tient après l'arrivée (testé).
- `observations.js:retardsCommun(B, prets, V, nom)` (utilisé quand la liste des virements permanents existe ; sinon
  ancienne règle des apports, inchangée) : chaque virement de `B.D.virements` est jugé seul (`KC.virementVu` pour le
  mois). Référence `E` = premier prêt du mois (motif `observations.motifPret`) ; tant qu'il n'est pas à la banque, son
  jour habituel (jour du premier prêt du dernier mois connu, « (jour habituel) » dans le texte) une fois passé. Avant
  l'échéance du mois en cours : « Tous reçus » si tout est arrivé, sinon le mois précédent jugé sur les seuls virements
  retrouvés (un virement non retrouvé d'un mois passé ne fait pas conclure). En retard : date effective (départ connu
  pour « moi », sinon arrivée) > `E` ; en route parti après `E` ; absent du mois en cours après `E`. Titre inchangé
  (« Compte commun : virement(s) de <nom>[ et de <nom>] après l'échéance ») ; texte : un élément par virement
  (« nom · libellé (montant) arrivé le JJ/MM | parti le JJ/MM, encore en route | pas encore arrivé »). Niveau inchangé
  (`warn` si mois passé et ordres programmés avant l'échéance, sinon `bad`). Décision du propriétaire : premier prêt
  du mois (option A, plutôt que le dernier).
- « Virements du mois » (info) : « n sur N reçus (x €) [, n en route (…)] ; y € encore attendus (noms, prévus le J) ».
  Le relevé de contrôle en tire les montants (`chiffres`).
- Tests : `test/lot114.test.mjs` (scénario constaté sur jeu fictif : départ 31/10 relu, arrivée 02/11, prêts 05 et
  06, virements ponctuels en octobre ; 02/11 sans retard ; 07/11 au seul nom de l'autre personne ; sans départ connu ;
  « Tous reçus » avant le prêt). Contre-épreuve : 4 des 5 tests échouent sur la 1.1.3.

### 1.1.3 — détails techniques
- **Jours ouvrés** (`commun.js`) : `paques(y)` (calcul grégorien), `ferie(d)` (11 jours fériés nationaux : 1/1, lundi de
  Pâques, 1/5, 8/5, Ascension, lundi de Pentecôte, 14/7, 15/8, 1/11, 11/11, 25/12 ; pas Alsace-Moselle, décision du
  propriétaire), `joursOuvres(a, b)` (jours ouvrés après a jusqu'à b compris). `routes(B)` (mémo `B.memo.routes`) :
  rapprochement départ → arrivée si l'arrivée est au plus `ROUTE_JOURS` = 5 jours ouvrés après le départ (ou 5 jours de
  calendrier avant) ; en route tant que `joursOuvres(départ, aujourd'hui) ≤ 5`. `enRoute(B)` inchangé pour les appelants ;
  `departDe(B, arrivée)` → ligne du départ ou null.
- **Observation « virements après l'échéance »** (`observations.js`) : un apport « moi » est en retard si son départ
  (`departDe`) est après l'échéance du prêt (sans départ connu : l'arrivée) ; « autre » : l'arrivée. Titre « Compte
  commun : virement(s) de <nom>[ et de <nom>] après l'échéance » (noms des réglages du commun, masqués en démo). Aucun
  apport arrivé mais des virements en route partis avant l'échéance : pas d'avertissement « Aucun apport reçu ». La
  branche « Tous reçus » prend aussi la date de départ.
- **« Budget du mois dépassé »** : lignes de `KB.suivi(B, sc, null)` (période de l'écran Budget : cycle de salaire ou
  mois civil, `pd`), plus `KB.postes` (mois civil). Changement voulu des relevés des jeux fictifs au 28/10 (cycle
  27/10 → 26/11) : références régénérées `test/references/releve-*-1.1.3.json` (les 1.1.1 gardées pour mémoire).
- **Journal de la synchronisation** (`modele.js`) : `formeEB(t)` (présence de status, entry_reference, transaction_id,
  booking_date, value_date ; `idDate` = transaction_id en forme de date), `formeKlad(o)` (identifiant `reference-date` |
  `reference` | `en-cours` | `empreinte`, statut, date de valeur), `texteForme(d)`. `integrer` → `st.details`
  `[{ action: fusion | retrait, motif: en-cours | relue | plus-renvoyee | en-cours-absente, renvoyee, ancienne }]` ;
  `rapprocher(list, noter)`. `sync.js` : une ligne par détail, `JOURNAL_FORMES` = 10 au plus, puis un décompte.
- **Journal du budget** : `KB.journalPoste(S, snap, quoi)` → « Budget perso|du commun : <quoi> (budget monté|baissé de
  x € par mois | inchangé). » ; utilisé par aligner (prélevé, contrats, réel habituel, référence « = » qui n'écrivait
  rien), modifier, ajouter, retirer ; « Tout aligner » donne le périmètre et le nombre de postes.
- **Diagnostic d'affichage** (`diagaff.js`, `style.css`) : texte témoin de la mesure en `position: fixed` (à 200 %, il
  élargissait la page à 347 px pendant la mesure : mesures faussées) ; `.diag-t` en `white-space: break-spaces` (les
  espaces de fin de ligne « pendaient » hors du cadre : échec du test de débordement à 320 px / 200 % selon la police).
- **Mode démo** : `test/demo-outils.mjs:completer` ajoute un virement en route (parti la veille, libellé avec référence)
  et un prélèvement réglé d'avance (`echeance` au 1er du mois suivant) ; `test/demo.test.mjs` parcourt Commun, le
  détail des deux opérations. Rien de nouveau à masquer : dates, montants (multipliés) et libellés passent déjà par le
  dictionnaire.
- **Écart de 0,66 € du budget commun (0.10.10 → 1.1.0)** : aucun calcul du budget commun modifié entre ces versions
  (diff du code). Dans les données de référence, un seul poste du commun a un budget qui diffère de son contrat de
  exactement cet écart : geste du propriétaire probable (« aligner sur ses contrats » ou saisie). Journal d'alors : « Budget d'un poste aligné sur ses
  contrats. » ou « Budget d'un poste modifié. », sans périmètre (corrigé en 1.1.3).
- Tests : `test/lot113.test.mjs` (jours fériés, en route du 31/10 au 06/11 puis non reçu le 09/11, départ 30/10 →
  arrivée 03/11 et 06/11, retard nommé, en route avant l'échéance, formes du journal, ligne de synchronisation, journal
  du budget, période du « Budget du mois dépassé »).

### 1.1.2 — détails techniques
- **Cause des doublons** : la banque a renvoyé les virements comme comptabilisés (statut `BOOK` ou absent, qui vaut
  `BOOK` dans `depuisEB`) avec un identifiant fabriqué à partir de la date (`transaction_id` = « AAAA-MM-JJT00:00:00-n »,
  id Klad `…:r:<cet identifiant>`) ; relus le lendemain avec une autre date de comptabilisation, un autre identifiant et
  une référence ajoutée au libellé. La fusion « en cours → comptabilisée » (`rapprocher`) ne concerne que les `PDNG` :
  les deux versions étaient gardées. Les champs bruts (status, entry_reference, value_date) ne sont pas conservés par
  Klad : diagnostic déduit des identifiants du relevé.
- `modele.js` : `baseLibelle` (libellé normalisé sans numéros de fin), `avecReference`, `memeOperation` (même montant,
  dates à `DOUBLON_JOURS` = 5, même libellé de base), `reprendreEtat(S, ancienne, gardee)` (classement, « vu »,
  rapprochements, `echeance`, `apparue` ; renvois : `S.budget.exc`, `equilibre.items[].op`, `categorie.lie`,
  `rapprochement.avec`), `annulerRenvois`. `integrer(S, cid, raw, now, { depuis })` : une comptabilisée Enable Banking
  plus renvoyée sur la période relue (depuis la date demandée, ou la plus ancienne renvoyée si la banque ne renvoie rien
  des 10 premiers jours demandés ; rien si la banque ne renvoie rien ; jamais avant la frontière) est fusionnée dans une
  renvoyée qui lui correspond (`fusionnees`), sinon retirée (`retirees`). `RAPPROCHE_JOURS` 4 → 5. `sync.js` passe
  `{ depuis: from }`.
- Migration `doublons` (`migrations.js`, au déverrouillage dans `preparerClassement`) : paires (sans référence ou en
  cours) → (comptabilisée avec référence), même règle ; la première est retirée. Une fois ; `doublonsAnnulables` (7 jours,
  `DOUBLONS_JOURS_ANNUL`), `annulerDoublons` (opérations remises, état d'avant de la gardée, renvois annulés ; la
  migration ne se refait pas). Bouton dans Plus › Journal (`#logAnnuler`, `data-annuler-doublons`).
- **Rattachement à l'échéance** (`budget.js`, `rattacher(B)` dans `contexte`) : chaque ligne reçoit `r.pd` (date de
  comptage) = `r.ech` (échéance réglée) ou `r.od`. Occurrences : virements permanents (départ perso : poste
  contribution ou libellé « VIR » du montant d'un de mes ordres ; arrivée sur le commun : revenu du montant d'un ordre,
  `deLautre` d'après `commun.motifAutre` ou le nom) au jour de la liste ; contrats (motif) et charges fixes récurrentes
  (`cid|sous-catégorie|suggestKw`, au moins 3 mois, au plus ~1 par mois) au jour le plus fréquent (au moins 2 fois et
  40 %). Fenêtre `B.R.echeance` (`S.budget.reglages.echeance { avant: 7, apres: 5 }`, 0 à 15 jours, thème `echeance` de
  `KladReglages.THEMES`). Correction à la main : `o.echeance` = date ou `'reel'` (`rattacherA`, `choixRattachement` :
  période de la date réelle et période voisine, mois ou cycle de salaire ; `rattachement`, `rattachements` : mention).
  Utilisé par `postes`, `suivi` (dépenses : `inPerD`, période entière ; revenus : `dateCompte` = `ech || date`),
  rythme habituel, `jourAttendu`, `dernierDebitPoste` (via `pd`), `moisProchaineEcheance`, `reserveCommun`, `echeances`
  (contrats et récurrents), `contrats().prochaine`, `tendance`, `tendanceMois`, `detailPoste`, `commun.virementVu`,
  `tresorerie`, `finDeMois`.
- **Commun** (`commun.js`) : `enRoute(B)` (départs perso non rapprochés d'une arrivée de même montant à `ROUTE_JOURS` = 5
  jours ; en route 5 jours après le départ, ensuite « non reçu » ; reliés à un de mes ordres), `enRouteMois`, `plan().recus[].route`,
  `finDeMois` : `route` (seulement s'il y en a) hors `inc`, `end = solde − due + inc + route − réserve`, `decouvert` =
  point bas du mois dans la trésorerie ; `margeReelle` : `enRoute`, `enAttente`, `prevue`, `affichee`, `base`
  (`prevue` tant que des virements du mois manquent) ; `risqueDecouvert` : la trésorerie fait foi (cause de l'écart du
  01/11 : « solde − prélèvements à venir » ignorait les virements pas encore arrivés → découvert annoncé au 30/11).
  Résumé Grafit : `commun.transfers_in_transit` seulement s'il y en a.
- Écrans : mention dans la liste (`tranche(…, { ratt })`) et le détail (`detail(S, o, ctx, B)` : « Compte pour »,
  boutons `data-a="comptepour"`, « Annuler ») ; `vcommun.plan` : puce « en route · parti le JJ/MM », ligne
  `.cmp-route` ; `vbudget.ravM` (commun) : « Marge prévue du commun », « prévue · en attente de x € », les deux bases ;
  Accueil : « en route » ; observation « Virements du mois » : « n en route ».
- Relevé de contrôle : `commun.marge.enRoute|enAttente|prevue`, `commun.finDeMois.enRoute`, `commun.virements[].enRoute`,
  `commun.enRoute`, `rattachements` : seulement s'il y en a (non comparés à l'ancienne version).
- Tests : `test/doublons.test.mjs` (scénario constaté, en cours → comptabilisée, deux vraies opérations identiques,
  opération plus renvoyée, migration et annulation), `test/anticipe.test.mjs` (jeu « personnel » complété,
  `test/scenario-anticipe.mjs`, au 31/10, 01/11 et 03/11 ; contre-épreuve ; découvert ; correction à la main ; écrans),
  relevés des jeux « mesures » et « personnel » comparés aux références 1.1.1 (`test/references/`, `test/jeux.mjs`).

### 1.1.1 — détails techniques
- Tolérance (`budget.js`) : `toleranceDe(T, pm) = min(T.max, max(T.min, pm × T.part))`, `tolReglee(S.budget.reglages)`
  → `B.R.tolerance` (centimes ; défauts `TOL_MIN = 200`, `TOL_PART = 0.02`, `TOL_MAX = 1000`). Réglage : thème
  `tolerance` de `KladReglages.THEMES` (magasin `r`, `S.budget.reglages.tolerance { min, part, max }` en € et %, bornes
  `borne` vérifiées par `convertir`), affiché dans Plus › Réglages › Budget (« Tolérance des charges »).
- Écart de rapprochement (`classement.js`) : `ecartDe(ctx, o)` → `{ banque, achat, ecart }` (prélèvement rapproché à la
  main `categorie.lie`, ou achat `rapprochement.avec` ; `ecart` = |prélevé| − |achat|, null si égal), `ecarts(ctx)`,
  `ecartAVerifier` (|écart| > `ECART_SIGNAL` = 200 et pas `o.ecartVu`), `marquerEcartVu` / `annulerEcartVu`,
  `ecartPrevu`. `attention()` → `gaps` (écarts à vérifier, comptes visibles). `liens(ctx)` mémorisé dans le contexte.
- Budget (`KladBudget.contexte`) : une ligne `{ ecart: true, id: id du prélèvement, m: −écart, type/cat/sub de l'achat,
  date du prélèvement, label « Écart de rapprochement » }` par écart ; comptée par tous les calculs de dépense
  (postes, suivi, tendance, répartition, reste à vivre) ; écartée des calculs de trésorerie et de soldes (variation du
  commun, courbe de solde, `opsCommun`) et des recherches par libellé (contrats, récurrents, salaire, impôts, livret,
  observations du portefeuille et du compte secondaire). Exclusion du budget par l'id du prélèvement.
- Écrans : confirmation dans le volet `secRapprocher` (`KladVues.confirmationEcart`, `data-rapok` / `data-rapnon`) ;
  détail des deux opérations (« Écart de rapprochement », boutons `ecartvu` / `ecartnonvu`) ; « À vérifier » : ligne
  `ecarts` → liste filtrée `__ecart` ; détail d'un poste : ligne « écart de rapprochement » sans bouton « classer » ni
  montant négatif. `modele.rapprocher` (en cours → comptabilisée) garde `rapprochement` et `ecartVu`.
- Relevé de contrôle : `aVerifier.ecartsAVerifier` et `ecartsRapprochement` seulement s'il y en a (relevé identique
  sinon) ; `ecartsAVerifier` non comparé à l'ancienne version (`tools/controle/comparer.mjs`).
- Mode démo (`demo.js`) : noms des fonds du plan d'épargne → « Fonds N » ; plans soldés (`closed`) : employeur et note.
  Jeu « personnel » (`PERSONNEL.patrimoine`, `test/demo-outils.mjs:completer`) : positions crypto, livret, plan
  d'épargne (fonds, versement, plan soldé), historique des observations, portefeuille et prélèvement à rapprocher ;
  noms et montants saisis dans les interdits ; `test/demo.test.mjs` ouvre aussi le formulaire crypto, l'historique,
  le choix et la confirmation du rapprochement et le détail des deux opérations.
- Tests : `test/lot111.test.mjs` (écart compté une fois, soldes inchangés, annulation, « À vérifier », relevé identique
  à montants égaux, tolérance 1 € / 15 €), `budget.test.mjs` (plafond, réglage), `lot11.test.mjs` (confirmation à
  l'écran, « Écart vérifié »).

### 1.1.0 — détails techniques
- Clavier du Budget : `ecranbudget.js` ne redessine plus sur `resize` si la largeur n'a pas changé ou si un champ de
  `#appli` a le focus (l'ouverture du clavier réduit la hauteur ; le rendu retirait le champ et fermait le clavier).
- Reste à vivre : Accueil (`vaccueil.js:reste`) = libellé, grand chiffre, « jusqu'au JJ/MM · x € par jour », barre du
  cycle (texte complet dans `aria-label`) ; `VB.detailRav(rav, base, restants)` ajoute la ligne « Par jour ».
- `budget.js` : `SURVEILLER = 0.9` (« à surveiller » si consommé ≥ 90 % du budget, plus de critère de projection) ;
  tolérance `TOL_MIN = 200`, `TOL_PART = 0.02` pour les charges fixes et tous les postes du commun (`tolere`,
  `tolerance`) : sous le seuil, état « prélevé · x € de plus » / « conforme · x € de plus » (good), cause `sorte: 'tol'`
  avec `aligner` (bouton « aligner le budget sur le prélevé ») ; ni dans `depasses` ni dans `causes`.
- Commun : `S.budget.reglages.commun.cycle` (`mois` par défaut, `salaire`) → `B.R.cycleCommun` ; `periode(B, 'commun')`
  prend le cycle de salaire du perso (si le perso n'est pas au mois civil). Trésorerie, plan et Grafit restent au mois.
- Observations : `KladObservations.fait(S, titre, now, B)` garde aussi `D.histObs` (200 au plus, le plus récent
  d'abord, `{ titre, le, niveau, scope, texte }`) ; `reafficher` ne le vide pas ; `annulerFait` accepte l'ancien et le
  nouveau format ; `historique(B)` ; rendu `KladVuesFisc.historiqueObs` (volet Observations et Budget).
- Carburant : volet `secCarburant` (`VB.carburantVolet`, gestionnaires dans `ecranbudget.js`), ouvert par `[data-fuel]`
  (poste Carburant, Suivi et Budget) ; thème `carburant` retiré du menu des Réglages (gardé dans `THEMES`).
- Onglet Patrimoine (6e onglet, `data-tab="patrimoine"`) : écrans `impots`, `epargne` et nouveau `crypto`
  (`view-crypto`) ; barre de parties `[data-patri]` (Impôts, Foncier, Épargne, Crypto) dans `ecranfisc.js`
  (`PARTIES`, `vuePatrimoine`) ; Foncier = écran des impôts en sous-vue `foncier` (retirée des sous-vues des impôts) ;
  plus de bouton Retour ; entrées Impôts et Épargne retirées de Plus. Banc (`tools/mesures/banc.mjs`) : parcourt
  chaque partie.
- Crypto : `S.budget.crypto.positions [{ id, nom, investi, valeur, le }]` (centimes) ; `KladFisc.crypto(B)`,
  `cryptoEnregistrer`, `cryptoRetirer`, `annulerCrypto`, `CRYPTO_JOURS = 30` ; observation « Crypto : valeur à mettre à
  jour » ; mode démo : nom → « Position N ».
- Rapprochement à la main (`classement.js`) : `o.rapprochement` = `'depense'` (prélèvement gardé en dépense, plus « à
  rapprocher »), `'autrement'` (achat du portefeuille payé autrement), `{ avec }` ; `rapprocherAvec(ctx, o, w, achat)`
  (prélèvement interne « rapproché à la main », `categorie.lie` = id de l'achat), `garderDepense`, `payeAutrement`,
  `annulerRapprochement`, `prelevementDe` (prélèvement qui règle un achat), `candidatsPortefeuille`,
  `candidatsBanque` (± 30 jours, plus proches en montant puis en date). Volet `secRapprocher`, boutons du détail.
- Six onglets : compteur « à voir » en « 9+ » sur un onglet étroit, et en simple point (nombre dans `aria-label`) quand
  la place manque à droite de l'icône (petit écran et texte très agrandi) ; recalculé au redimensionnement.
- Tests : `test/lot11.test.mjs` (Chromium, ajouté au parcours de la fabrication), `budget.test.mjs` (90 %, tolérance,
  commun sur le cycle), `fisc.test.mjs` (historique), `classement.test.mjs` (rapprochement), `accueil.test.mjs`.
  Relevé de contrôle et résumé Grafit identiques à la 1.0.1 sur les jeux « mesures » et « personnel ».

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
| — | Retours d'usage : saisie du Budget, reste à vivre, alertes, tolérance, commun en cycle, historique, carburant, onglet Patrimoine, crypto, rapprochement | 1.1.0 | fait |
| — | Correctif : tolérance plafonnée et réglable, écart de rapprochement, mode démo des nouveautés | 1.1.1 | fait |
| — | Correctif : doublons de la banque, échéances réglées d'avance, virements en route et marge prévue du commun, découvert | 1.1.2 | fait |
| — | Retours du relevé 1.1.2 : en route en jours ouvrés, retards du commun, période du dépassement, journal, mode démo | 1.1.3 | fait |
| — | Nouvelle interface : Aperçu Moi / Nous, barre à 5 entrées avec Trier (inclut 1.3.5 et 1.3.6) | 2.0.0 | fait |
| — | Échéances ponctuelles (impôt estimé, taxe foncière, provisions) | 1.4.0 → 2.1 | à faire |

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

- 2.0.0 (propriétaire, 08/11) : barre du bas Aperçu · Opérations · Trier · Patrimoine · Plus (noms validés) ; aucune
  information de l'ancien Accueil ni des écrans Budget / Commun retirée (les écrans détaillés restent, ouverts depuis
  l'Aperçu) ; budget avant les prochains jours sur Moi (et, par défaut, sur Nous : même ordre des deux côtés, à confirmer) ;
  1.3.5 et 1.3.6 publiées dans la 2.0.0 (« travaille directement sur la nouvelle version »). Itérations d'interface :
  prototype en artefact (`tools/artefact/prototype.mjs`) avant l'APK.

- 1.3.5 (propriétaire, 08/11, recommandations de l'architecte retenues) : le reste à vivre « comptes courants » retire
  toute la somme due sur les cartes à débit différé (pas seulement les achats du cycle) ; une seule notion « à vérifier »
  (non vue, ou non classée depuis 3 mois, ou à rapprocher) pour l'Accueil, les pastilles et l'onglet ; correctif 1.3.5
  avant le lot de désencombrement 1.3.6, puis le lot 1.4.0 (échéances ponctuelles).

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

- 1.1.1 (décisions de l'architecte) : tolérance = plus grand de 2 € et 2 % du budget, plafonnée à 10 €, réglable ;
  écart de rapprochement compté dans la catégorie de l'achat, signalé au-delà de 2 €, confirmation avant de rapprocher.
  Choix du propriétaire : un prélèvement plus petit que l'achat compte en moins (dépense comptée = montant prélevé) ;
  le signalement dure jusqu'à « Écart vérifié » (annulable). Par défaut, à valider : un rapprochement à montants égaux
  ne demande pas de confirmation ; l'écart est daté du prélèvement.
- 1.1.0 (décisions validées par l'architecte, sauf la tolérance, plafonnée en 1.1.1) : « à surveiller » dès 90 % consommés, sans autre condition ;
  tolérance aussi sur les postes courants du commun ; commun sur le cycle de salaire = celui du budget perso ; partie
  Foncier = taxe foncière seule ; crypto : rappel et observation à 30 jours ; rapprochement à la main jusqu'à 30 jours
  d'écart, montant libre ; libellé d'onglet « Patrimoine ».
- 1.0.1 (décisions prises par défaut, à valider) : nouveau format de sauvegarde par morceaux (v2), les fichiers v1
  restant lisibles ; messages 5 s, erreurs 6 s, « Annuler » 8 s ; un message plus récent remplace un « Annuler » en
  cours ; message en haut de l'écran quand un volet est ouvert ; bandeau du mode démo replié en pastille après 6 s ;
  l'encart « Reprendre le classement » reste jusqu'au choix (« Plus tard » : écarté pour la session) ; panne passagère
  limitée à la réponse 400 contenant « ASPSP ».

- 1.1.3 (validées par l'architecte) : marge prévue avec le reste du budget variable ; pas de rattachement pour les
  dépenses courantes ni le salaire ; virement « en route » 5 jours **ouvrés** (jours fériés nationaux seulement, décision
  du propriétaire), puis « non reçu » ; un virement parti avant l'échéance n'est jamais en retard ; journal anonyme de la
  forme des champs bancaires à chaque fusion ou retrait. Prises par défaut, à valider : au plus 10 lignes de forme par
  compte et par synchronisation ; journal du budget avec le périmètre et la variation mensuelle (sans nom de poste).

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

## Points d'appui laissés par la 2.2.0
- Nouveau texte d'explication : le mettre dans une `.inf` (ou laisser la pose automatique d'une zone `.inf-auto`) ; un
  état ou un montant à garder visible : classe `vis` (ou un `.num`, `.chip`, `.bad-t`).

## Points d'appui laissés par la 2.1.0
- Toute nouvelle donnée du budget va dans la carte du budget (`vbudget.js`, `suivi` / `plan` / `bilan`) ; du haut de
  l'Aperçu dans `vapercu.js` (`haut`). L'écran Accueil (`#view-accueil`) ne sert plus qu'avant le premier compte.
- Pistes non livrées : Trier en cartes ; « Virements à mettre en place » et « Le compte commun ce mois-ci » gardent leur
  présentation (même contenu, cartes de l'Aperçu autour).

## Points d'appui laissés par la 2.0.0
- Prototype : `node tools/artefact/prototype.mjs sortie.html` (Aperçu produit par le vrai code sur le jeu fictif au
  28/10/2026, Opérations et Trier simulés) ; à republier dans l'artefact du propriétaire pour chaque itération d'interface.
- Pistes déjà montrées dans le prototype et non livrées : **Trier en cartes** (glisser à droite = c'est bon, à gauche =
  changer de catégorie, vers le haut = plus tard) et filtres Moi / Nous des Opérations. Dans la 2.0.0, Trier ouvre la
  file « à vérifier » existante.
- Lot suivant prévu : échéances ponctuelles (ancien 1.4.0). Toute nouvelle donnée de l'Accueil va dans `vapercu.js`
  (page Moi ou Nous), avec un accès à l'écran détaillé.

## Points d'appui laissés par la 1.3.0

- Lot 1.4.0 (point 8 du propriétaire) : « échéances ponctuelles » (impôt sur le revenu, taxe foncière, régularisation,
  appel exceptionnel) avec estimation → avis → constaté, échéancier (solde ≤ 300 € fin septembre, sinon 4 fois de
  septembre à décembre ; taxe foncière mi-octobre), compte payeur, partage, provision mensuelle dans une enveloppe
  dédiée, trésorerie / Grafit / reste à vivre sur leurs seules dates (aujourd'hui `impots()` répète le dernier prélèvement
  constaté jusqu'en décembre), alertes. S'appuyer sur `enveloppes(B)` (ajouter une sorte d'enveloppe) et `statuts(B)`.
- Décisions prises par défaut, à valider : affectations proposées sur 12 mois glissants ; « Réserve », « Remboursement »
  et « Autre » ne changent pas l'équilibre ; part d'une avance de renflouement = part par défaut du commun ; renflouement
  arrondi à 10 € ; « Fait » gardé 7 jours.
- Relevé réel attendu : `communPlan.equilibre.ecartAvant` / `ecartApres` une fois les virements ponctuels affectés ;
  avances 270 € dont 135 € en faveur du propriétaire ; enveloppe Impôts 2025 : versé 343 €, payé 170 €, reste 173 €.

## Points d'appui laissés par la 1.2.0

- Décisions prises par défaut, à valider par le propriétaire : appui sur un choix à pastille = liste filtrée (et non un
  simple changement de périmètre) ; semaines marquées au lundi (et non tous les 7 jours depuis le début du cycle) ;
  « 1 mois » de la Tendance par jour ; Total perso : estimation du livret, portefeuille sans solde compté pour 0.
- Relevé réel attendu après installation : Total perso = courants perso + paiement en ligne + livret − dette de carte ;
  `grafit.calcule.total.all` du relevé = cette valeur ; aucun autre écart avec le relevé précédent hors mouvements réels.
- Régularisation des impôts (solde avancé par une personne non compté dans « qui verse combien ») : piste ouverte, non faite.

## Points d'appui laissés par la 1.1.4

- Prochain relevé de contrôle utile : après l'arrivée du virement de l'autre personne (marge « réelle ») et après les
  prêts du mois (observation « virements à l'heure » ou retard nommé).
- « Première grosse échéance du commun » (piste de l'architecte quand aucun prêt n'est reconnu) : non faite ; sans
  prêt reconnu par le motif, pas d'observation d'échéance (inchangé).
- Le texte de l'observation des virements après l'échéance diffère de l'ancienne version (code identique, chiffres
  différents) : à garder dans « Écarts connus » lors d'une comparaison.

## Points d'appui laissés par la 1.1.3

- Reste de la 1.1.1 : tolérance (a) et écart de rapprochement (b) livrés en 1.1.1, vérifiés ; mode démo (c) complété ;
  « Budget du mois dépassé » (d) corrigé (il suivait encore le mois civil) ; écart de 0,66 € (e) : cause probable donnée,
  à confirmer par le journal du propriétaire.
- Références des relevés : `test/references/releve-*-1.1.3.json` (jeux à date du 28/10/2026) ; un lot qui change
  volontairement un chiffre de ces jeux régénère la référence et l'explique dans le rapport.
- Comparaison avec l'ancienne version : l'observation « Budget du mois dépassé » (mois civil dans la v65) et le titre
  de l'observation des virements après l'échéance diffèrent désormais volontairement (voir « Écarts connus »).
- Journal : si un doublon revient, les lignes « opération fusionnée / retirée » donnent la forme des champs bancaires.

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
- 1.1.3 : « Budget du mois dépassé » suit la période du Budget (cycle de salaire) alors que l'ancienne version prenait le
  mois civil ; les virements partis avant l'échéance du prêt ne sont plus comptés en retard, et le titre nomme la
  personne en retard (« Compte commun : virement de … après l'échéance »).
