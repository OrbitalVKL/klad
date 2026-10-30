# Plan de mise en œuvre de la nouvelle organisation

**Validé par le propriétaire (variante A).** Avancement : UX-1 (0.10.0), UX-2 (0.10.1), UX-3 (0.10.2) et UX-4 (0.10.3) faits. Changement décidé : la palette se choisit
dans Réglages › Apparence (Klad ou Grafit), indépendante du thème ; jetons des deux palettes posés en UX-1, sélecteur
livré dès UX-1 dans Plus › Affichage, dans Plus › Réglages › Apparence depuis UX-4.

Suite de [`audit.md`](audit.md) et [`architecture.md`](architecture.md). **À lancer seulement après validation du
propriétaire** (variante, contenu de l'Accueil, groupes de Plus, couleurs). Écrit pour la variante A ; les écarts de la
variante B sont signalés.

## Règles communes à tous les lots

- **Parité des chiffres** : aucun lot ne modifie un calcul (`budget.js`, `commun.js`, `fisc.js`, `classement.js`,
  `observations.js`, `resume.js`). Les blocs déplacés appellent les mêmes fonctions. Garde-fous :
  - `npm test` et le parcours Chromium (mis à jour à chaque lot pour les nouveaux chemins) ;
  - un test qui compare les chiffres de l'Accueil (reste à vivre, soldes, postes, échéances, commun) à ceux des écrans
    d'origine, sur le jeu fictif ;
  - le **relevé de contrôle** (Plus › Contrôle) exporté avant et après chaque lot sur le téléphone : il doit être
    identique (même empreinte d'entrée, mêmes chiffres) ; le résumé Grafit ne change pas de format.
- **Migration des réglages d'affichage** (hors coffre, `localStorage`) :
  - `klad.replis` (sections repliées) : les identifiants de section sont **gardés** quand la section reste ; pour une
    section déplacée ou découpée, une table de correspondance ancien → nouveau est appliquée une seule fois (marque
    `klad.replis.v`), sans effacer l'ancienne clé avant le lot suivant (retour arrière possible) ;
  - `klad.periode`, `klad.tendance` et le thème : inchangés ;
  - positions de défilement par écran (en mémoire pendant la session) : gardées par écran et par sous-vue ;
  - nouvelle préférence éventuelle (sous-vue ouverte de Budget, de Commun) : ajoutée à la liste fermée `KladUI.PREFS`,
    jamais de donnée ;
  - test de migration en sautant des versions (0.9.4 → 0.10.3, par exemple), comme `test/migrations.test.mjs`.
- **Données du coffre** : aucune migration (rien ne change dans les blocs chiffrés).
- **Une version publiée par lot**, recette manuelle donnée au propriétaire après chaque publication ; une régression
  vue sur le téléphone donne un correctif, pas un retour arrière.
- **Accessibilité** vérifiée à chaque lot par le même relevé automatique que l'audit (contrastes AA en clair et en
  sombre, cibles de 48 dp, texte à 130 %), ajouté au parcours Chromium.

## Lots

Effort : S (une session), M (deux sessions), L (trois sessions). Risque : faible, moyen, élevé.

| Lot | Version | Contenu | Risque | Effort |
|---|---|---|---|---|
| UX-1 · Socle lisible ✅ | 0.10.0 | Couleurs AA (texte secondaire, légendes, liens, crédits, badge), polices de 12 px au moins, zones d'appui de 48 dp partout (en-tête, Fermer, puces, ◀ ▶, liens « voir les N », « Comment c'est calculé », « c'est fait », ↑ ↓) ; lignes d'opérations en boutons nommés (« débit 14,50 € ») ; 3 sections du commun nommées ; libellés sur 2 lignes à 130 % ; mot proposé par « Classer aussi les autres » présent dans le libellé, interrupteur coupé s'il ne trouve rien ; « abattement de … », « balance déficitaire ». **Aucun déplacement.** | faible | M |
| UX-2 · Accueil ✅ | 0.10.1 | Nouvel onglet Accueil (§ 2 de l'architecture) : reste à vivre en tête, « À vérifier » regroupé (à voir perso et commun, non classées, accès, sauvegarde, mise à jour, observations, bilan du cycle précédent), soldes en liste, « Ce cycle-ci », commun en un coup d'œil, échéances, actions rapides. L'onglet Budget perd son haut (grande carte, cartes, à voir, à vérifier). Retour d'Android : vers l'Accueil. | moyen | L |
| UX-3 · Opérations ✅ | 0.10.2 | Sélecteur Perso · Commun · Tout toujours visible (par défaut : celui choisi la dernière fois, gardé) ; badge = total à voir ; recherche visible ; « Trier une à une » (à voir puis non classées, 2 appuis par opération, Passer, Annuler) ; détail en page avec Retour ; « Opérations semblables ». | moyen | M |
| UX-4 · Plus ✅ | 0.10.3 | Plus en page entière, 6 groupes, Verrouiller en tête ; « Relevés et sauvegarde » coupé en deux ; Importer regroupé ; Synchroniser, Thème et Observations retirés de Plus ; retour d'Android vers Plus depuis un écran ouvert par Plus ; lexique. | faible | M |
| UX-5 · Budget et Commun | 0.10.4 | Budget : sous-vues Suivi · Tendance · Contrats, dépassés d'abord ; Commun : Ce mois · Trésorerie · Équilibre (variante B : sélecteur Perso · Commun dans Budget, Équilibre dans Plus › Modules) ; sélecteur Perso / Commun retiré de Budget (A) ; Catégories et Règles retirées du bas des deux onglets (restent dans Plus › Réglages › Classement). Migration de `klad.replis` (sections découpées). | moyen | L |
| UX-6 · Modules | 0.10.5 | Impôts : Résumé · Prélèvements · Taxe foncière · Paramètres ; Épargne : Livret · Plan d'épargne · Paramètres ; paramètres et hypothèses sortis des résultats ; Réglages › Budget (cycle de salaire, base de calcul). | moyen | M |
| UX-7 · Rapidité et couleurs | 0.10.6 | Accueil dessiné d'abord après le déverrouillage, autres onglets calculés ensuite ; liste d'opérations allégée (jours hors écran non dessinés) pour 3 ans d'historique ; palette « Grafit » si le propriétaire la choisit (sinon couleurs actuelles). | faible | M |

Ordre : UX-1 d'abord (sans risque, utile partout, et il prépare les composants : bouton de 48 dp, ligne nommée) ; puis
UX-2, le plus fort gain ; UX-3 et UX-4 sont indépendants ; UX-5 dépend d'UX-2 (le haut de Budget est déjà parti) ;
UX-6 et UX-7 en dernier.

Lot 9c (réglages du complément dans Klad, bascule 1.0.0) : **après la série UX (0.10.6)**, recommandé, car ses réglages trouvent leur
place dans Plus › Réglages › Budget et Plus › Données. Autre possibilité : le faire avant UX-4, au prix d'un rangement
fait deux fois.

## Détail par lot

### UX-1 · Socle lisible (0.10.0)

- Fichiers : `www/style.css` (jetons de couleur, tailles, zones d'appui), `www/vues.js` (ligne d'opération), `www/vcommun.js`
  (sections nommées), `www/vues.js` ou `www/classement.js` (mot proposé : à prendre dans le libellé tel quel), `www/vfisc.js`,
  `www/observations.js` (deux formulations ; vérifier que le relevé de contrôle compare les titres « au titre près »).
- Tests : contrastes et cibles dans le parcours Chromium ; mot proposé (test unitaire) ; aucun chiffre changé.
- Recette : lire l'Accueil actuel en plein soleil ; appuyer sur ◀ ▶, sur « voir les N », sur les puces ; classer une
  opération et vérifier le nombre affiché.

### UX-2 · Accueil (0.10.1)

- Nouveau rendu de l'Accueil à partir des fonctions existantes : `KladBudget.suivi(B,'perso').rav`, `KladVues.rangee`,
  `KladVues.lignesAVerifier`, `KladBudget.postes`, `KladCommun.finDeMois`, `KladCommun.plan`, `KladBudget.echeances(B, 31)`.
- Les sections retirées du haut de Budget gardent leurs identifiants dans le code tant qu'elles existent ailleurs.
- Risque : chiffres affichés deux fois (Accueil et Budget) → test de comparaison obligatoire.
- Recette : reste à vivre identique à celui de la 0.10.0 ; ligne « À vérifier » qui mène au bon écran ; échéances
  identiques à Budget › Contrats.

### UX-3 · Opérations (0.10.2)

- `www/app.js` (filtre de périmètre : `scope` des opérations séparé du dernier onglet), `www/vues.js` (puces, sélecteur),
  mode tri (file d'identifiants, volet Classer réutilisé).
- Préférence nouvelle : périmètre de la liste (`klad.opsPerimetre`, liste fermée).
- Recette : 10 opérations à voir traitées une à une ; 5 non classées classées en 2 appuis chacune ; « Annuler » rétablit.

### UX-4 · Plus (0.10.3)

- `www/index.html` (`#rangement` : sections inchangées, seulement regroupées), `www/app.js` (`renderPlus` → page ;
  retour d'Android), `www/plus.js`.
- Risque faible : les écrans eux-mêmes ne changent pas, seulement l'accès.
- Recette : chaque entrée de Plus ouvre le bon écran ; Verrouiller en tête ; Journal › Copier.

### UX-5 · Budget et Commun (0.10.4)

- `www/ecranbudget.js` (sous-vues), `www/vbudget.js`, `www/vcommun.js` ; table de correspondance des sections repliées
  (`actions`, `budget-main`, `tend-panel`, `p-contrats`, `cats-panel`, `rules-panel`, sections du commun).
- Risque : sections dépliées ou repliées perdues → migration testée.
- Recette : Budget › Suivi, Tendance, Contrats ; Commun › Ce mois, Trésorerie, Équilibre ; plus aucune section Catégories en bas.

### UX-6 · Modules (0.10.5)

- `www/vfisc.js`, `www/ecranfisc.js`, écran Épargne ; aucun calcul touché (`fisc.js`).
- Recette : impôt estimé, déjà prélevé, reste ou remboursement identiques ; paramètres modifiables dans leur sous-vue.

### UX-7 · Rapidité et couleurs (0.10.6)

- `www/app.js` (rendu par étapes), `www/vues.js` (liste allégée), `www/style.css` (palette).
- Mesure : code saisi → reste à vivre affiché, avant et après, même jeu fictif (cible : moins de 0,6 s à CPU × 4,
  hors calcul de la clé) ; aucune tâche de plus de 100 ms en faisant défiler 3 ans d'opérations.
- Recette : ouvrir Klad, déverrouiller, chronométrer l'apparition du reste à vivre ; faire défiler toute la liste.

## Ce que le plan ne fait pas

- Pas de nouvelle fonction de calcul, pas de nouvelle donnée dans le coffre, pas de changement du résumé Grafit.
- Pas d'Accueil personnalisable (ordre des blocs) : à voir après usage, si le propriétaire le demande.
