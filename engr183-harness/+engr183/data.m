function p = data(name)
%DATA  Full path to a data file that ships with an ENGR-183 assignment.
%
%   ENGR183.DATA(NAME) returns the absolute path to the bundled data file
%   NAME (for example 'readings.csv'), so your code can open it the same
%   way whether it runs in the browser Playground or in desktop Octave:
%
%       raw = csvread(engr183.data('readings.csv'));
%       fid = fopen(engr183.data('log.txt'), 'r');
%
%   NAME is just the file's own name -- ENGR183.DATA looks through the
%   assignment folders and finds which one bundles it. Give it the name
%   exactly as the unit's instructions write it, including the extension.
%
%   Why not just csvread('readings.csv')?  A bare filename only works when
%   the data file happens to sit in your current folder. ENGR183.DATA
%   always resolves to the real location, so it keeps working from a
%   function file, from Run Tests, and on a machine where you cloned the
%   repo somewhere other than your Desktop.
%
%   Errors if no assignment bundles a file by that name (check the
%   spelling, or pull the latest version of the repo).

  if nargin < 1 || ~ischar(name) || isempty(name)
    error('engr183:data:badName', ...
          ['Give the data file name as text, for example:\n' ...
           '    engr183.data(''readings.csv'')']);
  end

  [nameDir, ~, ~] = fileparts(name);
  if ~isempty(nameDir)
    error('engr183:data:badName', ...
          ['Pass only the file name, not a path -- engr183.data finds the\n' ...
           'folder for you. Got: ''%s'''], name);
  end

  assignmentsDir = fullfile(engr183.root(), 'assignments');
  entries = dir(assignmentsDir);
  hits = {};
  for k = 1:numel(entries)
    e = entries(k);
    if ~e.isdir || strcmp(e.name, '.') || strcmp(e.name, '..')
      continue;
    end
    candidate = fullfile(assignmentsDir, e.name, name);
    if exist(candidate, 'file') == 2
      hits{end+1} = candidate; %#ok<AGROW>
    end
  end

  if isempty(hits)
    error('engr183:data:notFound', ...
          ['No data file named ''%s'' ships with any assignment.\n' ...
           'Looked under: %s\n' ...
           'Check the spelling, or pull the latest version of the repo.'], ...
          name, assignmentsDir);
  end
  if numel(hits) > 1
    error('engr183:data:ambiguous', ...
          'More than one assignment bundles a file named ''%s''.', name);
  end
  p = hits{1};
end
