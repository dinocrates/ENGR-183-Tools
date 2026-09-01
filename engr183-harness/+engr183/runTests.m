function varargout = runTests(unit, varargin)
%RUNTESTS  Check your work for one ENGR-183 unit against the rubric.
%
%   ENGR183.RUNTESTS('unit01')
%       Runs every rubric criterion for that unit and prints a report
%       showing which ones you have met and which you have not.
%
%   R = ENGR183.RUNTESTS('unit01')
%       Also returns a struct array of results, one entry per criterion,
%       with fields: name, points, earned, passed, message.
%
%   ENGR183.RUNTESTS('unit01', 'showHidden', true)
%       Instructor use.  Includes criteria marked hidden.
%
%   You can run this as many times as you like.  It never submits
%   anything and it never changes your files.

  % ---- options ----------------------------------------------------------
  showHidden = false;
  for k = 1:2:numel(varargin)
    switch lower(varargin{k})
      case 'showhidden'
        showHidden = logical(varargin{k+1});
      otherwise
        error('engr183:runTests:badOption', ...
              'Unknown option ''%s''.', varargin{k});
    end
  end

  if nargin < 1 || ~ischar(unit)
    error('engr183:runTests:badUnit', ...
          'Give the unit name as text, for example: engr183.runTests(''unit01'')');
  end

  root = engr183.root();
  workDir = fullfile(root, 'assignments', unit);
  testDir = fullfile(root, 'tests');

  if exist(workDir, 'dir') ~= 7
    error('engr183:runTests:noUnit', ...
          ['No assignment folder found for ''%s''.\n' ...
           'Looked in: %s\n' ...
           'Check the spelling, or pull the latest version of the repo.'], ...
          unit, workDir);
  end

  % ---- put the student's work and the test specs on the path ------------
  oldPath = path();
  cleanup = onCleanup(@() engr183.restorePathQuietly(oldPath));
  addpath(workDir);
  addpath(testDir);

  % Unit ids may contain hyphens (e.g. 'u02-gp02-tensile') since they only
  % need to be valid directory/URL path segments everywhere else -- but an
  % Octave function name can't contain one. Sanitizing only here, for the
  % spec-function lookup, keeps assignments/<unit>/ and
  % engr183.runTests('<unit>')'s own argument hyphenated (unchanged for
  % every existing hyphen-free unit id) while still resolving to a legal
  % '<unit>_tests' function name on disk.
  specFn = sprintf('%s_tests', strrep(unit, '-', '_'));
  if exist(specFn, 'file') ~= 2
    error('engr183:runTests:noSpecs', ...
          'No test file named %s.m was found in %s', specFn, testDir);
  end
  specs = feval(specFn);

  if ~iscell(specs)
    error('engr183:runTests:badSpecs', ...
          '%s.m must return a cell array of engr183.spec(...) entries.', specFn);
  end

  % ---- run --------------------------------------------------------------
  results = struct('name', {}, 'points', {}, 'earned', {}, ...
                   'passed', {}, 'message', {}, 'hidden', {});
  noisy = [];   % criteria that passed but printed stray output

  for k = 1:numel(specs)
    s = specs{k};
    if s.hidden && ~showHidden
      continue;
    end

    passed = false;
    message = '';

    if exist(s.fn, 'file') ~= 2 && exist(s.fn) ~= 2 %#ok<EXIST>
      message = sprintf('function %s.m was not found - have you created it yet?', s.fn);
    else
      try
        % evalc captures anything the student's code prints, so a missing
        % semicolon does not flood the report.  The captured text is kept
        % and shown only when it is relevant.
        stray = evalc('actual = feval(s.fn, s.args{:});');
        [passed, message] = engr183.compare(actual, s.expected, s.tol);
        if passed && ~isempty(strtrim(stray))
          noisy(end+1) = k; %#ok<AGROW>
        end
      catch err
        message = sprintf('your code raised an error: %s%s', ...
                          engr183.flatten(err.message), ...
                          engr183.errorLocation(err));
      end
    end

    results(end+1) = struct('name', s.name, ...
                            'points', s.points, ...
                            'earned', passed * s.points, ...
                            'passed', passed, ...
                            'message', message, ...
                            'hidden', s.hidden); %#ok<AGROW>
  end

  engr183.report(unit, results, noisy);

  if nargout > 0
    varargout{1} = results;
  end
end
