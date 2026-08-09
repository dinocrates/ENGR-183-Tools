const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

const DEFAULT_COLOR = 'rgb(212, 212, 212)';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'http://localhost:4173/';

  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
  await page.goto(base + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  const script = [
    "% a comment",
    "function y = square(x)",
    "  y = x^2;",
    "end",
    "B = A';",
    "s = 'single quoted';",
    "d = \"double quoted\";",
    "n = 3.14;",
  ].join('\n');

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(script);
  await page.waitForTimeout(1000);

  // Monaco renders each `.view-line` as an outer full-line wrapper span (no
  // class, default color) plus one inner mtkN-classed span per contiguous
  // same-token run (adjacent same-styled characters merge into one span,
  // e.g. "y = square" can be a single span, not one per identifier). It
  // also renders spaces in the DOM as U+00A0 (non-breaking space), not
  // plain ASCII space -- normalized back to ' ' here so plain-space needles
  // below actually match. Everything is read in a SINGLE evaluate() round
  // trip; splitting this into several separate page.evaluate() calls was
  // flaky for unrelated reasons (a race with Monaco's async re-render).
  const dump = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.view-line')).map((l) => ({
      text: l.textContent.replace(/ /g, ' '),
      tokens: Array.from(l.querySelectorAll('span[class^="mtk"]')).map((s) => ({
        text: s.textContent.replace(/ /g, ' '),
        color: getComputedStyle(s).color,
      })),
    })),
  );

  function findLine(substring) {
    return dump.find((l) => l.text.includes(substring)) ?? null;
  }
  function tokenText(line, substring) {
    return line?.tokens.find((t) => t.text.includes(substring)) ?? null;
  }

  const commentLine = findLine('% a comment');
  const commentColor = tokenText(commentLine, '% a comment')?.color;
  check('comment is colored distinctly from default text', !!commentColor && commentColor !== DEFAULT_COLOR);

  const fnLine = findLine('function y = square(x)');
  const keywordColor = tokenText(fnLine, 'function')?.color;
  check('"function" is colored as a keyword, distinct from default text', !!keywordColor && keywordColor !== DEFAULT_COLOR);

  const endLine = findLine('end');
  const endColor = tokenText(endLine, 'end')?.color;
  check('"end" is recognized as a keyword (same color as "function")', !!endColor && endColor === keywordColor);

  const numLine = findLine('x^2');
  const numColor = tokenText(numLine, '2')?.color;
  check('number is colored distinctly from default text', !!numColor && numColor !== DEFAULT_COLOR);

  const sqLine = findLine("'single quoted'");
  const stringColor = tokenText(sqLine, 'single quoted')?.color;
  check('single-quoted string is colored distinctly from default text', !!stringColor && stringColor !== DEFAULT_COLOR);

  const dqLine = findLine('"double quoted"');
  const dqColor = tokenText(dqLine, 'double quoted')?.color;
  check('double-quoted string is colored the same as single-quoted string', !!dqColor && dqColor === stringColor);

  // --- The hard part: transpose (A') must NOT be colored as a string ---
  const transposeLine = findLine("B = A';");
  console.log("B = A'; token breakdown:", JSON.stringify(transposeLine?.tokens));
  const transposeChunk = tokenText(transposeLine, "A'");
  check(
    "transpose ' merges into plain/operator text, not a string token",
    !!transposeChunk && transposeChunk.color !== stringColor,
  );
  check(
    'no stray string token was opened by the transpose (no unclosed-string leftover span)',
    !transposeLine?.tokens.some((t) => t.color === stringColor),
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
