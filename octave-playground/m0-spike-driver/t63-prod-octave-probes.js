// Battery of Octave-language correctness probes run against the deployed
// production Scratch Pad, via Run File. Not pass/fail assertions -- this
// dumps real output for manual review against known Octave/MATLAB
// semantics, since the point is to spot divergences, not confirm a fixed
// expectation.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
  await page.goto(base + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  const script = [
    "disp('=== version ===')",
    "disp(version())",
    "",
    "disp('=== string vs char class ===')",
    "x = 'hello';",
    "y = \"world\";",
    "printf('class(single-quoted) = %s\\n', class(x));",
    "printf('class(double-quoted) = %s\\n', class(y));",
    "z = [x ' ' y];",
    "disp(z)",
    "",
    "disp('=== numeric division ===')",
    "a = 5/2",
    "b = int32(5)/int32(2)",
    "",
    "disp('=== integer saturation ===')",
    "c = int8(127) + int8(1)",
    "d = uint8(0) - uint8(1)",
    "",
    "disp('=== broadcasting ===')",
    "m = [1 2 3] + [1;2;3]",
    "",
    "disp('=== cell array display ===')",
    "cc = {1, 'two', [3 4 5]}",
    "",
    "disp('=== struct display ===')",
    "s.a = 1; s.b = 'hello'; s",
    "",
    "disp('=== printf/sprintf formatting ===')",
    "printf('%d %s %.2f\\n', 5, 'hi', 3.14159)",
    "fprintf('%5.2f|\\n', pi)",
    "disp(sprintf('%03d', 7))",
    "",
    "disp('=== error identifier/message ===')",
    "try",
    "  error('MyErr:bad', 'custom %s', 'message');",
    "catch err",
    "  printf('id=%s msg=%s\\n', err.identifier, err.message);",
    "end",
    "",
    "disp('=== regexp/regexprep/strsplit/strtrim ===')",
    "disp(regexprep('hello world', 'o', '0'))",
    "cellDisp = strsplit('a,b,,c', ',');",
    "disp(cellDisp)",
    "disp(['[' strtrim('  hi  ') ']'])",
    "",
    "disp('=== anonymous function closures ===')",
    "aVal = 10;",
    "g = @() aVal;",
    "aVal = 20;",
    "printf('closure captured value: %d (expect 10)\\n', g())",
    "",
    "disp('=== end keyword indexing ===')",
    "v = [1 2 3 4 5];",
    "disp(v(end))",
    "disp(v(2:end-1))",
    "",
    "disp('=== complex numbers ===')",
    "zc = 3 + 4i;",
    "printf('abs(3+4i) = %g\\n', abs(zc))",
    "",
    "disp('=== logical vs elementwise ===')",
    "printf('true && false = %d\\n', true && false)",
    "disp([1 0 1] & [1 1 0])",
    "",
    "disp('=== containers.Map ===')",
    "try",
    "  cm = containers.Map();",
    "  cm('key') = 'value';",
    "  disp(cm('key'))",
    "catch err2",
    "  printf('containers.Map failed: %s\\n', err2.message)",
    "end",
    "",
    "disp('=== multiple return values (sort) ===')",
    "[sv, si] = sort([3 1 2]);",
    "disp(sv)",
    "disp(si)",
    "",
    "disp('=== num2str precision ===')",
    "disp(num2str(3.14159, 4))",
    "",
    "disp('=== comments: percent and hash ===')",
    "% percent comment",
    "# hash comment",
    "disp('comments ok')",
    "",
    "disp('=== isrow/iscolumn/class checks ===')",
    "printf('isrow: %d, iscolumn: %d\\n', isrow([1 2 3]), iscolumn([1;2;3]))",
    "",
    "disp('=== DONE ===')",
  ].join('\n');

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(script);
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('=== DONE ==='), null, { timeout: 30000 });
  await page.waitForTimeout(500);

  const cmdText = await page.evaluate(() => document.querySelector('pre')?.textContent || '');
  console.log(cmdText);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
