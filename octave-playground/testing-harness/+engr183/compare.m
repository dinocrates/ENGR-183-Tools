function [ok, msg] = compare(actual, expected, tol)
%COMPARE  Compare a returned value against the expected value.
%
%   [OK, MSG] = ENGR183.COMPARE(ACTUAL, EXPECTED, TOL)
%
%   Returns OK as true/false and MSG as a short explanation when OK is
%   false.  Handles numeric arrays (with absolute tolerance and NaN-aware
%   matching), logicals, character strings, and cell arrays.
%
%   You should not need to call this yourself.

  if nargin < 3 || isempty(tol)
    tol = 0;
  end

  ok = false;
  msg = '';

  % --- character strings -------------------------------------------------
  if ischar(expected) || ischar(actual)
    if ~ischar(actual)
      msg = sprintf('expected text, got %s', engr183.describe(actual));
      return;
    end
    if ~ischar(expected)
      msg = sprintf('expected %s, got text', engr183.describe(expected));
      return;
    end
    ok = strcmp(actual, expected);
    if ~ok
      msg = sprintf('expected ''%s'', got ''%s''', expected, actual);
    end
    return;
  end

  % --- cell arrays -------------------------------------------------------
  if iscell(expected) || iscell(actual)
    if ~iscell(actual) || ~iscell(expected)
      msg = sprintf('expected %s, got %s', ...
                    engr183.describe(expected), engr183.describe(actual));
      return;
    end
    if ~isequal(size(actual), size(expected))
      msg = sprintf('expected a %s cell array, got %s', ...
                    engr183.sizeStr(expected), engr183.sizeStr(actual));
      return;
    end
    for k = 1:numel(expected)
      [elemOk, elemMsg] = engr183.compare(actual{k}, expected{k}, tol);
      if ~elemOk
        msg = sprintf('element %d: %s', k, elemMsg);
        return;
      end
    end
    ok = true;
    return;
  end

  % --- numeric and logical ----------------------------------------------
  if (isnumeric(expected) || islogical(expected)) && ...
     (isnumeric(actual)   || islogical(actual))

    if ~isequal(size(actual), size(expected))
      msg = sprintf('expected a %s result, got %s', ...
                    engr183.sizeStr(expected), engr183.sizeStr(actual));
      return;
    end

    a = double(actual(:));
    e = double(expected(:));

    bothNaN = isnan(a) & isnan(e);
    oneNaN  = xor(isnan(a), isnan(e));

    if any(oneNaN)
      msg = sprintf('expected %s, got %s', ...
                    engr183.describe(expected), engr183.describe(actual));
      return;
    end

    d = abs(a - e);
    d(bothNaN) = 0;

    if all(d <= tol)
      ok = true;
    else
      if isscalar(a)
        msg = sprintf('expected %s, got %s', ...
                      engr183.describe(expected), engr183.describe(actual));
      else
        [worst, idx] = max(d);
        msg = sprintf('values differ; largest gap %.6g at element %d', ...
                      worst, idx);
      end
    end
    return;
  end

  % --- fallback ----------------------------------------------------------
  ok = isequal(actual, expected);
  if ~ok
    msg = sprintf('expected %s, got %s', ...
                  engr183.describe(expected), engr183.describe(actual));
  end
end
