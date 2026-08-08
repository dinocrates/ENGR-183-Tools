% REGENERATE_GOLDEN  Rewrite _verify/golden/*.txt from the harness's actual
% current output, for every unit that has _verify/solved and
% _verify/unsolved fixtures (or just one -- see below).
%
% Only run this after a deliberate, reviewed change to a unit's solved
% reference or the rubric report format -- it's meant to update the CI
% guardrail (check_golden.m), not to paper over a regression.
%
% Regenerate every unit:
%     octave-cli --no-gui --eval "setup; run('_verify/regenerate_golden.m')"
% Regenerate just one unit:
%     octave-cli --no-gui --eval "setup; regenUnitFilter='unit02'; run('_verify/regenerate_golden.m')"

here = fileparts(mfilename('fullpath'));
root = fileparts(here);
addpath(here);

units = discoverUnits(root);
if exist('regenUnitFilter', 'var')
  units = units(strcmp(units, regenUnitFilter));
  if isempty(units)
    error('regenerate_golden:nomatch', 'No unit matching ''%s'' found.', regenUnitFilter);
  end
end

goldenDir = fullfile(here, 'golden');
if ~exist(goldenDir, 'dir')
  mkdir(goldenDir);
end

for u = 1:numel(units)
  unit = units{u};
  stubDir = fullfile(root, 'assignments', unit);
  solvedDir = fullfile(here, 'solved', unit);
  unsolvedDir = fullfile(here, 'unsolved', unit);

  if exist(solvedDir, 'dir') ~= 7 || exist(unsolvedDir, 'dir') ~= 7
    fprintf('SKIP %s (missing _verify/solved or _verify/unsolved fixtures -- add them first)\n', unit);
    continue;
  end

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
    fid = fopen(goldenPath, 'w');
    fputs(fid, actual);
    fclose(fid);
    fprintf('wrote %s\n', goldenPath);
  end

  for k = 1:numel(fns)
    copyfile(fullfile(unsolvedDir, fns{k}), fullfile(stubDir, fns{k}));
  end
end

fprintf('done.\n');
