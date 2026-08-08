% REGENERATE_GOLDEN  Rewrite _verify/golden/*.txt from the harness's actual
% current output. Only run this after a deliberate, reviewed change to the
% rubric report format -- it's meant to update the CI guardrail (see
% check_golden.m), not to silently paper over an unintended regression.
%
%     octave-cli --no-gui --eval "regenerate_golden"

here = fileparts(mfilename('fullpath'));
root = fileparts(here);
goldenDir = fullfile(here, 'golden');
stubDir = fullfile(root, 'assignments', 'unit00');
solvedDir = fullfile(here, 'solved');
unsolvedDir = fullfile(here, 'unsolved');
fns = {'addTwo.m', 'circleArea.m', 'greet.m'};

if ~exist(goldenDir, 'dir')
  mkdir(goldenDir);
end

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
  fid = fopen(goldenPath, 'w');
  fputs(fid, actual);
  fclose(fid);
  fprintf('wrote %s\n', goldenPath);
end

for k = 1:numel(fns)
  copyfile(fullfile(unsolvedDir, fns{k}), fullfile(stubDir, fns{k}));
end

fprintf('done.\n');
