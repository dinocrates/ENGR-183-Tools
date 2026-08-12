// Runs Stephen's own smoke-test .m script through the Scratch Pad and
// checks the console output + figure windows it should produce.
const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

const BASE = process.argv[2] || 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';
console.log(`Running user smoke script against: ${BASE}\n`);

const SCRIPT = `
fprintf('=== OCTAVE PLAYGROUND SMOKE TEST ===\\n\\n');

fprintf('Test 1: Scalar arithmetic\\n');
force_N = 25;
distance_m = 3;
work_J = force_N * distance_m;
fprintf('Work = %.1f J\\n', work_J);
if work_J == 75
    fprintf('PASS\\n\\n');
else
    fprintf('FAIL\\n\\n');
end

fprintf('Test 2: Vectors\\n');
x = [1 2 3 4 5];
y = x.^2;
disp('x =');
disp(x);
disp('x.^2 =');
disp(y);
if isequal(y, [1 4 9 16 25])
    fprintf('PASS\\n\\n');
else
    fprintf('FAIL\\n\\n');
end

fprintf('Test 3: Matrices\\n');
A = [1 2; 3 4];
B = [5 6; 7 8];
C = A + B;
D = A * B;
disp('A + B =');
disp(C);
disp('A * B =');
disp(D);
if isequal(C, [6 8; 10 12]) && isequal(D, [19 22; 43 50])
    fprintf('PASS\\n\\n');
else
    fprintf('FAIL\\n\\n');
end

fprintf('Test 4: Indexing\\n');
values = [10 20 30 40 50];
third_value = values(3);
fprintf('Third value = %d\\n', third_value);
if third_value == 30
    fprintf('PASS\\n\\n');
else
    fprintf('FAIL\\n\\n');
end

fprintf('Test 5: For loop\\n');
total = 0;
for i = 1:5
    total = total + i;
end
fprintf('Sum 1 to 5 = %d\\n', total);
if total == 15
    fprintf('PASS\\n\\n');
else
    fprintf('FAIL\\n\\n');
end

fprintf('Test 6: Conditional\\n');
temperature_C = 100;
if temperature_C >= 100
    state = 'boiling';
else
    state = 'not boiling';
end
fprintf('Water is %s.\\n', state);
if strcmp(state, 'boiling')
    fprintf('PASS\\n\\n');
else
    fprintf('FAIL\\n\\n');
end

fprintf('Test 7: Built-in math function\\n');
result = sin(pi/2);
fprintf('sin(pi/2) = %.6f\\n', result);
if abs(result - 1) < 1e-10
    fprintf('PASS\\n\\n');
else
    fprintf('FAIL\\n\\n');
end

fprintf('Test 8: Anonymous function\\n');
kineticEnergy = @(m, v) 0.5 * m .* v.^2;
KE = kineticEnergy(2, 3);
fprintf('KE = %.1f J\\n', KE);
if KE == 9
    fprintf('PASS\\n\\n');
else
    fprintf('FAIL\\n\\n');
end

fprintf('Test 9: Figure 1 (2D plot)\\n');
x1 = linspace(0, 2*pi, 200);
y1 = sin(x1);
figure(1);
plot(x1, y1, 'LineWidth', 2);
xlabel('x');
ylabel('sin(x)');
title('Figure 1: Sine Wave');
grid on;
fprintf('Created Figure 1.\\n\\n');

fprintf('Test 10: Figure 2 (multiple figures)\\n');
x2 = linspace(0, 10, 200);
y2 = x2.^2;
figure(2);
plot(x2, y2, 'LineWidth', 2);
xlabel('x');
ylabel('x^2');
title('Figure 2: Parabola');
grid on;
fprintf('Created Figure 2.\\n\\n');

fprintf('Test 11: Re-activating an earlier figure\\n');
figure(1);
hold on;
plot(x1, cos(x1), '--', 'LineWidth', 2);
legend('sin(x)', 'cos(x)');
hold off;
fprintf('Returned to Figure 1 and added cos(x).\\n\\n');

fprintf('Test 12: 3D plot\\n');
[x3, y3] = meshgrid(linspace(-3, 3, 60), linspace(-3, 3, 60));
z3 = sin(sqrt(x3.^2 + y3.^2));
figure(3);
surf(x3, y3, z3);
xlabel('x');
ylabel('y');
zlabel('z');
title('Figure 3: 3D Surface Plot');
grid on;
fprintf('Created Figure 3.\\n\\n');

fprintf('Test 13: 3D line plot\\n');
t = linspace(0, 8*pi, 400);
x4 = cos(t);
y4 = sin(t);
z4 = t;
figure(4);
plot3(x4, y4, z4, 'LineWidth', 2);
xlabel('x');
ylabel('y');
zlabel('z');
title('Figure 4: 3D Helix');
grid on;
fprintf('Created Figure 4.\\n\\n');

fprintf('=====================================\\n');
fprintf('SMOKE TEST COMPLETE\\n');
fprintf('=====================================\\n');
`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page.goto(BASE + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  await page.waitForTimeout(500);

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(SCRIPT);
  await page.waitForTimeout(300);

  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('SMOKE TEST COMPLETE'), null, { timeout: 60000 });
  await page.waitForTimeout(3000); // let all 4 figures finish rendering (3D surface is the heaviest)

  const outputText = await page.evaluate(() => {
    const pre = Array.from(document.querySelectorAll('pre')).find((p) => p.closest('.flex.h-full.flex-col.bg-app'));
    return pre ? pre.innerText : '';
  });

  const passCount = (outputText.match(/PASS/g) || []).length;
  const failCount = (outputText.match(/FAIL/g) || []).length;
  check('all 8 scripted PASS assertions report PASS', passCount === 8);
  check('no scripted FAIL assertions', failCount === 0);
  check('script ran to completion (SMOKE TEST COMPLETE)', outputText.includes('SMOKE TEST COMPLETE'));

  const figureInfo = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('[class*="cursor-move"], .flex.items-center.justify-between'))
      .map((el) => el.textContent)
      .filter((t) => t && t.includes('Figure'));
    return {
      figureCount: document.querySelectorAll('.js-plotly-plot').length,
      titles: Array.from(new Set(titles)),
    };
  });
  check('4 figure windows are open (Figure 1-4)', figureInfo.figureCount === 4);
  console.log('  figure titles found:', figureInfo.titles);

  // Figure 1 should have 2 traces (sin + cos, from the hold on re-activation)
  const figure1Traces = await page.evaluate(() => {
    const plots = Array.from(document.querySelectorAll('.js-plotly-plot'));
    // Figure 1 is whichever plot's layout title mentions "Sine Wave"
    for (const p of plots) {
      const data = p.data;
      if (data && p.layout && p.layout.title && String(p.layout.title.text || p.layout.title).includes('Sine')) {
        return data.length;
      }
    }
    return null;
  });
  check('Figure 1 has 2 traces after hold-on re-activation (sin + cos)', figure1Traces === 2);

  const has3DSurface = await page.evaluate(() => {
    const plots = Array.from(document.querySelectorAll('.js-plotly-plot'));
    return plots.some((p) => p.data && p.data.some((tr) => tr.type === 'surface'));
  });
  check('3D surface plot (surf) rendered with the correct Plotly trace type', has3DSurface);

  const has3DLine = await page.evaluate(() => {
    const plots = Array.from(document.querySelectorAll('.js-plotly-plot'));
    return plots.some((p) => p.data && p.data.some((tr) => tr.type === 'scatter3d'));
  });
  check('3D line plot (plot3) rendered with the correct Plotly trace type', has3DLine);

  check('no uncaught page errors', pageErrors.length === 0);
  if (pageErrors.length > 0) console.log('  page errors:', pageErrors);
  check('no console.error output', consoleErrors.length === 0);
  if (consoleErrors.length > 0) console.log('  console errors:', consoleErrors);

  await page.screenshot({ path: `${__dirname}/t99-result.png`, fullPage: false });

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log('\n--- Full console transcript ---');
  console.log(outputText);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message, e.stack); process.exit(1); });
