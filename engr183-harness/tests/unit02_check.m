function result = unit02_check(criterion)
%UNIT02_CHECK  Shared checks for Unit 2 (APA-02 Solar-Panel I-V Data
%   Analysis), called from unit02_tests.m via ordinary engr183.spec(...)
%   entries -- mirrors unit01_check.m's shape: all of this unit's own
%   logic (resolving the right file, running it in an isolated workspace,
%   checking placeholders/values) lives here so +engr183/runTests.m and
%   +engr183/spec.m stay generic.
%
%   Ground truth for every numeric check is recomputed here from the
%   student's OWN voltage_V/current_A/mpp_index/etc. (the same pattern
%   unit01_check.m uses for work_J), not hardcoded from the instructor
%   solution -- so this file never needs the answer key to grade
%   correctly. The two exceptions are mpp_index==21 and the
%   sum(high_power_mask)==11 count, which are already public in the
%   assignment's own supplied data and match the public self-check
%   tolerances the assignment was designed around.
%
%   R = UNIT02_CHECK(CRITERION) returns true when CRITERION passes, or
%   throws an error with a specific, actionable message when it does not.
%   runTests.m shows err.message verbatim as the rubric line's hint.
%
%   CRITERION is one of:
%     'name_placeholder'      -- the "% Name:" comment was personalized
%     'date_placeholder'      -- the "% Date:" comment was personalized
%     'power_calculation'     -- measurement_count and power_W are correct
%     'mpp_identification'    -- max_power_W, mpp_index, and the MPP
%                                 voltage/current lookups are correct
%     'fill_factor_and_norm'  -- open/short-circuit approximations, fill
%                                 factor, and normalized vectors are correct
%     'mask_and_results'      -- high_power_mask/high_power_voltage_V and
%                                 the results matrix are correct

  scriptPath = resolveTargetScript();

  switch criterion
    case 'name_placeholder'
      checkCommentPersonalized(scriptPath, 'Name', ...
        'Replace the Name comment placeholder with your first and last name.');
      result = true;

    case 'date_placeholder'
      checkCommentPersonalized(scriptPath, 'Date', ...
        'Replace the Date comment placeholder with today''s date.');
      result = true;

    case 'power_calculation'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      requireVars(run, {'voltage_V', 'current_A', 'measurement_count', 'power_W'});

      if numel(run.voltage_V) ~= 37 || numel(run.current_A) ~= 37
        error(['voltage_V and current_A should still have 37 elements each. ' ...
               'Did you accidentally edit the supplied data?']);
      end
      if ~isequal(run.measurement_count, 37)
        error('Expected measurement_count to be 37, but got %s.', ...
              mat2str(run.measurement_count));
      end
      if numel(run.power_W) ~= 37
        error('Expected power_W to have 37 elements, but it has %d.', numel(run.power_W));
      end
      expectedPower = run.voltage_V .* run.current_A;
      if max(abs(run.power_W(:) - expectedPower(:))) > 1e-6
        error(['power_W does not match voltage_V .* current_A. ' ...
               'Check that you used element-wise multiplication (.*).']);
      end
      result = true;

    case 'mpp_identification'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      requireVars(run, {'voltage_V', 'current_A', 'power_W', 'max_power_W', ...
                         'mpp_index', 'voltage_at_mpp_V', 'current_at_mpp_A'});

      [expectedMax, expectedIdx] = max(run.power_W);
      if abs(run.max_power_W - 299.9763228) > 0.001
        error(['max_power_W is not within tolerance (expected about 299.98 W). ' ...
               'Check that you multiplied voltage_V and current_A element-wise.']);
      end
      if abs(run.max_power_W - expectedMax) > 1e-9
        error(['max_power_W does not match max(power_W). ' ...
               'Use max with two outputs, as TODO 3 describes.']);
      end
      if run.mpp_index ~= 21
        error('Expected mpp_index to identify measurement 21, but got %s.', ...
              mat2str(run.mpp_index));
      end
      if run.mpp_index ~= expectedIdx
        error('mpp_index does not match the index max(power_W) actually returns.');
      end
      if abs(run.voltage_at_mpp_V - run.voltage_V(run.mpp_index)) > 1e-9
        error('voltage_at_mpp_V does not match voltage_V(mpp_index).');
      end
      if abs(run.current_at_mpp_A - run.current_A(run.mpp_index)) > 1e-9
        error('current_at_mpp_A does not match current_A(mpp_index).');
      end
      result = true;

    case 'fill_factor_and_norm'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      requireVars(run, {'voltage_V', 'current_A', 'max_power_W', ...
                         'open_circuit_voltage_V', 'short_circuit_current_A', ...
                         'fill_factor', 'normalized_voltage', 'normalized_current'});

      if abs(run.open_circuit_voltage_V - max(run.voltage_V)) > 1e-9
        error('open_circuit_voltage_V does not match max(voltage_V).');
      end
      if abs(run.short_circuit_current_A - max(run.current_A)) > 1e-9
        error('short_circuit_current_A does not match max(current_A).');
      end
      if abs(run.fill_factor - 0.7754926621) > 1e-6
        error(['fill_factor is not within tolerance. Check that the denominator ' ...
               'is open_circuit_voltage_V * short_circuit_current_A.']);
      end
      expectedNormV = run.voltage_V ./ run.open_circuit_voltage_V;
      if numel(run.normalized_voltage) ~= 37 || ...
         max(abs(run.normalized_voltage(:) - expectedNormV(:))) > 1e-9
        error('normalized_voltage does not match voltage_V ./ open_circuit_voltage_V.');
      end
      expectedNormI = run.current_A ./ run.short_circuit_current_A;
      if numel(run.normalized_current) ~= 37 || ...
         max(abs(run.normalized_current(:) - expectedNormI(:))) > 1e-9
        error('normalized_current does not match current_A ./ short_circuit_current_A.');
      end
      result = true;

    case 'mask_and_results'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      requireVars(run, {'voltage_V', 'current_A', 'power_W', 'max_power_W', ...
                         'normalized_voltage', 'normalized_current', ...
                         'high_power_mask', 'high_power_voltage_V', 'results'});

      expectedMask = run.power_W >= 0.90 .* run.max_power_W;
      if ~isequal(logical(run.high_power_mask(:)), logical(expectedMask(:)))
        error('high_power_mask does not match power_W >= 0.90 * max_power_W.');
      end
      if sum(run.high_power_mask) ~= 11
        error(['Expected high_power_mask to select 11 measured points, ' ...
               'but it selected %d.'], sum(run.high_power_mask));
      end
      expectedHPV = run.voltage_V(logical(run.high_power_mask));
      if numel(run.high_power_voltage_V) ~= numel(expectedHPV) || ...
         max(abs(run.high_power_voltage_V(:) - expectedHPV(:))) > 1e-9
        error('high_power_voltage_V does not match voltage_V(high_power_mask).');
      end

      if ~isequal(size(run.results), [37 5])
        error('results should be a 37-by-5 matrix. Check transposes and column order.');
      end
      expectedResults = [run.voltage_V(:) run.current_A(:) run.power_W(:) ...
                          run.normalized_voltage(:) run.normalized_current(:)];
      if max(abs(run.results(:) - expectedResults(:))) > 1e-9
        error(['results does not match [voltage_V, current_A, power_W, ' ...
               'normalized_voltage, normalized_current] in that column order.']);
      end
      result = true;

    otherwise
      error('unit02_check:badCriterion', 'Unknown criterion ''%s''.', criterion);
  end
end

% ---------------------------------------------------------------------------
function scriptPath = resolveTargetScript()
%RESOLVETARGETSCRIPT  Prefer a single personalized copy
%   (U02_APA02_SolarIV_*.m, e.g. from the Playground's Add File workflow,
%   or a renamed-for-Canvas submission) over the generic starter, so the
%   same checker works whether or not a student has renamed their file
%   yet. See unit01_check.m's resolveTargetScript for the original of
%   this pattern.

  assignDir = fullfile(engr183.root(), 'assignments', 'unit02');
  generic = fullfile(assignDir, 'U02_APA02_SolarIV.m');
  personalized = dir(fullfile(assignDir, 'U02_APA02_SolarIV_*.m'));

  if numel(personalized) > 1
    names = strjoin({personalized.name}, ', ');
    error(['More than one personalized copy was found (%s). ' ...
           'Keep only one U02_APA02_SolarIV_*.m file in assignments/unit02/.'], names);
  elseif numel(personalized) == 1
    scriptPath = fullfile(assignDir, personalized(1).name);
    return;
  end

  if exist(generic, 'file') ~= 2
    error('U02_APA02_SolarIV.m was not found in assignments/unit02/.');
  end
  scriptPath = generic;
end

% ---------------------------------------------------------------------------
function checkCommentPersonalized(scriptPath, label, failMessage)
%CHECKCOMMENTPERSONALIZED  Matches the "% Name:"/"% Date:" comment line
%   against `label`, one whole line at a time. Identical, previously
%   debugged logic to unit01_check.m's version of this helper -- see that
%   file's header comment for the two real cross-runtime bugs this
%   line-by-line approach avoids (a plain (.*) crossing lines, and
%   'lineanchors' not behaving the same between desktop Octave and the
%   pinned xeus-octave browser runtime).
  source = fileread(scriptPath);
  source = strrep(source, sprintf('\r\n'), sprintf('\n'));
  sourceLines = strsplit(source, sprintf('\n'));

  pattern = sprintf('^%%\\s*%s:\\s*(.*)$', label);
  value = '';
  found = false;
  for i = 1:numel(sourceLines)
    tok = regexp(sourceLines{i}, pattern, 'tokens', 'once');
    if ~isempty(tok)
      value = strtrim(tok{1});
      found = true;
      break;
    end
  end

  placeholders = struct('Name', 'Replace with your first and last name', ...
                         'Date', 'Replace with today''s date');
  if ~found || isempty(value) || strcmp(value, placeholders.(label))
    error('%s', failMessage);
  end
end

% ---------------------------------------------------------------------------
function failIfScriptErrored(run)
  if ~run.ok
    error('your code raised an error: %s', engr183.flatten(run.errMessage));
  end
end

% ---------------------------------------------------------------------------
function requireVars(run, names)
  for i = 1:numel(names)
    v = names{i};
    if ~run.(['has_' v])
      error('Your script must create a variable named %s.', v);
    end
  end
end

% ---------------------------------------------------------------------------
function run = runStudentScript(scriptPath)
%RUNSTUDENTSCRIPT  Executes the student's script in a workspace that is
%   entirely disposable -- same isolation approach as unit01_check.m's
%   runStudentScript (see that file for the full rationale). In short: a
%   genuine nested function call is required because the starter begins
%   with `clear;`, which would wipe THIS function's own locals too if the
%   student's script were eval'd directly from unit02_check's body.
%   Nothing in this workspace may be set before the evalc(...) line
%   completes -- including the variable-name list below -- since the
%   student's `clear;` fires partway through evaluating that line's
%   right-hand side, before capturedOutput's assignment actually lands.
  try
    capturedOutput = evalc('eval(fileread(scriptPath));');
    scriptErrored = false;
    scriptErrMessage = '';
  catch err
    capturedOutput = '';
    scriptErrored = true;
    scriptErrMessage = [err.message engr183.errorLocation(err)];
  end

  varNames = {'voltage_V', 'current_A', 'measurement_count', 'power_W', ...
              'max_power_W', 'mpp_index', 'voltage_at_mpp_V', 'current_at_mpp_A', ...
              'open_circuit_voltage_V', 'short_circuit_current_A', 'fill_factor', ...
              'normalized_voltage', 'normalized_current', 'high_power_mask', ...
              'high_power_voltage_V', 'results'};

  run = struct('ok', ~scriptErrored, 'errMessage', scriptErrMessage, ...
               'capturedOutput', capturedOutput);
  for i = 1:numel(varNames)
    run.(['has_' varNames{i}]) = false;
    run.(varNames{i}) = [];
  end

  if scriptErrored
    return;
  end

  for i = 1:numel(varNames)
    n = varNames{i};
    if exist(n, 'var')
      run.(['has_' n]) = true;
      run.(n) = eval(n);
    end
  end
end
