# Audit UX de Klad (version 0.9.4)

Étude seulement : aucun code de l'appli n'est modifié. Mesures faites dans Chromium au format téléphone (412 × 915),
coffre de démonstration, **données fictives** (4 comptes, une banque fictive « Banque Démo », environ 3 000 opérations sur
3 ans), en clair et en sombre. Les captures sont dans [`captures/`](captures/). La nouvelle organisation est décrite dans
[`architecture.md`](architecture.md), le découpage en lots dans [`plan.md`](plan.md), la maquette cliquable dans
`site/maquette/` (publiée sur le site du dépôt, adresse `…/maquette/`).

## Synthèse

1. Klad reprend fidèlement l'ancienne version : les calculs sont justes, les gestes et l'annulation sont bons, mais le
   rangement a grossi par couches (lots 5 à 9) sans être repensé.
2. Il n'y a pas d'Accueil : l'onglet Budget sert d'accueil et fait **3 584 px, soit environ 4 écrans**.
3. Le **reste à vivre arrive sous la ligne de flottaison** : 4 cartes « À vérifier » passent devant lui.
4. Le budget du cycle est à 1,2 écran ; les **échéances des 31 jours sont à 4 écrans + 1 appui** (section Contrats repliée).
5. Le bloc « Ce mois-ci » de l'ancienne version (4 postes les plus consommés et jours restants) a disparu.
6. L'onglet Opérations **suit le dernier périmètre** (Perso ou Commun), écrit en petit dans le sur-titre, sans moyen d'en changer sur place ; le badge passe de 93 à 6.
7. Plus est un volet de **18 entrées à plat** qui défile (1 098 px), où se mêlent contenus (Impôts, Observations), doublons
   (Synchroniser, Thème) et outils rares (Import de reprise, Contrôle, Journal) ; « Verrouiller » est tout en bas.
8. Plusieurs doublons : Perso/Commun en haut de Budget **et** onglet Commun ; Catégories et Règles en bas de Budget, de
   Commun **et** dans Plus.
9. Impôts (8 949 px, environ 10 écrans) et Épargne mêlent les résultats et les champs de paramètres.
10. Accessibilité : **71 % des contrôles mesurent moins de 48 dp** (367 sur 518) ; texte secondaire à 4,15:1 en clair (AA
    demande 4,5:1) ; polices jusqu'à 9,5 px.
11. Le texte agrandi à 130 % ne fait pas déborder la page, mais tronque les libellés et les catégories des opérations.
12. Le classement d'une opération coûte 3 appuis, sans file à traiter ; le mot proposé pour « Classer aussi les autres »
    peut ne correspondre à aucune opération.
13. Performance : premier écran utile **0,87 à 0,90 s** après le code (processeur ralenti 4 fois), plus le calcul de la clé sur
    le téléphone (environ 0,5 s) ; la liste d'opérations saccade après un long défilement (tâches de 150 ms au plus, 12 900 éléments).
14. Propositions : un Accueil tableau de bord, Plus en 6 groupes, des sous-vues pour Budget et Commun, un mode « trier une à
    une », une passe d'accessibilité. Résultat : les tâches de la semaine et du mois passent de 4 écrans de défilement à 0 ou 1 appui.
15. Sept lots courts (0.10.0 à 0.10.6), sans changer aucun calcul, avec le relevé de contrôle comme garde-fou de parité.

## 1. Méthode

- **Écrans** : script Playwright (hors dépôt) : premier lancement, banque fictive, import d'une reprise fictive sur
  36 mois, puis chaque onglet, chaque volet et chaque écran de Plus, en clair et en sombre (animations réduites).
- **Mesures automatiques** sur chaque écran : contrôles visibles (nom accessible, taille), contraste de chaque texte
  visible (WCAG 2.1, seuil 4,5:1, ou 3:1 pour un grand texte), plus petite police, débordement horizontal.
- **Texte agrandi 130 %** : toutes les polices multipliées par 1,3 (l'appli ne fixe pas `textZoom` : la WebView suit le
  réglage du téléphone).
- **Performance** : processeur ralenti 4 fois (téléphone moyen), 3 essais de déverrouillage, changement d'onglet,
  40 défilements de la liste, recherche, filtre.
- **Appuis** comptés depuis l'Accueil (aujourd'hui : l'onglet Budget, en haut). « Écran » = 760 px de contenu utile
  (915 moins l'en-tête et la barre d'onglets). **Temps estimés** par un modèle simple : 1,2 s par appui, 1 s par écran
  défilé, plus le temps d'affichage mesuré.
- **Ancienne version** : lecture de son code d'interface (dépôt privé de référence), sans l'exécuter sur des données réelles.

Limites : navigateur de bureau et non WebView Android (les temps sur le téléphone seront un peu plus longs, l'ordre de
grandeur reste) ; TalkBack non testé, seulement les étiquettes ; données fictives plus « sales » que la réalité
(92 non classées, 93 à voir) pour bien charger les écrans.

## 2. Inventaire (0.9.4)

Barre du bas : **Budget** (accueil) · **Opérations** (badge « à voir ») · **Commun** · **Plus** (ouvre un volet, pas un écran).
En-tête : sur-titre (cycle ou période), titre, pastille de synchro (✓ heure, ↻, !), loupe (Opérations seulement), ☀/☾.

| Écran | Contenu (dans l'ordre) | Boutons et réglages | Appuis depuis l'Accueil | Hauteur |
|---|---|---|---|---|
| **Budget** (accueil) — [01](captures/01-accueil-budget-clair.jpg), [02](captures/02-accueil-budget-sombre.jpg), [03](captures/03-budget-page-entiere.jpg) | Perso / Commun ; ◀ cycle ▶ ; grande carte « Total des comptes courants » ; cartes des comptes (défilement horizontal) ; « N opérations à voir » ; « À vérifier » (non classées, accès, sauvegarde, comptes, mise à jour) ; reste à vivre (dépliable) ; Observations (repliées) ; Budget mensuel (Suivi / Budget ; revenus, charges fixes, courantes, optionnelles, hors budget ; total ; solde prévu ; gros écarts ; répartition) ; Tendance ; Contrats et échéances (repliés) ; Catégories ; Règles de classement | 48 contrôles : synchro, thème, Perso, Commun, ◀ ▶, 4 cartes de compte, 4 lignes « À vérifier », reste à vivre, Observations, ◀ Cycle précédent, Suivi, Budget, « voir les N ▾ » par section, « Comment c'est calculé », Tendance (◀ ▶, période, 1m 3m 6m 12m Tout, comptes, série), Contrats (Modifier la liste), Catégories, Règles | 0 | 3 584 px (4,7 écrans) |
| Reste à vivre (déplié) — [24](captures/24-reste-a-vivre-detail.jpg) | Base − charges fixes = marge − variable = reste à vivre, deux colonnes (dernier salaire, comptes courants) | — | 0 + 1 écran + 1 | — |
| Budget, mode « Budget » | Tableau des postes : prévu par échéance, périodicité, réel habituel, « = » pour aligner, base de calcul, « Tout aligner » | champs de montant (calcul possible), cases, ajouter un poste | 1,2 écran + 1 | — |
| Volets **Budget du poste**, **Ajouter un poste** | montant, périodicité, nature, annulable | Enregistrer, Supprimer | 1,2 écran + 2 | — |
| **Opérations** — [04](captures/04-operations.jpg), [05](captures/05-operations-non-classees.jpg) | Sur-titre « période · Perso ou Commun » ; puces Toutes, Non vues N, Non classées N, Internes N, (À rapprocher), Période, Catégorie, Compte, Tout marquer vu (7 à 8 puces, 3 visibles sans glisser) ; liste par jour (total du jour) ; totaux débit / crédit ; tranches de 30 jours au défilement | loupe (en-tête), ligne (détail), « catégorie ▾ » (Classer), balayage droite (vue) et gauche (Classer) | 1 | selon la liste |
| Volet **Opération** — [06](captures/06-detail-operation.jpg) | libellé, date, compte, débit ou crédit, catégorie, vue | Classer, Marquer vue | 2 | 366 px |
| Volet **Classer** — [07](captures/07-volet-classer.jpg) | 8 catégories fréquentes + Toutes, sous-catégorie, « Classer aussi les autres » (mot, seulement ce compte, sens) | Classer en …, Ajouter à l'équilibre | 2 (ou un balayage) | 669 px |
| **Commun** — [08](captures/08-commun.jpg), [09](captures/09-commun-page-entiere.jpg) | Perso / Commun ; ◀ mois ▶ ; solde ; fin de mois estimée ; à voir ; marge réelle ; Observations ; Virements à mettre en place ; Appels de fonds ; Trésorerie 12 mois ; D'où vient le solde ; Budget mensuel du commun ; Tendance ; Contrats ; Catégories ; Règles | 44 contrôles, dont 3 sections sans nom accessible | 1 | 4 234 px (5,6 écrans) |
| Volet **Ordres permanents** — [10](captures/10-ordres-permanents.jpg) | qui, libellé, montant, jour, usage | Supprimer, Ajouter un virement, Enregistrer | 1 + 1,1 écran + 1 | 815 px |
| Volet **Synchronisation** — [23](captures/23-synchro.jpg) | dernière synchro, état par compte | Synchroniser maintenant | 1 (pastille en erreur) | 205 px |
| Volet **Plus** — [11](captures/11-plus-clair.jpg), [12](captures/12-plus-sombre.jpg) | Équilibre, Impôts, Épargne, Relevés et sauvegarde, Synchroniser maintenant, Thème ; « Réglages de Klad » : Banques et accès, Comptes, Classement, Observations, Import de reprise, Affichage, Contrôle, Extras, Modules, Verrou, Journal, À propos et mise à jour ; Verrouiller | 18 entrées + 1 bouton | 1 | 1 098 px (défile) |
| **Équilibre** — [13](captures/13-equilibre.jpg) | équilibre de l'indivision (reste à combler, rattrapage, simulation), comment chacun a investi, cumul, ce que le commun a payé, dépenses payées en direct, tous les mouvements | champs de simulation, ajout d'une dépense, filtre | 2 | 2 702 px |
| **Impôts** — [14](captures/14-impots-page-entiere.jpg) | impôt du foyer (2 années), observations, prélèvement à la source (9 bulletins), calcul détaillé, taux et partage, taxe foncière (5 ans), paramètres, hypothèses (11 champs), avis et barèmes | 49 contrôles, dont 30 champs | 2 | 8 949 px (11,8 écrans) |
| **Épargne** | plan d'épargne (recommandations, règles du plan, fonds, versements), livret | 37 contrôles, dont 20 champs | 2 | 2 942 px |
| **Relevés et sauvegarde** — [15](captures/15-releves-sauvegarde.jpg) | état de chaque compte (période, opérations, dernière synchro, état, à faire) ; relevé manuel ; Sauvegarde | Synchroniser, Importer un relevé, Choisir le fichier, Retirer les imports manuels, Exporter ma sauvegarde, Restaurer | 2 | 1 401 px |
| **Banques et accès** — [16](captures/16-banques-acces.jpg) | banques connectées (accès jusqu'au …), connecter une banque, clé Enable Banking, adresse de retour | Renouveler l'accès, Déconnecter, pays, recherche, Charger, kid, .pem, Enregistrer, Tester la clé, Copier | 2 | 702 px |
| **Comptes** et fiche | liste (rôle, source, solde) ; fiche : libellé, rôle, solde affiché, masquer, prélèvement de carte, réassocier | ↑ ↓, Ajouter un compte manuel, Enregistrer | 2 ; fiche 3 | 497 px |
| **Classement** — [17](captures/17-classement.jpg) | reprise de l'ancienne version, complément, catégories (nature, icône, nombre), règles | Reprendre, Importer un complément, chaque catégorie | 2 | 3 322 px |
| **Observations** — [18](captures/18-observations.jpg) | à faire, masqués, infos | « c'est fait » | 2 | 1 901 px |
| **Import de reprise** | état, choix du fichier, association des comptes | Choisir le fichier, Importer | 2 | 256 px |
| **Affichage** | thème (Automatique, Clair, Sombre), mode démo | 4 boutons | 2 | 379 px |
| **Contrôle** | relevé de contrôle (fichier en clair), état de l'import | Exporter le relevé de contrôle | 2 + défilement du volet | 425 px |
| **Extras** (+ volet Claude) | Mail (appels de fonds), Claude | 2 interrupteurs ; réglages et clés une fois activés | 2 + défilement | 256 px |
| **Modules** | Lien Grafit : partagé, jamais partagé, empreinte | 1 case | 2 + défilement | 597 px |
| **Verrou** | empreinte, code, tout effacer | Activer, Changer, Effacer | 2 + défilement | 298 px |
| **Journal** — [19](captures/19-journal.jpg) | journal anonyme | Copier le journal, Vider | 2 + défilement | 615 px |
| **À propos et mise à jour** | version | Rechercher une mise à jour, Mettre à jour | 2 + défilement | 203 px |
| **Verrou (clavier)** — [20](captures/20-verrou.jpg) | logo, 6 points, clavier, « code oublié » | 10 chiffres, effacer, empreinte | — | — |

## 3. Tâches du propriétaire (hypothèses à valider)

« Avant » = 0.9.4 ; « Après » = variante A recommandée ([`architecture.md`](architecture.md)) ; écart de la variante B
indiqué quand il existe. Temps estimés (modèle du § 1), à vérifier sur le téléphone avec la maquette (compteur d'appuis).

### Au quotidien

| Tâche | Avant : appuis, défilement, temps | Obstacles | Après | Gain |
|---|---|---|---|---|
| Voir le reste à vivre | 0 appui, 0,3 à 1 écran, ~2 s | sous 4 cartes « À vérifier » ; à la ligne de flottaison | 0 appui, en tête de l'Accueil, ~0,5 s | lisible sans geste |
| Voir les soldes | 0 appui, glissement horizontal pour le 4ᵉ compte, ~2 s | carte à prélever et livret cachés à droite | 0 appui, liste verticale + total, ~1,5 s | tout visible |
| Traiter les « à voir » (10) | 1 + 10 balayages (ou « Tout marquer vu »), ~13 s ; +2 appuis pour ceux du commun | périmètre imposé : les opérations du commun ne sont visibles qu'en passant par l'onglet Commun | 1 + 10 balayages, ou « Trier une à une », perso et commun ensemble, ~12 s | plus de piège de périmètre |
| Classer les non classées (5) | 1 + 3 × 5 = 16 appuis, ~20 s | pas de file ; mot proposé parfois sans correspondance (« 0 opération contient… ») | 1 + 1 + 2 × 5 = 12 appuis, ~15 s | −25 % d'appuis |
| Synchroniser | 1 (pastille) | — | 1 (pastille) ou action rapide | — |

### Chaque semaine

| Tâche | Avant | Obstacles | Après | Gain |
|---|---|---|---|---|
| Suivre le budget du cycle | 1,2 écran, ~3 s | sous le reste à vivre et les observations | 0 appui, « Ce cycle-ci » sur l'Accueil ; détail : 1 appui | −1,2 écran |
| Voir les postes dépassés | 1,2 écran + 1 à 4 appuis (« voir les N ▾ » par section), ~6 s | dépassés mêlés aux autres, sections à ouvrir une à une | 0 appui (dépassés en premier sur l'Accueil et dans Budget › Suivi), ~1,5 s | −4 appuis |
| Vérifier les prochaines échéances | 4 écrans + 1 appui (Contrats replié), ~6 s | introuvable sans connaître la section | 0 appui (Accueil, 1,5 écran) ; liste complète : Budget › Contrats, 2 appuis | −4 écrans |

### Chaque mois

| Tâche | Avant | Obstacles | Après (A) | Après (B) |
|---|---|---|---|---|
| Commun : virements reçus | 1 appui + 1,1 écran, ~3 s | sous marge réelle et observations | 0 (Accueil) ; 1 appui, en tête de Commun | 0 ; 2 appuis |
| Commun : à mettre en place | 1 + 1,1 écran + 1, ~4 s | idem | 0 (Accueil) ; 1 appui | 0 ; 2 appuis |
| Commun : fin de mois | 1 appui | — | 0 (Accueil) | 0 |
| Commun : trésorerie 12 mois | 1 + 2,1 écrans + 1, ~5 s | section repliée en milieu de page | 2 appuis (Commun › Trésorerie) | 3 appuis |
| Équilibre des apports | 2 appuis (Plus › Équilibre) | rangé loin du commun | 2 (Commun › Équilibre) | 2 + 1 écran (Plus › Modules) |
| Clôture du cycle (bilan du cycle passé) | 1,2 écran + 1 (◀) | rien ne signale le changement de cycle | 2 (Budget › ◀) ; ligne « Bilan du cycle précédent » dans « À vérifier » les 5 premiers jours | idem |

### Occasionnellement

| Tâche | Avant | Après | Remarque |
|---|---|---|---|
| Impôts | 2 appuis, page de 11,8 écrans | 2 appuis, sous-vues Résumé · Prélèvements · Taxe foncière · Paramètres (≤ 1,5 écran chacune) | −10 écrans |
| Épargne | 2 appuis, 3,9 écrans | 2 appuis, Livret · Plan d'épargne · Paramètres | |
| Contrats | 4 écrans + 1 | 2 (Budget › Contrats) | |
| Renouveler un accès bancaire | 2 (« À vérifier ») ou 3 (Plus › Banques › Renouveler) | 2 ou 3, sans défilement | inchangé, mieux rangé |
| Sauvegarde (export) | 2 (« À vérifier ») + 1,3 écran ; 3 + 1,3 écran par Plus | 2 (« À vérifier » › Exporter) ou 3 (Plus › Sauvegarde › Exporter), sans défilement | |
| Export du relevé de contrôle | 3 + défilement du volet | 3 (Plus › Contrôle › Exporter) | |
| Import d'un relevé manuel | 3 + 1 écran (Plus › Relevés › Importer) | 3 (Plus › Importer › Relevé d'un compte) | |
| Mise à jour | 2 si signalée, sinon 3 + défilement du volet | 2 si signalée, sinon 3 (Plus › Version et mise à jour) | |
| Extras (mail, Claude) | 2 + défilement | 2 | |
| Journal (copier) | 3 + défilement | 3 | |
| Verrouiller | 2 + défilement (bouton en bas du volet) | 1 (action rapide de l'Accueil) ou 2 (en tête de Plus) | |
| Catégories et règles | 2 (Plus › Classement) ou 4 écrans en bas de Budget | 2 (Plus › Réglages › Classement) | sections retirées de Budget et Commun |
| Observations | 1,3 écran + 1, ou 2 par Plus | 1 (ligne de l'Accueil) ou Budget › Suivi | sort de « Réglages » |
| Ordres permanents | 1 + 1,1 écran + 1 | 2 (Commun › Modifier les ordres) | |
| Tendance | 3,2 écrans | 2 (Budget › Tendance) | |
| Thème | 1 (en-tête) | 3 (Plus › Affichage) ; à garder dans l'en-tête si le propriétaire le souhaite | décision à valider |

## 4. Évaluation

### a. Heuristiques de Nielsen

| Heuristique | Constat | Note |
|---|---|---|
| 1. Visibilité de l'état | Pastille de synchro claire (✓ heure, ↻, !), badge « à voir », états « à jour / en retard ». Mais le périmètre de la liste d'opérations n'est pas affiché, et le badge change de sens selon le dernier onglet. | moyen |
| 2. Correspondance avec le monde réel | Vocabulaire du foyer (reste à vivre, qui doit combien à qui, débiteur). Quelques termes internes : « Import de reprise », « Contrôle », « Modules », « complément », « hors budget ». | bon |
| 3. Contrôle et liberté | Annulation partout (classement, budget, vues, contrats), confirmation des actions lourdes. Le bouton retour d'Android ramène toujours au Budget, même depuis Impôts ouvert par Plus. | bon |
| 4. Cohérence et standards | Doublons (Perso/Commun, Catégories, Règles, Synchroniser, Thème, Observations) ; « Relevés » désigne un écran, une section et un fichier ; Plus est un volet, les autres onglets des écrans. | faible |
| 5. Prévention des erreurs | Fichiers en clair signalés, effacement protégé par le code, calcul dans les champs. « Classer aussi les autres » activé avec un mot qui ne trouve rien. | bon |
| 6. Reconnaître plutôt que se souvenir | Les échéances, la tendance, les contrats sont dans des sections repliées en bas de page ; il faut savoir qu'elles existent. | faible |
| 7. Souplesse et efficacité | Gestes (balayage), « Tout marquer vu », calculs. Pas de file pour trier les non classées, pas de raccourci vers les tâches du mois. | moyen |
| 8. Esthétique et minimalisme | Écrans chargés : Budget 4,7 écrans, Commun 5,6, Impôts 11,8 ; paramètres mêlés aux résultats. | faible |
| 9. Aide sur les erreurs | Messages en phrases fixes, en français (synchro, clé, Claude). Le volet Synchronisation est sobre mais suffisant. | bon |
| 10. Aide et documentation | « Comment c'est calculé » partout (bien), mais en liens de 19 px de haut. | moyen |

### b. Accessibilité

**Contrastes (WCAG AA).** 627 textes sous le seuil en clair, 75 en sombre (une partie sont des icônes en couleur, sans
importance). Les cas qui comptent :

| Élément | Clair | Sombre | Proposition |
|---|---|---|---|
| Texte secondaire `--muted` #747f7a (sous-titres, comptes, catégories) | 4,15:1 sur blanc, 3,64:1 sur fond gris | 6,6:1 (bon) | #5b6661 : 5,97:1 sur blanc, 5,24:1 sur gris |
| Étiquettes et « eyebrow » (10,5 à 11 px) | 3,0 à 3,6:1 | 3,3:1 (« Reste ») | 12 px au moins, couleur `--ink-2` |
| Liens « voir les N ▾ » | 2,4:1 | 2,6:1 | couleur d'accent pleine, 13 px |
| Onglets inactifs (11,5 px) | 4,15:1 | bon | `--ink-2`, 12,5 px |
| Crédits verts « +2 500,00 € » sur fond teinté | 3,64:1 | bon | #1a7347 : 5,85:1 |
| Badge de l'onglet Opérations | 4,4:1 | 3,6:1 | texte plus foncé ou fond plus soutenu |
| Flèche de période ▶ | — | 3,0:1 | désactivée seulement : rien à faire ; active : `--ink` |

**Cibles tactiles (48 dp).** 367 contrôles sur 518 en dessous : boutons d'en-tête 40 dp, Fermer et Retour 44, puces
32, ◀ ▶ de période 24 à 28, 1m/3m/6m 26, « catégorie ▾ » des opérations 19, « voir les N ▾ » 17, « Comment c'est
calculé » 19, « c'est fait » 20, ↑ ↓ des comptes 40, « Importer un relevé » 21. Les lignes d'opérations (64 dp) et les
entrées de Plus (54 dp) sont bonnes. Correction simple : zone d'appui agrandie par une marge invisible, sans changer le dessin.

**Texte agrandi 130 %** ([21](captures/21-texte-130-accueil.jpg), [22](captures/22-texte-130-operations.jpg)) : aucun
débordement horizontal (bien). Libellés d'opérations coupés vers 22 caractères, catégorie et compte coupés
(« Shopping · Achat… »), montants collés au bord, cartes de comptes tronquées, lignes « À vérifier » sur 3 lignes.
Proposition : libellé sur 2 lignes au besoin, catégorie et compte sur une ligne à part, soldes en liste verticale.

**Lecteur d'écran.** Boutons d'icône bien nommés (synchro, thème, loupe, Fermer, Retour), sections dépliantes annoncées
(`aria-expanded`), « Non vue » lu avant le libellé (bien). À corriger : 3 sections de Commun sans nom, lignes
d'opérations non atteignables au clavier ni au contacteur (ligne de tableau cliquable sans rôle), nom de ligne sans le
sens (débit / crédit) ; graphiques sans résumé textuel (les phrases sous les graphiques aident).

**Animations réduites.** Respectées : transitions et animations coupées si le téléphone le demande (feuille de style et
volets). Rien à faire.

### c. Cohérence

- **Vocabulaire** : « Relevés » (écran), « Relevés des comptes » (section), « relevé de contrôle » (fichier) ; « vue /
  non vue » et « à voir » ; « Observations et recommandations », « Observations », « À faire » ; « Classement »
  (réglages) et « Classer » (action) ; « Modules » ne contient que le lien Grafit ; « Import de reprise ».
- **Place des actions** : bouton principal tantôt à gauche (fiche compte), tantôt pleine largeur (Classer), tantôt en bas
  d'un volet qui défile (Plus).
- **Débit / crédit** : bien appliqué (aucun montant négatif, « débiteur », « déficit »). Deux tournures à reprendre :
  « Abattement de 10 % : Personne A moins 3 120 € » (Impôts) et « Balance négative sur 3 mois » (observation) →
  « abattement de 3 120 € », « balance déficitaire ». « Qui doit combien à qui » : bien dans Équilibre (« Personne A doit
  encore investir… ») et Impôts (« doit encore 413 € », « a trop payé 907 € »).
- **Couleurs** : rouge = dépassé, débiteur, déficit ; vert = crédit, à jour ; orange = à surveiller. Cohérent. Le
  bleu marine sert à la fois d'accent et de grande carte.
- **États vides** : bons (« Aucune échéance connue », « ✓ Toutes les opérations ont été vues »).
- **Messages d'erreur** : phrases fixes en français, jamais d'identifiant (journal anonyme vérifié sur la capture 19).
- **Annulation** : présente partout où une donnée change (bandeau « Annuler »).

### d. Performance ressentie

Processeur ralenti 4 fois, 3 001 opérations, navigateur :

| Mesure | Résultat |
|---|---|
| Code saisi → soldes affichés | 866 ms, 900 ms, 890 ms (3 essais ; 0.9.3 : 836 à 920 ms) |
| Code saisi → reste à vivre et budget | 872 à 912 ms (affichés en même temps que les soldes : tout est calculé avant le premier dessin) |
| Sur le téléphone, en plus | calcul de la clé à partir du code, réglé à environ 0,5 s ; soit **1,3 à 1,5 s** au total |
| Changement d'onglet | Opérations 231 à 267 ms, Commun 315 ms, Budget 217 ms, volet Plus 149 ms |
| Liste d'opérations à l'ouverture | 104 lignes (30 jours) |
| 40 défilements rapides | 946 lignes, 12 945 éléments dans la page, **10 tâches longues, 149 ms au plus** (saccades perceptibles ; 0.9.3 : 220 ms) |
| Recherche « pharmacie » | 387 ms (délai de saisie de 200 ms compris) ; effacer : 178 ms |
| Filtre « Non vues » | 211 ms |

Bon dans l'ensemble. Deux pistes : dessiner l'Accueil d'abord et calculer le reste ensuite ; alléger la liste (sections
de jours hors écran non dessinées, `content-visibility`) pour la période « Tout » sur 3 ans.

### e. Ancienne version et Grafit

- **Ce qui était bien et a été gardé** : 4 onglets connus, volet du bas, gestes sur les opérations, pastille de synchro,
  badge « à voir », sections repliables mémorisées, « Comment c'est calculé ».
- **Ce qui était bien et a été perdu** : le bloc **« Ce mois-ci »** de l'accueil (4 postes les plus consommés, barre,
  « reste … » ou « dépassé de … », jours restants, « Tout le budget › ») ; un volet Plus court (6 entrées).
- **Ce qui manquait déjà** : un accueil qui résume, les échéances à venir, un périmètre visible dans les opérations, une
  façon rapide de trier les non classées.
- **Grafit** : seule l'icône (К rouge `#9E4A4A` sur noir `#0A0C0E`) est commune. L'appli garde le bleu marine et le
  fond vert-gris de l'ancienne version. Proposition dans la maquette (bouton « Grafit ») : chrome noir, rouge réservé à la
  marque et à l'onglet actif, couleurs de sens (dépassé, crédit) inchangées et toujours doublées d'un mot.

## 5. Problèmes priorisés

Gravité : **bloquant** (empêche une tâche), **majeur** (ralentit une tâche fréquente ou induit en erreur),
**mineur** (gêne ponctuelle), **confort**. Aucun problème bloquant trouvé.

| # | Gravité | Écran | Problème | Capture | Proposition | Lot |
|---|---|---|---|---|---|---|
| P1 | majeur | Budget (accueil) | Pas d'Accueil ; le reste à vivre est sous 4 cartes, à la ligne de flottaison ; l'onglet fait 4,7 écrans | [01](captures/01-accueil-budget-clair.jpg), [03](captures/03-budget-page-entiere.jpg) | Onglet Accueil : reste à vivre en tête, puis À vérifier, soldes, ce cycle-ci, commun, échéances | UX-2 |
| P2 | majeur | Budget | Échéances des 31 jours à 4 écrans + 1 appui | [03](captures/03-budget-page-entiere.jpg) | Bloc « Prochaines échéances » sur l'Accueil ; Budget › Contrats | UX-2, UX-5 |
| P3 | majeur | Budget | Le bloc « Ce mois-ci » de l'ancienne version a disparu | [01](captures/01-accueil-budget-clair.jpg) | « Ce cycle-ci » sur l'Accueil, dépassés en premier | UX-2 |
| P4 | majeur | Opérations | Périmètre (Perso ou Commun) hérité du dernier onglet, écrit seulement dans le sur-titre, impossible à changer sur place ; badge 93 ou 6 selon l'onglet ; 7 à 8 puces dont 3 visibles | [04](captures/04-operations.jpg), [08](captures/08-commun.jpg) | Sélecteur Perso · Commun · Tout visible ; badge = total | UX-3 |
| P5 | majeur | Plus | 18 entrées à plat, volet qui défile, contenus, doublons et outils rares mélangés, Verrouiller en bas | [11](captures/11-plus-clair.jpg) | Plus en page entière, 6 groupes nommés, Verrouiller en tête | UX-4 |
| P6 | majeur | Budget, Commun | Doublons : Perso/Commun en haut de Budget et onglet Commun ; Catégories et Règles en bas des deux onglets et dans Plus | [03](captures/03-budget-page-entiere.jpg), [09](captures/09-commun-page-entiere.jpg) | Une seule place pour chaque fonction | UX-5 |
| P7 | majeur | Tous | 71 % des contrôles sous 48 dp (puces 32, ◀ ▶ 24, liens 17 à 21) | — | Zone d'appui de 48 dp au moins partout | UX-1 |
| P8 | majeur | Tous (clair) | Texte secondaire à 4,15:1, légendes 3,0 à 3,6:1, liens 2,4:1 | [01](captures/01-accueil-budget-clair.jpg) | Nouvelles valeurs de couleur (tableau du § 4b) | UX-1 |
| P9 | majeur | Impôts, Épargne | Pages de 11,8 et 3,9 écrans, 30 champs de paramètres au milieu des résultats | [14](captures/14-impots-page-entiere.jpg) | Sous-vues ; paramètres à part | UX-6 |
| P10 | mineur | Opérations, Classer | 3 appuis par opération ; pas de file à traiter | [05](captures/05-operations-non-classees.jpg), [07](captures/07-volet-classer.jpg) | « Trier une à une » : catégorie proposée, 2 appuis, « Passer » | UX-3 |
| P11 | mineur | Classer | Mot proposé « CAFE GARE » : 0 opération, interrupteur pourtant activé | [07](captures/07-volet-classer.jpg) | Proposer un mot présent tel quel dans le libellé ; interrupteur désactivé si 0 | UX-1 |
| P12 | mineur | Opérations | Liste lourde après long défilement (12 900 éléments, tâches jusqu'à 150 ms) | — | Jours hors écran non dessinés | UX-7 |
| P13 | mineur | Tous | Polices de 9,5 à 11 px (axes, étiquettes, sous-titres) | [01](captures/01-accueil-budget-clair.jpg) | 12 px au moins | UX-1 |
| P14 | mineur | Opérations, Budget | À 130 % : libellés, catégories et comptes coupés ; cartes de comptes tronquées | [21](captures/21-texte-130-accueil.jpg), [22](captures/22-texte-130-operations.jpg) | Libellé sur 2 lignes, catégorie et compte sur une ligne à part, soldes en liste | UX-1, UX-2 |
| P15 | mineur | Opérations, Commun | Lignes d'opérations non atteignables au clavier, nom sans le sens ; 3 sections sans nom | — | Bouton par ligne avec nom complet (« débit 14,50 € ») | UX-1 |
| P16 | mineur | Budget | Soldes en cartes horizontales : la carte à prélever et le livret sont hors écran | [01](captures/01-accueil-budget-clair.jpg) | Liste verticale, total disponible et « après la carte » | UX-2 |
| P17 | mineur | Accueil, Commun | Cycle de salaire (perso) et mois civil (commun) côte à côte sans le dire | [08](captures/08-commun.jpg) | « Cycle de salaire du … au … » et « Mois d'octobre » écrits en clair | UX-2 |
| P18 | mineur | Tous | Vocabulaire : Relevés (3 sens), Modules, Import de reprise, Observations / À faire | [11](captures/11-plus-clair.jpg) | Lexique (architecture.md, § 6) | UX-4 |
| P19 | mineur | Impôts, observations | « moins 3 120 € », « Balance négative » | [14](captures/14-impots-page-entiere.jpg) | « abattement de 3 120 € », « balance déficitaire » | UX-1 |
| P20 | mineur | Retour Android | Revient toujours au Budget, même depuis un écran ouvert par Plus | — | Retour vers l'écran d'où l'on vient (Plus, puis Accueil) | UX-4 |
| P21 | mineur | Budget | Changement de cycle non signalé ; bilan du cycle passé à chercher (◀) | — | Ligne « Bilan du cycle précédent » dans « À vérifier » les 5 premiers jours | UX-2 |
| P22 | confort | Déverrouillage | Tout est calculé avant le premier dessin (0,87 à 0,90 s à CPU × 4) | [20](captures/20-verrou.jpg) | Accueil d'abord, autres onglets ensuite | UX-7 |
| P23 | confort | En-tête | Le sur-titre (« Cycle du 27/10 au 26/11 ») répète la ligne ◀ ▶ juste dessous | [01](captures/01-accueil-budget-clair.jpg) | Sur-titre utile par écran (jour du cycle, période) | UX-2 |
| P24 | confort | Tous | Couleurs sans lien avec Grafit, sauf l'icône | [02](captures/02-accueil-budget-sombre.jpg) | Palette « Grafit » (au choix du propriétaire) | UX-7 |
| P25 | confort | Plus › Observations | « c'est fait » en lien de 20 px | [18](captures/18-observations.jpg) | Bouton de 48 dp | UX-1 |

## 6. Ce qui marche bien (à garder)

Calculs identiques à l'ancienne version ; filtre de période et totaux débit / crédit des opérations (0.9.4) ; pastille de synchro ; balayages ; annulation systématique ; « Comment c'est
calculé » ; journal anonyme ; thème sombre soigné (peu de contrastes faibles) ; animations réduites respectées ; aucun
débordement horizontal, même à 130 % ; temps d'affichage courts ; aucun montant négatif affiché.
