# Consignes pour Claude (dépôt Klad)

- Langue : français, phrases simples, termes techniques expliqués au besoin.
- Méthode : **mode plan puis mode action**. Proposer le plan, attendre la validation, puis développer.
- Référence fonctionnelle : le cahier des charges et le suivi de développement sont tenus **hors du dépôt** par le propriétaire ; il en fournit le contenu utile en début de session. Ne rien supposer qui n'y figure pas.
- Dépôt **public** : aucune donnée personnelle ni secret dans le code, les commits, les tickets, les journaux d'Actions ou les noms de fichiers (noms, banques utilisées, IBAN, montants, clés, identifiants Enable Banking, adresses e-mail). Exemples et tests avec des données fictives uniquement.
- Journal de l'appli : toujours anonyme (alias « Banque A · compte 1 », filtre `KladAnon.scrub`) ; jamais de nom de titulaire, de banque, de compte, d'IBAN, d'e-mail ni d'identifiant. La sécurité des données est prioritaire.
- Ne jamais ajouter de fichier `.pem`, `.jks`, `.b64`, `.env` ni de clé ; les secrets passent par les secrets GitHub Actions.
- Le compte GitHub n'est écrit nulle part : il est déduit à la fabrication (`GITHUB_REPOSITORY_OWNER`).
- Le nom du dépôt n'est pas écrit en dur non plus : `GITHUB_REPOSITORY` à la fabrication (`klad` par défaut), `location.pathname` sur le site.
- Formulations financières dans l'interface : pas de montants négatifs affichés ; dire « débit / crédit », « débiteur », ou qui doit combien à qui.
- Avant de pousser : `npm test` doit passer ; avec l'environnement Android (`klad-android`), aussi `./gradlew assembleDebug testDebugUnitTest lint` dans `android/`.
- Travail sur une branche + demande de fusion ; `main` déclenche la fabrication de l'APK et du site.
- Cycle GitHub géré par Claude, sans intervention du propriétaire : branche, demande de fusion, attente des vérifications (workflow « APK Android »), fusion par Claude quand tout est vert, suivi des workflows sur `main`, correction en cas d'échec. Le propriétaire n'intervient que pour les décisions de design.
- **Fusion par Claude**, y compris pour une demande de fusion qui change la version (donc publie l'APK). Garde-fous :
  - fusionner uniquement ses propres demandes de fusion, quand la vérification « APK Android » est verte, sans aucun test sauté ;
  - une seule version publiée par lot, sauf correctif ;
  - après publication, donner au propriétaire la recette manuelle ; si le téléphone révèle une régression, publier un correctif plutôt que revenir en arrière.
- Publication : changer `version` dans `package.json` ; la fusion dans `main` crée l'étiquette `v<version>` et la publication avec l'APK signé. Pas de publication ni d'étiquette à la main. Pas de secret ni de réglage du dépôt modifié par Claude.
- Lien Grafit : le résumé (`www/resume.js`) ne contient jamais d'IBAN ni de fin d'IBAN, d'identifiant, de jeton, d'opération, de nom de banque ni de libellé bancaire brut. Paquet et empreinte attendus de Grafit : seulement dans `GrafitConfig.java`.
