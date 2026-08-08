% CHECK_GOLDEN  CI guardrail on Goal 3 (byte-identical rubric output).
%
% Runs engr183.runTests('unit00') for the unsolved and solved cases and
% compares the exact output against committed golden files. Fails (nonzero
% exit via error()) on any mismatch, so a change to report.m/runTests.m/
% compare.m that alters the rubric report gets caught in CI instead of
% silently reaching students.
%
% Run from Octave with the repo root on the path (after `setup`):
%     octave-cli --no-gui --eval "check_golden"
%
% To regenerate the golden files after a deliberate, reviewed format change,
% see _verify/regenerate_golden.m.

here = fileparts(mfilename('fullpath'));
root = fileparts(here);
goldenDir = fullfile(here, 'golden');
stubDir = fullfile(root, 'assignments', 'unit00');
solvedDir = fullfile(here, 'solved');
unsolvedDir = fullfile(here, 'unsolved');
fns = {'addTwo.m', 'circleArea.m', 'greet.m'};

failed = false;
cases = {'unsolved', 'solved'};

for c = 1:numel(cases)
  caseName = cases{c};
  if strcmp(caseName, 'solved')
    for k = 1:numel(fns)
      copyfile(fullfile(solvedDir, fns{k}), fullfile(stubDir, fns{k}));
    end
    % Octave caches a function by the path it first loaded it from;
    % overwriting the file on disk doesn't invalidate that cache (even
    % rehash doesn't help). Without this, the 'unsolved' pass above leaves
    % addTwo/circleArea/greet cached in their unsolved form.
    clear addTwo circleArea greet
  end

  actual = evalc("engr183.runTests('unit00')");
  goldenPath = fullfile(goldenDir, sprintf('unit00_%s.txt', caseName));

  if exist(goldenPath, 'file') ~= 2
    fprintf('MISSING golden file: %s\n', goldenPath);
    failed = true;
  else
    expected = fileread(goldenPath);
    if strcmp(actual, expected)
      fprintf('OK   %s matches golden\n', caseName);
    else
      fprintf('FAIL %s does not match golden (%s)\n', caseName, goldenPath);
      fprintf('--- expected ---\n%s\n--- actual ---\n%s\n', expected, actual);
      failed = true;
    end
  end
end

for k = 1:numel(fns)
  copyfile(fullfile(unsolvedDir, fns{k}), fullfile(stubDir, fns{k}));
end

if failed
  error('check_golden:mismatch', 'Harness output drifted from golden files. See above.');
end

fprintf('\nAll golden checks passed.\n');
