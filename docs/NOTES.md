# Klad — notes de version

Ouvertes depuis l'appli : Plus › Aide et à propos › À propos › « Notes de version ». Aucune donnée personnelle.

## 1.1.1

Correctif de la 1.1.0 (décisions de l'architecte).
- **Tolérance des charges plafonnée** : un écart reste toléré jusqu'au plus grand de 2 € et 2 % du budget, mais jamais
  plus de 10 € ; au-delà, le poste est en dépassement. Les trois seuils se règlent dans Plus › Réglages › Budget ›
  Tolérance des charges.
- **Écart de rapprochement** : rapprocher à la main un prélèvement de portefeuille d'un achat d'un autre montant demande
  confirmation (prélèvement, achat, écart, catégorie). L'écart reste compté, une seule fois, dans la catégorie de
  l'achat (en moins si le prélèvement est plus petit) ; il est affiché « écart de rapprochement » sur les deux
  opérations et signalé dans « À vérifier » au-delà de 2 €, jusqu'à « Écart vérifié ». « Annuler » rend l'état d'avant.
- **Mode démo** : noms des fonds et des anciens plans d'épargne masqués ; crypto, livret, plan d'épargne, historique des
  observations et rapprochement vérifiés.
- Aucun autre montant calculé modifié (relevé de contrôle identique quand les montants rapprochés sont égaux).

## 1.1.0

Retours d'usage de la 1.0.1 (sauvegarde et lecture confirmées sur le téléphone).
- **Budget** : le montant d'un poste se modifie de nouveau (le clavier ne se referme plus tout seul).
- **Reste à vivre** (Accueil) : encart simplifié (montant, échéance, montant par jour, avancement du cycle) ; le détail
  montre aussi le montant par jour.
- **« À surveiller »** : seulement à partir de 90 % du budget utilisé.
- **Charges** (fixes et compte commun) : un écart sous 2 € ou 2 % du budget (le plus grand) ne met plus le poste en
  dépassement ; il est signalé avec « aligner le budget sur le prélevé ».
- **Commun** : suivi au mois civil ou sur le cycle de salaire (Réglages › Budget › Compte commun).
- **Observations** : historique des points marqués « c'est fait », gardé même quand le point revient.
- **Carburant** : calculateur dans une fenêtre dédiée, ouverte depuis le poste Carburant du Budget.
- **Nouvel onglet Patrimoine** : Impôts, Foncier, Épargne et Crypto (positions saisies à la main, résultat, rappel de
  mise à jour après 30 jours) ; ces écrans quittent « Plus ».
- **Portefeuille de paiement en ligne** : rapprocher à la main un prélèvement d'un achat (montant ou date différents),
  garder un prélèvement en dépense, marquer un achat « payé autrement » ; tout est annulable.
- Aucun montant calculé modifié (relevé de contrôle et résumé Grafit identiques).

## 1.0.1

Correctif de la recette 1.0.0.
- **Sauvegarde** : Klad ne se ferme plus à l'export avec des données réelles. La sauvegarde est préparée et chiffrée
  morceau par morceau avant d'ouvrir le sélecteur de fichiers, puis recopiée vers Drive (ou ailleurs), relue et
  comparée : « Sauvegarde enregistrée » seulement si le fichier est identique. Si Klad se verrouille pendant le
  sélecteur, l'enregistrement se termine quand même et le message s'affiche au déverrouillage. En cas d'échec : message
  clair, ligne au journal, rien de partiel dans le fichier choisi. Nouveau format de fichier, par morceaux ; les
  sauvegardes de la 1.0.0 restent lisibles. Même correction pour le relevé de contrôle et les fichiers importés.
- **Journal des plantages** : si Klad s'arrête (erreur Java ou moteur d'affichage perdu), une ligne anonyme est écrite
  au journal au déverrouillage suivant : « Klad s'est arrêté pendant <action> : <type d'erreur>, <endroit du code> ».
- **Reprendre le classement** : après un changement des bars ou des règles, un encart indique combien d'opérations
  changeraient de catégorie, avec « Reprendre le classement » (annulable) et « Plus tard ».
- **Messages en bas d'écran** : un appui les ferme, un glissement les écarte ; ils disparaissent seuls (5 s, 6 s pour
  une erreur, 8 s avec « Annuler ») ; un seul à la fois ; au-dessus de la barre d'onglets (en haut quand un volet est
  ouvert) ; plus rien de bloquant autour. Bandeau du mode démo replié en pastille « DÉMO » (appui, glissement, ou seul
  après 6 s). Compteur « à voir » de l'onglet Opérations plus petit, à côté de l'icône.
- **Banque momentanément indisponible** (« 400 Error interacting with ASPSP ») : message neutre, nouvel essai à la
  prochaine synchro ; erreur seulement après 3 échecs de suite ou plus de 24 h.
- Aucun calcul modifié.

## 1.0.0

Première version complète : l'ancienne version peut être arrêtée.
- **Réglages du complément dans Klad** : plus aucun réglage figé dans le complément importé. Plus › Réglages › Budget
  (cycle de salaire ou mois civil, reconnaissance du salaire, reste à vivre affiché, personnes du commun et part par
  défaut, compte secondaire) ; Plus › Réglages › Complément (cartes et remboursements, appels de fonds, mail, mots-clés,
  taxe foncière, livret, épargne salariale, observations masquées, exclusions du budget, carburant, couleurs et
  pastilles) et éditeur avancé (complément complet, vérifié avant l'enregistrement, annulable). Un réglage fait dans Klad
  passe avant le complément ; un champ vidé revient au complément.
- **Compte secondaire** : pastille « récurrent sur … » sur les charges récurrentes du compte secondaire, dans le détail
  des postes du Budget.
- **Importer** (Plus › Données) : reprise et complément au même endroit, avec un aperçu (ajouté, remplacé, identique)
  avant de confirmer.
- **Sauvegarde vérifiée** : la sauvegarde contient tout sauf le journal (clés comprises, complément, réglages,
  apparence) ; « Vérifier une sauvegarde » l'ouvre avec la phrase et la compare aux données actuelles sans rien
  remplacer. Rappel tant qu'aucune sauvegarde n'est vérifiée, puis 30 jours après.
- **À propos** : version, date, notes de version.
- Nettoyage : anciennes vues Catégories et Règles du Budget retirées (elles sont dans Plus › Réglages › Classement).
- Aucun calcul modifié.

## 0.10.11
Bandeau du mode démo dans l'écran (texte agrandi, écran étroit) ; contrôle automatique des débordements de tous les
écrans, volets, bandeaux et messages.

## 0.10.10
Mode démo sans rien de réel à l'écran ; titres et montants lisibles à 320 px et avec un texte agrandi à 200 %.

## 0.10.9
Icônes des catégories toutes dessinées ; champs des volets ; diagnostic d'affichage ; captures d'écran en mode démo.

## 0.10.8
Parité des fonctions avec l'ancienne version (renommer, supprimer une catégorie, règle à la main, tri des opérations…).

## 0.10.0 → 0.10.7
Nouvelle organisation (Accueil, Opérations, Budget, Commun, Plus), couleurs lisibles, palettes Klad et Grafit, rapidité,
icônes des catégories, base du reste à vivre au choix, gestes sur les opérations.

## 0.9.x
Interface de l'ancienne version, relevé de contrôle, extras (mail, Claude), mode clair, opérations internes visibles.

## 0.1 → 0.8
Socle Android chiffré, Enable Banking, reprise de l'ancienne version, lien Grafit, classement, budget par cycle, compte
commun et équilibre, impôts, épargne et observations.
