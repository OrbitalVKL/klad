# Klad — état du projet

Mémoire entre sessions (générique et public : aucune donnée personnelle). Une session neuve repart de ce fichier,
de `CLAUDE.md` et du `README.md`. À tenir à jour à chaque lot.

## Version

**0.8.1** — écarts comblés après l'inventaire : contrats modifiables (« → prévu »), base de calcul et « Tout aligner »,
thème clair / sombre, mode démo, import manuel d'un relevé CSV ou JSON. (0.8.0 — Lot 8 : impôts, taxe foncière, épargne,
observations, résultats, répartition ; 0.7.0 — Lot 7 : compte commun et équilibre ; 0.6.0 — Lot 6 : budget par cycle,
reste à vivre, contrats, échéances, tendance.)

Nuit autonome du 28 au 29/10/2026 : lots 6, 7, 8 et inventaire des écarts enchaînés sans validation intermédiaire
(décisions par défaut notées dans chaque section « Décisions »).

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
| 9 | Extras (IMAP, Claude), reprise définitive, bascule | 0.9 → 1.0 | à faire |

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

## Inventaire des écarts avec l'ancienne version (0.8.1)

Comblés en 0.8.1 (ni clé ni réglage personnel) : édition des contrats et « → prévu » ; base de calcul et « Tout aligner
sur le réel habituel » ; thème ; mode démo ; import manuel CSV / JSON par compte manuel.

Restent (à arbitrer pour le Lot 9 ou au-delà) :
- Tendance : séries revenus / dépenses / balance par mois, solde cumulé et solde reconstitué, choix des comptes.
- Compte commun : vue d'ensemble des parts par poste (tableau « Total retenu / Personne A / Personne B ») ; équilibre :
  liste complète des mouvements filtrable par sorte, graphique de l'investissement cumulé de chacun.
- Livret : estimation affichée sur la carte du compte livret (elle est dans Plus › Épargne).
- Calculateur carburant (réglage `fuel` du carnet).
- Import Excel (.xlsx) : l'ancienne version chargeait une bibliothèque en ligne ; à reprendre seulement avec une
  bibliothèque embarquée (taille de l'appli).
- Opérations « exceptionnelles » : réglage vide dans l'ancienne version (`EXC = {}`), rien à reprendre.
- Avec clé ou réglage personnel (Lot 9) : lecture des bulletins de paie, avis et appels de fonds (Drive, Gmail / IMAP),
  analyses par Claude, reprise définitive et bascule.

Décisions 0.8.1 : contrats et base de calcul suivent l'ancienne version (poste deviné par les mots de 4 lettres ou plus,
« → prévu » = total mensuel des contrats, ou échéance et périodicité d'un contrat non mensuel unique ; alignement à
l'euro) ; import de relevé réservé aux comptes manuels (les comptes bancaires sont lus par Enable Banking : pas de
doublon possible avec la synchro) ; mode démo sans facteur mémorisé (s'arrête au redémarrage) ; libellés courts des
comptes non masqués en démo (ce sont aussi des mots de l'interface : « Commun »…).

## Points d'appui pour le Lot 9

- Impôts : `KladFisc` (`contexte`, `annee`, `partage`, `regularisations`, `alertes`, `taxeFonciere`, `pee`, `livret`) ;
  bulletins (`S.budget.fisc.bs`) et avis (`fisc.avis`) au format de l'ancienne version : la lecture automatique (Drive,
  Claude) du Lot 9 doit produire ces objets (`{ p, emp, m, pay, ni, pas, taux, type, brut }`, avis `{ rev, sal, ded, … }`).
- Appels de fonds : `S.budget.appels[cp].items`, `mails`, `pdfs` (format de l'ancienne version) ; lecture des mails au Lot 9.
- Observations : `KladObservations.audit(B)` (points), `observations(B, scope)` (à faire, masqués, infos).
- Réglages du carnet encore inexploités : `excl` (opérations exceptionnelles, vide chez le propriétaire), `fuel`
  (calculateur carburant), `eq.mG/mS` (recalculés), `autoFiles` (soldes de l'ancienne synchro).
- Import manuel : `KladReleve.lire(texte, role, auj)` puis `integrer(S, cid, lignes, now)` (source `fichier`) ; utile
  pour la reprise définitive si un relevé manque.

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
