# Klad — notes de version

Ouvertes depuis l'appli : Plus › Aide et à propos › À propos › « Notes de version ». Aucune donnée personnelle.

## 2.4.1

- **Opération liée** : un achat payé par PayPal (ou un autre portefeuille) et le prélèvement de la banque qui le
  règle s'affichent l'un dans l'autre ; un appui ouvre l'autre opération, Retour revient à la première.
- Dans « Classer », un prélèvement qui règle un achat détaillé ailleurs indique de classer l'achat, avec un accès
  direct.

## 2.4.0

- **Classer une opération** : la catégorie choisie s'applique toujours à l'opération. Avant, une règle plus précise
  déjà en place (ou un règlement de carte détaillé ailleurs) pouvait garder l'ancienne catégorie malgré le message
  « Opération classée ». Le message dit maintenant ce qui s'est réellement passé.
- « Classer aussi les autres » n'est plus activé d'office ; le volet indique combien d'autres opérations contiennent
  le mot proposé.
- **Nouvelle catégorie** depuis le volet « Classer » : nom et section du budget, puis elle est choisie.

## 2.3.4

- **Synchro automatique** : le passage de 8 h ou de 14 h n'est plus sauté quand Klad a été quitté sans être fermé ;
  Klad est alors verrouillé, puis la synchro a lieu. Si Klad est affiché à l'écran à ce moment, nouvel essai 30 min
  plus tard.
- **Plus › Verrou › Synchro automatique** : heure et résultat du dernier passage, heure du prochain, et un bouton
  « Essayer dans 1 min » pour vérifier sans attendre.
- Une erreur passagère ne désactive plus la synchro automatique.

## 2.3.3

- **Widget** : le 1 × 1 n'est plus rond. L'écran d'accueil arrondissait le widget à sa façon, ce qui coupait la
  bordure et cachait la pastille ; Klad garde maintenant ses propres coins (carré aux coins arrondis, comme les icônes).

## 2.3.2

- **Widget** : le 1 × 1 est un carré de la taille d'une icône, aligné sur les icônes ; le 2 × 1 a la même hauteur. La
  bordure n'est plus coupée. Nouveau style **Orbital verre** (fond sombre transparent, bordure et pastille rouille),
  par défaut ; Orbital, Bleu Klad et Verre restent au choix dans Plus › Apparence.
- **Budget** : chaque section (Revenus, Charges fixes, Dépenses courantes, Dépenses optionnelles, Hors budget) est un
  bloc à part, avec un liseré et un titre de sa couleur ; on distingue tout de suite une section d'un poste.
- **Mode démo** : un montant réel pouvait rester, par moments, dans le texte lu par l'accessibilité d'une ligne
  d'opération ; il est maintenant masqué comme le reste.

## 2.3.1

Widget retravaillé (maquettes validées le 10/11).
- Deux formats à poser depuis l'écran d'accueil : **1 × 1** (le montant et la pastille) et **2 × 1** (le montant, l'heure
  de la dernière synchro et la pastille). Le 2 × 2 disparaît ; un widget déjà posé passe à la disposition 2 × 1.
- Bordure fine ; pastille à la taille d'une pastille de notification Android (« 9+ » au-delà de 9).
- Trois styles au choix dans Plus › Apparence : Orbital (par défaut, couleur des dossiers de l'écran d'accueil,
  bordure et pastille rouille), Bleu Klad, Verre (fond sombre transparent).
- 1 × 1 : synchro ancienne ou banque à reconnecter = bordure ambre (pas de place pour l'heure).

## 2.3.0

Widget d'écran d'accueil et synchro automatique (demande du propriétaire, 09/11 ; maquette validée).
- **Widget** (2 × 2 cases, à poser depuis l'écran d'accueil du téléphone) : le reste à vivre, sans légende, en bleu (en
  rouge s'il est dépassé, jamais avec un signe moins), une pastille avec le nombre d'opérations à vérifier, l'heure de la
  dernière synchro en bas (en ambre au-delà de 12 h ; « à ouvrir » si la banque est à reconnecter). Mode démo : « ••• ».
  Un toucher ouvre Klad sur « Trier » s'il y a une pastille, sinon sur l'Aperçu (après le code ou l'empreinte). Il suit
  le thème clair ou sombre du téléphone et se met à jour dès qu'une opération est vue ou classée.
- **Synchro automatique** (Plus › Verrou, désactivée par défaut) : vers 8 h et 14 h, Klad fermé, les comptes sont lus
  comme d'habitude, sans écran ; le widget et le résumé Grafit sont mis à jour. L'activer demande le code : Klad garde
  alors une clé du coffre utilisable sans code, mais seulement par Klad sur ce téléphone ; la désactiver l'efface.
  Android peut décaler un passage de quelques minutes (ou davantage pour économiser la batterie). Rien ne se passe si
  Klad est ouvert ; s'il s'ouvre pendant une synchro, il attend qu'elle finisse.

## 2.2.1

Couleurs du cadran (retour du propriétaire, 09/11) : le montant du reste à vivre (Moi) et de la fin de mois (Nous) est
en couleur de texte ; la couronne (part du budget variable ou du budget du commun déjà dépensée) prend la couleur du côté,
bleu pour Moi, orange pour Nous, comme la légende de son ⓘ. Un dépassement reste signalé par le mot en rouge sous le
montant.

## 2.2.0

Lecture rapide (retour du propriétaire, 09/11 ; maquette validée : « ⓘ partout », toute l'appli d'un coup).
- **Règle** : reste visible le nom, le montant, l'état et le mot qui dit ce qu'est le montant ; les dates, formules,
  explications et petits textes sous les titres sont derrière un **ⓘ**. Un toucher sur ⓘ ouvre l'info juste dessous (ou
  toutes celles de la carte, pour un ⓘ de titre) ; un second la referme. Rien n'est retiré, aucun calcul ne change.
- **Aperçu** : le montant du cadran est à la couleur du côté (bleu Moi, orange Nous) ; l'échéance, le jour du cycle, la
  légende et, pour Nous, le calcul de la fin de mois (solde, prélèvements à venir, provisions) sont dans le ⓘ du cadran.
  Dates des soldes, heure du relevé, détail des opérations à vérifier, nature des échéances : ⓘ du titre de la carte.
  Le lien « Le calcul sur les deux bases » (doublon du « ? ») est retiré.
- **Budget** : plus de bandeau « N poste dépassé » ni de compteurs en tête des sections (les postes portent leur état, les
  « Plus gros écarts » sont en bas) ; plus de « jour N/T » ni de « + Ajouter un poste » dans le suivi (ajout dans
  « Régler le budget ») ; un poste replié montre son nom, son état (« à venir », sans la date) et son montant, le reste
  quand on le déplie ; formules du bilan et détail des écarts : ⓘ sur chaque ligne ; dates de la période : ⓘ.
- **Commun** : chaque part du solde (Disponible, Réserve fixe, Provisions, Enveloppes) a son ⓘ (ex. Enveloppes : les
  impôts) ; le calcul détaillé de la marge s'ouvre par le ⓘ de « Marge réelle du commun ».
- **Partout ailleurs** (Opérations, Trésorerie, Équilibre, Tendance, Contrats, Patrimoine, Plus et ses volets) : sous-textes
  et aides derrière un ⓘ (titre de la section ou libellé du champ) ; les états restent visibles (« Lien Grafit désactivé »,
  « 3 ordres à modifier », résultat d'une crypto…). Opérations : le nom du compte passe dans le détail de l'opération.

## 2.1.0

Budget fusionné dans l'Aperçu (retour du propriétaire, 08/11 : l'Aperçu 2.0 répétait le budget au lieu de le
remplacer ; maquettes validées). Aucun calcul ne change, aucune information n'est retirée.
- **Un seul écran par côté** : l'Aperçu *Moi* est le budget perso, l'Aperçu *Nous* le budget du commun. Plus de résumé
  du budget suivi d'un bouton « Tout le budget » : le budget est là, en entier, entre le haut (cadran, où va l'argent,
  à vérifier, soldes) et le bas (à faire, prochains jours, Verrouiller).
- **Budget en sections repliables** : Revenus, Charges fixes, Dépenses courantes, Dépenses optionnelles, Hors budget
  (dépenses ouvertes, revenus et hors budget repliés au départ). Chaque poste : anneau de consommation, état
  (« conforme », « à venir · le 05/11 », « dépassé »…), montant / budget ; un appui déplie ses opérations (« Classer »),
  ses contrats, la projection, « Modifier le budget ». Période précédente / suivante dans la carte (‹ ›).
- **Régler le budget dans la même carte** (bouton « Régler le budget ») : une ligne par poste avec le réel habituel
  comparé au budget (deux barres), le montant, la périodicité, « = » pour aligner ; sections repliables ; au commun,
  la part de chacun et l'équilibre ; « Tout aligner » et « Réglages du budget » en tête.
- **Bilan** : total des dépenses (dans le budget, hors budget, reste), causes d'un dépassement, solde prévu, réel à ce
  jour, projeté (pastilles « excédent » / « déficit »), au commun mouvements du mois et provisions ; puis les plus gros
  écarts, la répartition des dépenses et les boutons Tendance, Contrats, Dernier bilan (Moi) ou Trésorerie, Équilibre,
  Contrats (Nous), qui ouvrent l'écran détaillé (titre de l'écran, retour en haut à gauche).
- **Nous** : fin de mois estimée avec son calcul (solde, prélèvements à venir, provisions), opérations du commun à
  vérifier, équilibre et 12 prochains mois, « Où va l'argent du commun » (marge réelle en barre et en détail), virements à
  mettre en place, le compte commun ce mois-ci, puis le budget du commun.
- **À faire** en bas : les points du côté affiché (Moi : perso et général ; Nous : commun et général), « c'est fait » ;
  tous les points et les observations dans « Toutes les observations ».
- Reste à vivre : les deux bases (dernier salaire, comptes courants) montrent chacune leur montant.

## 2.0.1

Correctif (retour du propriétaire, 08/11) : une opération marquée vue d'un glissement, ou depuis son détail, met à jour
tout de suite les nombres de l'écran Opérations (pastilles Perso · Commun · Tout, filtre « Non vues », « Trier une à
une ») ; avant, seul le bouton Trier changeait, le reste attendait qu'on quitte la liste. La liste ne bouge pas.

## 2.0.0

Nouvelle interface (demande du propriétaire, 08/11 : moins de texte, une navigation qui se comprend sans explication, sans
perdre aucune information). Aucun calcul ne change. Comprend aussi les corrections de la 1.3.5 et de la 1.3.6 ci-dessous.
- **Barre du bas** : Aperçu · Opérations · **Trier** (bouton du milieu, avec le nombre d'opérations à vérifier) ·
  Patrimoine · Plus. Budget, Commun et Équilibre s'ouvrent depuis l'Aperçu (le bouton Retour y ramène).
- **Aperçu, page Moi** : un cadran donne le reste à vivre (au centre), le temps écoulé du cycle (cercle fin et point) et
  la part du budget variable déjà dépensée (cercle épais, vert / orange / rouge selon le rythme) ; « Où va l'argent »
  découpe le salaire ou les comptes en couleurs ; puis à vérifier, soldes, le budget du cycle **poste par poste** (un
  anneau par poste, « reste », « dépassé de », « à venir », « prélevé ») avec son bilan (total dépensé, réel à ce jour,
  projeté, pastilles « excédent » / « déficit ») et quatre boutons vers les écrans détaillés (Tout le budget, Tendance,
  Contrats, Dernier bilan), les 7 prochains jours (échéances et paie, liste complète en dépliant), les points à faire et
  Verrouiller.
- **Aperçu, page Nous** (glisser vers la gauche ou toucher « Nous ») : fin de mois estimée et solde du commun, virements
  de chacun (reçu, en route, à mettre en place), équilibre (balançoire : qui doit encore investir, date d'équilibre),
  12 prochains mois (point bas, plancher de la réserve), répartition du solde, budget du commun avec son bilan et ses
  boutons (Tout le commun, Trésorerie, Équilibre, Contrats), prochains jours du commun, points à faire.
- **Lisible partout** : petit écran (320 px) et texte agrandi jusqu'à 200 % sans rien de coupé ; cibles de 48 dp.

## 1.3.6

Écrans allégés (analyse complète de l'appli par l'architecte, 08/11).
- **Accueil** : le cycle n'est plus rappelé trois fois (en-tête sans « jour N sur T », « Ce cycle-ci » sans les jours
  restants) ; « Bilan du cycle précédent » passe dans « Ce cycle-ci » ; un seul raccourci en bas (Verrouiller) ;
  « À mettre en place » : une ligne par personne avec le total de ses virements à modifier.
- **À vérifier** : depuis l'Accueil, la liste propose « Trier une à une » (non vues puis non classées, en une file).
- **Commun › Ce mois** : le solde n'est plus répété : la carte « Le compte commun ce mois-ci » montre sa répartition,
  le bas du budget les mouvements du mois (variation réelle).
- **Cycle de salaire** : il se termine la veille du prochain jour de paie habituel (jour ouvré) ; un salaire versé en
  avance (fêtes) ne raccourcit plus le cycle. Observation « Salaire attendu le …, pas encore arrivé » trois jours après.
- **Contrats** : « prélèvement absent » pour tous les contrats (perso aussi, toutes périodicités), avec un conseil si
  l'organisme a changé de libellé ou de numéro ; « Prévu du poste » lisible sur un petit écran.
- **Projeté fin de mois** : affiché à partir du 7e jour (avant, deux jours de dépenses donnaient un chiffre inquiétant).
- **Affichage** : « Alimentation » coupé proprement dans « Classer » ; graphiques sans axe hors de la carte ;
  « 12 prochains mois » dans Commun › Trésorerie ; Impôts : « À régler et à suivre », « Points à suivre ».

## 1.3.5

Correctif (analyse complète de l'appli par l'architecte, 08/11).
- **Reste à vivre « comptes courants »** : la somme due sur la carte à débit différé est retirée (ligne « Carte à débit
  différé » dans le détail). Avant, un achat à la carte faisait monter ce reste à vivre jusqu'au prélèvement de la carte.
- **Projeté fin de mois** (Budget › Suivi) : une charge fixe plus chère que son budget, ou sans budget, est comptée.
- **Opération en cours abandonnée** (pré-autorisation d'une station ou d'un hôtel, remplacée par un autre montant) : dès
  que la banque ne la renvoie plus, elle ne compte plus ; elle reste visible, barrée, « en cours · plus renvoyée ».
- **Synchro** : une fois par semaine, les 30 derniers jours sont relus (opération passée en retard avec une date
  ancienne) ; deux achats identiques le même jour ne sont plus jamais fusionnés.
- **À vérifier** : une seule ligne sur l'Accueil, avec le même nombre que la pastille « Tout » des Opérations (non vues,
  non classées depuis 3 mois, à rapprocher : chacune comptée une fois) ; un appui ouvre cette liste. L'observation
  « Opérations à classer » compte les mêmes 3 mois.
- **Recherche par montant** : « 34,65 » (ou « 34.65 », « 34,65 € ») trouve les opérations de ce montant.
- **Enregistrement** : après un enregistrement impossible, tout ce qui n'a pas été écrit est réécrit ensuite ; écriture
  immédiate quand Klad passe en arrière-plan ; le fichier de sauvegarde porte la date du téléphone.

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
