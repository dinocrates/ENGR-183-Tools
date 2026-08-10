const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

(async () => {
  const browser = await chromium.launch();
  const base = 'http://localhost:4173/';

  // --- Fresh visit: persistence warning first, onboarding not shown yet ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(base, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(400);
    let text = await page.evaluate(() => document.body.innerText);
    check('persistence warning shows first on a fresh visit', text.includes('your work lives in this browser'));
    check('onboarding is not shown yet (behind persistence warning)', !text.includes('Quick orientation'));

    // Dismiss persistence warning -- onboarding should appear next
    await page.getByText('Got it', { exact: true }).click();
    await page.waitForTimeout(300);
    text = await page.evaluate(() => document.body.innerText);
    check('onboarding appears after dismissing the persistence warning', text.includes('Quick orientation'));
    check('mentions the File Browser', text.includes('File Browser'));
    check('mentions Run Tests', text.includes('Run Tests'));
    check('mentions PASS/FAIL rubric report format', text.includes('[ PASS ]') && text.includes('[ FAIL ]'));
    check('mentions Download File/Download All for submission', text.includes('Download File') && text.includes('Download All'));
    check('"Don\'t show this again" checkbox is checked by default', await page.isChecked('input[type="checkbox"]'));

    // Backdrop click / Escape should NOT dismiss it (matches PersistenceWarning)
    await page.mouse.click(50, 50);
    await page.waitForTimeout(200);
    text = await page.evaluate(() => document.body.innerText);
    check('backdrop click does not dismiss onboarding', text.includes('Quick orientation'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    text = await page.evaluate(() => document.body.innerText);
    check('Escape does not dismiss onboarding', text.includes('Quick orientation'));

    // Dismiss via the real button
    await page.getByText("Let's go", { exact: true }).click();
    await page.waitForTimeout(200);
    text = await page.evaluate(() => document.body.innerText);
    check('dismissed after clicking Let\'s go', !text.includes('Quick orientation'));
    check('index visible underneath', text.includes('Pick a unit'));

    // Reload -- neither modal should reappear (both acknowledged)
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    text = await page.evaluate(() => document.body.innerText);
    check('neither modal reappears after reload', !text.includes('your work lives in this browser') && !text.includes('Quick orientation'));

    await page.close();
  }

  // --- Unchecking "Don't show this again" only hides it for this session ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
    await page.goto(base, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(400);

    await page.uncheck('input[type="checkbox"]');
    await page.getByText("Let's go", { exact: true }).click();
    await page.waitForTimeout(200);
    let text = await page.evaluate(() => document.body.innerText);
    check('unchecked dismiss hides onboarding for this session', !text.includes('Quick orientation'));

    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    text = await page.evaluate(() => document.body.innerText);
    check('onboarding reappears after reload when not remembered', text.includes('Quick orientation'));

    // Now leave the checkbox checked (default) and dismiss -- this time it
    // should persist and not come back.
    await page.getByText("Let's go", { exact: true }).click();
    await page.waitForTimeout(200);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    text = await page.evaluate(() => document.body.innerText);
    check('onboarding does not reappear after a checked (remembered) dismiss', !text.includes('Quick orientation'));

    await page.close();
  }

  // --- Deep link: onboarding should still surface (layered like PersistenceWarning) ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
    await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(500);
    const text = await page.evaluate(() => document.body.innerText);
    check('onboarding surfaces on a direct unit deep link too', text.includes('Quick orientation'));
    await page.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
