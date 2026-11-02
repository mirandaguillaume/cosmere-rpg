import { chromium } from 'playwright';

const TEST_ITEM_ID = process.env.TEST_ITEM_ID || 'tbEchvJ52egLma6d';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:30000/join', { waitUntil: 'networkidle' });
await page.evaluate(() => {
    const sel = document.querySelector('select[name="userid"]');
    sel.value = Array.from(sel.options).find(
        (o) => o.textContent.trim() === 'Gamemaster',
    ).value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.click('button[name="join"]');
await page.waitForURL(/\/game/, { timeout: 30000 });
await page.waitForFunction(() => game?.ready === true, { timeout: 60000 });

async function readRaw() {
    return page.evaluate(async (id) => {
        const { result } = await foundry.helpers.SocketInterface.dispatch(
            'modifyDocument',
            { type: 'Item', operation: { query: { _id: id } }, action: 'get' },
        );
        const sys = result?.[0]?.system ?? {};
        return Object.keys(sys).filter((k) =>
            ['path', 'ancestry', 'power'].includes(k),
        );
    }, TEST_ITEM_ID);
}

console.log('BEFORE legacy keys:', JSON.stringify(await readRaw()));

// Re-seed if missing (idempotent test prep)
await page.evaluate(async (id) => {
    await foundry.helpers.SocketInterface.dispatch('modifyDocument', {
        type: 'Item',
        action: 'update',
        operation: {
            updates: [
                {
                    _id: id,
                    system: {
                        path: 'legacy-path-id',
                        ancestry: 'legacy-ancestry-id',
                        power: 'legacy-power-id',
                    },
                },
            ],
            diff: false,
        },
    });
}, TEST_ITEM_ID);
console.log('After re-seed legacy keys:', JSON.stringify(await readRaw()));

// Probe document.update with various option combos
const probes = await page.evaluate(async (id) => {
    const results = {};
    const item = game.items.get(id);

    // Pretty-print which keys remain after each attempt by reading raw
    const peek = async () => {
        const { result } = await foundry.helpers.SocketInterface.dispatch(
            'modifyDocument',
            {
                type: 'Item',
                operation: { query: { _id: id } },
                action: 'get',
            },
        );
        const sys = result?.[0]?.system ?? {};
        return ['path', 'ancestry', 'power'].filter((k) => k in sys);
    };

    // Probe 1: same options the migration uses today
    try {
        await item.update({ 'system.-=path': null }, { diff: false });
        results.p1 = await peek();
    } catch (e) {
        results.p1 = `ERR: ${e.message}`;
    }

    // Probe 2: Item.updateDocuments static (V13 canonical batch path)
    try {
        const Item = CONFIG.Item.documentClass;
        await Item.updateDocuments(
            [{ _id: id, 'system.-=ancestry': null }],
            { diff: false },
        );
        results.p2 = await peek();
    } catch (e) {
        results.p2 = `ERR: ${e.message}`;
    }

    // Probe 3: dispatch the socket directly (proven working in earlier diag)
    try {
        await foundry.helpers.SocketInterface.dispatch('modifyDocument', {
            type: 'Item',
            action: 'update',
            operation: {
                updates: [{ _id: id, 'system.-=power': null }],
                diff: false,
            },
        });
        results.p3 = await peek();
    } catch (e) {
        results.p3 = `ERR: ${e.message}`;
    }

    return results;
}, TEST_ITEM_ID);

console.log('PROBES (remaining legacy keys after each):');
console.log(JSON.stringify(probes, null, 2));

await browser.close();
