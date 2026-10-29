# Contrôle automatique Klad / ancienne version

Compare, au centime, les chiffres affichés par Klad et ceux de l'ancienne version (« Carnet »), sur les mêmes données du
jour. Ce dossier ne contient que du code : les données (relevé de Klad, page, état et imports de l'ancienne version)
sont fournies en arguments et restent hors du dépôt.

## Pré-requis

- Node 22 ou plus récent.
- Playwright et Chromium (pour exécuter la page de l'ancienne version) :
  `npm install --no-save playwright && npx playwright install chromium`.

## Mode d'emploi

```sh
git clone <dépôt public de Klad> klad && cd klad
npm install --no-save playwright && npx playwright install chromium

# 1. Relevé de Klad : exporté depuis le téléphone (Plus › Contrôle › Exporter le relevé de contrôle),
#    fichier klad-controle-AAAAMMJJ-HHMM.json.
# 2. Même relevé calculé par l'ancienne version, à la date du relevé de Klad :
node tools/controle/carnet-controle.mjs --html <page de l'ancienne version>.html --etat <state/main.json> \
  --imports <imports/0-AAAA.json> <imports/1-AAAA.json> … --date AAAA-MM-JJ --sortie carnet-controle.json
# 3. Comparaison, rapport en français :
node tools/controle/comparer.mjs klad-controle-AAAAMMJJ-HHMM.json carnet-controle.json --sortie rapport.txt
```

`--date` est la date du relevé de Klad (champ `meta.aujourdhui`). La page de l'ancienne version est exécutée dans
Chromium sans aucune requête vers l'extérieur. Si elle n'est pas reconnue (autre version), l'outil s'arrête avec le
repère introuvable. Code de sortie de `comparer.mjs` : 0 si tout est identique, 1 s'il y a des écarts, 2 en cas d'erreur.

## Rapport

Pour chaque point (1 à 10) : « identique », « non comparable » (absent de l'ancienne version) ou la liste des écarts
avec les deux valeurs. Chaque écart est diagnostiqué avec l'empreinte des données d'entrée (point 11) :

- **données d'entrée différentes** : opérations présentes d'un seul côté (appariées par identifiant, puis par date et
  montant), listées avec date, montant, libellé et identifiant ;
- **même entrée, calcul différent** : défaut à corriger dans Klad (ou écart connu).

Tolérances : 50 centimes sur les budgets (arrondis à l'euro par l'ancienne version), 1 centime sur les autres montants
(arrondi des sommes), aucune sur les nombres, dates et textes. Les observations de même niveau et mêmes montants dont
les titres ne diffèrent que par la formulation sont signalées « identiques au titre près ».

## Format `klad-controle` v1

Fichier JSON ; montants en centimes (entiers, signés : un débit est négatif) ; dates `AAAA-MM-JJ` ; clés stables.
Fichier **personnel en clair** (chiffres et libellés des opérations) : à supprimer après le contrôle. Ni IBAN, ni clé,
ni journal, ni identifiant bancaire. Une valeur que l'une des versions ne calcule pas vaut `null`.

| Clé | Contenu |
|---|---|
| `format`, `v`, `source` | `"klad-controle"`, `1`, `"klad"` ou `"carnet"` |
| `meta` | `version`, `genere` (ISO), `aujourdhui`, `synchro` (par compte : `ref`, `libelle`, `lu`, `source`), `complement` (importé ou non), `derniereSynchro` |
| `comptes` | 1. par compte : `ref` (référence de la reprise `r0`, `r1`… ; `livret` pour le livret suivi), `libelle`, `role`, `solde` et `date`, `dette` (carte à débit différé) et `prelevement` (prochain) |
| `resteAVivre` | 2. `fin` du cycle, colonnes `salaire` et `comptes` : `base`, `fixes`, `marge`, `variable`, `reste` (et `date` du salaire) |
| `budget` | 3. `courant` et `precedent` : `debut`, `fin`, `salaire` (`date`, `montant`), `revenus` (`prevu`, `recu`), `sections` (`fixe`, `courante`, `optionnelle` : `budget`, `utilise`, `reste`), `horsBudget`, `total` (`budget`, `utilise`, `depassement`), `postes` (`cle` « f\|… » ou « c\|… », `section`, `budget`, `utilise`, `reste`) |
| `commun` | 4. `mois`, `marge` (`solde`, `fixes`, `variable`, `marge`), `finDeMois` (`solde`, `aVenir`, `attendus`, `reserve`, `fin`), `virements` (`qui` : `moi` / `autre`, `attendu`, `recu`, `date`), `aMettreEnPlace` (`qui`, `actuel`, `demande`), `ponctuel` (`total`, `moi`, `autre`), `tresorerie` (`pointBas`, `date`, `decouvert`), `origine` (`debut`, `mois`, `soldeInitial`, `apports`, `attendu`, `budget`, `postes`) |
| `equilibre` | 5. `investi`, `versements`, `equipements` (`moi`, `autre`), `ecart`, `debiteur` (qui doit encore investir : `moi` / `autre`), `mensuel`, `date` |
| `contrats` | 6. `liste` (`perimetre`, `libelle`, `poste`, `montant`, `periodicite`, `prochaine`), `echeances31` (`date`, `libelle`, `montant`, `sorte`) |
| `impots` | 7. `annee`, `annees` (par année : `sorte` avis / estimation, `total`, `paye`, `aVenir`, `solde`, `revenuImposable`, `impotNet`, `prelevementsSociaux`, `pas` et `reste` par personne), `regularisations`, `taxeFonciere` (par année : `total`, `base`), `livret` (`solde`, `date`, `interets`), `pee` (`encours`, `verse`, `abondement`, `plusValue`) |
| `observations` | 8. `code` (titre sans chiffres ni accents), `niveau`, `perimetre`, `titre`, `chiffres` (montants cités) |
| `aVerifier` | 9. `nonVues`, `nonClassees` (90 derniers jours), `aRapprocher` (prélèvements de portefeuille), `comptesAVerifier` |
| `grafit` | 10. `actif`, `enregistre` (résumé tel qu'enregistré pour Grafit), `calcule` (tel que calculé à l'export) |
| `empreinte` | 11. `cycles.courant` / `cycles.precedent` (`debut`, `fin`, `comptes` : `ref`, `nb`, `debits`, `credits`, `ops`) et `commun` (12 mois : `mois`, `nb`, `debits`, `credits`, `ops`) ; `ops` = `[id, date, montant, libellé]` |

Identifiants d'opérations : ceux de la reprise de l'ancienne version (`'k' + sha256(date|montant|compte|libellé[0..30])`,
20 caractères hexadécimaux, `'.' + rang` parmi les lignes de même clé), sinon l'identifiant de Klad (opérations lues
par la banque après la reprise) ; le comparateur apparie alors par date et montant.

Dans l'ancienne version, `null` pour : rôle, libellé et prochain prélèvement des comptes, date d'équilibre, échéances
à 31 jours, intérêts du livret, prélèvements à rapprocher, comptes à vérifier, résumé Grafit (fonctions propres à Klad).
La prochaine échéance des contrats y est déduite du dernier prélèvement avec la règle de Klad.
