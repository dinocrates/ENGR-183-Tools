% CHECK_GOLDEN  CI guardrail on Goal 3 (byte-identical rubric output).
%
% Runs engr183.runTests(unit) for every unit that has committed golden
% files, for both the unsolved and solved cases, and compares the exact
% output against those golden files. Units without golden files yet
% (freshly scaffolded via new_unit.py, still being written) are skipped,
% not failed -- run regenerate_golden.m once a unit is ready to opt it
% into this check.
%
% Run from Octave with the repo root on the path (after `setup`):
%     octave-cli --no-gui --eval "setup; run('_verify/check_golden.m')"

here = fileparts(mfilename('fullpath'));
root = fileparts(here);
addpath(here);

units = discoverUnits(root);
if isempty(units)
  error('check_golden:nounits', 'No units found under %s', fullfile(root, 'assignments'));
end

goldenDir = fullfile(here, 'golden');
failed = false;
checkedAny = false;

for u = 1:numel(units)
  unit = units{u};
  stubDir = fullfile(root, 'assignments', unit);
  solvedDir = fullfile(here, 'solved', unit);
  unsolvedDir = fullfile(here, 'unsolved', unit);

  goldenUnsolved = fullfile(goldenDir, sprintf('%s_unsolved.txt', unit));
  goldenSolved = fullfile(goldenDir, sprintf('%s_solved.txt', unit));

  if exist(goldenUnsolved, 'file') ~= 2 && exist(goldenSolved, 'file') ~= 2
    fprintf('SKIP %s (no golden files yet)\n', unit);
    continue;
  end
  if exist(unsolvedDir, 'dir') ~= 7 || exist(solvedDir, 'dir') ~= 7
    fprintf('SKIP %s (missing _verify/unsolved or _verify/solved fixtures)\n', unit);
    continue;
  end

  checkedAny = true;
  fns = unitFunctionFiles(root, unit);
  fnNames = cellfun(@(f) f(1:end-2), fns, 'UniformOutput', false);

  cases = {'unsolved', 'solved'};
  for c = 1:numel(cases)
    caseName = cases{c};
    srcDir = unsolvedDir;
    if strcmp(caseName, 'solved')
      srcDir = solvedDir;
    end
    for k = 1:numel(fns)
      copyfile(fullfile(srcDir, fns{k}), fullfile(stubDir, fns{k}));
    end
    % Octave caches a function by the path it first loaded it from;
    % overwriting the file on disk doesn't reliably invalidate that cache
    % (even rehash doesn't help -- only clear <name> does).
    if ~isempty(fnNames)
      clear(fnNames{:});
    end

    actual = evalc(sprintf('engr183.runTests(''%s'')', unit));
    goldenPath = fullfile(goldenDir, sprintf('%s_%s.txt', unit, caseName));

    if exist(goldenPath, 'file') ~= 2
      fprintf('MISSING golden file: %s\n', goldenPath);
      failed = true;
      continue;
    end
    expected = fileread(goldenPath);
    if strcmp(actual, expected)
      fprintf('OK   %s %s matches golden\n', unit, caseName);
    else
      fprintf('FAIL %s %s does not match golden (%s)\n', unit, caseName, goldenPath);
      fprintf('--- expected ---\n%s\n--- actual ---\n%s\n', expected, actual);
      failed = true;
    end
  end

  for k = 1:numel(fns)
    copyfile(fullfile(unsolvedDir, fns{k}), fullfile(stubDir, fns{k}));
  end
end

if ~checkedAny
  fprintf('\nNo units had golden files to check.\n');
end

if failed
  error('check_golden:mismatch', 'Harness output drifted from golden files. See above.');
end

fprintf('\nAll golden checks passed.\n');
