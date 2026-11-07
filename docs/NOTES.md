# Klad — notes de version

Ouvertes depuis l'appli : Plus › Aide et à propos › À propos › « Notes de version ». Aucune donnée personnelle.

## 1.3.4

Contrats (demande du propriétaire, 07/11).
- **Numéro de contrat** : un prélèvement est reconnu par le numéro de contrat écrit dans son libellé, avant le mot. Utile
  quand plusieurs contrats ont le même organisme (habitation, auto, accidents de la vie…). Klad propose les numéros
  trouvés dans les prélèvements.
- **Fin du contrat (résiliation)** : après cette date, un prélèvement de ce contrat est « non prévu » : pastille rouge
  dans Opérations, compté à part du poste (ligne « Après la fin d'un contrat »), observation avec le total prélevé depuis
  la fin. Plus d'échéance annoncée après la fin.
- **Lien Grafit** : alerte « CONTRAT RÉSILIÉ PRÉLEVÉ » tant que le prélèvement n'a pas été vu.

## 1.3.3

Correctif d'affichage (retour du propriétaire, 07/11).
- **Commun › Trésorerie** : la section Tendance se replie comme les autres (elle reste toujours ouverte dans Budget ›
  Tendance, où elle est seule).
- **Contrats** : les sous-sections (liste des contrats, prévu du poste et contrats, échéances des 31 prochains jours) se
  replient d'un appui ; leur état est gardé sur le téléphone.
- **Journal** : « Confirmer ? » s'affiche en rouge avant de vider le journal.
- **Virements reçus sur le commun** : un virement venu d'un de vos comptes, affecté à la main (par exemple « Avance au
  commun »), compte maintenant dans l'équilibre ; avant, l'affectation était gardée mais ignorée. Le détail du virement
  dit clairement son affectation et son effet (par exemple « 50 € comptés en faveur de … dans l'équilibre »), puis
  propose « Accepter la proposition » ou un autre choix : une carte par choix, avec son effet et son champ (poste,
  année, précision) dans la même carte. Une fois affecté, la pastille devient « imprévu · affecté » (vert).
- **« Autre » avec un effet dans l'équilibre** : comme son classement d'origine, hors équilibre, ou en faveur de l'un
  (en entier ou pour moitié) ; ligne « + Autres virements affectés » dans « Comment chacun a investi ». Réserve et
  Remboursement disent maintenant que l'équilibre garde le classement d'origine du virement (versement de …, etc.).

## 1.3.2

Correctif (retour du propriétaire, 07/11).
- **Opérations qui disparaissaient** : une opération que la banque ne renvoie plus lors d'une relecture n'est plus jamais
  retirée. Elle reste comptée ; si elle est bien à l'intérieur de la période relue, elle repasse « non vue » avec une note
  dans son détail et un bouton « Retirer (opération en double) ». L'historique bancaire est relu une fois à la première
  synchro pour remettre les opérations retirées à tort (si la banque les renvoie).
- **Équilibre de l'appartement** : les avances au commun comptent à partir d'une date (Réglages › Personnes du commun ›
  Début du suivi des avances). Avant, chaque virement garde son classement d'origine, même s'il a été affecté ; seule
  l'enveloppe Impôts s'applique. Un déblocage de prêt n'est plus proposé comme virement à affecter.
- **Lien Grafit** : débits imprévus du compte commun du mois en cours dans le résumé, et alerte tant qu'ils ne sont pas vus.
- **Journal** : « Vider » demande une confirmation (second appui) et peut être annulé.

## 1.3.1

Correctif de la 1.3.0 (retour du propriétaire, 06/11).
- **Carte « Provisions en cours »** du compte commun (ancienne « Réserve pour échéances ») : la ligne « mis de côté »
  affiche les postes et leurs montants (par exemple « Copropriété 250,00 €, Parking 40,00 € ») au lieu de « [object Object] ». Le
  nouveau nom évite la confusion avec la réserve fixe (plancher de la trésorerie).
- **Plus de sous-vue « Plan »** dans Commun : elle reprenait le budget du commun et « Virements à mettre en place ». Le
  détail par poste (part de chacun, poste par poste, total égal au « demandé ») se déplie maintenant sous chaque
  personne dans « Virements à mettre en place ». Les montants et les parts se règlent dans le budget du commun, seule
  source.
- **Garde-fou** : un test parcourt tous les écrans et volets (jeux fictifs, mode démo compris) et échoue si un texte
  illisible (« [object Object] », « undefined », « NaN », « null ») apparaît.

## 1.3.0

Compte commun remis à plat (demande du propriétaire du 05/11).
- **Prévu, écart, imprévu** : chaque mouvement du compte commun porte une pastille. « Prévu » : il correspond au plan
  (virement permanent, contrat ou poste du budget commun, appel de fonds, impôt prévu ou payé par son enveloppe).
  « Écart » : élément du plan, mais montant hors tolérance, date hors fenêtre, plusieurs appels payés en une fois ou
  appel payé en retard ; l'écart est expliqué en une phrase. « Imprévu » : rien dans le plan. Filtres « Imprévus » et
  « Écarts » dans les Opérations (Commun et Tout). Correction à la main dans le détail (« compter comme prévu /
  imprévu »), annulable.
- **Virements ponctuels affectés** : chaque virement ponctuel reçu sur le commun (12 derniers mois) reçoit une
  affectation proposée d'après son libellé (Impôts <année>, Avance au commun, Réserve, Remboursement, Autre), à confirmer
  d'un appui (Commun › Ce mois, ou détail de l'opération). Un versement aussitôt reversé est proposé « avance pour » le
  poste payé.
- **Enveloppes** : un versement « Impôts <année> » (ou une avance pour un poste) devient une enveloppe qui ne paie que ce
  à quoi elle est affectée ; les paiements reliés la font diminuer (relier à la main possible). Observation « L'enveloppe
  … finance autre chose » quand le disponible passe sous zéro alors qu'elle n'est pas vide.
- **Solde du commun décomposé** : disponible + réserve fixe + provisions des charges non mensuelles + enveloppes.
- **Avances au commun** : la part de l'autre personne (parts du poste, sinon part par défaut) est comptée en faveur de
  celle qui avance dans l'équilibre, avec la mention « avance au commun ». Total des avances de chacun dans Commun.
  L'enveloppe Impôts et ses paiements sont hors équilibre.
- **Réserve fixe** (Réglages › Budget › Personnes du commun) : la trésorerie prévue ne doit pas descendre dessous ;
  sinon, renflouement proposé, partagé selon les parts des postes en cause, avec un bouton « Fait ».
- **Commun › Plan** : part de chacun poste par poste, comparée aux virements permanents en place ; propositions quand
  les contrats d'un poste ont changé.
- **Fiche du mois** (Commun › Ce mois, ◀ ▶ pour les mois passés) : « Mois conforme », ou la liste des écarts (dont
  virements permanents non reçus) et des imprévus.
- Relevé de contrôle : nouveau bloc « communPlan » (statuts des 7 derniers mois, ponctuels et affectations, enveloppes,
  avances, réserve, renflouement, équilibre avant / après les affectations). Aucun autre chiffre modifié sur les jeux
  fictifs.

## 1.2.0

Retours d'usage de la 1.1.4.
- **Pastilles « à vérifier »** dans les Opérations : chaque choix Perso, Commun et Tout porte une pastille avec le nombre
  d'opérations à vérifier (non vues, non classées des 3 derniers mois, prélèvements de portefeuille à rapprocher ; une
  opération n'est comptée qu'une fois). Un appui sur un choix qui a une pastille ouvre la liste de ce périmètre filtrée
  sur « À vérifier » ; « Toutes » retire le filtre. La pastille de l'onglet Opérations donne le total (celui de « Tout ») ;
  avant, elle ne comptait que les opérations non vues.
- **Reste à vivre** : plus de montant « par jour » (Accueil et détail). La barre du cycle indique « jour N/T », avec un
  trait par jour, un trait plus marqué au début de chaque semaine (lundi) et un repère sur aujourd'hui.
- **Tendance** : période personnalisée au jour près (début et fin), gardée comme dernier choix. Sous 62 jours, un point par
  jour ; au-delà, un point par mois. Les préréglages restent (1, 3, 6, 12 mois, Tout) ; « 1 mois » s'affiche donc par jour.
- **Total perso** : sur l'Accueil, un seul total remplace « Total disponible (courants et commun) » et « Tous les comptes » :
  comptes courants, paiement en ligne et épargne, moins ce que les cartes à débit différé vont prélever, **sans le compte
  commun**. Grafit reçoit la même valeur : son total baisse du solde du commun.
- Aucun autre chiffre modifié (relevés de contrôle des jeux fictifs identiques à la 1.1.3, sauf le total).

## 1.1.4

Réponse de l'architecte au relevé de contrôle 1.1.3 (après l'arrivée des virements sur le commun).
- **Commun : virements après l'échéance** : chaque virement permanent est jugé seul. Les virements ponctuels du mois
  (rattrapage, remboursement) ne sont plus pris pour des retards. La date de référence est le premier prêt du mois,
  jamais le jour prévu du virement ; une arrivée avant cette date n'est jamais en retard. Une fois le prêt passé, un
  virement mensuel encore absent est signalé au nom de la personne concernée.
- **« Virements du mois »** : l'observation donne le montant reçu et ce qui est encore attendu.

## 1.1.3

Réponse de l'architecte au relevé de contrôle 1.1.2.
- **Virements « en route »** : un virement reste « en route » pendant 5 jours ouvrés après son départ (week-ends et
  jours fériés exclus), puis redevient « non reçu ». Un départ le vendredi avant un week-end prolongé peut arriver le
  mardi sans fausse alerte.
- **Commun : virements après l'échéance** : un de vos virements parti avant l'échéance du prêt n'est jamais compté en
  retard, même s'il arrive après ou s'il est encore en route. Le titre de l'observation dit qui est en retard.
- **« Budget du mois dépassé »** : l'observation suit maintenant la même période que le Budget (cycle de salaire ou
  mois civil), et non plus toujours le mois civil.
- **Journal** : à chaque opération fusionnée ou retirée par la synchronisation, une ligne anonyme dit quels champs la
  banque a envoyés (présents ou absents, jamais leur contenu). Les modifications du budget disent s'il s'agit du budget
  perso ou du commun et de combien le budget mensuel change ; le bouton « = » du mode Budget est aussi noté.
- **Diagnostic d'affichage** : la mesure n'élargit plus la page quand le texte est très agrandi, et le texte copié
  reste dans son cadre.
- **Mode démo** : virements en route et opérations réglées d'avance vérifiés.

## 1.1.2

Correctif prioritaire (défaut constaté le 01/11 sur la 1.1.1).
- **Opérations en double** : quand la banque renvoie une opération déjà lue à une autre date, avec une référence
  ajoutée au libellé, Klad n'en garde plus qu'une (la plus récente, avec le classement, le « vu » et les rapprochements
  de l'autre). Une opération que la banque ne renvoie plus lors d'une relecture de la même période est retirée (sauf
  saisie à la main). Les doublons déjà enregistrés sont retirés une fois à l'installation ; ce retrait s'annule pendant
  7 jours depuis Plus › Journal. Deux vraies opérations identiques ne sont jamais fusionnées.
- **Échéances réglées d'avance** : un virement permanent, un prélèvement ou une échéance de contrat débité jusqu'à
  7 jours avant ou 5 jours après sa date prévue (week-end, jour férié, fait d'avance) compte pour l'échéance prévue,
  partout : reste à vivre, budget (cycle et mois civil), observations, échéances, commun, résumé Grafit. La date réelle
  reste affichée, avec la mention « réglé d'avance pour novembre ». Fenêtre réglable dans Plus › Réglages › Budget ›
  Échéances réglées d'avance ; correction à la main dans le détail de l'opération (« Compte pour »), annulable.
- **Commun** : un virement parti du compte perso et pas encore arrivé est « en route » (plus « attendu, non reçu ») ;
  il compte une seule fois. Tant que des virements du mois manquent, la marge affichée est la marge prévue (« prévue ·
  en attente de x € ») ; la marge réelle reste visible dans le détail et reprend quand tout est arrivé.
- **Découvert prévu du commun** : l'alerte suit la trésorerie jour par jour (virements attendus et en route compris).
- Aucun autre chiffre modifié (relevés de contrôle des jeux fictifs identiques à la 1.1.1).

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
