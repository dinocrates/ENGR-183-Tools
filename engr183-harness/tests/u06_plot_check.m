function result = u06_plot_check(kind, criterion)
%U06_PLOT_CHECK Inspect one execution per specification invocation.
% Only the two Unit 6 wrappers use this helper. Reset is explicit in each
% *_tests builder; lazy snapshots cache failures as well as successful runs.
% Graphics are copied by known handle, never activated with figure/axes.
% Source methods and interpretation meaning are deliberately manual review.
  persistent snapshots;
  if isempty(snapshots), snapshots = struct(); end
  result = true;
  if strcmp(criterion, 'reset')
    snapshots.(kind) = [];
    return;
  end
  c = contract(kind);
  scriptPath = fullfile(engr183.root(), 'assignments', c.id, c.file);
  if strcmp(criterion, 'personalization')
    personalize(scriptPath);
    return;
  end
  if ~isfield(snapshots, kind) || isempty(snapshots.(kind))
    snapshots.(kind) = capture(scriptPath);
  end
  s = snapshots.(kind);
  require(s.ok, ['Fix the script execution error: ' s.error]);
  switch criterion
    case 'execution'
      return;
    case 'data'
      names = fieldnames(c.data);
      for k = 1:numel(names), variable(s, names{k}, c.data.(names{k})); end
    case 'difference'
      variable(s, 'delta_C', c.lowerA);
      variable(s, 'final_delta_C', c.lowerA(end));
      require(outputValue(s.output, 'a\s*(minus|[-−])\s*b', 24, 'c'), ...
        'Print the final A minus B difference, clearly labeled with its C units.');
    case 'power'
      variable(s, 'power_A_W', c.lowerA);
      variable(s, 'power_B_W', c.lowerB);
    case 'output'
      require(outputValue(s.output, '(?<![a-z])battery\s*a(?![a-z])', 5.68, 'w') && ...
              outputValue(s.output, '(?<![a-z])battery\s*b(?![a-z])', 6.04, 'w'), ...
        'Print each final power with Battery A/B labels and W units, using the calculated arrays.');
    otherwise
      require(isempty(s.graphicsError), ['Graphics inspection needs visual review: ' s.graphicsError]);
      axesList = panels(s);
      switch criterion
        case 'arrangement'
          return;
        case 'top'
          series(axesList{1}, c.time, c.upperA, 'top-panel A');
          series(axesList{1}, c.time, c.upperB, 'top-panel B');
          reference(axesList{1}, c);
        case 'bottom'
          if strcmp(kind, 'apa')
            variable(s, 'power_A_W', c.lowerA);
            variable(s, 'power_B_W', c.lowerB);
          end
          series(axesList{2}, c.time, c.lowerA, 'lower-panel calculated values');
          if strcmp(kind, 'apa'), series(axesList{2}, c.time, c.lowerB, 'lower-panel B power'); end
        case 'labels'
          labels(axesList, kind);
        case {'identification', 'presentation'}
          a = series(axesList{1}, c.time, c.upperA, 'top-panel A');
          b = series(axesList{1}, c.time, c.upperB, 'top-panel B');
          r = reference(axesList{1}, c);
          d = series(axesList{2}, c.time, c.lowerA, 'lower-panel calculated values');
          legendEntry(axesList{1}, a, 'a');
          legendEntry(axesList{1}, b, 'b');
          legendEntry(axesList{1}, r, 'reference');
          if strcmp(kind, 'gp')
            require(style(a, '-', 'o') && style(b, '--', 's') && style(d, '-', 'd') && ...
              strcmp(r.linestyle, '--') && same(r.color, [0 0 0]), ...
              'Use solid/circle A, dashed/square B, solid/diamond difference, and a black dashed limit.');
          else
            labels(axesList, kind);
            e = series(axesList{2}, c.time, c.lowerB, 'lower-panel B power');
            legendEntry(axesList{2}, d, 'a');
            legendEntry(axesList{2}, e, 'b');
            require(sameStyle(a, d) && sameStyle(b, e), ...
              'Keep each battery''s line style and marker shape consistent across panels.');
            require(~sameStyle(a, b), ...
              'Distinguish A and B by line style and/or marker shape, in addition to any color choices.');
          end
        case 'limits'
          require(same(axesList{1}.xlim, [0 c.time(end)]) && same(axesList{2}.xlim, [0 c.time(end)]), ...
            sprintf('Set both x limits to [0 %g] minutes.', c.time(end)));
          if strcmp(kind, 'gp')
            require(same(axesList{1}.ylim, [20 85]) && same(axesList{2}.ylim, [0 30]), ...
              'Use top y limits [20 85] and bottom y limits [0 30].');
          else
            require(includes(axesList{1}.ylim, [2.84 4.20 c.threshold]) && ...
              includes(axesList{2}.ylim, [5.68 8.40]), ...
              'Choose y limits that show all voltage data and the cutoff, and all power values.');
          end
        otherwise
          error('Unknown Unit 6 criterion: %s.', criterion);
      end
  end
end

function c = contract(kind)
  if strcmp(kind, 'gp')
    c.id = 'u06-gp06-cooling'; c.file = 'U06_GP06_CoolingPlots.m';
    c.time = 0:12;
    c.upperA = [25 34 42 49 55 60 64 67 69 71 72 73 74];
    c.upperB = [25 32 37 41 44 46 47 48 49 49 50 50 50];
    c.threshold = 70; c.lowerA = c.upperA - c.upperB;
    c.data = struct('time_min', c.time, 'temp_A_C', c.upperA, ...
      'temp_B_C', c.upperB, 'limit_C', c.threshold);
  else
    c.id = 'u06-apa06-battery-discharge'; c.file = 'U06_APA06_BatteryPlots.m';
    c.time = 0:10:120;
    c.upperA = [4.20 4.08 3.99 3.92 3.87 3.82 3.76 3.66 3.48 3.27 3.08 2.96 2.84];
    c.upperB = [4.20 4.10 4.02 3.97 3.92 3.88 3.84 3.80 3.73 3.58 3.38 3.19 3.02];
    c.threshold = 3.20; c.lowerA = 2 * c.upperA; c.lowerB = 2 * c.upperB;
    c.data = struct('time_min', c.time, 'voltage_A_V', c.upperA, ...
      'voltage_B_V', c.upperB, 'current_A_A', 2 * ones(1,13), ...
      'current_B_A', 2 * ones(1,13), 'cutoff_V', c.threshold);
  end
end

function personalize(scriptPath)
  require(exist(scriptPath, 'file') == 2, ['Create the required script: ' scriptPath]);
  lines = strsplit(fileread(scriptPath), '\n');
  for label = {'Name', 'Date'}
    value = '';
    for k = 1:numel(lines)
      token = regexpi(lines{k}, ['^\s*%\s*' label{1} ':\s*(.*)$'], 'tokens', 'once');
      if ~isempty(token), value = strtrim(token{1}); break; end
    end
    require(~isempty(value) && isempty(regexpi(value, '^replace\s+with(?:\s|$)', 'once')), ...
      ['Fill in the ' label{1} ' comment instead of leaving it blank or at the starter placeholder.']);
  end
end

function s = capture(scriptPath)
% State/cleanup live outside the workspace erased by a student's clear.
  oldPath = path(); oldDir = pwd();
  cleanup = onCleanup(@() restoreState(oldPath, oldDir));
  try
    % close() makes each old figure current before deleting it. The browser
    % toolkit can hang on that reactivation; delete known handles directly.
    delete(findall(0, 'type', 'figure'));
    s = executeScript(scriptPath);
  catch err
    s = struct('ok', false, 'error', err.message, 'output', '', 'vars', struct());
  end
  s.figures = {}; s.graphicsError = '';
  if ~s.ok, return; end
  try
    figures = findall(0, 'type', 'figure');
    for k = 1:numel(figures)
      axesHandles = findall(figures(k), 'type', 'axes');
      a = {};
      for j = 1:numel(axesHandles)
        h = axesHandles(j);
        if any(strcmpi(get(h, 'tag'), {'legend', 'colorbar'})), continue; end
        a{end+1} = readAxes(h);
      end
      s.figures{end+1} = a;
    end
  catch err
    s.graphicsError = err.message;
  end
end

function restoreState(oldPath, oldDir)
  cd(oldDir);
  engr183.restorePathQuietly(oldPath);
end

function s = executeScript(scriptPath)
% source() preserves filename/line in runtime errors. Like unit01_check,
% assign all harness locals AFTER execution: clear must erase only students'
% disposable workspace, never the cache, captured output or cleanup object.
  try
    capturedOutput = evalc('source(scriptPath);');
    scriptError = '';
  catch err
    capturedOutput = '';
    scriptError = [err.message engr183.errorLocation(err)];
  end
  s = struct('ok', isempty(scriptError), 'error', scriptError, ...
    'output', capturedOutput, 'vars', struct());
  names = {'time_min','temp_A_C','temp_B_C','limit_C','delta_C','final_delta_C', ...
    'voltage_A_V','voltage_B_V','current_A_A','current_B_A','cutoff_V','power_A_W','power_B_W'};
  for k = 1:numel(names)
    if exist(names{k}, 'var'), s.vars.(names{k}) = eval(names{k}); end
  end
end

function a = readAxes(h)
  a.position = getpixelposition(h, true);
  a.xlim = get(h, 'xlim'); a.ylim = get(h, 'ylim');
  a.title = textValue(get(get(h, 'title'), 'string'));
  a.xlabel = textValue(get(get(h, 'xlabel'), 'string'));
  a.ylabel = textValue(get(get(h, 'ylabel'), 'string'));
  a.grid = strcmp(get(h, 'xgrid'), 'on') && strcmp(get(h, 'ygrid'), 'on');
  a.lines = {};
  handles = findall(h, 'type', 'line');
  for k = 1:numel(handles)
    l = get(handles(k));
    a.lines{end+1} = struct('handle', handles(k), 'x', l.xdata, 'y', l.ydata, ...
      'linestyle', l.linestyle, 'marker', marker(l.marker), 'color', l.color, 'visible', l.visible);
  end
  a.legendHandles = []; a.legendLabels = {}; a.legendAvailable = true;
  legends = findall(ancestor(h, 'figure'), 'type', 'axes', 'tag', 'legend');
  for k = 1:numel(legends)
    if ~strcmp(get(legends(k), 'visible'), 'on'), continue; end
    peers = getappdata(legends(k), '__peer_objects__');
    if isempty(peers)
      % Legacy gnuplot legend stores plotted objects in userdata.
      info = get(legends(k), 'userdata');
      if isstruct(info) && isfield(info, 'handles'), peers = info.handles; end
    end
    if isempty(peers), a.legendAvailable = false; continue; end
    belongs = arrayfun(@(p) isequal(ancestor(p, 'axes'), h), peers);
    if ~any(belongs), continue; end
    strings = get(legends(k), 'string');
    if ischar(strings), strings = cellstr(strings); end
    if numel(peers) ~= numel(strings), a.legendAvailable = false; continue; end
    peers = peers(belongs); strings = strings(belongs);
    a.legendHandles = [a.legendHandles; peers(:)];
    a.legendLabels = [a.legendLabels; strings(:)];
  end
end

function a = panels(s)
  require(numel(s.figures) == 1, 'Create exactly one figure containing both panels.');
  a = s.figures{1};
  require(numel(a) == 2, 'Use two plotting axes: subplot(2,1,1) and subplot(2,1,2).');
  if a{1}.position(2) < a{2}.position(2), a = a([2 1]); end
  top = a{1}.position; bottom = a{2}.position;
  overlap = min(top(1)+top(3),bottom(1)+bottom(3)) - max(top(1),bottom(1));
  require(top(2) >= bottom(2)+bottom(4)-1 && overlap > 0, ...
    'Arrange the two panels vertically, with temperatures/voltages above the calculated values.');
end

function variable(s, name, expected)
  require(isfield(s.vars, name), ['Create the variable ' name '.']);
  require(same(s.vars.(name), expected), ...
    sprintf('Check every value of %s: expected a finite vector with %d sample(s), not a matrix.', name, numel(expected)));
end

function yes = same(actual, expected)
  yes = isnumeric(actual) && isreal(actual) && isvector(actual) && ...
    numel(actual) == numel(expected) && all(isfinite(actual(:))) && ...
    all(abs(actual(:)-expected(:)) <= 1e-8);
end

function l = series(a, x, y, description)
  for k = 1:numel(a.lines)
    l = a.lines{k};
    if strcmp(l.visible, 'on') && same(l.x,x) && same(l.y,y), return; end
  end
  error('Plot all 13 %s samples against the actual time_min values in the correct panel.', description);
end

function l = reference(a, c)
  for k = 1:numel(a.lines)
    l = a.lines{k};
    if strcmp(l.visible, 'on') && isnumeric(l.x) && isvector(l.x) && numel(l.x) >= 2 && ...
       all(isfinite(l.x(:))) && same(l.y, c.threshold*ones(size(l.x))) && ...
       abs(min(l.x)-c.time(1)) <= 1e-8 && abs(max(l.x)-c.time(end)) <= 1e-8 && ...
       ~strcmp(l.linestyle, 'none')
      return;
    end
  end
  error('Use plot to draw the constant %g reference across 0 through %g minutes in the top panel.', c.threshold, c.time(end));
end

function labels(a, kind)
  for k = 1:2
    title = lower(strtrim(a{k}.title)); x = lower(a{k}.xlabel); y = lower(a{k}.ylabel);
    require(numel(title) >= 3 && isempty(regexp(title, '^(title|plot|panel|subplot|figure|top|bottom)(\s*\d*)?$', 'once')), ...
      'Give each panel a descriptive title identifying what it shows.');
    require(has(x, 'time|elapsed|duration') && has(x, 'min'), 'Label each horizontal axis with time and minutes.');
    if strcmp(kind, 'gp')
      quantity = has(y, 'temp|thermal');
      if k == 2, quantity = has(y, 'diff|delta|a\s*(minus|[-−])\s*b'); end
      unit = has(y, '(^|[^a-z])c([^a-z]|$)|celsius');
    elseif k == 1
      quantity = has(y, 'voltage|potential'); unit = has(y, '(^|[^a-z])(v|volts?)([^a-z]|$)');
    else
      quantity = has(y, 'power'); unit = has(y, '(^|[^a-z])(w|watts?)([^a-z]|$)');
    end
    require(quantity && unit, 'Label each vertical axis with its plotted quantity and units.');
    require(a{k}.grid, 'Turn on both horizontal and vertical grid directions in each panel.');
  end
end

function legendEntry(a, line, role)
  require(a.legendAvailable, 'Legend association is unavailable in this graphics toolkit; it needs visual review.');
  index = find(a.legendHandles == line.handle);
  require(~isempty(index), 'Include each required series in the panel legend.');
  text = lower(textValue(a.legendLabels(index)));
  if strcmp(role, 'reference')
    good = has(text, 'limit|cut\s*-?\s*off|threshold|reference|70|3\.2');
  else
    other = 'b'; if strcmp(role, 'b'), other = 'a'; end
    good = has(text, ['(^|[^a-z])' role '([^a-z]|$)']) && ...
      ~has(text, ['(^|[^a-z])' other '([^a-z]|$)']);
  end
  require(good, 'Associate each legend label with the correct A, B, or reference series; check label order/handles.');
end

function yes = outputValue(output, label, value, unit)
  lines = strsplit(lower(regexprep(output, '\x1b\[[0-9;]*[a-zA-Z]', '')), '\n');
  yes = false;
  number = '([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)';
  for k = 1:numel(lines)
    if ~has(lines{k}, label), continue; end
    segment = lines{k};
    % Keep values associated with the right battery even when both are
    % printed on one line. A unit in a shared heading (Power (W)) is fine.
    starts = regexp(segment, '(?<![a-z])battery\s*[ab](?![a-z])');
    if numel(starts) > 1
      selected = regexp(segment, label, 'once');
      next = starts(starts > selected);
      if isempty(next), last = numel(segment); else, last = next(1)-1; end
      segment = segment(selected:last);
    end
    unitPattern = ['(?<![a-z])' unit '(?:elsius|atts?)?(?![a-z])'];
    if ~has(lines{k}, unitPattern), continue; end
    tokens = regexp(segment, number, 'tokens');
    for j = 1:numel(tokens)
      if abs(str2double(tokens{j}{1})-value) <= 1e-6, yes = true; return; end
    end
  end
end

function yes = includes(limits, values)
  yes = isnumeric(limits) && numel(limits) == 2 && all(isfinite(limits)) && ...
    limits(1) <= min(values)+1e-8 && limits(2) >= max(values)-1e-8;
end
function yes = style(l, lineStyle, mark)
  yes = strcmp(l.linestyle, lineStyle) && strcmp(l.marker, mark);
end
function yes = sameStyle(a, b)
  yes = strcmp(a.linestyle, b.linestyle) && strcmp(a.marker, b.marker);
end
function m = marker(m)
  if strcmp(m, 'square'), m = 's'; elseif strcmp(m, 'diamond'), m = 'd'; end
end
function value = textValue(value)
  if iscell(value), value = strjoin(value(:)', ' '); end
  if ~ischar(value), value = ''; elseif size(value,1)>1, value = strjoin(cellstr(value)', ' '); end
end
function yes = has(text, pattern)
  yes = ~isempty(regexp(text, pattern, 'once'));
end
function require(yes, message)
  if ~yes, error('%s', message); end
end
