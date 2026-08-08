function fns = unitFunctionFiles(root, unit)
%UNITFUNCTIONFILES  List the .m filenames (e.g. {'addTwo.m', ...}) in a
%   unit's assignments/<unit>/ folder, sorted.
%
%   Scratch-only, used by check_golden.m and regenerate_golden.m.

  d = dir(fullfile(root, 'assignments', unit, '*.m'));
  fns = sort({d.name});
end
