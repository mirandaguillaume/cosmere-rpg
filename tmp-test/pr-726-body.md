<!--
For Work In Progress Pull Requests, please use the Draft PR feature.
See https://github.blog/2019-02-14-introducing-draft-pull-requests/ for further details.
-->

**Type**  
What type of pull request is this? (e.g., Bug fix, Feature, Refactor, etc.)

- [x] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Other (please describe):

**Description**  
Fixes a stale-snapshot bug in `BaseItemSheet` where in-flight prose-mirror content was lost on re-render when a sibling field change triggered `submitOnChange` (#211). The same root cause was applying to `BaseActorSheet` for the `biography`, `appearance`, and `notes` fields (#724) — and there the data loss also reached persistence, because `onFormEvent` performs a narrow single-field update rather than pushing the full `formData`, so the stale snapshot was being committed back to the actor document.

The fix syncs the in-memory snapshot (`proseDescHtml` on items / `proseFieldHtml` on actors) from the live DOM element at the top of `_prepareContext`, before the re-render replaces the editor. A `querySelector` on `prose-mirror[name="<fieldName>"]` targets only the currently active editor so unrelated fields are not touched.

Files changed:
- `src/system/applications/item/base.ts` — sync `proseDescHtml` in `_prepareContext`; tighten the `onFormEvent` element-type guard; fix the `item-description-tab.hbs` condition to `(and isUpdatingDescription tab.active)`
- `src/system/applications/actor/base.ts` — sync `proseFieldHtml` in `_prepareContext` (same pattern)

**Related Issue**  
Closes #211  
Closes #724

**How Has This Been Tested?**  
Manual reproduction of both bugs on Foundry VTT v13.351, before and after the fix:

1. Item sheet: open any item, click into a description field, type text without saving, then change the item name in another input. Before the fix the typed content disappears on re-render; after the fix it survives.
2. Actor sheet: open a Character or Adversary, click into Biography / Appearance / Notes, type text without saving, then change the actor name in another input. Before the fix the typed content disappears *and* the empty value is persisted to `actor.system.<field>` (verifiable in the browser console). After the fix both the visible editor content and the stored value are preserved.
3. Saving via the prose-mirror toolbar button still commits content normally — no regression to the happy path.
4. Verified the `querySelector` only matches the active editor: editing one prose-mirror field does not touch the snapshot of another.

CI/local checks:
- `tsc --noEmit` — passes
- `npm run build` — passes (baseline unchanged)
- `npm run lint` — passes (baseline unchanged)

**Screenshots (if applicable)**  
N/A — the bug is invisible by definition (content disappears). Reproduction is described in the testing steps above.

**Checklist:**  
- [x] I have commented on my code, particularly in hard-to-understand areas.
- [x] My changes do not introduce any new warnings or errors.
- [x] My PR does not contain any copyrighted works that I do not have permission to use.
- [x] I have tested my changes on Foundry VTT version: 13.351.

**Additional context**  
The fix is purely defensive — it reads the live DOM before the framework discards it — and has no effect when no prose-mirror field is currently being edited. Two related issues (#211 and #724) share the same root cause, hence one PR closing both.
