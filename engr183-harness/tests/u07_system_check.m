function result = u07_system_check(kind, criterion)
%U07_SYSTEM_CHECK One isolated main-script execution per Run Tests invocation.
% Numerical/graphics/output evidence is cached, including failed executions.
% Source algorithms, interpretation and exported PNG remain instructor review.
  persistent snapshots;
  if isempty(snapshots), snapshots = struct(); end
  result = true;
  if strcmp(criterion, 'reset')
    snapshots.(kind) = [];
    clear solve_checked_system;
    return;
  end
  c = contract(kind);
  directory = fullfile(engr183.root(), 'assignments', c.id);
  scriptPath = fullfile(directory, c.file);
  if strcmp(criterion, 'personalization'), personalize(scriptPath); return; end
  if strcmp(criterion, 'helper'), checkHelper(directory); return; end
  if ~isfield(snapshots, kind) || isempty(snapshots.(kind))
    snapshots.(kind) = capture(scriptPath);
  end
  s = snapshots.(kind);
  switch criterion
    case 'execution'
      require(s.ok, ['Fix the script execution error: ' s.error]);
    case 'inputs'
      names = fieldnames(c.inputs);
      for k = 1:numel(names)
        value = c.inputs.(names{k});
        tol = 1e-12;
        if isscalar(value) && value > 0 && value < 1e-6, tol = value * 1e-12; end
        variable(s, names{k}, value, tol);
      end
    case 'matrix'
      variable(s, c.matrix, c.M, 1e-12, c.matrixHint);
      variable(s, c.rhs, c.b, 1e-12);
    case 'baseline'
      variable(s, c.solution, c.x, c.valueTol);
      variable(s, 'matrix_rank', 3, 1e-12);
      variable(s, 'condition_number', cond(c.M), c.condTol);
    case 'residual'
      M = numeric(s, c.matrix, [3 3]); x = numeric(s, c.solution, [3 1]);
      b = numeric(s, c.rhs, [3 1]);
      residual(s, c.residual, c.maximum, M*x-b, c.threshold);
    case 'known'
      if strcmp(kind, 'gp')
        variable(s, 'known_b_V', c.knownB, 1e-12);
        variable(s, 'expected_known_voltage_V', c.knownX, 1e-12);
      else
        variable(s, 'known_sensor_mV', c.knownB, 1e-12);
        variable(s, 'known_force_N', c.knownX, 1e-12);
      end
      x = numeric(s, c.knownSolution, [3 1]);
      actualError = norm(x-c.knownX, Inf);
      require(actualError < c.knownTol, 'Check the independent known answer; a true flag alone does not verify the solution.');
      M = numeric(s, c.matrix, [3 3]);
      variable(s, c.knownResidual, M*x-c.knownB, c.threshold/100);
      require(norm(s.vars.(c.knownResidual), Inf) < c.threshold, 'The known-case residual must pass the supplied voltage/reading tolerance.');
      variable(s, 'known_condition_number', cond(c.M), c.condTol);
      variable(s, c.knownError, actualError, c.knownTol/100);
      e = s.vars.(c.knownError);
      require(e >= 0 && e < c.knownTol, 'known_error must be a nonnegative infinity norm below the supplied tolerance.');
      require(isfield(s.vars, 'known_test_passed') && ...
        (islogical(s.vars.known_test_passed) || isnumeric(s.vars.known_test_passed)) && ...
        isequal(s.vars.known_test_passed, true), 'Set known_test_passed from the actual known-answer error.');
    case 'application'
      if strcmp(kind, 'gp')
        variable(s, 'source_current_mA', 1000*(12-c.x(1))/1000, 1e-8, 'Convert A to mA by multiplying by 1000.');
        variable(s, 'link_current_mA', [c.x(1)-c.x(2); c.x(2)-c.x(3)], 1e-8);
        variable(s, 'ground_current_mA', c.x, 1e-8);
        i = numeric(s, 'source_current_mA', [1 1]);
        l = numeric(s, 'link_current_mA', [2 1]); g = numeric(s, 'ground_current_mA', [3 1]);
        balance = [i-l(1)-g(1); l(1)-l(2)-g(2); l(2)-g(3)];
        residual(s, 'kcl_balance_mA', 'max_kcl_balance_mA', balance, 1e-10);
      else
        variable(s, 'input_change_pct', 100*norm(c.changedB-c.b)/norm(c.b), 1e-8, ...
          'Use the whole-vector 2-norm ratio and multiply by 100, not a fraction or component percentage.');
        variable(s, 'force_change_pct', 100*norm(c.changedX-c.x)/norm(c.x), 1e-6, ...
          'Use the whole-vector 2-norm ratio and multiply by 100, not a fraction or component percentage.');
      end
    case 'change'
      variable(s, c.changedRhs, c.changedB, 1e-12);
      variable(s, c.changedSolution, c.changedX, c.valueTol);
      M = numeric(s, c.matrix, [3 3]); x = numeric(s, c.changedSolution, [3 1]);
      b = numeric(s, c.changedRhs, [3 1]);
      residual(s, c.changedResidual, c.changedMaximum, M*x-b, c.threshold);
      variable(s, 'changed_condition_number', cond(c.M), c.condTol);
      if strcmp(kind, 'gp')
        variable(s, 'supply_change_pct', -10, 1e-8, 'The supply change is signed: the supply decreased.');
        variable(s, 'voltage_change_pct', 10, 1e-8, 'Use 100 times the whole-vector 2-norm ratio (a positive magnitude).');
      else
        variable(s, 'delta_force_N', c.changedX-c.x, 1e-6);
      end
    case 'plot'
      checkPlot(s, c, kind);
    case 'output'
      checkOutput(s.output, c, kind);
    otherwise
      error('Unknown Unit 7 criterion: %s.', criterion);
  end
end

function c = contract(kind)
  if strcmp(kind, 'gp')
    c.id = 'u07-gp07-circuit'; c.file = 'U07_GP07_Circuit.m';
    c.inputs = struct('supply_V',12,'changed_supply_V',10.8,'resistance_ohm',1000, ...
      'tolerance_V',1e-10,'tolerance_mA',1e-10,'node_number',[1;2;3]);
    c.matrix = 'A'; c.M = [3 -1 0; -1 3 -1; 0 -1 2];
    c.matrixHint = 'Check each coefficient and sign in A against the three supplied node equations.';
    c.rhs = 'b_V'; c.b = [12;0;0]; c.solution = 'node_voltage_V';
    c.residual = 'residual_V'; c.maximum = 'max_residual_V'; c.threshold = 1e-10;
    c.knownB = [13;0;0]; c.knownX = [5;2;1]; c.knownSolution = 'known_voltage_V';
    c.knownResidual = 'known_residual_V'; c.knownError = 'known_error_V'; c.knownTol = 1e-10;
    c.changedRhs = 'changed_b_V'; c.changedB = [10.8;0;0]; c.changedSolution = 'changed_node_voltage_V';
    c.changedResidual = 'changed_residual_V'; c.changedMaximum = 'changed_max_residual_V';
    c.valueTol = 1e-8; c.condTol = 1e-6;
  else
    c.id = 'u07-apa07-force-recovery'; c.file = 'U07_APA07_ForceRecovery.m';
    c.inputs = struct('sensor_mV',[118;117.96;54],'known_force_N',[20;-10;30], ...
      'known_sensor_mV',[21;20.99;26.5],'delta_sensor_mV',[0;0.020;0], ...
      'residual_tolerance_mV',1e-9,'force_tolerance_N',1e-8,'component_number',[1;2;3]);
    c.matrix = 'C'; c.M = [1 .200 .10; 1 .201 .10; .05 .150 .90];
    c.matrixHint = 'Retain 0.201 in channel 2 and use columns in [Fx; Fy; Fz] order.';
    c.rhs = 'sensor_mV'; c.b = [118;117.96;54]; c.solution = 'force_N';
    c.residual = 'residual_mV'; c.maximum = 'max_residual_mV'; c.threshold = 1e-9;
    c.knownB = [21;20.99;26.5]; c.knownX = [20;-10;30]; c.knownSolution = 'recovered_known_force_N';
    c.knownResidual = 'known_residual_mV'; c.knownError = 'known_error_N'; c.knownTol = 1e-8;
    c.changedRhs = 'changed_sensor_mV'; c.changedB = c.b+[0;.020;0]; c.changedSolution = 'changed_force_N';
    c.changedResidual = 'changed_residual_mV'; c.changedMaximum = 'changed_max_residual_mV';
    c.valueTol = 1e-6; c.condTol = 1e-3;
  end
  c.x = c.M\c.b; c.changedX = c.M\c.changedB;
end

function personalize(scriptPath)
  require(exist(scriptPath, 'file') == 2, ['Create the required main script: ' scriptPath]);
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

function cleanup = projectState(directory)
  oldPath = path(); oldDir = pwd();
  cleanup = onCleanup(@() restoreState(oldPath, oldDir));
  % Preserve the meaning of relative caller path entries while changing cwd.
  % Otherwise Octave removes them with warnings, misreported as student output.
  entries = strsplit(oldPath,pathsep());
  changed = false;
  for k = 1:numel(entries)
    if ~isempty(entries{k}) && ~strcmp(entries{k},'.') && ~is_absolute_filename(entries{k})
      entries{k} = fullfile(oldDir,entries{k});
      changed = true;
    end
  end
  % Avoid re-running toolkit PKG_ADD hooks for an already absolute WASM path.
  if changed, engr183.restorePathQuietly(strjoin(entries,pathsep())); end
  cd(directory); addpath(directory, '-begin');
  clear solve_checked_system;
end
function restoreState(oldPath, oldDir)
  cd(oldDir); engr183.restorePathQuietly(oldPath);
  clear solve_checked_system;
end

function checkHelper(directory)
  cleanup = projectState(directory);
  require(exist(fullfile(directory,'solve_checked_system.m'),'file') == 2, 'Create solve_checked_system.m in this project.');
  valid = { [2 0;0 4], [6;-8], [3;-2]; ...
    [4 -1 0;-1 4 -1;0 -1 3], [2;4;7], [1;2;3]; ...
    4, 10, 2.5; [2 0;0 4], [0;0], [0;0] };
  for k = 1:size(valid,1)
    A = valid{k,1}; b = valid{k,2};
    try
      [x,r,q] = solve_checked_system(A,b);
    catch err
      error('Helper must solve finite full-rank %d-by-%d systems: %s%s', ...
        size(A,1),size(A,2),err.message,engr183.errorLocation(err));
    end
    require(same(x,valid{k,3},1e-10) && same(r,A*x-b,1e-12) && norm(r,Inf)<1e-10 && ...
      same(q,cond(A),1e-8), 'Return [x, residual, condition_number], with x and residual columns; solve general 2-by-2 and 1-by-1 inputs too.');
  end
  invalid = {ones(2,3),[1;2];eye(2),[1 2];eye(3),[1;2];[],[]; ...
    [NaN 0;0 1],[1;2];[Inf 0;0 1],[1;2];eye(2),[NaN;2];eye(2),[1;Inf]; ...
    [1 1i;0 1],[1;2];eye(2),[1;2+1i];'ab',[1;2];eye(2),'ab'; ...
    {1},1;1,{1};ones(2,2,2),[1;2];[1 1;2 2],[2;4];[1 1;2 2],[2;5]};
  for k = 1:size(invalid,1)
    rejected = false;
    try
      [x,r,q] = solve_checked_system(invalid{k,1},invalid{k,2});
    catch
      rejected = true;
    end
    require(rejected, ['Helper must throw an error for invalid dimensions/types/nonfinite inputs and rank-deficient A. ' ...
      'A singular-solve warning is insufficient; reject rank(A) < n_cols.']);
  end
  % The sensitive APA matrix is valid: no arbitrary condition-number cutoff.
  C = [1 .200 .10;1 .201 .10;.05 .150 .90]; b = [118;117.96;54];
  [x,r,q] = solve_checked_system(C,b);
  require(same(x,C\b,1e-6) && same(r,C*x-b,1e-11) && norm(r,Inf)<1e-9 && ...
    same(q,cond(C),1e-3), 'Accept the full-rank sensitive sensor matrix; do not impose a condition-number cutoff.');
end

function s = capture(scriptPath)
  cleanup = projectState(fileparts(scriptPath));
  try
    delete(findall(0, 'type', 'figure'));
    s = executeScript(scriptPath);
  catch err
    s = struct('ok',false,'error',[err.message engr183.errorLocation(err)],'output','','vars',struct());
  end
  s.figures = {}; s.graphicsError = '';
  if ~s.ok, return; end
  try
    figures = findall(0, 'type', 'figure');
    for k = 1:numel(figures)
      handles = findall(figures(k), 'type', 'axes'); a = {};
      for j = 1:numel(handles)
        if any(strcmpi(get(handles(j),'tag'),{'legend','colorbar'})), continue; end
        a{end+1} = readAxes(handles(j));
      end
      s.figures{end+1} = a;
    end
  catch err
    s.graphicsError = err.message;
  end
end

function s = executeScript(scriptPath)
% Everything needed after clear is assigned AFTER source returns or throws.
  try
    capturedOutput = evalc('source(scriptPath);');
    scriptError = '';
  catch err
    capturedOutput = ''; scriptError = [err.message engr183.errorLocation(err)];
  end
  s = struct('ok',isempty(scriptError),'error',scriptError,'output',capturedOutput,'vars',struct());
  names = {'supply_V','changed_supply_V','resistance_ohm','tolerance_V','tolerance_mA','node_number', ...
    'A','b_V','node_voltage_V','residual_V','condition_number','matrix_rank','max_residual_V', ...
    'known_b_V','expected_known_voltage_V','known_voltage_V','known_residual_V','known_condition_number', ...
    'known_error_V','known_test_passed','source_current_mA','link_current_mA','ground_current_mA', ...
    'kcl_balance_mA','max_kcl_balance_mA','changed_b_V','changed_node_voltage_V','changed_residual_V', ...
    'changed_condition_number','changed_max_residual_V','supply_change_pct','voltage_change_pct', ...
    'sensor_mV','known_force_N','known_sensor_mV','delta_sensor_mV','residual_tolerance_mV', ...
    'force_tolerance_N','component_number','C','force_N','residual_mV','max_residual_mV', ...
    'recovered_known_force_N','known_residual_mV','known_error_N','changed_sensor_mV','changed_force_N', ...
    'changed_residual_mV','changed_max_residual_mV','delta_force_N','input_change_pct','force_change_pct'};
  for k = 1:numel(names)
    if exist(names{k},'var'), s.vars.(names{k}) = eval(names{k}); end
  end
end

function value = numeric(s, name, shape)
  require(isfield(s.vars,name), ['Create the variable ' name '.']);
  value = s.vars.(name);
  require(isnumeric(value) && isreal(value) && isequal(size(value),shape) && all(isfinite(value(:))), ...
    sprintf('%s must be a finite real %d-by-%d %s.',name,shape(1),shape(2),shapeName(shape)));
end
function label = shapeName(shape)
  label = 'matrix';
  if isequal(shape,[1 1]), label = 'scalar'; elseif shape(2)==1, label = 'column'; end
end
function variable(s, name, expected, tol, hint)
  if nargin < 5, hint = 'Check the calculation and units.'; end
  value = numeric(s,name,size(expected));
  require(same(value,expected,tol), ['Check ' name ': ' hint]);
end
function yes = same(value,expected,tol)
  yes = isnumeric(value) && isreal(value) && isequal(size(value),size(expected)) && ...
    all(isfinite(value(:))) && all(abs(value(:)-expected(:))<=tol);
end
function residual(s, name, maximum, expected, threshold)
  variable(s,name,expected,threshold/100, 'Compute the residual with the matching right side; use incoming minus outgoing for node balances.');
  r = numeric(s,name,[3 1]); m = numeric(s,maximum,[1 1]);
  require(m>=0 && m<threshold && norm(r,Inf)<threshold && abs(m-norm(r,Inf))<=threshold/100, ...
    ['Check ' maximum ': use the nonnegative infinity norm of ' name ' and require it strictly below the supplied tolerance.']);
end

function checkPlot(s,c,kind)
  require(isempty(s.graphicsError), ['Graphics inspection needs visual review: ' s.graphicsError]);
  require(numel(s.figures)==1 && numel(s.figures{1})==1, 'Create one figure with one plotting axes comparing both cases.');
  a = s.figures{1}{1};
  original = series(a,c.x,c.valueTol); changed = series(a,c.changedX,c.valueTol);
  require(numel(a.lines)==2, 'Use two three-point series, one for each case.');
  require(~strcmp(original.linestyle,changed.linestyle) || ~strcmp(original.marker,changed.marker), ...
    'Distinguish the cases using different markers and/or line styles.');
  require(includes(a.xlim,[1 2 3]) && includes(a.ylim,[c.x;c.changedX]), ...
    'Show all three values from both cases, including negative Fy; check axis limits.');
  require(numel(strtrim(a.title))>=3 && ~has(lower(strtrim(a.title)), '^(plot|figure|title)(\s*\d*)?$'), ...
    'Give the figure a meaningful title describing the comparison.');
  require(a.grid, 'Turn on the horizontal and vertical grid.');
  require(a.legendAvailable, 'Legend association is unavailable in this toolkit; explicit visual review is required.');
  require(numel(a.legendLabels)==2, 'Include a correct two-entry legend identifying original and changed cases.');
  legendEntry(a,original,'original',kind); legendEntry(a,changed,'changed',kind);
  require(all(ismember([1 2 3],a.xtick)), 'Identify the three discrete positions at 1, 2, 3.');
  if strcmp(kind,'gp')
    require(has(lower(a.xlabel),'node') && has(lower(a.ylabel),'volt|potential') && ...
      has(lower(a.ylabel),'(^|[^a-z])(v|volts?)([^a-z]|$)'), 'Label node number and node voltage with V units.');
    require(all(abs(a.xtick-round(a.xtick))<1e-10), 'Use integer node tick positions; the horizontal axis identifies discrete nodes.');
  else
    require(has(lower(a.ylabel),'force') && has(lower(a.ylabel),'(^|[^a-z])(n|newtons?)([^a-z]|$)'), ...
      'Label force with N units.');
    labels = a.xticklabel;
    if ischar(labels), labels = cellstr(labels); end
    good = iscell(labels) && numel(labels)==numel(a.xtick);
    for j = 1:3
      idx = find(a.xtick==j,1);
      if good, good = has(lower(labels{idx}), ['f[_\s{]*' char('x'+j-1)]); end
    end
    mapping = lower([a.xlabel ' ' a.title]);
    require(good || (has(mapping,'1\s*[=:]\s*f[_ {]*x') && has(mapping,'2\s*[=:]\s*f[_ {]*y') && ...
      has(mapping,'3\s*[=:]\s*f[_ {]*z')), 'Identify components 1, 2, 3 as Fx, Fy, Fz with tick labels or an explicit axis mapping.');
  end
end
function l = series(a,y,tol)
  for k = 1:numel(a.lines)
    l = a.lines{k};
    if strcmp(l.visible,'on') && (~strcmp(l.marker,'none') || ~strcmp(l.linestyle,'none')) && ...
      same(l.x(:),[1;2;3],1e-10) && same(l.y(:),y,tol), return; end
  end
  error('Plot both calculated solution vectors at positions 1, 2, 3; do not plot the readings or swap data between series.');
end
function legendEntry(a,line,role,kind)
  index = find(a.legendHandles==line.handle);
  require(numel(index)==1, 'Associate each legend entry with its corresponding plotted series.');
  label = lower(a.legendLabels{index});
  if strcmp(role,'original')
    good = has(label,'original|baseline|initial|unchanged');
    if strcmp(kind,'gp'), good = good || has(label,'(^|[^0-9.])12(\.0+)?\s*v'); end
    good = good && ~has(label,'changed|perturb|new|lower');
    % "unchanged" contains "changed", but is an unambiguous baseline label.
    if has(label,'unchanged'), good = true; end
  else
    good = has(label,'changed|perturb|new|lower|modified');
    if strcmp(kind,'gp'), good = good || has(label,'10\.8\s*v'); end
    good = good && ~has(label,'original|baseline|initial|unchanged');
  end
  require(good, 'Check legend order/handles: identify the original and changed series correctly.');
end

function checkOutput(output,c,kind)
  checkPrinted(output,'rank',3,'','matrix rank');
  checkPrinted(output,'cond(?:ition)?',cond(c.M),'','condition number');
  base = '(original|baseline|initial)'; changed = '(changed|perturbed|modified|new|lower)';
  if strcmp(kind,'gp')
    checkPrinted(output,[base '.*(voltage|potential)'],c.x,'v|volts?','original node voltages (V)');
    checkPrinted(output,[changed '.*(voltage|potential)'],c.changedX,'v|volts?','changed node voltages (V)');
    checkPrinted(output,'^(?!.*(changed|perturb|modified|new)).*(baseline|original|max).*residual',0,'v|volts?','baseline maximum voltage residual (V)');
    checkPrinted(output,'known.*error',0,'v|volts?','known-answer error (V)');
    checkPrinted(output,'(source|supply).*current',12-c.x(1),'ma|milliamps?|milliamperes?','source current (mA)');
    checkPrinted(output,'link.*current',[c.x(1)-c.x(2);c.x(2)-c.x(3)],'ma|milliamps?|milliamperes?','both link currents (mA)');
    checkPrinted(output,'ground.*current',c.x,'ma|milliamps?|milliamperes?','all ground currents (mA)');
    checkPrinted(output,'(max.*(balance|imbalance|kcl)|(balance|imbalance|kcl).*max)',0,'ma|milliamps?|milliamperes?','maximum current imbalance (mA)');
    checkPrinted(output,'supply.*change',-10,'%|percent|pct','signed supply change (%)');
    checkPrinted(output,'voltage.*change',10,'%|percent|pct','whole-vector voltage change (%)');
  else
    checkPrinted(output,[base '.*force'],c.x,'n|newtons?','original forces (N)');
    checkPrinted(output,[changed '.*force'],c.changedX,'n|newtons?','changed forces (N)');
    checkPrinted(output,[base '.*residual'],0,'mv|millivolts?','baseline maximum residual (mV)');
    checkPrinted(output,[changed '.*residual'],0,'mv|millivolts?','changed maximum residual (mV)');
    checkPrinted(output,'known.*error',0,'n|newtons?','known-load error (N)');
    checkPrinted(output,'(input|sensor|reading).*change',100*norm(c.changedB-c.b)/norm(c.b), ...
      '%|percent|pct','whole-vector input change (%)');
    checkPrinted(output,'force.*change',100*norm(c.changedX-c.x)/norm(c.x),'%|percent|pct','whole-vector force change (%)');
  end
end
function checkPrinted(output,label,expected,unit,description)
% Associate numbers with a labeled line (or a numeric-only following vector).
% Printing precision is deliberately separate from computational tolerances.
  lines = strsplit(lower(regexprep(output,'\x1b\[[0-9;]*[a-zA-Z]','')), '\n');
  yes = false;
  for k = 1:numel(lines)
    line = strrep(lines{k}, '_', ' ');
    if ~has(line,label), continue; end
    if ~isempty(unit) && ~has(line,['(?<![a-z])(' unit ')(?![a-z])']), continue; end
    tail = line;
    separator = regexp(line,'[:=]','once');
    if ~isempty(separator), tail = line(separator+1:end); end
    for j = k+1:min(k+4,numel(lines))
      if isempty(strtrim(lines{j})), continue; end
      if has(lines{j},'^\s*[\[\]0-9e+.,;\s-]+\s*$'), tail = [tail ' ' lines{j}]; else, break; end
    end
    tokens = regexp(tail,'(?<![a-z])[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?','match');
    values = cellfun(@str2double,tokens);
    % Compare a contiguous group so a convincing label with absent/wrong
    % numbers cannot earn credit. 3-decimal engineering output is sufficient.
    for j = 1:numel(values)-numel(expected)+1
      if all(abs(values(j:j+numel(expected)-1)'-expected(:)) <= max(0.0006,abs(expected(:))*0.0006))
        yes = true; break;
      end
    end
    if yes, break; end
  end
  require(yes, ['Print ' description ' with recognizable labels, correct numbers and units (ordinary rounding is fine).']);
end

function yes = includes(limits,values)
  yes = isnumeric(limits) && numel(limits)==2 && all(isfinite(limits)) && ...
    limits(1)<=min(values(:))+1e-8 && limits(2)>=max(values(:))-1e-8;
end
function yes = has(text,pattern), yes = ~isempty(regexp(text,pattern,'once')); end
function require(yes,message), if ~yes, error('%s',message); end; end

function a = readAxes(h)
  a.xtick = get(h, 'xtick'); a.xticklabel = get(h, 'xticklabel');
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

function m = marker(m)
  if strcmp(m, 'square'), m = 's'; elseif strcmp(m, 'diamond'), m = 'd'; end
end
function value = textValue(value)
  if iscell(value), value = strjoin(value(:)', ' '); end
  if ~ischar(value), value = ''; elseif size(value,1)>1, value = strjoin(cellstr(value)', ' '); end
end
