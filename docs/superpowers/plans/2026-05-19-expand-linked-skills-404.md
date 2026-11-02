# Expand Linked-Skills To More Item Types (issue #404) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre le mixin `LinkedSkillsMixin` aux types d'items `connection`, `equipment`, `loot`, `talent` (issue #404), en réutilisant le composant sheet existant et sans toucher à la logique actor.

**Architecture:** Trois changements de très bas niveau : (a) composer `LinkedSkillsMixin()` dans chacune des 4 classes de data model, (b) ajouter `& LinkedSkillsItemDataSchema` à leurs types, (c) ajouter `{{app-item-details-linked-skills}}` dans les 2 templates custom (`loot-details-tab.hbs` et `talent-details-tab.hbs`). Les 2 autres types (`connection`, `equipment`) utilisent le template partagé qui invoque déjà le composant. Le composant `app-item-details-linked-skills` auto-gate son rendu via `hasLinkedSkills()` → aucune modification de logique.

**Tech Stack:** TypeScript, Foundry VTT V13 data models (foundry.abstract.TypeDataModel), mixin composition pattern, Handlebars.

**Spec reference:** `docs/superpowers/specs/2026-05-19-expand-linked-skills-404-design.md`

**Validation manuelle requise:** Aucune infra de tests sheet automatisés dans le repo. La vérification se fait par build/typecheck/lint + manipulation dans Foundry.

**Important — politique du repo (issue de la mémoire utilisateur):**
- **Ne PAS committer** ce plan ni le spec doc. Les fichiers dans `docs/superpowers/` restent sur disque pendant le travail, jamais `git add`.
- Pas de mention de Claude/AI dans les commits ou la PR.
- Pas de `Co-Authored-By` trailers.

---

## File Structure

**Modify:**
- `src/system/data/item/connection.ts` — ajout import + type + appel mixin
- `src/system/data/item/equipment.ts` — idem
- `src/system/data/item/loot.ts` — idem
- `src/system/data/item/talent.ts` — idem
- `src/templates/item/loot/partials/loot-details-tab.hbs` — ajout 1 ligne d'appel composant
- `src/templates/item/talent/partials/talent-details-tab.hbs` — idem

**Create:** rien.

**Delete:** rien.

---

## Pre-flight

### Task 0: Préparer la branche

**Files:**
- Repo `/home/gumiranda/cosmere-rpg` (main repo, pas de worktree nécessaire vu la taille).

- [ ] **Step 0.1: Vérifier qu'on part d'un état propre sur main**

```bash
cd /home/gumiranda/cosmere-rpg
git status --short
```

Expected: éventuellement les modifications locales pré-existantes (`.gitignore`, `package-lock.json`, `docker-compose.yml`, `.claude/`, `docs/superpowers/`) qu'on laisse intactes. Aucun fichier de `src/` ou `tests/` modifié.

- [ ] **Step 0.2: Aller sur main et fetch**

```bash
git checkout main
git fetch origin main
git pull --ff-only origin main
```

Expected: branche `main` à jour avec `origin/main`.

- [ ] **Step 0.3: Créer la branche de feature**

```bash
git checkout -b feat/expand-linked-skills-404
```

Expected: `Switched to a new branch 'feat/expand-linked-skills-404'`.

- [ ] **Step 0.4: Baseline typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
```

Expected:
- TS error count : noter le chiffre (probablement 64 d'après les sessions précédentes). C'est la baseline à NE PAS dépasser.
- Lint : `ESLint: No issues found`.

---

## Task 1: Ajouter le mixin à Connection

**Files:**
- Modify: `src/system/data/item/connection.ts`

Pourquoi : `connection.ts` utilise déjà le template partagé `item-details-tab.hbs` (via `ITEM_BASE_CONTENT`), qui contient déjà `{{app-item-details-linked-skills}}`. Donc seul le data model a besoin de la modification.

- [ ] **Step 1.1: Lire l'état actuel pour confirmer le point d'insertion**

```bash
cat src/system/data/item/connection.ts
```

Expected: fichier qui imports `DescriptionItemMixin`, `EventsItemMixin`, `RelationshipsMixin` et les compose via `DataModelMixin`.

- [ ] **Step 1.2: Appliquer les modifications**

Remplacer le contenu de `src/system/data/item/connection.ts` par :

```ts
import { CosmereItem } from '@src/system/documents';

// Mixins
import { DataModelMixin } from '../mixins';
import {
    DescriptionItemMixin,
    DescriptionItemDataSchema,
} from './mixins/description';
import { EventsItemMixin, EventsItemDataSchema } from './mixins/events';
import {
    RelationshipsMixin,
    RelationshipsItemDataSchema
} from './mixins/relationships';
import {
    LinkedSkillsMixin,
    LinkedSkillsItemDataSchema,
} from './mixins/linked-skills';

export type ConnectionItemDataSchema =
    & DescriptionItemDataSchema
    & EventsItemDataSchema
    & RelationshipsItemDataSchema
    & LinkedSkillsItemDataSchema;

export class ConnectionItemDataModel extends DataModelMixin<
    ConnectionItemDataSchema
>(
    DescriptionItemMixin({
        value: 'COSMERE.Item.Type.Connection.desc_placeholder',
    }),
    EventsItemMixin(),
    RelationshipsMixin(),
    LinkedSkillsMixin(),
) {}
```

- [ ] **Step 1.3: Vérifier typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
```

Expected: même count d'erreurs TS que la baseline (Step 0.4) + `ESLint: No issues found`.

- [ ] **Step 1.4: Commit**

```bash
git add src/system/data/item/connection.ts
git commit -m "feat(connection): support linked skills

Ajoute LinkedSkillsMixin au data model Connection pour permettre aux
contacts/relations sociales de fournir des linked skills au character
qui les possede. Pas de changement template (utilise item-details-tab.hbs
partage qui invoque deja le composant).

Refs #404"
```

---

## Task 2: Ajouter le mixin à Equipment

**Files:**
- Modify: `src/system/data/item/equipment.ts`

Pourquoi : `equipment.ts` utilise aussi le template partagé. Pattern strictement identique à Connection.

- [ ] **Step 2.1: Lire l'état actuel**

```bash
cat src/system/data/item/equipment.ts
```

Expected: fichier qui imports plusieurs mixins (DescriptionItemMixin, EquippableItemMixin, PhysicalItemMixin, EventsItemMixin, etc.).

- [ ] **Step 2.2: Appliquer les 3 modifications ciblées**

**Modification 2.2.a — ajouter l'import** après le bloc d'imports `RelationshipsMixin` :

Remplacer :

```ts
import {
    RelationshipsMixin,
    RelationshipsItemDataSchema,
} from './mixins/relationships';

export type EquipmentItemDataSchema = 
    & TypedItemDataSchema<EquipmentType>
```

par :

```ts
import {
    RelationshipsMixin,
    RelationshipsItemDataSchema,
} from './mixins/relationships';
import {
    LinkedSkillsMixin,
    LinkedSkillsItemDataSchema,
} from './mixins/linked-skills';

export type EquipmentItemDataSchema = 
    & TypedItemDataSchema<EquipmentType>
```

**Modification 2.2.b — étendre le type composé** (convention : `LinkedSkills` AVANT `Relationships`) :

Remplacer :

```ts
    & EventsItemDataSchema
    & RelationshipsItemDataSchema;

export type EquipmentItemDerivedData = 
```

par :

```ts
    & EventsItemDataSchema
    & LinkedSkillsItemDataSchema
    & RelationshipsItemDataSchema;

export type EquipmentItemDerivedData = 
```

**Modification 2.2.c — ajouter le mixin à la composition** (convention : `LinkedSkillsMixin()` AVANT `RelationshipsMixin()`) :

Remplacer :

```ts
    EventsItemMixin(),
    RelationshipsMixin(),
) {}
```

par :

```ts
    EventsItemMixin(),
    LinkedSkillsMixin(),
    RelationshipsMixin(),
) {}
```

- [ ] **Step 2.3: Vérifier typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
```

Expected: même count d'erreurs TS que la baseline + `ESLint: No issues found`.

- [ ] **Step 2.4: Commit**

```bash
git add src/system/data/item/equipment.ts
git commit -m "feat(equipment): support linked skills

Ajoute LinkedSkillsMixin au data model Equipment. Les equipements
utilitaires (sac, lampe, corde, etc.) peuvent maintenant fournir des
linked skills au character qui les possede. Pas de changement template
(utilise item-details-tab.hbs partage qui invoque deja le composant).

Refs #404"
```

---

## Task 3: Ajouter le mixin à Loot + appel composant dans son template

**Files:**
- Modify: `src/system/data/item/loot.ts`
- Modify: `src/templates/item/loot/partials/loot-details-tab.hbs`

Pourquoi : `loot.ts` utilise `ITEM_LOOT_CONTENT` (template custom) qui inclut `{{> loot-details-tab}}`. Le `loot-details-tab.hbs` actuel n'invoque pas le composant linked-skills, on doit l'ajouter manuellement.

- [ ] **Step 3.1: Modifier le data model**

Remplacer le contenu de `src/system/data/item/loot.ts` par :

```ts
import { CosmereItem } from '@src/system/documents';
import { EmptyObject } from '@system/types/utils';

// Mixins
import { DataModelMixin } from '../mixins';
import {
    DescriptionItemMixin,
    DescriptionItemDataSchema,
} from './mixins/description';
import { PhysicalItemMixin, PhysicalItemDataSchema, PhysicalItemDerivedData } from './mixins/physical';
import { EventsItemMixin, EventsItemDataSchema } from './mixins/events';
import {
    RelationshipsMixin,
    RelationshipsItemDataSchema,
} from './mixins/relationships';
import {
    LinkedSkillsMixin,
    LinkedSkillsItemDataSchema,
} from './mixins/linked-skills';

const SCHEMA = () => ({
    isMoney: new foundry.data.fields.BooleanField({
        required: true,
        initial: false,
        label: 'COSMERE.Item.Loot.isMoney',
        nullable: false,
    }),
});

export type LootItemDataSchema =
    & ReturnType<typeof SCHEMA>
    & DescriptionItemDataSchema
    & PhysicalItemDataSchema
    & EventsItemDataSchema
    & LinkedSkillsItemDataSchema
    & RelationshipsItemDataSchema;

export type LootItemDerivedData = PhysicalItemDerivedData;

export class LootItemDataModel extends DataModelMixin<
    LootItemDataSchema,
    foundry.abstract.Document.Any,
    EmptyObject,
    LootItemDerivedData
>(
    DescriptionItemMixin({
        value: 'COSMERE.Item.Type.Loot.desc_placeholder',
    }),
    PhysicalItemMixin(),
    EventsItemMixin(),
    LinkedSkillsMixin(),
    RelationshipsMixin(),
) {
    static defineSchema() {
        return foundry.utils.mergeObject(super.defineSchema(), SCHEMA());
    }
}
```

- [ ] **Step 3.2: Modifier le template Loot**

Dans `src/templates/item/loot/partials/loot-details-tab.hbs`, insérer `{{app-item-details-linked-skills}}` juste après l'ouverture du `<fieldset>` (avant le `<div class="item-details-form">`) :

Remplacer :

```hbs
{{#with (lookup tabsMap "details") as |tab|}}
<div class="tab tab-content {{tab.cssClass}}" data-tab="details" data-group="primary">
    <fieldset>
        <legend>{{localize "COSMERE.Item.Type.Loot.label"}}</legend>
        <div class="item-details-form">
```

par :

```hbs
{{#with (lookup tabsMap "details") as |tab|}}
<div class="tab tab-content {{tab.cssClass}}" data-tab="details" data-group="primary">
    <fieldset>
        <legend>{{localize "COSMERE.Item.Type.Loot.label"}}</legend>
        {{app-item-details-linked-skills}}
        <div class="item-details-form">
```

Le reste du fichier reste inchangé.

- [ ] **Step 3.3: Vérifier typecheck + lint + build**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
npm run build 2>&1 | tail -3
```

Expected:
- TS count = baseline
- Lint clean
- Build : `created build in <N>s`

- [ ] **Step 3.4: Commit**

```bash
git add src/system/data/item/loot.ts src/templates/item/loot/partials/loot-details-tab.hbs
git commit -m "feat(loot): support linked skills

Ajoute LinkedSkillsMixin au data model Loot, et invoque le composant
app-item-details-linked-skills dans loot-details-tab.hbs (template
custom qui n'utilise pas item-details-tab.hbs partage). Permet aux
items de butin de fournir des linked skills au character possesseur.

Refs #404"
```

---

## Task 4: Ajouter le mixin à Talent + appel composant dans son template

**Files:**
- Modify: `src/system/data/item/talent.ts`
- Modify: `src/templates/item/talent/partials/talent-details-tab.hbs`

Pourquoi : pattern identique à Loot — Talent a un template custom qui n'invoque pas le composant linked-skills.

**Note tradeoff documenté dans le spec :** ce changement permet à un `PathTalent` de déclarer ses propres linked-skills en plus de celles fournies par son `Path` parent. C'est un effet de bord GM-configurable, signalé dans la PR description (voir Task 6).

- [ ] **Step 4.1: Lire l'état actuel de talent.ts**

```bash
cat src/system/data/item/talent.ts
```

Expected: fichier de ~125 lignes qui définit `TalentItemDataModel` avec un `prepareDerivedData()` qui gère `hasPath`, `hasAncestry`, `hasPower`.

- [ ] **Step 4.2: Appliquer les 3 modifications ciblées**

**Modification 4.2.a — ajouter l'import** après le bloc d'imports `RelationshipsMixin` :

Remplacer :

```ts
import {
    RelationshipsMixin,
    RelationshipsItemDataSchema,
} from './mixins/relationships';

const SCHEMA = () => ({
```

par :

```ts
import {
    RelationshipsMixin,
    RelationshipsItemDataSchema,
} from './mixins/relationships';
import {
    LinkedSkillsMixin,
    LinkedSkillsItemDataSchema,
} from './mixins/linked-skills';

const SCHEMA = () => ({
```

**Modification 4.2.b — étendre le type composé** (convention : `LinkedSkills` AVANT `Relationships`) :

Remplacer :

```ts
    & EventsItemDataSchema
    & RelationshipsItemDataSchema;

export type TalentItemDerivedData = TypedItemDerivedData & {
```

par :

```ts
    & EventsItemDataSchema
    & LinkedSkillsItemDataSchema
    & RelationshipsItemDataSchema;

export type TalentItemDerivedData = TypedItemDerivedData & {
```

**Modification 4.2.c — ajouter le mixin à la composition** (convention : `LinkedSkillsMixin()` AVANT `RelationshipsMixin()`) :

Remplacer :

```ts
    EventsItemMixin(),
    RelationshipsMixin(),
) {
    static defineSchema() {
```

par :

```ts
    EventsItemMixin(),
    LinkedSkillsMixin(),
    RelationshipsMixin(),
) {
    static defineSchema() {
```

- [ ] **Step 4.3: Modifier le template Talent**

Dans `src/templates/item/talent/partials/talent-details-tab.hbs`, le composant doit être placé juste après l'appel `{{app-item-details-type}}` pour cohérence avec le template partagé qui place `linked-skills` après `id` et `type`.

Remplacer :

```hbs
        {{app-item-details-id}}
        {{app-item-details-type}}
        <div class="item-details-form">
```

par :

```hbs
        {{app-item-details-id}}
        {{app-item-details-type}}
        {{app-item-details-linked-skills}}
        <div class="item-details-form">
```

Le reste du fichier reste inchangé.

- [ ] **Step 4.4: Vérifier typecheck + lint + build**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
npm run build 2>&1 | tail -3
```

Expected:
- TS count = baseline
- Lint clean
- Build OK

- [ ] **Step 4.5: Commit**

```bash
git add src/system/data/item/talent.ts src/templates/item/talent/partials/talent-details-tab.hbs
git commit -m "feat(talent): support linked skills

Ajoute LinkedSkillsMixin au data model Talent, et invoque le composant
app-item-details-linked-skills dans talent-details-tab.hbs. Un Talent
peut maintenant declarer ses propres linked skills.

Note: pour un PathTalent dont le Path parent fournit deja des linked
skills, le GM peut configurer des skills supplementaires sur le
talent. La meme skill peut alors apparaitre liee a plusieurs items
dans la fiche actor. C'est intentionnel et opt-in (defaut: liste vide).

Refs #404"
```

---

## Task 5: Build + validation manuelle dans Foundry

**Files:** aucun changement de code.

- [ ] **Step 5.1: Build final + sanity check**

```bash
npm run build 2>&1 | tail -3
```

Expected: `created build in <N>s`.

- [ ] **Step 5.2: Vérifier que Foundry voit le nouveau build**

Le container Docker `cosmere-foundry` monte `/home/gumiranda/cosmere-rpg/build` en read-only. Puisqu'on travaille directement dans le main repo (pas worktree), le mount est déjà bon. Pas de `cp` à faire.

```bash
docker ps --filter name=cosmere-foundry --format '{{.Status}}'
stat -c '%y' build/index.js
```

Expected: container Up, `build/index.js` modifié à l'instant.

- [ ] **Step 5.3: Plan de validation manuelle dans Foundry**

À exécuter dans le browser (`http://localhost:30000`) :

| Scénario | Étapes | Attendu |
|---|---|---|
| Connection | Créer un nouveau Connection item, ouvrir l'onglet Details | Section « Linked Skills » présente avec sélecteur multi-skill |
| Equipment | Idem avec Equipment | Idem |
| Loot | Idem avec Loot (essayer aussi `isMoney=true`) | Section linked-skills présente dans les deux cas |
| Talent | Idem avec Talent (essayer les 3 subtypes : PathTalent, AncestryTalent, PowerTalent) | Section présente sur les 3 subtypes |
| Consommation actor | Possessivement linker une skill non-core (ex: Lore, Discipline) sur 1 item de chaque type, ouvrir un Character qui a unlock cette skill | Les 4 items doivent apparaître dans la section linked-items du sheet character |
| Path/PathTalent doublon | Créer un Path X avec linkedSkill=Lore, créer un PathTalent enfant du Path X avec linkedSkill=Lore, ouvrir le character | La skill Lore doit apparaître liée à plusieurs items (intentionnel) |

- [ ] **Step 5.4: Documenter les résultats**

Tenir un mini-rapport mental (ou un fichier scratch) avec OK/FAIL pour chaque scénario. Aucun ne doit échouer. Si l'un échoue, retourner aux Tasks 1-4 pour identifier la cause et corriger.

---

## Task 6: Push fork + ouvrir PR contre upstream

**Files:** aucun changement de code.

- [ ] **Step 6.1: Vérifier l'historique et le diff total**

```bash
git log --oneline origin/main..HEAD
git diff origin/main..HEAD --stat
```

Expected:
- 4 commits (1 par item type)
- ~6 fichiers touchés au total
- Diff total ~30 lignes

- [ ] **Step 6.2: Push sur le fork**

```bash
git push -u fork feat/expand-linked-skills-404
```

Expected: branche poussée, output indiquant l'URL fork.

- [ ] **Step 6.3: Créer la PR contre upstream**

```bash
gh pr create --repo the-metalworks/cosmere-rpg \
  --base main --head mirandaguillaume:feat/expand-linked-skills-404 \
  --title "feat: expand linked-skills support to connection, equipment, loot, talent (#404)" \
  --body "$(cat <<'EOF'
## Summary
Adds `LinkedSkillsMixin` to the `connection`, `equipment`, `loot`, and `talent` data models as per issue #404. The existing sheet component (`app-item-details-linked-skills`) is reused; `loot-details-tab.hbs` and `talent-details-tab.hbs` are extended to invoke it.

## Files changed
- `src/system/data/item/connection.ts`
- `src/system/data/item/equipment.ts`
- `src/system/data/item/loot.ts`
- `src/system/data/item/talent.ts`
- `src/templates/item/loot/partials/loot-details-tab.hbs`
- `src/templates/item/talent/partials/talent-details-tab.hbs`

No new files, no new i18n keys, no migration (Foundry V13 hydrates `linkedSkills: []` automatically via `cleanData` — verified experimentally and consistent with how previous linked-skills commit `1aa35e1` was shipped).

## Note on talents
The reporter listed talents as "Maybe Talents too?". Including them means a `PathTalent` can declare its own linked-skills in addition to those provided by its parent `Path`. This is opt-in by GMs (default `linkedSkills: []`) so it doesn't auto-pollute existing data, but the same skill can now appear linked to two items in the character sheet if the GM configures it that way. If you'd prefer to keep talents out of scope, the relevant changes are isolated to \`talent.ts\` and \`talent-details-tab.hbs\` — happy to drop them.

## Test plan
- [ ] Create one item of each new type, configure a non-core linked skill on each
- [ ] Open a Character sheet that owns the items and has unlocked the relevant skill
- [ ] Verify each item appears in the character's skill-linked-items section
- [ ] Verify Loot with \`isMoney=true\` still works (sémantique laissée volontairement uniforme)
- [ ] Verify Talent subtypes (PathTalent, AncestryTalent, PowerTalent) all expose the section

Closes #404
EOF
)"
```

**Note importante :** `--body` utilise un HEREDOC pour la mise en forme. Les backticks `\`talent.ts\`` sont échappés pour éviter l'interprétation shell. Vérifier le rendu après création.

Expected: `gh` retourne l'URL de la PR créée.

- [ ] **Step 6.4: Vérifier le rendu de la PR**

Ouvrir l'URL retournée dans le browser, vérifier :
- Titre correct
- Body bien formaté (backticks rendus correctement, paragraphes séparés)
- Closes #404 référence bien l'issue
- Les 4 commits sont visibles dans l'onglet Commits

---

## Self-Review

### Spec coverage

Le spec doc (`docs/superpowers/specs/2026-05-19-expand-linked-skills-404-design.md`) liste :
- **Architecture cible** → couvert par les Tasks 1-4 (chaque type d'item est composé avec le mixin)
- **Changements données 4 fichiers** → Tasks 1, 2, 3, 4 respectivement
- **Changements templates 2 fichiers** → Tasks 3 (loot) et 4 (talent)
- **Pas de migration** → noté dans Task 5 (validation), pas d'étape de migration créée
- **Pas de nouvelle clé i18n** → réutilise `COSMERE.Item.General.LinkedSkills.Label` (existant)
- **Sémantique uniforme** → aucun check additionnel ajouté, conforme au spec
- **Effet de bord Path/PathTalent assumé** → mentionné dans le commit message de Task 4 ET dans la note PR de Task 6
- **Validation manuelle 5 scénarios** → Task 5 décrit le plan de test précis
- **Note PR pré-rédigée** → reprise telle quelle dans Task 6

Aucun gap identifié.

### Placeholder scan

Aucun « TBD », « TODO », « fill in », ni instructions vagues. Tous les changements sont des diffs précis avec code complet ou modifications ciblées explicitées.

### Type consistency

Les types utilisés à travers les tâches :
- `LinkedSkillsMixin` (fonction sans argument retournant un mixin) — utilisé partout pareil
- `LinkedSkillsItemDataSchema` (type) — utilisé partout pareil
- `DataModelMixin<TSchema>(...mixins)` — pattern existant respecté
- `& LinkedSkillsItemDataSchema` — composition par intersection, identique partout

Aucune incohérence.

### Risques résiduels

- **Equipment.ts et Talent.ts pas réécrits complètement** dans le plan (Steps 2.2 et 4.2) : on indique « ne pas réécrire le fichier complet, faire les 3 modifications ciblées ». L'engineer doit lire le fichier complet d'abord pour respecter les conventions existantes. C'est un choix volontaire pour ne pas surcharger le plan avec du code redondant et risquer un mismatch avec l'état actuel du fichier.
- **Path/PathTalent doublon visuel** : assumé et documenté dans la PR. Si les mainteneurs refusent, le revert de Task 4 est trivial.
- **Mount Docker** : le plan suppose qu'on travaille dans le main repo `/home/gumiranda/cosmere-rpg` (pas un worktree), ce qui rend le mount Docker live sans `cp` manuel. Si l'engineer choisit un worktree, il devra copier `build/` vers le main repo après chaque rebuild — non couvert ici.
