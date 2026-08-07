function r = root()
%ROOT  Absolute path to the repo root (the folder containing setup.m).
%
%   You should not need to call this yourself.

  here = fileparts(mfilename('fullpath'));   % .../+engr183
  r = fileparts(here);                        % .../  (one level up)
end
