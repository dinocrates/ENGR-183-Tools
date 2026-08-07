function s = sizeStr(value)
%SIZESTR  Short "RxC" description of a value's size, for failure messages.
%
%   You should not need to call this yourself.

  sz = size(value);
  parts = arrayfun(@(d) num2str(d), sz, 'UniformOutput', false);
  s = strjoin(parts, 'x');
end
