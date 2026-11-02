import { test, expect, Page } from '@playwright/test';

/**
 * Regression test for PR #726 (issue: item description edit reset / save lost).
 *
 * Reproduces the reviewer's scenario: edit a prose-mirror description, then have
 * the sheet re-render because of an *external* document update while the editor
 * still holds unsaved text. Before the fix, the rebuilt editor could no longer
 * persist on save (Foundry's `value === _value` guard short-circuits the change
 * event). After the `_canRender` fix, the editor is not destroyed mid-edit, so
 * the text is preserved AND a normal save persists it to the document.
 */

const TEXT = 'PR726 preserved across an external update';

async function joinAsGameMaster(page: Page) {
    await page.goto('/join', { waitUntil: 'domcontentloaded' });

    const select = page.locator('select[name="userid"]');
    await select.waitFor({ state: 'attached', timeout: 60_000 });

    // The /join screen is a SPA; pick a GM-looking user, else the first real one.
    const value = await select.evaluate((el: HTMLSelectElement) => {
        const opts = Array.from(el.options).filter((o) => o.value);
        const gm = opts.find((o) => /game ?master|gm/i.test(o.textContent ?? ''));
        return (gm ?? opts[0])?.value ?? '';
    });
    expect(value, 'a joinable user must exist').toBeTruthy();
    await select.selectOption(value);

    await page
        .locator(
            'button[name="join"], button[data-action="join"], button[type="submit"]',
        )
        .first()
        .click();

    await page.waitForFunction(() => (window as never as any).game?.ready === true, {
        timeout: 120_000,
    });

    await dismissBlockingUI(page);
}

/**
 * Close anything that could intercept pointer events: Foundry's ESC game menu
 * (a modal <dialog id="menu">), an active guided tour, and any other open
 * native <dialog>. NOTE: do NOT press Escape blindly — Escape *toggles* the ESC
 * menu, so an odd number of presses leaves a modal dialog open over the board.
 */
async function dismissBlockingUI(page: Page) {
    await page.evaluate(() => {
        const w = window as never as any;
        try {
            w.game?.tours?.activeTour?.exit?.();
        } catch {
            /* no active tour */
        }
        document
            .querySelectorAll('dialog[open]')
            .forEach((d) => (d as HTMLDialogElement).close?.());
    });
    await page.waitForTimeout(300);
}

test('description persists after an external re-render mid-edit (PR #726)', async ({
    page,
}) => {
    page.on('console', (m) => {
        if (m.type() === 'error') console.log('PAGE ERROR:', m.text());
    });

    await joinAsGameMaster(page);

    expect(
        await page.evaluate(() => (window as never as any).game.user.isGM),
        'must be logged in as a GM to create items',
    ).toBeTruthy();

    // --- Create a test item and render its sheet ---
    const { itemId, sheetId } = await page.evaluate(async () => {
        const w = window as never as any;
        const item = await w.Item.create({
            name: 'PR726 ProseMirror Test',
            type: 'loot',
        });
        await item.sheet.render(true);
        return { itemId: item.id as string, sheetId: item.sheet.id as string };
    });

    const sheet = page.locator(`#${sheetId}`);
    await sheet.waitFor({ state: 'visible', timeout: 30_000 });

    // --- Open the description editor ---
    await page.evaluate((id) => {
        const w = window as never as any;
        const app = w.foundry.applications.instances.get(id);
        app?.changeTab?.('description', 'primary');
    }, sheetId);

    await dismissBlockingUI(page);
    const editBtn = sheet.locator('[data-action="edit-description"]').first();
    await editBtn.waitFor({ state: 'visible', timeout: 20_000 });
    await editBtn.click();

    const editor = sheet.locator(
        'prose-mirror .ProseMirror[contenteditable="true"]',
    );
    await editor.waitFor({ state: 'visible', timeout: 20_000 });

    // --- Type into the editor ---
    await editor.click();
    await page.keyboard.type(TEXT, { delay: 25 });
    await expect(editor).toContainText('PR726');

    // --- Trigger an EXTERNAL re-render while the editor is dirty (the bug trigger) ---
    await page.evaluate(
        (id) =>
            (window as never as any).game.items
                .get(id)
                .update({ name: 'PR726 externally updated mid-edit' }),
        itemId,
    );
    await page.waitForTimeout(1200);

    // With the fix, the live editor must SURVIVE the external update and keep the text.
    await expect(
        editor,
        'editor should survive the external update (render suppressed while dirty)',
    ).toBeVisible();
    await expect(editor).toContainText('PR726');

    // --- Save through the editor's own control (fires the change event) ---
    const saveBtn = sheet.locator('prose-mirror button[data-action="save"]');
    if (await saveBtn.count()) {
        await saveBtn.first().click();
    } else {
        await editor.click();
        await page.keyboard.press('Control+s');
    }
    await page.waitForTimeout(1500);

    // --- Assert the description was actually persisted to the document ---
    const saved = await page.evaluate(
        (id) =>
            (window as never as any).game.items.get(id).system.description
                .value as string,
        itemId,
    );
    expect(
        saved,
        'the typed description must be persisted to the item document',
    ).toContain('PR726');

    // --- Cleanup ---
    await page.evaluate(
        (id) => (window as never as any).game.items.get(id)?.delete(),
        itemId,
    );
});
