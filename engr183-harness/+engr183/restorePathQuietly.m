function restorePathQuietly(oldPath)
%RESTOREPATHQUIETLY  Restore a saved path without printing shadowing warnings.
%
%   Some Octave builds (notably the WASM/xeus-octave one this harness also
%   runs under) ship a bundled function that gets shadowed by a built-in
%   once the path is restored -- harmless, but distracting to students.
%
%   You should not need to call this yourself.

  warnState = warning('off', 'all');
  path(oldPath);
  warning(warnState);
end
