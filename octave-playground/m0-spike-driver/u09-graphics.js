// PNG handoff and figure Position regression in the actual WASM toolkit.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1'); localStorage.setItem('engr183-onboarding-seen', '1');
    });
    await page.goto((process.argv[2] || 'http://127.0.0.1:4189/') + '?unit=scratch');
    const ready = () => page.getByPlaceholder(/Type an Octave command/).waitFor({ timeout: 90000 });
    async function command(code) {
      await ready(); const box = page.getByPlaceholder(/Type an Octave command/);
      await box.fill(code); await box.press('Enter'); await ready();
      return (await page.locator('pre').allTextContents()).join('\n');
    }
    const o = await command("figure(1); set(gcf,'Position',[100 100 900 600]); plot([0 1],[2 3]); title('PNG handoff regression'); xlabel('Input'); ylabel('Output'); print(gcf,'handoff.png','-dpng','-r150'); assert(exist('handoff.png','file')==0); disp('HANDOFF_OK');");
    assert.ok(o.includes('HANDOFF_OK') && o.includes('No native PNG file was written.'), o);
    await page.waitForFunction(() => document.querySelector('.js-plotly-plot')?._fullLayout?.width === 900);
    const pending = page.waitForEvent('download'); await page.locator('[data-title*="Download plot"]').click();
    const d = await pending; const fs = require('node:fs'); const png = fs.readFileSync(await d.path());
    assert.equal(png.readUInt32BE(16), 900); assert.equal(png.readUInt32BE(20), 600);
    const invalid = await command("rejected=false; try, print(1,'bad.png','-dpng','-notARealOption'); catch, rejected=true; end; assert(rejected); assert(exist('bad.png','file')==0); disp('VALIDATION_OK');");
    assert.ok(invalid.includes('VALIDATION_OK'), invalid);
    await command("set(1,'Position',[100 100 1000 700]); disp('RESIZED');");
    await page.waitForFunction(() => document.querySelector('.js-plotly-plot')?._fullLayout?.width === 1000);
    console.log('PASS PNG handoff writes no fake file; camera emits real requested-size PNG; invalid options fail; later Position updates render');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
