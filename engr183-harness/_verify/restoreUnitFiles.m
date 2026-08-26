function restoreUnitFiles(assignDir, sourceDir, fnNames)
%RESTOREUNITFILES  Wipe every *.m file in ASSIGNDIR and replace it with an
%   exact copy of SOURCEDIR's *.m files, then clear the given function
%   names from Octave's function cache (overwriting a file on disk does
%   not reliably invalidate that cache -- only clear(...) does).
%
%   Scratch-only, used by regression_*.m driver scripts to reset
%   assignments/<unit>/ between deliberately broken/edge-case fixtures.

  d = dir(fullfile(assignDir, '*.m'));
  for k = 1:numel(d)
    delete(fullfile(assignDir, d(k).name));
  end
  s = dir(fullfile(sourceDir, '*.m'));
  for k = 1:numel(s)
    copyfile(fullfile(sourceDir, s(k).name), fullfile(assignDir, s(k).name));
  end
  if ~isempty(fnNames)
    clear(fnNames{:});
  end
end
