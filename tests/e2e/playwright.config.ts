import { defineConfig } from '@playwright/test';

/**
 * E2E config for the PR #726 prose-mirror regression test.
 *
 * Expects a Foundry VTT instance already running on :30000 with the patched
 * cosmere-rpg build mounted (see docker-compose.foundry.yml in this folder).
 * Video recording is enabled so the run produces a reviewable .webm.
 */
export default defineConfig({
    testDir: '.',
    timeout: 240_000,
    expect: { timeout: 20_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    outputDir: 'artifacts',
    use: {
        baseURL: 'http://localhost:30000',
        headless: true,
        video: 'on',
        trace: 'on',
        screenshot: 'only-on-failure',
        viewport: { width: 1600, height: 900 },
        actionTimeout: 30_000,
    },
});
