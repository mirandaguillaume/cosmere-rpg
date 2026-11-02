import { chromium } from 'playwright';

const TEST_ITEM_NAME = 'cosmere-rpg-test-legacy-talent';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
});
const page = await ctx.newPage();

const errors = [];
page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
        const t = msg.text();
        if (!t.includes('WebGL') && !t.includes('resolution')) errors.push(t);
    }
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

console.log('→ Loading /join …');
await page.goto('http://localhost:30000/join', { waitUntil: 'networkidle' });

console.log('→ Selecting Gamemaster + submitting …');
// The "Gamemaster" option may be disabled if a session is already active.
// Force-set the value via JS — Foundry's server will accept it and the
// existing session will simply be reaped.
await page.evaluate(() => {
    const sel = document.querySelector('select[name="userid"]');
    const gmOpt = Array.from(sel.options).find(
        (o) => o.textContent.trim() === 'Gamemaster',
    );
    sel.value = gmOpt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.click('button[name="join"]');

// Wait for /game (the actual game page) to load and `game` to be ready
console.log('→ Waiting for game.ready …');
await page.waitForURL(/\/game/, { timeout: 30000 });
await page.waitForFunction(
    () => typeof game !== 'undefined' && game.ready === true,
    { timeout: 60000 },
);
console.log('→ game.ready');

// Seed the legacy talent. Old schema still has path/ancestry/power as
// StringFields, so a normal Item.create accepts them.
const result = await page.evaluate(async (name) => {
    // Be idempotent: remove any leftover with the same name first.
    const stale = game.items.find((i) => i.name === name);
    if (stale) await stale.delete();

    const item = await Item.create({
        type: 'talent',
        name,
        system: {
            path: 'legacy-path-id',
            ancestry: 'legacy-ancestry-id',
            power: 'legacy-power-id',
        },
    });

    // Re-read from the world collection to make sure we get persisted state
    const persisted = game.items.get(item.id);
    return {
        id: item.id,
        type: item.type,
        name: item.name,
        systemKeys: Object.keys(persisted._source.system),
        rawSourceSystem: {
            path: persisted._source.system.path,
            ancestry: persisted._source.system.ancestry,
            power: persisted._source.system.power,
        },
        systemVersionAtSeed: game.system.version,
    };
}, TEST_ITEM_NAME);

console.log('SEED RESULT:');
console.log(JSON.stringify(result, null, 2));

if (errors.length) {
    console.log('\nPAGE ERRORS DURING SEED:');
    for (const e of errors) console.log('  -', e);
}

await browser.close();
