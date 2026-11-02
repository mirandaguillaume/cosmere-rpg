# Reprise — cosmere-rpg

## À quoi sert le projet
Fork personnel du système communautaire Foundry VTT pour le Cosmere Roleplaying Game (dépôt amont : `the-metalworks/cosmere-rpg`, licence MIT, sauf les dossiers `src/packs/rules/` et `src/packs/tables/` qui contiennent du contenu officiel utilisé avec permission). Il sert à préparer des corrections et des fonctionnalités à proposer en pull request à l'amont (TypeScript, Rollup, Foundry v13). Remotes : `origin` = amont (`the-metalworks/cosmere-rpg`), `fork` = ce dépôt public (`mirandaguillaume/cosmere-rpg`).

## État au 2026-11-02
- `main` local = `efc593c` « Release 2.1.0 » (15 mai 2026) ; `package.json` indique la version 2.2.0. Branches de release amont : `release-2.2.0`, `release-3.0.0`.
- Branche courante : `feat/expand-linked-skills-404` (`eb98f80`, dernier travail le 20 mai 2026). Elle porte quatre commits « support linked skills » (connection, equipment, loot, talent) pour l'issue amont #404 (ajouter les skills liés à quatre types d'items). Elle a en plus des modifications indexées, non commitées, sur `src/system/data/item/{connection,equipment,loot,talent}.ts`.
- Autres branches locales : `*/720-rebase` (`4231e15`, migration : contourner `cleanData` du schéma pour retirer les clés de talent obsolètes), `*/726-fix-save-after-update` (`00d498d`, 29 mai 2026 : conserver le contenu de l'éditeur prose-mirror lors d'un nouveau rendu), `fix/item-description-edit-reset-211` (`797a459`, même famille de correctif, issue #211), `refactor/talent-remove-path-ancestry-314` (`dfa7198`, suppression de `path`/`ancestry`/`power` sur les talents avec migration 1.0 vers 1.1), `feat/sheet-title-format-73` (`a1a1bee`, titre de fiche « Nom [Type] »). Plusieurs sont en worktrees dans un sous-dossier local ignoré du dépôt.
- Sauvegardes du 2026-11-02 (sur `fork`) : `wip/sauvegarde-2026-11-02` (`1615598` : les modifications indexées ci-dessus, `docker-compose.yml`, `docs/superpowers/`, `tmp-test/`), `refactor/talent-remove-path-ancestry-314-local-2026-11-02` (copie de `dfa7198`, la branche distante ayant divergé), `stash/2026-05-20-0` (stash WIP de la branche refactor #314, `eab9334`). Un stash local équivalent existe encore (`stash@{0}`).
- Dernière activité : fin mai 2026.

## Installer et lancer
Prérequis : Node 20 (`engines`), npm, Docker pour lancer Foundry en local.
- `npm ci` (installe aussi les hooks husky ; commits au format Conventional Commits via commitlint).
- `npm run build` (Rollup vers `build/`), `npm run build:watch`, `npm run pack` (compendiums), `npm run build:release`, `npm run lint`, `npm run prettier`.
- `npm run link` : lie `build/` au dossier `Data` de Foundry (demande le chemin).
- Foundry en Docker : `docker compose up` avec `docker-compose.yml` (image `felddy/foundryvtt:13.351`, port 30000, `build/` monté en lecture seule comme système `cosmere-rpg`). Le fichier `.env` doit définir `FOUNDRY_RELEASE_URL`, `FOUNDRY_ADMIN_KEY` et `FOUNDRY_LICENSE_KEY` (noms seulement ; valeurs non versionnées).
- `tmp-test/*.mjs` : scripts d'essai de bout en bout et de migration (seed, e2e, migrate-and-verify), à usage local.

## Où j'en étais et prochaines étapes
1. #404 (skills liés) : les quatre commits de données sont faits ; le plan et la spec sont dans `docs/superpowers/` (35 cases de plan non cochées). Reste à relire les modifications indexées, vérifier l'affichage dans la fiche et dans la liste des items liés d'un acteur, puis ouvrir la PR en indiquant le compromis sémantique pour Talent par rapport à Path.
2. Corps de PR préparés dans `tmp-test/pr-725-body.md` et `tmp-test/pr-726-body.md` (statut des PR amont non vérifié).
3. #314 : migration 1.0 vers 1.1 en place sur la branche refactor ; la distante a divergé de la sauvegarde `-local-2026-11-02`.
4. #211 : plan `docs/superpowers/plans/2026-05-18-fix-item-description-edit-reset-211.md` (18 cases non cochées) ; correctif commité sur `fix/item-description-edit-reset-211`.

## À fournir hors dépôt
- Une licence Foundry VTT et l'URL de téléchargement de la version (variables `FOUNDRY_LICENSE_KEY`, `FOUNDRY_RELEASE_URL`, `FOUNDRY_ADMIN_KEY` dans un `.env` local, à créer, jamais commité).
- Aucun PDF ni source éditeur requis (le contenu des packs fait partie du dépôt amont).

## Pièges connus
- Dépôt public : ne jamais commiter `.env`, `docs/superpowers/` (notes de travail internes, volontairement non versionnées) ni `tmp-test/`. Le fichier `.env` n'est pas dans le `.gitignore` du dépôt.
- Les branches de sauvegarde du 2026-11-02 contiennent `docs/superpowers/` et `tmp-test/` ; ne pas les proposer telles quelles en PR amont.
- `build/` est ignoré ; relancer `npm run build` après chaque changement avant d'ouvrir Foundry.
- Pour une PR amont (CONTRIBUTING.md) : si l'issue appartient à un jalon, travailler sur la branche de ce jalon (`release-2.2.0`, `release-3.0.0`), sinon sur `main` ; le `main` local est resté en 2.1.0, penser à le mettre à jour depuis `origin`.
