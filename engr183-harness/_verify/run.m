% RUN  Verify the harness locally: 0/N on unsolved stubs, N/N once solved,
% for every unit (or just one -- see below).
%
% Scratch-only. Run from Octave after `setup` (repo root on the path).
% Restores each unit's unsolved stubs when done, so it is safe to run
% repeatedly and leaves assignments/ untouched afterward.
%
% Verify every unit:
%     octave-cli --no-gui --eval "setup; run('_verify/run.m')"
% Verify just one unit:
%     octave-cli --no-gui --eval "setup; runUnitFilter='unit02'; run('_verify/run.m')"

here = fileparts(mfilename('fullpath'));       % .../_verify
root = fileparts(here);                        % repo root
addpath(here);

units = discoverUnits(root);
if exist('runUnitFilter', 'var')
  units = units(strcmp(units, runUnitFilter));
  if isempty(units)
    error('run:nomatch', 'No unit matching ''%s'' found.', runUnitFilter);
  end
end

for u = 1:numel(units)
  unit = units{u};
  stubDir = fullfile(root, 'assignments', unit);
  solvedDir = fullfile(here, 'solved', unit);
  unsolvedDir = fullfile(here, 'unsolved', unit);

  if exist(solvedDir, 'dir') ~= 7 || exist(unsolvedDir, 'dir') ~= 7
    fprintf('\nSKIP %s (missing _verify/solved or _verify/unsolved fixtures)\n', unit);
    continue;
  end

  fns = unitFunctionFiles(root, unit);
  fnNames = cellfun(@(f) f(1:end-2), fns, 'UniformOutput', false);

  fprintf('\n########## %s ##########\n', unit);

  fprintf('\n=== unsolved stubs (expect 0) ===\n');
  engr183.runTests(unit);

  fprintf('\n=== copying in solved versions ===\n');
  for k = 1:numel(fns)
    copyfile(fullfile(solvedDir, fns{k}), fullfile(stubDir, fns{k}));
  end
  % Octave caches a function by the path it first loaded it from;
  % overwriting the file on disk doesn't reliably invalidate that cache
  % (even rehash doesn't help -- only clear <name> does).
  if ~isempty(fnNames)
    clear(fnNames{:});
  end

  fprintf('\n=== solved (expect full marks) ===\n');
  engr183.runTests(unit);

  fprintf('\n=== restoring unsolved stubs ===\n');
  for k = 1:numel(fns)
    copyfile(fullfile(unsolvedDir, fns{k}), fullfile(stubDir, fns{k}));
  end
  fprintf('Done. assignments/%s restored to unsolved stubs.\n', unit);
end
