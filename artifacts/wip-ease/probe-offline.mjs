import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext();
const page = await ctx.newPage();
const failed = [];
page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`));
page.on('console', (m) => { if (m.type() === 'error') failed.push(`CONSOLE ${m.text()} @ ${(m.location()||{}).url || '(no url)'}`); });
await page.goto('http://127.0.0.1:8791/#autotest');
await page.waitForFunction(() => !!window.__OW);
await ctx.setOffline(true);
await page.getByRole('button', { name: /^(Continue|Lay hands on the chest)$/ }).click();
try { const w = page.getByRole('button', { name: 'Take the wager', exact: true }); await w.waitFor({ timeout: 2000 }); await w.click(); } catch {}
await page.waitForTimeout(4000);
console.log(failed.join('\n') || '(nothing failed)');
await b.close();
