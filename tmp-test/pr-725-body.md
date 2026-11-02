<!--
For Work In Progress Pull Requests, please use the Draft PR feature.
See https://github.blog/2019-02-14-introducing-draft-pull-requests/ for further details.
-->

**Type**  
What type of pull request is this? (e.g., Bug fix, Feature, Refactor, etc.)

- [ ] Bug fix
- [x] Feature
- [ ] Refactor
- [ ] Other (please describe):

**Description**  
Adds `LinkedSkillsMixin` to the `connection`, `equipment`, `loot`, and `talent` item data models, completing the linked-skills feature begun in commit `1aa35e1`. The existing sheet component (`app-item-details-linked-skills`) is reused — no new component code. The two custom Details templates that didn't previously render it (`loot-details-tab.hbs`, `talent-details-tab.hbs`) are extended to invoke the component, and `ConnectionItemSheet` gains a `Details` tab declaration so the new control has a UI surface (the sheet had no Details tab before).

Files changed:
- `src/system/data/item/connection.ts` — `LinkedSkillsMixin()` added to the composition chain
- `src/system/applications/item/connection-sheet.ts` — adds a `Details` tab (was missing)
- `src/system/data/item/equipment.ts` — `LinkedSkillsMixin()` added to the composition chain
- `src/system/data/item/loot.ts` — `LinkedSkillsMixin()` added to the composition chain
- `src/templates/item/loot/partials/loot-details-tab.hbs` — invokes `{{app-item-details-linked-skills}}`
- `src/system/data/item/talent.ts` — `LinkedSkillsMixin()` added to the composition chain
- `src/templates/item/talent/partials/talent-details-tab.hbs` — invokes `{{app-item-details-linked-skills}}`

No new files, no new i18n keys (the existing `COSMERE.Item.General.LinkedSkills.Label` works for all types), no migration (Foundry V13 hydrates `linkedSkills: []` automatically via `cleanData` — verified experimentally, and consistent with how the previous linked-skills commit `1aa35e1` shipped without a migration).

A note on talents: issue #404 lists talents as "Maybe Talents too?". Including them means a `PathTalent` can declare its own linked skills in addition to those provided by its parent `Path`. This is opt-in by GMs (default `linkedSkills: []`) so it does not auto-pollute existing data, but the same skill can now appear linked to two items in the character sheet if a GM configures it that way. If preferred out of scope, the relevant changes are isolated to `talent.ts` and `talent-details-tab.hbs` — happy to drop them.

**Related Issue**  
Closes #404

**How Has This Been Tested?**  
Manual end-to-end validation on Foundry VTT v13.351, for each of the four new item types (connection, equipment, loot, talent):

1. Create an item of the given type, open its sheet, navigate to the Details tab.
2. Confirm the "Linked Skills" control is rendered and accepts skill selections.
3. Save, reopen the sheet, and confirm persistence.
4. Programmatic check: `Item.create({ ..., system: { linkedSkills: [...] } })` is accepted by the schema, and `item.hasLinkedSkills()` returns `true`.
5. Confirmed the control's `name` attribute resolves to `system.linkedSkills` so Foundry form submission round-trips correctly.

CI/local checks:
- `npm run build` — passes
- `npm run typecheck` — passes (baseline unchanged)
- `npm run lint` — passes (baseline unchanged)

**Screenshots (if applicable)**  
End-to-end validation video showing the UI on all four new types:

https://github.com/user-attachments/assets/e206f4fa-2264-4c3c-9703-8c081fba033b

**Checklist:**  
- [x] I have commented on my code, particularly in hard-to-understand areas.
- [x] My changes do not introduce any new warnings or errors.
- [x] My PR does not contain any copyrighted works that I do not have permission to use.
- [x] I have tested my changes on Foundry VTT version: 13.351.

**Additional context**  
This PR currently targets `main`. Per @Khunkurisu's earlier comment, it should be rebased onto the `release/2.2.0` branch — will do so before requesting review. The feature is additive and non-breaking: existing items default to `linkedSkills: []` and existing sheets are unaffected unless a GM populates the new field.
