# Design — Expand linked-skills support to more item types (issue #404)

> **Status :** draft — pending spec doc review
> **Source :** design alignment via brainstorm session, 2026-05-19
> **Implementation plan :** to be generated via writing-plans after spec approval

## Context

Issue [#404](https://github.com/the-metalworks/cosmere-rpg/issues/404) demande d'étendre la capacité « linked skills » à de nouveaux types d'items. Aujourd'hui, seuls `ancestry`, `path`, `culture`, `weapon`, `armor` peuvent fournir des linked skills. Le reporter demande explicitement d'ajouter `connection`, `equipment`, `loot`, et envisage aussi `talent`.

Décision validée pendant le brainstorm : ajouter le mixin aux **4 types** (Connection, Equipment, Loot, Talent), avec une mention explicite dans la PR du tradeoff sémantique pour Talent vs Path.

## Architecture cible

Le mixin existant `LinkedSkillsMixin` (`src/system/data/item/mixins/linked-skills.ts`) ajoute un champ `linkedSkills: string[]` au schéma data, avec :
- `ArrayField` de `StringField`
- `choices` dérivés de `CONFIG.COSMERE.skills` filtrés sur `!skill.core` (seulement les skills non-core sont liables)
- `initial: []`, `required: true, nullable: false`

Le composant sheet `app-item-details-linked-skills` (`details-linked-skills.ts`) lit `item.hasLinkedSkills()` (qui teste `'linkedSkills' in this.system`) et auto-gate son rendu : si false, il ne render rien.

L'helper `CosmereItem.hasLinkedSkills()` type-narrows vers `LinkedSkillsItem`.

Côté actor, `CosmereActor.skillLinkedItems` agrège tous les items ayant `hasLinkedSkills() && linkedSkills.length > 0` en excluant les 3 types background (`!isPath() && !isAncestry() && !isCulture()`). Pas de check supplémentaire (pas d'`equipped`, pas d'`isMoney`).

**Conséquence** : ajouter le mixin à un type le rend automatiquement visible dans la liste actor `skillLinkedItems` et dans l'éditeur sheet, sans aucun câblage supplémentaire.

## Changements

### Données (4 fichiers)

Pour chaque fichier de la liste ci-dessous : ajout de l'import, du type composé, et de l'appel `LinkedSkillsMixin()` dans la composition.

| Fichier | Lignes ajoutées |
|---|---|
| `src/system/data/item/connection.ts` | ~6 |
| `src/system/data/item/equipment.ts` | ~6 |
| `src/system/data/item/loot.ts` | ~6 |
| `src/system/data/item/talent.ts` | ~6 |

Pattern identique à `weapon.ts` (lignes 34-35, 54, 113 dans la version actuelle).

### Templates (2 fichiers)

Pour `loot` et `talent`, le sheet utilise un template custom (`loot-details-tab.hbs`, `talent-details-tab.hbs`) qui n'appelle pas le composant linked-skills. On ajoute `{{app-item-details-linked-skills}}` dans le `<fieldset>` principal de chacun, à un emplacement cohérent avec où `item-details-tab.hbs` l'appelle (entre `id` et `type`, ou après `type`).

Pour `connection` et `equipment`, les sheets utilisent le template partagé `item-details-tab.hbs` qui contient déjà `{{app-item-details-linked-skills}}` (ligne 7 du template actuel). **Aucune modification template requise.**

### Pas de changement

- Aucune migration nécessaire (vérifié expérimentalement le 2026-05-19 sur un Connection neuf : Foundry hydrate `linkedSkills: []` automatiquement via `cleanData`. Confirmé aussi par le commit historique `1aa35e1` qui a introduit le mixin sur 4 types existants sans inclure de migration).
- Aucune nouvelle clé i18n (le label existant `COSMERE.Item.General.LinkedSkills.Label` est générique et adapté à tous les types).
- Aucune logique actor à toucher : le getter `skillLinkedItems` est déjà type-agnostique.
- Aucun nouveau composant TS.

## Comportement

- **Sémantique uniforme** : la possession de l'item dans l'inventaire suffit à « linker » les skills déclarés. Pas de check `equipped`, pas de check `isMoney` pour Loot, pas de distinction entre subtypes de Talent (`PathTalent`, `AncestryTalent`, `PowerTalent`).
- **Filtrage côté actor** : un item avec `linkedSkills: []` n'apparaît PAS dans `skillLinkedItems` (filtré par `length > 0`). Donc pas de pollution UI pour les items existants sans linked-skills configurés.
- **Sélection du skill** : limitée aux skills non-core, comme pour les types existants (héritage direct du mixin sans modification).

## Effet de bord assumé : Path / PathTalent

Un Path fournit aujourd'hui ses propres linked-skills via `path.system.linkedSkills`. Ses talents enfants (`PathTalent`) hériteront du mixin par cette PR et pourront eux aussi déclarer des linked-skills.

Conséquence visible : la même skill peut apparaître liée à plusieurs items dans la fiche actor (le Path **et** un de ses talents qui la re-déclare). C'est de la redondance configurée par le GM, pas un bug data. Mais c'est un effet de bord à signaler aux mainteneurs dans la description de PR pour qu'ils puissent décider :
- soit accepter en l'état (laisser la flexibilité au GM),
- soit exclure `talent` du scope (revert d'un commit, low effort),
- soit ajouter une exclusion d'affichage côté actor pour les talents dont le path parent fournit déjà la skill (plus complexe, follow-up séparé).

## Validation

- **Build / typecheck / lint** : doivent passer (préexistantes mises à part).
- **Manuelle dans Foundry** :
  1. Créer un item de chaque type (Connection / Equipment / Loot / Talent), vérifier que l'onglet Details propose bien la section Linked Skills avec un sélecteur multi-skill.
  2. Configurer un skill non-core (ex: Discipline, Lore, etc.) sur chacun.
  3. Ouvrir une fiche Character qui possède l'item ET a unlock ce skill, vérifier que l'item apparaît dans la section dédiée du sheet character.
  4. Cas Path/PathTalent : créer un PathTalent dont le Path parent fournit déjà la skill, vérifier que la skill apparaît bien dupliquée et noter le comportement dans la PR.
  5. Cas Loot `isMoney=true` : vérifier que la section linked-skills reste affichée et fonctionne (sémantique « money items peuvent fournir des skills », acceptée par YAGNI).
- **Aucun test automatisé** (le repo n'a pas d'infra de tests sheets, et il serait disproportionné d'en ajouter une pour ce changement).

## Note PR

Le corps de PR mentionnera explicitement le tradeoff Path/PathTalent et invitera les mainteneurs à valider l'inclusion de Talent. Texte type :

> This PR adds `LinkedSkillsMixin` to `connection`, `equipment`, `loot`, and `talent` as per issue #404.
>
> Note on talents: the reporter listed talents as "Maybe Talents too?". Including them means a `PathTalent` can declare its own linked-skills in addition to those provided by its parent `Path`. This is opt-in by GMs (default `linkedSkills: []`) so it doesn't auto-pollute existing data, but the same skill can now appear linked to two items in the character sheet if the GM configures it that way. If you'd prefer to keep talents out of scope, the relevant changes are isolated to `talent.ts` and `talent-details-tab.hbs` — happy to drop them.

## Risques résiduels

- Si une version future de Foundry change le comportement de `cleanData` ou de l'hydration des champs nouveaux, une migration pourrait devenir nécessaire. Très peu probable étant donné que c'est le pattern Foundry V13 documenté.
- Si les mainteneurs préfèrent un sub-mixin par subtype de Talent, il faudra refactor en mixin opt-in. Hors scope actuel.

## Estimation

- Diff total : ~30 lignes
- Fichiers touchés : 6 (4 data + 2 templates)
- 1 commit
- Validation manuelle dans Foundry : ~10 minutes pour les 4 types
