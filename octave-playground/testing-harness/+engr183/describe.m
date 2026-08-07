function s = describe(value)
%DESCRIBE  Short, human-readable description of a value's type and shape.
%
%   Used only in ENGR183.COMPARE's failure messages, e.g.
%   "expected text, got a 1x3 numeric array".
%
%   You should not need to call this yourself.

  if ischar(value)
    s = 'text';
  elseif iscell(value)
    s = sprintf('a %s cell array', engr183.sizeStr(value));
  elseif islogical(value)
    if isscalar(value)
      s = sprintf('a logical (%s)', mat2str(value));
    else
      s = sprintf('a %s logical array', engr183.sizeStr(value));
    end
  elseif isnumeric(value)
    if isscalar(value)
      s = sprintf('the number %s', num2str(value));
    else
      s = sprintf('a %s numeric array', engr183.sizeStr(value));
    end
  else
    s = sprintf('a %s value', class(value));
  end
end
