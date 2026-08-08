function units = discoverUnits(root)
%DISCOVERUNITS  List unit IDs (e.g. {'unit01', 'unit02', ...}) that have an
%   assignments/ subfolder, sorted.
%
%   Scratch-only, used by check_golden.m and regenerate_golden.m so they
%   don't need updating every time a unit is added via new_unit.py.

  assignDir = fullfile(root, 'assignments');
  entries = dir(assignDir);
  units = {};
  for i = 1:numel(entries)
    name = entries(i).name;
    if entries(i).isdir && ~strcmp(name, '.') && ~strcmp(name, '..')
      units{end+1} = name; %#ok<AGROW>
    end
  end
  units = sort(units);
end
