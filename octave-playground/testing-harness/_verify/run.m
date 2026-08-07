% RUN  Verify the harness locally: 0/6 on unsolved stubs, 6/6 once solved.
%
% Scratch-only. Run from Octave after `setup` (repo root on the path).
% Restores the unsolved stubs from _verify/unsolved/ when done, so it is
% safe to run repeatedly and leaves assignments/unit00/ untouched afterward.

here = fileparts(mfilename('fullpath'));       % .../_verify
root = fileparts(here);                        % repo root
stubDir = fullfile(root, 'assignments', 'unit00');
solvedDir = fullfile(here, 'solved');
unsolvedDir = fullfile(here, 'unsolved');

fns = {'addTwo.m', 'circleArea.m', 'greet.m'};

fprintf('\n=== unsolved stubs (expect 0/6) ===\n');
engr183.runTests('unit00');

fprintf('\n=== copying in solved versions ===\n');
for k = 1:numel(fns)
  copyfile(fullfile(solvedDir, fns{k}), fullfile(stubDir, fns{k}));
end

fprintf('\n=== solved (expect 6/6) ===\n');
engr183.runTests('unit00');

fprintf('\n=== restoring unsolved stubs ===\n');
for k = 1:numel(fns)
  copyfile(fullfile(unsolvedDir, fns{k}), fullfile(stubDir, fns{k}));
end

fprintf('Done. assignments/unit00 restored to unsolved stubs.\n');
