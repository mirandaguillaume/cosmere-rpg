# Fix Item Description Edit Reset (Issue #211) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner le comportement de `BaseItemSheet` sur celui de `BaseActorSheet` pour la gestion de l'éditeur ProseMirror de description, en supprimant les régressions liées à `submitOnChange`.

**Architecture:** Trois changements ciblés sur `src/system/applications/item/base.ts` et `src/templates/item/partials/item-description-tab.hbs`. (1) Remplacer la détection fragile par classe CSS par un `instanceof HTMLProseMirrorElement` (motif actor). (2) Filtrer les events `onFormEvent` aux mêmes types que l'actor pour éviter des updates parasites. (3) Quand on n'édite pas le prose-mirror lui-même mais qu'on est en mode édition de description, exclure les champs `system.description.*` du payload pour éviter le round-trip qui écrase la description en base. (4) Aligner la template avec la condition `(and isUpdatingDescription tab.active)` comme l'actor.

**Tech Stack:** TypeScript, Foundry VTT ApplicationV2, Handlebars, ProseMirror (custom element `<prose-mirror>` de Foundry V13).

**Validation manuelle requise:** Le projet n'a pas de tests unitaires couvrant les sheets — la vérification se fait par build + manipulation dans Foundry. Le plan privilégie des changements isolés et minimaux pour limiter le risque.

---

## File Structure

- **Modify** `src/system/applications/item/base.ts` — alignement de `onFormEvent` sur la version actor (détection prose-mirror, filtrage events, exclusion des champs description sur events non-prose-mirror).
- **Modify** `src/templates/item/partials/item-description-tab.hbs` — ajout du `tab.active` dans la condition d'affichage du prose-mirror (cohérence avec `char-notes-tab.hbs` / `adv-notes-tab.hbs`).
- **No new test files** — pas d'infra de tests sheets dans le repo. La vérification est manuelle.

---

## Pre-flight

### Task 0: Préparer la branche

**Files:**
- Repo: travail dans le worktree actuel (`refactor/talent-remove-path-ancestry-314`) est inadapté. On part d'une nouvelle branche depuis `main`.

- [ ] **Step 0.1: Stash éventuels changements et créer la branche**

```bash
git status --short
# Si propre :
git checkout main
git pull --ff-only origin main
git checkout -b fix/item-description-edit-reset-211
```

Expected: `Switched to a new branch 'fix/item-description-edit-reset-211'`.

- [ ] **Step 0.2: Installer dépendances si pas à jour**

```bash
npm ci
```

Expected: pas d'erreurs, `node_modules` présent.

---

## Task 1 — Aligner la détection ProseMirror dans `onFormEvent`

**Files:**
- Modify: `src/system/applications/item/base.ts:90-271` (méthode `onFormEvent`)

Pourquoi : la détection actuelle `(event.target as HTMLElement).className.includes('prosemirror')` ne fonctionne jamais parce que `<prose-mirror>` (custom element Foundry V13) n'a pas de classe `prosemirror`. Conséquence : `saveDescription()` n'est jamais déclenché par un event de sauvegarde de l'éditeur — le mode édition reste actif après un Save (bug rapporté par Doc-Sun dans les commentaires de l'issue). On remplace par le test d'instance utilisé dans `BaseActorSheet.onFormEvent`.

- [ ] **Step 1.1: Remplacer le bloc de détection prose-mirror**

Dans `src/system/applications/item/base.ts`, dans la méthode `onFormEvent`, remplacer :

```ts
        if (event instanceof SubmitEvent) return;

        // Handle prose mirror saving via hotkey
        if ((event.target as HTMLElement).className.includes('prosemirror')) {
            await this.saveDescription();
        }

        if (!('name' in event.target!)) return;
```

par :

```ts
        if (event instanceof SubmitEvent) return;

        // Filter to relevant form-control element types only.
        if (
            !(event.target instanceof HTMLInputElement) &&
            !(event.target instanceof HTMLTextAreaElement) &&
            !(event.target instanceof HTMLSelectElement) &&
            !(
                event.target instanceof
                foundry.applications.elements.HTMLProseMirrorElement
            )
        )
            return;
        if (!event.target.name) return;

        // Handle prose-mirror fields separately: exit edit mode after the
        // editor commits its content to the form value.
        if (
            event.target instanceof
            foundry.applications.elements.HTMLProseMirrorElement
        ) {
            await this.saveDescription();
        }
```

- [ ] **Step 1.2: Vérifier le typecheck**

```bash
npx tsc --noEmit
```

Expected: aucune erreur. (Si une erreur survient sur `HTMLProseMirrorElement`, vérifier `node_modules/.../@league-of-foundry-developers/foundry-vtt-types` — l'actor s'en sert déjà, donc le type doit exister.)

- [ ] **Step 1.3: Commit**

```bash
git add src/system/applications/item/base.ts
git commit -m "fix(item-sheet): detect prose-mirror via instanceof

Aligne BaseItemSheet.onFormEvent sur BaseActorSheet : la verification
par className.includes('prosemirror') etait toujours fausse pour le
custom element <prose-mirror>, donc saveDescription() n'etait jamais
declenche par un commit de l'editeur. Utilisation de instanceof
HTMLProseMirrorElement comme dans l'actor.

Refs #211"
```

---

## Task 2 — Empêcher l'écrasement de la description par les autres champs

**Files:**
- Modify: `src/system/applications/item/base.ts` (méthode `onFormEvent`, juste avant `void this.item.update(formData.object);`)

Pourquoi : avec `submitOnChange: true`, modifier le titre (ou tout autre champ) déclenche `onFormEvent`. `formData.object` contient les `system.description.*` à leur valeur **committée** dans le prose-mirror (l'ancienne valeur, vu que le texte en cours d'édition n'est pas encore committé). `this.item.update(formData.object)` réécrit alors la description avec l'ancienne valeur. Quand on est en mode édition, ce round-trip provoque l'effet rapporté (perte de l'avancement). On exclut les champs description quand l'event ne provient pas du prose-mirror.

- [ ] **Step 2.1: Ajouter le filtrage juste avant `this.item.update`**

Dans `src/system/applications/item/base.ts`, dans `onFormEvent`, à la fin (juste avant `// Update the document` / `void this.item.update(formData.object);`), insérer :

```ts
        // If we're in the middle of editing a description and the event
        // didn't come from the prose-mirror itself, drop description fields
        // from the payload so the in-flight editor content isn't rolled
        // back by the form's last-committed value.
        if (
            this.updatingDescription &&
            !(
                event.target instanceof
                foundry.applications.elements.HTMLProseMirrorElement
            )
        ) {
            formData.delete('system.description.value');
            formData.delete('system.description.short');
            formData.delete('system.description.chat');
        }
```

(Le reste de la méthode est inchangé : `void this.item.update(formData.object);` reste tel quel.)

- [ ] **Step 2.2: Vérifier le typecheck**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 2.3: Commit**

```bash
git add src/system/applications/item/base.ts
git commit -m "fix(item-sheet): preserve description during sibling field edits

Quand l'utilisateur edite la description et modifie un autre champ
(titre, prix, etc.), submitOnChange envoyait toute la formData a
item.update, ecrasant system.description.* avec la valeur committee
du prose-mirror (l'ancienne, le texte tape n'etait pas encore
committe). On exclut les champs description du payload quand l'event
ne provient pas du prose-mirror.

Refs #211"
```

---

## Task 3 — Aligner la template sur le motif actor

**Files:**
- Modify: `src/templates/item/partials/item-description-tab.hbs:3`

Pourquoi : les templates actor (`char-notes-tab.hbs`, `adv-notes-tab.hbs`) utilisent `(and isUpdatingHtmlField tab.active)`. Pour l'item on n'utilise que `isUpdatingDescription`. Aligner par cohérence et pour qu'un éventuel render partiel ne réinjecte pas le prose-mirror dans un onglet inactif.

- [ ] **Step 3.1: Modifier la condition**

Dans `src/templates/item/partials/item-description-tab.hbs`, remplacer :

```hbs
    {{#if @root.isUpdatingDescription}}
    <prose-mirror name="{{@root.proseDescName}}" data-document-u-u-i-d="{{@root.item.uuid}}"
         value = "{{@root.proseDescHtml}}" collaborate="true">
        {{{@root.proseDescHtml}}}
    </prose-mirror>
    {{else}}
```

par :

```hbs
    {{#if (and @root.isUpdatingDescription tab.active)}}
    <prose-mirror name="{{@root.proseDescName}}" data-document-u-u-i-d="{{@root.item.uuid}}"
         value = "{{@root.proseDescHtml}}" collaborate="true">
        {{{@root.proseDescHtml}}}
    </prose-mirror>
    {{else}}
```

- [ ] **Step 3.2: Commit**

```bash
git add src/templates/item/partials/item-description-tab.hbs
git commit -m "refactor(item-sheet): align description tab with actor template

Utilise (and isUpdatingDescription tab.active) comme le font les
templates char-notes-tab et adv-notes-tab. Evite que le prose-mirror
ne soit rendu sur un onglet inactif.

Refs #211"
```

---

## Task 4 — Build et validation manuelle

**Files:**
- No file changes.

- [ ] **Step 4.1: Build complet**

```bash
npm run build
```

Expected: build OK (les warnings éventuels sont OK tant qu'il n'y a pas d'erreurs).

- [ ] **Step 4.2: Lint**

```bash
npm run lint
```

Expected: pas de nouvelle erreur introduite (les erreurs préexistantes peuvent rester).

- [ ] **Step 4.3: Plan de test manuel à exécuter dans Foundry**

Documenter les étapes (à exécuter par le testeur, pas par l'agent) :

1. Démarrer Foundry (instance hostée si possible pour reproduire le contexte du bug rapporté), charger le world avec le système Cosmere-RPG.
2. Ouvrir un item existant qui a déjà une description (ex: une arme).
3. Cliquer sur l'icône d'édition de la description longue → l'éditeur ProseMirror s'ouvre.
4. **Test A — Sauvegarde directe** : taper du nouveau texte, cliquer sur Save dans la toolbar de l'éditeur. Attendu : l'éditeur se ferme et la description affichée est bien la nouvelle valeur. (Avant fix : l'éditeur reste ouvert et la description revient à l'ancienne valeur — bug Doc-Sun.)
5. **Test B — Édition d'un autre champ pendant l'édition** : rouvrir l'éditeur de description, taper du texte, puis sans cliquer Save aller modifier le titre dans le header. Attendu : la description en base ne doit pas avoir été écrasée par l'ancienne valeur. L'éditeur reste ouvert (comportement actor). Cliquer Save commit le nouveau contenu.
6. **Test C — Changement d'onglet pendant l'édition** : rouvrir l'éditeur, taper, puis cliquer sur l'onglet Details. Attendu : pas de crash. Revenir sur Description : l'éditeur peut être réouvert proprement.
7. **Test D — Non-régression sur les autres handlers spéciaux** : tester une modification de prix (équipement), une modification de trait avec expertise (arme/armure), une modification d'activation/consumption (action). Attendu : aucun comportement modifié vs avant.

- [ ] **Step 4.4: Si le build/lint passe et qu'un testeur humain confirme le plan de test, créer la PR**

```bash
git push -u origin fix/item-description-edit-reset-211
gh pr create --title "fix(item-sheet): description editor reverts when editing other fields" --body "$(cat <<'EOF'
## Summary
- Aligne `BaseItemSheet.onFormEvent` sur `BaseActorSheet` : detection ProseMirror via `instanceof HTMLProseMirrorElement` (l'ancienne detection par className ne matchait jamais).
- Exclut `system.description.*` du payload `item.update` quand l'event ne vient pas du prose-mirror et qu'on est en mode edition, pour eviter le round-trip qui ecrase la description.
- Aligne le template description avec celui de l'actor : `(and isUpdatingDescription tab.active)`.

## Test plan
- [ ] Editer la description longue d'un equipement existant puis cliquer Save dans l'editeur de ProseMirror -> editeur ferme, nouveau texte visible.
- [ ] Editer la description, taper du texte, puis modifier le titre dans le header -> la description en base n'est pas ecrasee par l'ancienne valeur.
- [ ] Modifier prix / trait avec expertise / activation -> comportement inchange vs avant.

Closes #211
EOF
)"
```

---

## Self-Review

- **Spec coverage**:
  - Issue #211 expected behavior: "Description should leave edit mode" — non strictement implémenté (utilisateur a demandé "pareil que actor" → l'actor reste en mode édition). Documenté dans le plan ; à confirmer par le mainteneur.
  - Commentaire de Doc-Sun (Save efface) → couvert par Task 1.
  - Commentaire de LLilliputian (edition d'un autre champ écrase la description) → couvert par Task 2.
- **Placeholder scan**: aucun TBD/TODO/"fill in".
- **Type consistency**: `HTMLProseMirrorElement` est référencé via `foundry.applications.elements.HTMLProseMirrorElement` (même fully-qualified name que dans `actor/base.ts:290`).
- **Risques résiduels documentés** :
  - Le texte en cours de frappe (non committé dans le prose-mirror) reste perdu sur re-render. C'est aussi le comportement de l'actor et n'a pas été demandé pour ce fix.
  - Le filtrage des events (instanceof input/textarea/select/prose-mirror) restreint la portée par rapport à l'ancien code. Si une `<input>` custom était utilisée ailleurs, elle serait désormais ignorée. Aucune trace d'un tel cas dans le code des item sheets.
