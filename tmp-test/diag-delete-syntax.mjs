import { chromium } from 'playwright';

const TEST_ITEM_ID = process.env.TEST_ITEM_ID || 'tbEchvJ52egLma6d';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto('http://localhost:30000/join', { waitUntil: 'networkidle' });
await page.evaluate(() => {
    const sel = document.querySelector('select[name="userid"]');
    const gmOpt = Array.from(sel.options).find(
        (o) => o.textContent.trim() === 'Gamemaster',
    );
    sel.value = gmOpt.value;
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
        return {
            keys: Object.keys(sys),
            path: sys.path,
            ancestry: sys.ancestry,
            power: sys.power,
        };
    }, TEST_ITEM_ID);
}

console.log('BEFORE:', JSON.stringify(await readRaw()));

// Path A: client-side document.update({-=key})
const a = await page.evaluate(async (id) => {
    try {
        const item = game.items.get(id);
        await item.update({ 'system.-=path': null }, { diff: false });
        return { ok: true };
    } catch (err) {
        return { ok: false, error: String(err?.message || err) };
    }
}, TEST_ITEM_ID);
console.log('Path A (document.update):', JSON.stringify(a));
console.log('AFTER A:', JSON.stringify(await readRaw()));

// Path B: server socket dispatch with the -=key payload directly
const b = await page.evaluate(async (id) => {
    try {
        const res = await foundry.helpers.SocketInterface.dispatch(
            'modifyDocument',
            {
                type: 'Item',
                action: 'update',
                operation: {
                    updates: [{ _id: id, 'system.-=ancestry': null }],
                    diff: false,
                },
            },
        );
        return { ok: true, res: !!res };
    } catch (err) {
        return { ok: false, error: String(err?.message || err) };
    }
}, TEST_ITEM_ID);
console.log('Path B (socket modifyDocument update):', JSON.stringify(b));
console.log('AFTER B:', JSON.stringify(await readRaw()));

// Path C: explicit non-prefix delete via deleteEmbeddedDocuments style?
// Actually try setProperty + persist via update with a `_source` override
const c = await page.evaluate(async (id) => {
    try {
        const item = game.items.get(id);
        // Directly call the DatabaseBackend with an unprocessed update
        await foundry.helpers.SocketInterface.dispatch('modifyDocument', {
            type: 'Item',
            action: 'update',
            operation: {
                updates: [{ _id: id, system: { '-=power': null } }],
                diff: false,
            },
        });
        return { ok: true };
    } catch (err) {
        return { ok: false, error: String(err?.message || err) };
    }
}, TEST_ITEM_ID);
console.log('Path C (nested system: {-=power: null}):', JSON.stringify(c));
console.log('AFTER C:', JSON.stringify(await readRaw()));

await browser.close();
