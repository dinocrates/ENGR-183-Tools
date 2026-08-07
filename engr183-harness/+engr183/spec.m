function s = spec(name, fn, args, expected, points, varargin)
%SPEC  Build one rubric criterion for the ENGR-183 test harness.
%
%   S = ENGR183.SPEC(NAME, FN, ARGS, EXPECTED, POINTS)
%   S = ENGR183.SPEC(..., TOL)
%   S = ENGR183.SPEC(..., TOL, HIDDEN)
%
%   NAME      Text shown to the student.  Write it as the rubric line, e.g.
%             'addTwo returns the sum of two positive numbers'.
%   FN        Name of the student function to call, as a string.
%   ARGS      Cell array of arguments, e.g. {2, 3}.  Use {} for none.
%   EXPECTED  The value the function should return.
%   POINTS    Points this criterion is worth.
%   TOL       Optional absolute tolerance for numeric comparison.
%             Default 0 (exact).  Use ~1e-9 for anything involving
%             division, sqrt, trig, or accumulated floating point.
%   HIDDEN    Optional logical.  Hidden criteria run during grading but
%             are not revealed in the student-facing report.  Default false.
%
%   Returns a scalar struct.  Collect several into a CELL ARRAY:
%
%       specs = { engr183.spec('...', 'addTwo', {2,3}, 5, 5), ...
%                 engr183.spec('...', 'addTwo', {-1,1}, 0, 5) };

  tol = 0;
  hidden = false;

  if numel(varargin) >= 1 && ~isempty(varargin{1})
    tol = varargin{1};
  end
  if numel(varargin) >= 2 && ~isempty(varargin{2})
    hidden = logical(varargin{2});
  end

  if ~ischar(name)
    error('engr183:spec:badName', 'NAME must be a character string.');
  end
  if ~ischar(fn)
    error('engr183:spec:badFn', 'FN must be a character string.');
  end
  if ~iscell(args)
    error('engr183:spec:badArgs', 'ARGS must be a cell array, e.g. {2, 3}.');
  end

  s = struct('name', name, ...
             'fn', fn, ...
             'args', {args}, ...
             'expected', {expected}, ...
             'points', points, ...
             'tol', tol, ...
             'hidden', hidden);
end
