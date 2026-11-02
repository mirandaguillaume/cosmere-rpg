import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on('console', (msg) => console.log(`[page ${msg.type()}]`, msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto('http://localhost:30000/join', { waitUntil: 'networkidle' });
console.log('URL:', page.url());
console.log('TITLE:', await page.title());

// Dump form fields, selects, buttons
const info = await page.evaluate(() => {
    const form = document.querySelector('form');
    const selects = Array.from(document.querySelectorAll('select')).map((s) => ({
        name: s.name,
        options: Array.from(s.options).map((o) => ({
            value: o.value,
            text: o.textContent.trim(),
        })),
    }));
    const inputs = Array.from(document.querySelectorAll('input')).map((i) => ({
        name: i.name,
        type: i.type,
        placeholder: i.placeholder,
    }));
    const buttons = Array.from(document.querySelectorAll('button')).map((b) => ({
        name: b.name,
        text: b.textContent.trim(),
    }));
    return {
        formAction: form?.action,
        selects,
        inputs,
        buttons,
        bodyTextStart: document.body.innerText.slice(0, 400),
    };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
