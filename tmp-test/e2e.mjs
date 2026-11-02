import { chromium } from 'playwright';

const TEST_ITEM_ID = 'tbEchvJ52egLma6d';
const ADMIN_KEY = 'cosmere-admin';
const WORLD_ID = 'test';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
});
const page = await ctx.newPage();

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

// --- 0. Launch the world if needed ----------------------------------------
await page.goto('http://localhost:30000/', { waitUntil: 'networkidle' });
console.log('→ Entry URL:', page.url());

// Foundry redirects: /setup if no world launched, /join if launched. After a
// container restart, we land on /setup and need admin auth + launchWorld.
if (!page.url().includes('/join') && !page.url().includes('/game')) {
    // Navigate to /setup explicitly in case we're somewhere else
    await page.goto('http://localhost:30000/setup', { waitUntil: 'networkidle' });
    console.log('→ /setup URL:', page.url());

    if ((await page.locator('input[name="adminPassword"]').count()) > 0) {
        console.log('→ Admin auth …');
        await page.fill('input[name="adminPassword"]', ADMIN_KEY);
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');
    }
    console.log(`→ Launching world "${WORLD_ID}" …`);
    const launched = await page.evaluate(async (worldId) => {
        const res = await fetch('/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'launchWorld', world: worldId }),
        });
        return { ok: res.ok, status: res.status };
    }, WORLD_ID);
    console.log('  →', launched);
    await page.waitForTimeout(3000);
    await page.goto('http://localhost:30000/join', { waitUntil: 'networkidle' });
}
console.log('→ Pre-join URL:', page.url());

// --- 1. Join as Gamemaster ------------------------------------------------
console.log('→ Joining as Gamemaster …');
await page.evaluate(() => {
    const sel = document.querySelector('select[name="userid"]');
    const gm = Array.from(sel.options).find(
        (o) => o.textContent.trim() === 'Gamemaster',
    );
    sel.value = gm.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.click('button[name="join"]');
await page.waitForURL(/\/game/, { timeout: 30000 });
await page.waitForFunction(() => game?.ready === true, { timeout: 60000 });
console.log('→ game.ready');

const readRaw = (id) =>
    page.evaluate(async (id) => {
        const { result } = await foundry.helpers.SocketInterface.dispatch(
            'modifyDocument',
            { type: 'Item', operation: { query: { _id: id } }, action: 'get' },
        );
        const sys = result?.[0]?.system ?? null;
        if (!sys) return null;
        return {
            keys: Object.keys(sys),
            path: sys.path,
            ancestry: sys.ancestry,
            power: sys.power,
        };
    }, id);

// --- 2. Re-seed legacy fields via raw socket (bypass schema) --------------
// Use dot-path keys so only path/ancestry/power are written; the rest of
// `system` is left untouched.
console.log('→ Re-seeding legacy fields via socket …');
await page.evaluate(async (id) => {
    await foundry.helpers.SocketInterface.dispatch('modifyDocument', {
        type: 'Item',
        action: 'update',
        operation: {
            updates: [
                {
                    _id: id,
                    'system.path': 'legacy-path-id',
                    'system.ancestry': 'legacy-ancestry-id',
                    'system.power': 'legacy-power-id',
                },
            ],
            diff: false,
        },
    });
}, TEST_ITEM_ID);

const beforeRaw = await readRaw(TEST_ITEM_ID);
console.log('BEFORE migration (raw DB):', JSON.stringify(beforeRaw));

// --- 3. Run the migration -------------------------------------------------
console.log('→ Invoking migration 1.0 → 1.1 …');
const migrate = await page.evaluate(async () => {
    try {
        await globalThis.cosmereRPG.utils.invokeMigration('1.0', '1.1');
        return { ok: true };
    } catch (err) {
        return { ok: false, error: String(err?.stack || err) };
    }
});
console.log('  →', migrate);

// --- 4. Verify DB stripped -----------------------------------------------
const afterRaw = await readRaw(TEST_ITEM_ID);
console.log('AFTER migration (raw DB):', JSON.stringify(afterRaw));

const dbStripped =
    !!afterRaw &&
    !afterRaw.keys.includes('path') &&
    !afterRaw.keys.includes('ancestry') &&
    !afterRaw.keys.includes('power');

// --- 5. Verify UI does not render the inputs -----------------------------
console.log('→ Verifying UI …');
const ui = await page.evaluate(async (id) => {
    const item = game.items.get(id);
    await item.sheet.render(true);
    await new Promise((r) => setTimeout(r, 1200));
    const root =
        item.sheet.element instanceof HTMLElement
            ? item.sheet.element
            : item.sheet.element?.[0];
    return {
        sheetTitle: root?.querySelector('.window-title')?.textContent?.trim(),
        inputPath: !!root?.querySelector('[name="system.path"]'),
        inputAncestry: !!root?.querySelector('[name="system.ancestry"]'),
        inputPower: !!root?.querySelector('[name="system.power"]'),
        inputSpecialty: !!root?.querySelector('[name="system.specialty"]'),
        idField: !!root?.querySelector('[name="system.id"]'),
        typeField: !!root?.querySelector('[name="system.type"]'),
    };
}, TEST_ITEM_ID);
console.log('UI CHECK:', JSON.stringify(ui, null, 2));

const uiStripped =
    !ui.inputPath &&
    !ui.inputAncestry &&
    !ui.inputPower &&
    !ui.inputSpecialty &&
    ui.idField &&
    ui.typeField;

console.log(`\nDB stripped: ${dbStripped} | UI stripped: ${uiStripped}`);
console.log('=================');
console.log(dbStripped && uiStripped ? 'PASS ✓' : 'FAIL ✗');
console.log('=================');

if (pageErrors.length) {
    console.log('Page errors:', pageErrors.slice(0, 5));
}

await browser.close();
process.exit(dbStripped && uiStripped ? 0 : 1);
