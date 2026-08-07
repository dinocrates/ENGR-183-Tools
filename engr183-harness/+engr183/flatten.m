function out = flatten(msg)
%FLATTEN  Collapse a multi-line message to a single line for report display.
%
%   ENGR183.FLATTEN(MSG) replaces newlines with spaces and collapses
%   repeated whitespace, so a multi-line Octave error prints as one
%   readable "-> " line in the rubric report instead of breaking it.
%
%   You should not need to call this yourself.

  out = strtrim(regexprep(msg, '\s+', ' '));
end
