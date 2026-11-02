import { chromium } from 'playwright';

const TEST_ITEM_ID = process.env.TEST_ITEM_ID || 'tbEchvJ52egLma6d';
const ADMIN_KEY = process.env.FOUNDRY_ADMIN_KEY || 'cosmere-admin';
const WORLD_ID = 'test';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
});
const page = await ctx.newPage();

const errors = [];
page.on('console', (msg) => {
    if (msg.type() === 'error') {
        const t = msg.text();
        if (
            !t.includes('WebGL') &&
            !t.includes('resolution') &&
            !t.includes('hardware acceleration') &&
            !t.includes('Deprecated') &&
            !t.includes('namespaced')
        )
            errors.push(t);
    }
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

console.log('→ Loading /setup …');
await page.goto('http://localhost:30000/setup', { waitUntil: 'networkidle' });

// If admin password screen is present, fill it
if ((await page.locator('input[name="adminPassword"]').count()) > 0) {
    console.log('→ Admin auth …');
    await page.fill('input[name="adminPassword"]', ADMIN_KEY);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
}

// Launch the world (Foundry V13 setup page exposes per-world action buttons)
console.log(`→ Launching world "${WORLD_ID}" …`);
const launched = await page.evaluate(async (worldId) => {
    // Foundry's setup API exposes ui.setup or window.dispatchToServer; use the
    // generic socket path via the SetupConfiguration helper.
    const res = await fetch('/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launchWorld', world: worldId }),
    });
    return { ok: res.ok, status: res.status };
}, WORLD_ID);
console.log('  →', launched);

// The fetch() doesn't trigger client navigation. Wait a beat for the server
// to register the active world, then drive the browser there ourselves.
await page.waitForTimeout(2000);
console.log('→ Navigating to /join …');
await page.goto('http://localhost:30000/join', { waitUntil: 'networkidle' });
console.log('→ URL:', page.url());

if (page.url().includes('/join')) {
    console.log('→ Selecting Gamemaster + submitting …');
    await page.evaluate(() => {
        const sel = document.querySelector('select[name="userid"]');
        const gmOpt = Array.from(sel.options).find(
            (o) => o.textContent.trim() === 'Gamemaster',
        );
        sel.value = gmOpt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.click('button[name="join"]');
}

console.log('→ Waiting for game.ready …');
await page.waitForURL(/\/game/, { timeout: 30000 });
await page.waitForFunction(
    () => typeof game !== 'undefined' && game.ready === true,
    { timeout: 60000 },
);
console.log('→ game.ready');

// Helper to read truly raw rows via the same path the migration uses
// (foundry.helpers.SocketInterface.dispatch). cls.database.get() runs data
// model cleaning client-side; the socket path goes server -> DB direct.
async function readRawFromSocket(id) {
    return page.evaluate(async (id) => {
        try {
            const { result } =
                await foundry.helpers.SocketInterface.dispatch(
                    'modifyDocument',
                    {
                        type: 'Item',
                        operation: { query: { _id: id } },
                        action: 'get',
                    },
                );
            return result?.[0] ?? null;
        } catch (err) {
            return { __error: String(err?.stack || err) };
        }
    }, id);
}

// Pre-flight: read the RAW database row (not the in-memory _source, which
// Foundry's DataModel may have already cleaned of undeclared keys).
const preflight = await page.evaluate(async (id) => {
    // Foundry V13: raw DB access goes through CONFIG.DatabaseBackend.
    // The cosmere migrations use `getRawDocumentSources` for this exact
    // purpose, but it isn't on a public globalThis path. Use the same
    // underlying primitive: the document collection's index of _source.
    // We pull the raw row by re-hydrating from the LevelDB store via the
    // _getDocumentClass-bound storage API.

    // Easier: use Foundry's public game.items.get(id).toObject() which dumps
    // the in-memory _source; AND read the underlying DB via
    // game.collections.get('Item').index entry. We dump both.
    const item = game.items.get(id);
    const toObj = item ? item.toObject() : null;

    // Tap straight into the LevelDB via the documents collection storage.
    // foundry.documents.collections.WorldCollection exposes _source.
    let rawFromDb = null;
    try {
        const cls = CONFIG.Item.documentClass;
        const result = await cls.database.get(cls, {
            query: { _id: id },
        });
        rawFromDb = result?.[0]?._source ?? result?.[0] ?? null;
    } catch (err) {
        rawFromDb = { __error: String(err?.message || err) };
    }

    return {
        itemExists: !!item,
        systemVersion: game.system.version,
        // In-memory view
        memSystemKeys: item ? Object.keys(item._source.system) : null,
        memHasPath: item ? 'path' in item._source.system : null,
        memHasAncestry: item ? 'ancestry' in item._source.system : null,
        memHasPower: item ? 'power' in item._source.system : null,
        validatedHasPath: item ? 'path' in item.system : null,
        // toObject() view (often equals _source)
        toObjSystemKeys: toObj ? Object.keys(toObj.system) : null,
        // Direct DB read (the ground truth for the migration's perspective)
        dbSystemKeys: rawFromDb?.system
            ? Object.keys(rawFromDb.system)
            : rawFromDb,
        dbHasPath: rawFromDb?.system
            ? 'path' in rawFromDb.system
            : null,
        dbHasAncestry: rawFromDb?.system
            ? 'ancestry' in rawFromDb.system
            : null,
        dbHasPower: rawFromDb?.system
            ? 'power' in rawFromDb.system
            : null,
        invokeMigrationExposed:
            typeof globalThis.cosmereRPG?.utils?.invokeMigration ===
            'function',
    };
}, TEST_ITEM_ID);
console.log('PRE-FLIGHT (cls.database.get path):');
console.log(JSON.stringify(preflight, null, 2));

const preflightSocket = await readRawFromSocket(TEST_ITEM_ID);
console.log('PRE-FLIGHT (socket dispatch path — the migration\'s view):');
console.log(JSON.stringify(
    {
        systemKeys: preflightSocket?.system
            ? Object.keys(preflightSocket.system)
            : preflightSocket,
        path: preflightSocket?.system?.path ?? null,
        ancestry: preflightSocket?.system?.ancestry ?? null,
        power: preflightSocket?.system?.power ?? null,
    },
    null,
    2,
));

// Run the 1.0 → 1.1 migration
console.log('\n→ Invoking migration 1.0 → 1.1 …');
const migrateResult = await page.evaluate(async () => {
    try {
        await globalThis.cosmereRPG.utils.invokeMigration('1.0', '1.1');
        return { ok: true };
    } catch (err) {
        return { ok: false, error: String(err?.stack || err) };
    }
});
console.log('  →', migrateResult);

// Verify post-migration with the same DB-level read as pre-flight
const postflight = await page.evaluate(async (id) => {
    const item = game.items.get(id);
    let rawFromDb = null;
    try {
        const cls = CONFIG.Item.documentClass;
        const result = await cls.database.get(cls, { query: { _id: id } });
        rawFromDb = result?.[0]?._source ?? result?.[0] ?? null;
    } catch (err) {
        rawFromDb = { __error: String(err?.message || err) };
    }
    return {
        itemExists: !!item,
        memSystemKeys: item ? Object.keys(item._source.system) : null,
        dbSystemKeys: rawFromDb?.system
            ? Object.keys(rawFromDb.system)
            : rawFromDb,
        dbHasPath: rawFromDb?.system
            ? 'path' in rawFromDb.system
            : null,
        dbHasAncestry: rawFromDb?.system
            ? 'ancestry' in rawFromDb.system
            : null,
        dbHasPower: rawFromDb?.system
            ? 'power' in rawFromDb.system
            : null,
    };
}, TEST_ITEM_ID);
console.log('\nPOST-MIGRATION:');
console.log(JSON.stringify(postflight, null, 2));

const postflightSocket = await readRawFromSocket(TEST_ITEM_ID);
console.log('\nPOST-MIGRATION (socket dispatch path):');
console.log(JSON.stringify(
    {
        systemKeys: postflightSocket?.system
            ? Object.keys(postflightSocket.system)
            : postflightSocket,
        path: postflightSocket?.system?.path ?? null,
        ancestry: postflightSocket?.system?.ancestry ?? null,
        power: postflightSocket?.system?.power ?? null,
    },
    null,
    2,
));

// UI check: open the talent sheet and assert the legacy form sections are
// gone. The new template no longer renders any input with these names.
console.log('\n→ Opening talent sheet for UI check …');
const uiCheck = await page.evaluate(async (id) => {
    const item = game.items.get(id);
    if (!item) return { __error: 'item not found' };
    const sheet = item.sheet;
    await sheet.render(true);
    // Wait for the sheet to attach to the DOM
    await new Promise((r) => setTimeout(r, 1000));
    const root = sheet.element instanceof HTMLElement
        ? sheet.element
        : sheet.element?.[0];
    if (!root) return { __error: 'no sheet root' };
    return {
        sheetTitle: root.querySelector('.window-title')?.textContent?.trim(),
        inputPath: !!root.querySelector('input[name="system.path"]'),
        inputAncestry: !!root.querySelector('input[name="system.ancestry"]'),
        inputPower: !!root.querySelector('[name="system.power"]'),
        inputSpecialty: !!root.querySelector('input[name="system.specialty"]'),
        // For comparison: confirm something we KEEP is still rendered
        idField: !!root.querySelector('input[name="system.id"]'),
        typeField: !!root.querySelector('[name="system.type"]'),
    };
}, TEST_ITEM_ID);
console.log('UI CHECK:');
console.log(JSON.stringify(uiCheck, null, 2));

const dbStripped =
    postflightSocket?.system &&
    !('path' in postflightSocket.system) &&
    !('ancestry' in postflightSocket.system) &&
    !('power' in postflightSocket.system);

const uiStripped =
    uiCheck.inputPath === false &&
    uiCheck.inputAncestry === false &&
    uiCheck.inputPower === false &&
    uiCheck.inputSpecialty === false &&
    uiCheck.idField === true &&
    uiCheck.typeField === true;

const ok = postflight.itemExists && dbStripped && uiStripped;
console.log(`\nDB stripped: ${dbStripped} | UI stripped: ${uiStripped}`);

console.log('\n=================');
console.log(ok ? 'PASS ✓' : 'FAIL ✗');
console.log('=================');

if (errors.length) {
    console.log('\nPAGE ERRORS:');
    for (const e of errors.slice(0, 10)) console.log('  -', e);
}

await browser.close();
process.exit(ok ? 0 : 1);
