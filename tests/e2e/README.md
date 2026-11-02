# E2E test — PR #726 (prose-mirror description save)

End-to-end regression test that drives a **real Foundry VTT v13** in a browser
(Playwright) and proves the `_canRender` fix: editing an item description, then
forcing an *external* re-render mid-edit, must still **persist** on save.

It is self-contained and **not** part of the system build (own `package.json`).

## What it checks

`prosemirror-save.spec.ts`:

1. Joins the `test` world as a GM.
2. Creates a `loot` item and opens its sheet on the Description tab.
3. Clicks the edit (feather) action and types into the `<prose-mirror>` editor.
4. Triggers an **external** `item.update(...)` while the editor is dirty
   (the bug trigger — a re-render that destroys the editor).
5. Asserts the editor survived and the text is still shown.
6. Saves and asserts `item.system.description.value` was **persisted**.

Before the fix the run fails at step 6 (`Received: "<p>Edit this to describe the
item.</p>"`); after the fix it passes. See `videos/01-before-fix-FAIL.webm` and
`videos/02-after-fix-PASS.webm`.

## Run it

```bash
# 1. Build the system (mounted read-only into Foundry)
npm run build                      # from the repo root

# 2. Start Foundry v13 with this build + auto-launch the "test" world
docker compose --env-file ../../.env -f tests/e2e/docker-compose.foundry.yml up -d
#   wait until http://localhost:30000 answers (302)

# 3. Install the runner (once) and run the test (records video)
cd tests/e2e && npm install && npm test

# 4. Tear down
docker compose --env-file ../../.env -f tests/e2e/docker-compose.foundry.yml down
```

Videos and traces are written to `tests/e2e/artifacts/`.

## Notes / gotchas

- The compose file mounts **this worktree's** `build/` over the system, so the
  test always runs the code you just built.
- It reuses the existing `cosmere-foundry-data` volume (licensed, has the `test`
  world). The container name is `cosmere-foundry-test` to avoid clobbering a dev
  container.
- If a restart fails with *"directory ... already locked"*, remove the stale
  lock: `docker run --rm -v cosmere-foundry-data:/data alpine sh -c 'find /data
  -maxdepth 3 -iname "*.lock" -delete'`.
- Do **not** press `Escape` to dismiss dialogs in the spec — it toggles
  Foundry's modal ESC menu; use `dismissBlockingUI()` instead.
