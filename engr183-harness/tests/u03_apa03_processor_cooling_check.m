function result = u03_apa03_processor_cooling_check(criterion)
%U03_APA03_PROCESSOR_COOLING_CHECK  Shared checks for Unit 3's APA-03
%   (Processor Cooling-Stack Analyzer), called from
%   u03_apa03_processor_cooling_tests.m via ordinary engr183.spec(...)
%   entries -- mirrors unit02_check.m / u02_gp02_tensile_check.m's shape:
%   all of this assignment's own logic (resolving the right files, running
%   them in isolated workspaces, checking interfaces/values/help/output)
%   lives here so +engr183/runTests.m and +engr183/spec.m stay generic.
%
%   R = U03_APA03_PROCESSOR_COOLING_CHECK(CRITERION) returns true when
%   CRITERION passes, or throws an error with a specific, actionable
%   message when it does not. runTests.m shows err.message verbatim as
%   the rubric line's hint.
%
%   CRITERION is one of:
%     'required_function_files'          -- the 3 function files exist
%     'public_check_present'             -- the public-check file exists
%     'main_script_resolves'             -- exactly one main script is found
%     'tim_resistance_interface'         -- 3 inputs, 1 output declared
%     'processor_temperatures_interface' -- 5 inputs, 3 outputs declared
%     'thermal_margin_interface'         -- 2 inputs, 1 output declared
%     'tim_resistance_correctness'       -- conversions/vectors/scenario
%     'processor_temperatures_correctness' -- node order/shapes/scenario
%     'thermal_margin_correctness'       -- sign/shape/nondefault limit
%     'function_help_documentation'      -- help blocks for all 3 functions
%     'public_check_passes_when_solved'  -- the supplied checker itself runs
%     'main_script_integration'          -- full main-script pipeline
%     'main_script_output'               -- the four required printed lines

  assignDir = fullfile(engr183.root(), 'assignments', 'u03-apa03-processor-cooling');

  switch criterion
    case 'required_function_files'
      requireFileExists(assignDir, 'tim_resistance.m');
      requireFileExists(assignDir, 'processor_temperatures.m');
      requireFileExists(assignDir, 'thermal_margin.m');
      resolveMainScript(assignDir);   % also fails with an actionable message
      result = true;

    case 'public_check_present'
      requireFileExists(assignDir, 'U03_APA03_ProcessorCooling_PublicCheck.m');
      result = true;

    case 'main_script_resolves'
      resolveMainScript(assignDir);
      result = true;

    case 'tim_resistance_interface'
      checkInterface('tim_resistance', 3, 1);
      result = true;

    case 'processor_temperatures_interface'
      checkInterface('processor_temperatures', 5, 3);
      result = true;

    case 'thermal_margin_interface'
      checkInterface('thermal_margin', 2, 1);
      result = true;

    case 'tim_resistance_correctness'
      checkTimResistanceCorrectness();
      result = true;

    case 'processor_temperatures_correctness'
      checkProcessorTemperaturesCorrectness();
      result = true;

    case 'thermal_margin_correctness'
      checkThermalMarginCorrectness();
      result = true;

    case 'function_help_documentation'
      checkHelp('tim_resistance', { ...
        {{'resistance'}, 'describes TIM thermal resistance'}, ...
        {{'mm', 'millimeter'}, 'the millimeter thickness/area units'}, ...
        {{'w/(m', 'w/mk', 'w per m', 'conductivit'}, 'the W/(m*K) conductivity unit'}, ...
        {{'mm^2', 'mm2', 'square millimeter'}, 'the square-millimeter area unit'}, ...
        {{'c/w', 'per watt', 'degrees celsius per watt'}, 'the C/W resistance unit'}, ...
        {{'scalar'}, 'whether scalar input is supported'}, ...
        {{'vector'}, 'whether vector input is supported'}, ...
        {{'one-dimensional', 'one dimensional', '1-d', '1d '}, 'the one-dimensional assumption'}, ...
        {{'constant'}, 'the constant-property assumption'} ...
      });
      checkHelp('processor_temperatures', { ...
        {{'temperature'}, 'describes processor node temperatures'}, ...
        {{'watt', ' w '}, 'the watt power unit'}, ...
        {{'celsius', ' c '}, 'the degrees Celsius unit'}, ...
        {{'scalar'}, 'whether scalar input is supported'}, ...
        {{'vector'}, 'whether vector input is supported'}, ...
        {{'steady'}, 'the steady-state assumption'}, ...
        {{'base'}, 'the heat-sink base output'}, ...
        {{'ihs', 'surface'}, 'the IHS surface output'}, ...
        {{'junction'}, 'the processor junction output'} ...
      });
      checkHelp('thermal_margin', { ...
        {{'margin'}, 'describes thermal margin'}, ...
        {{'celsius', ' c '}, 'the degrees Celsius unit'}, ...
        {{'scalar'}, 'whether scalar input is supported'}, ...
        {{'vector'}, 'whether vector input is supported'}, ...
        {{'positive'}, 'the meaning of positive margin'}, ...
        {{'zero'}, 'the meaning of zero margin'}, ...
        {{'negative'}, 'the meaning of negative margin'} ...
      });
      result = true;

    case 'public_check_passes_when_solved'
      checkPath = fullfile(assignDir, 'U03_APA03_ProcessorCooling_PublicCheck.m');
      if exist(checkPath, 'file') ~= 2
        error('U03_APA03_ProcessorCooling_PublicCheck.m was not found in assignments/u03-apa03-processor-cooling/.');
      end
      run = runIsolatedScript(checkPath);
      if ~run.ok
        error(['The public check did not pass: %s\n' ...
               'Complete tim_resistance.m, processor_temperatures.m, and ' ...
               'thermal_margin.m, then rerun the public check.'], ...
              engr183.flatten(run.errMessage));
      end
      if isempty(strfind(run.capturedOutput, 'All APA-03 public function checks passed.'))
        error(['The public check ran without error, but did not print ' ...
               '''All APA-03 public function checks passed.'' -- did you edit ' ...
               'the supplied public-check script?']);
      end
      result = true;

    case 'main_script_integration'
      checkMainScriptIntegration();
      result = true;

    case 'main_script_output'
      checkMainScriptOutput();
      result = true;

    otherwise
      error('u03_apa03_processor_cooling_check:badCriterion', ...
            'Unknown criterion ''%s''.', criterion);
  end
end

% ---------------------------------------------------------------------------
function requireFileExists(assignDir, fileName)
  if exist(fullfile(assignDir, fileName), 'file') ~= 2
    error('%s was not found in assignments/u03-apa03-processor-cooling/.', fileName);
  end
end

% ---------------------------------------------------------------------------
function scriptPath = resolveMainScript(assignDir)
%RESOLVEMAINSCRIPT  Prefer a single personalized copy
%   (APA03_ProcessorCooling_*.m) over the generic starter
%   (U03_APA03_ProcessorCooling_Starter.m). Same pattern as
%   unit02_check.m's resolveTargetScript, adapted for this assignment's
%   renamed-starter convention (the generic starter itself is not named
%   after the personalization pattern the way unit02's is). The public
%   check file (U03_APA03_ProcessorCooling_PublicCheck.m) never matches
%   either glob, so it is never mistaken for the main script.

  generic = fullfile(assignDir, 'U03_APA03_ProcessorCooling_Starter.m');
  personalized = dir(fullfile(assignDir, 'APA03_ProcessorCooling_*.m'));

  if numel(personalized) > 1
    names = strjoin({personalized.name}, ', ');
    error(['More than one personalized copy was found (%s). ' ...
           'Keep only one APA03_ProcessorCooling_*.m file in ' ...
           'assignments/u03-apa03-processor-cooling/.'], names);
  elseif numel(personalized) == 1
    scriptPath = fullfile(assignDir, personalized(1).name);
    return;
  end

  if exist(generic, 'file') ~= 2
    error(['Neither U03_APA03_ProcessorCooling_Starter.m nor a personalized ' ...
           'APA03_ProcessorCooling_*.m file was found in ' ...
           'assignments/u03-apa03-processor-cooling/.']);
  end
  scriptPath = generic;
end

% ---------------------------------------------------------------------------
function checkInterface(fnName, expectedNargin, expectedNargout)
  if exist(fnName, 'file') ~= 2
    error('%s.m was not found -- have you created it yet?', fnName);
  end
  actualNargin = nargin(fnName);
  actualNargout = nargout(fnName);
  if actualNargin ~= expectedNargin
    error('%s.m must declare exactly %d input(s), but it declares %d.', ...
          fnName, expectedNargin, actualNargin);
  end
  if actualNargout ~= expectedNargout
    error('%s.m must declare exactly %d output(s), but it declares %d.', ...
          fnName, expectedNargout, actualNargout);
  end
end

% ---------------------------------------------------------------------------
function checkTimResistanceCorrectness()
  scalarActual = callOrFail('tim_resistance', {0.10, 5, 1000});
  if ~isscalar(scalarActual) || abs(scalarActual - 0.02) >= 1e-10
    error(['tim_resistance.m: expected 0.10 mm, 5 W/(m*K), and 1000 mm^2 to ' ...
           'return 0.02 C/W. Check both millimeter-to-meter and ' ...
           'square-millimeter-to-square-meter conversions.']);
  end

  rowActual = callOrFail('tim_resistance', {[0.05 0.10], 5, 1000});
  if ~isequal(size(rowActual), [1 2]) || max(abs(rowActual - [0.01 0.02])) >= 1e-10
    error(['tim_resistance.m: a 1-by-2 thickness input must return a 1-by-2 ' ...
           'resistance output matching [0.01 0.02]. Use element-wise operators.']);
  end

  colActual = callOrFail('tim_resistance', {[0.05; 0.10], 5, 1000});
  if ~isequal(size(colActual), [2 1]) || max(abs(colActual - [0.01; 0.02])) >= 1e-10
    error(['tim_resistance.m: a 2-by-1 thickness input must return a 2-by-1 ' ...
           'resistance output. Use element-wise operators without transposing ' ...
           'the input.']);
  end

  scenarioActual = callOrFail('tim_resistance', {0.08, 6, 900});
  if abs(scenarioActual - 0.0148148148148148) >= 1e-10
    error(['tim_resistance.m: the supplied processor scenario (0.08 mm, ' ...
           '6 W/(m*K), 900 mm^2) must return 0.0148148148148148 C/W.']);
  end

  nondefaultActual = callOrFail('tim_resistance', {0.20, 10, 2000});
  if abs(nondefaultActual - 0.01) >= 1e-10
    error(['tim_resistance.m: expected 0.20 mm, 10 W/(m*K), and 2000 mm^2 to ' ...
           'return 0.01 C/W. This checks for hard-coded constants from the ' ...
           'public-check example.']);
  end

  zeroActual = callOrFail('tim_resistance', {0, 5, 1000});
  if abs(zeroActual) >= 1e-10
    error(['tim_resistance.m: zero thickness must return zero resistance ' ...
           'without any conditional branch.']);
  end
end

% ---------------------------------------------------------------------------
function checkProcessorTemperaturesCorrectness()
  [b, i, j] = callOrFail3('processor_temperatures', {[50 100], 25, 0.10, 0.02, 0.20});
  if ~isequal(size(b), [1 2]) || ~isequal(size(i), [1 2]) || ~isequal(size(j), [1 2])
    error(['processor_temperatures.m: the public-check row-vector case must ' ...
           'return three 1-by-2 outputs.']);
  end
  checkNodes(b, i, j, [35 45], [36 47], [41 57], 1e-10, ...
    'the public-check row-vector case');

  [b, i, j] = callOrFail3('processor_temperatures', {[50; 100], 25, 0.10, 0.02, 0.20});
  if ~isequal(size(b), [2 1]) || ~isequal(size(i), [2 1]) || ~isequal(size(j), [2 1])
    error(['processor_temperatures.m: a 2-by-1 power_W input must return ' ...
           'three 2-by-1 outputs. Use element-wise operators without ' ...
           'transposing the input.']);
  end
  checkNodes(b, i, j, [35; 45], [36; 47], [41; 57], 1e-10, ...
    'the column-vector case');

  [b, i, j] = callOrFail3('processor_temperatures', {75, 20, 0.10, 0.02, 0.20});
  if ~isscalar(b) || ~isscalar(i) || ~isscalar(j)
    error('processor_temperatures.m: a scalar power_W input must return three scalar outputs.');
  end
  checkNodes(b, i, j, 20 + 75*0.20, 20 + 75*0.20 + 75*0.02, ...
    20 + 75*0.20 + 75*0.02 + 75*0.10, 1e-9, 'the scalar case');

  [b, i, j] = callOrFail3('processor_temperatures', {0, 30, 0.10, 0.02, 0.20});
  if abs(b - 30) >= 1e-10 || abs(i - 30) >= 1e-10 || abs(j - 30) >= 1e-10
    error(['processor_temperatures.m: zero processor power must return ' ...
           'ambient temperature (30 C) at all three nodes.']);
  end

  % Sensitivity probes: catch hard-coded constants, swapped arguments, and
  % resistance stages applied in the wrong order. Each output is checked
  % individually (not just the final junction) because a swapped
  % tim/package argument still sums to the same junction value -- only the
  % intermediate ihs_surface node reveals the swap.
  [b, i, j] = callOrFail3('processor_temperatures', {100, 0, 1, 2, 0});
  checkNodes(b, i, j, 0, 200, 300, 1e-9, ...
    'the argument-order probe (power=100, ambient=0, package=1, tim=2, heatsink=0)');

  [b, i, j] = callOrFail3('processor_temperatures', {10, 5, 0, 0, 9});
  checkNodes(b, i, j, 95, 95, 95, 1e-9, ...
    'the heat-sink-only probe (power=10, ambient=5, heatsink=9)');

  [b, i, j] = callOrFail3('processor_temperatures', {100, 10, 3, 5, 7});
  checkNodes(b, i, j, 710, 1210, 1510, 1e-9, ...
    'the multi-resistance probe (power=100, ambient=10, package=3, tim=5, heatsink=7)');

  % Supplied five-element scenario at full precision.
  power_W = [25 65 105 150 210];
  tim_R = 0.0148148148148148;
  [b, i, j] = callOrFail3('processor_temperatures', ...
    {power_W, 24, 0.18, tim_R, 0.22});
  expected_base = [29.500000000000000, 38.300000000000000, 47.100000000000000, ...
                   57.000000000000000, 70.200000000000000];
  expected_ihs = [29.870370370370370, 39.262962962962959, 48.655555555555559, ...
                  59.222222222222221, 73.311111111111117];
  expected_junction = [34.370370370370367, 50.962962962962962, 67.555555555555557, ...
                        86.222222222222229, 111.111111111111114];
  checkNodes(b, i, j, expected_base, expected_ihs, expected_junction, 1e-8, ...
    'the supplied five-element processor scenario');
end

% ---------------------------------------------------------------------------
function checkNodes(actualBase, actualIhs, actualJunction, ...
    expectedBase, expectedIhs, expectedJunction, tol, label)
  if numel(actualBase) ~= numel(expectedBase) || ...
      max(abs(actualBase(:) - expectedBase(:))) >= tol
    error(['processor_temperatures.m: the first output (heat-sink base) is ' ...
           'incorrect for %s.'], label);
  end
  if numel(actualIhs) ~= numel(expectedIhs) || ...
      max(abs(actualIhs(:) - expectedIhs(:))) >= tol
    error(['processor_temperatures.m: the second output (IHS surface) is ' ...
           'incorrect for %s. The first output must be the heat-sink base ' ...
           'temperature, the second must be the IHS surface, and the third ' ...
           'must be the processor junction.'], label);
  end
  if numel(actualJunction) ~= numel(expectedJunction) || ...
      max(abs(actualJunction(:) - expectedJunction(:))) >= tol
    error(['processor_temperatures.m: the third output (processor junction) ' ...
           'is incorrect for %s.'], label);
  end
end

% ---------------------------------------------------------------------------
function checkThermalMarginCorrectness()
  actual = callOrFail('thermal_margin', {90, [41 57]});
  if ~isequal(size(actual), [1 2]) || max(abs(actual - [49 33])) >= 1e-10
    error(['thermal_margin.m: expected [49 33] for a 90 C limit and junction ' ...
           'temperatures [41 57]. Subtract junction temperature from the ' ...
           'maximum allowed temperature.']);
  end

  actual = callOrFail('thermal_margin', {100, [90 100 110]});
  if ~isequal(actual, [10 0 -10])
    error(['thermal_margin.m: expected [10 0 -10] for a 100 C limit and ' ...
           'junction temperatures [90 100 110]. Subtract junction temperature ' ...
           'from the maximum allowed temperature.']);
  end

  actual = callOrFail('thermal_margin', {100, [90; 100; 110]});
  if ~isequal(size(actual), [3 1]) || ~isequal(actual, [10; 0; -10])
    error(['thermal_margin.m: a 3-by-1 junction_C input must return a 3-by-1 ' ...
           'margin output. Use element-wise operators without transposing ' ...
           'the input.']);
  end

  actual = callOrFail('thermal_margin', {85, 80});
  if abs(actual - 5) >= 1e-10
    error(['thermal_margin.m: expected an 85 C limit with an 80 C junction ' ...
           'to return 5 C of margin. Check that the limit is not hard-coded.']);
  end

  junction_C = [34.370370370370367, 50.962962962962962, 67.555555555555557, ...
                86.222222222222229, 111.111111111111114];
  expected_margin = [65.629629629629633, 49.037037037037038, 32.444444444444443, ...
                      13.777777777777771, -11.111111111111114];
  actual = callOrFail('thermal_margin', {100, junction_C});
  if numel(actual) ~= 5 || max(abs(actual(:) - expected_margin(:))) >= 1e-8
    error(['thermal_margin.m: the supplied five-element junction-temperature ' ...
           'vector does not produce the authoritative margin vector.']);
  end
end

% ---------------------------------------------------------------------------
function actual = callOrFail(fnName, args)
  try
    actual = feval(fnName, args{:});
  catch err
    error('%s.m raised an error: %s', fnName, engr183.flatten(err.message));
  end
end

% ---------------------------------------------------------------------------
function [a, b, c] = callOrFail3(fnName, args)
  try
    [a, b, c] = feval(fnName, args{:});
  catch err
    error('%s.m raised an error: %s', fnName, engr183.flatten(err.message));
  end
end

% ---------------------------------------------------------------------------
function checkHelp(fnName, evidenceGroups)
%CHECKHELP  Tolerant, keyword-based evidence check against `help fnName`'s
%   captured text -- deliberately not one exact prose sentence. Each entry
%   in evidenceGroups is {alternativeKeywords, humanDescription}; the
%   captured help (lowercased) must contain at least one of
%   alternativeKeywords for that entry to pass.
  if exist(fnName, 'file') ~= 2
    error('%s.m was not found -- have you created it yet?', fnName);
  end

  try
    helpText = evalc(['help ' fnName]);
  catch err
    error('%s.m: calling ''help %s'' raised an error: %s', ...
          fnName, fnName, engr183.flatten(err.message));
  end

  lowerText = lower(helpText);

  if ~isempty(strfind(lowerText, 'todo'))
    error(['%s.m: the help block still contains TODO text. Replace every ' ...
           'TODO placeholder with real documentation.'], fnName);
  end

  % Rough proxy for "the first help line describes the function's actual
  % purpose": some real prose content should exist beyond just the function
  % name and boilerplate before the units/assumption details do.
  contentChars = regexprep(lowerText, sprintf('[^a-z]|%s', fnName), '');
  if numel(contentChars) < 40
    error(['%s.m: the help block looks too short to describe the purpose, ' ...
           'inputs, outputs, units, and vector support.'], fnName);
  end

  for k = 1:numel(evidenceGroups)
    keywords = evidenceGroups{k}{1};
    description = evidenceGroups{k}{2};
    found = false;
    for m = 1:numel(keywords)
      if ~isempty(strfind(lowerText, keywords{m}))
        found = true;
        break;
      end
    end
    if ~found
      error(['%s.m: the help block does not appear to describe %s. ' ...
             'Expected wording like: %s.'], ...
            fnName, description, strjoin(keywords, ' / '));
    end
  end
end

% ---------------------------------------------------------------------------
function run = runIsolatedScript(scriptPath)
%RUNISOLATEDSCRIPT  Executes any script (main script or public check) in a
%   workspace that is entirely disposable -- same isolation approach as
%   unit01_check.m's runStudentScript. A genuine nested function call is
%   required because both the starter and the public check begin with
%   `clear;`, which would wipe a caller's own locals too if eval'd
%   directly from that caller's body. Nothing in this workspace may be set
%   before the evalc(...) line completes.
  try
    capturedOutput = evalc('eval(fileread(scriptPath));');
    scriptErrored = false;
    scriptErrMessage = '';
  catch err
    capturedOutput = '';
    scriptErrored = true;
    scriptErrMessage = err.message;
  end
  run = struct('ok', ~scriptErrored, 'errMessage', scriptErrMessage, ...
               'capturedOutput', capturedOutput);
end

% ---------------------------------------------------------------------------
function run = runStudentMainScript(scriptPath)
%RUNSTUDENTMAINSCRIPT  Same isolation pattern as runIsolatedScript, but
%   also harvests every variable the main script is supposed to create.
%   Nothing here may be set before the evalc(...) line completes -- see
%   runIsolatedScript's header comment and unit01_check.m's
%   runStudentScript for the full rationale.
  try
    capturedOutput = evalc('eval(fileread(scriptPath));');
    scriptErrored = false;
    scriptErrMessage = '';
  catch err
    capturedOutput = '';
    scriptErrored = true;
    scriptErrMessage = err.message;
  end

  varNames = {'power_W', 'ambient_C', 'maximum_junction_C', ...
              'package_ihs_resistance_C_per_W', 'tim_thickness_mm', ...
              'tim_conductivity_W_mK', 'tim_area_mm2', ...
              'heatsink_resistance_C_per_W', 'tim_resistance_C_per_W', ...
              'heatsink_base_C', 'ihs_surface_C', 'junction_C', 'margin_C', ...
              'within_limit', 'within_limit_count', 'highest_junction_C', ...
              'minimum_margin_C', 'results'};

  run = struct('ok', ~scriptErrored, 'errMessage', scriptErrMessage, ...
               'capturedOutput', capturedOutput, ...
               'has_thickness_m', false, 'has_area_m2', false);
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
  run.has_thickness_m = exist('thickness_m', 'var') ~= 0;
  run.has_area_m2 = exist('area_m2', 'var') ~= 0;
end

% ---------------------------------------------------------------------------
function requireVars(run, names)
  for i = 1:numel(names)
    v = names{i};
    if ~run.(['has_' v])
      error('APA-03 main script: your script must create a variable named %s.', v);
    end
  end
end

% ---------------------------------------------------------------------------
function failIfScriptErrored(run)
  if ~run.ok
    error('APA-03 main script: your code raised an error: %s', ...
          engr183.flatten(run.errMessage));
  end
end

% ---------------------------------------------------------------------------
function checkMainScriptIntegration()
  assignDir = fullfile(engr183.root(), 'assignments', 'u03-apa03-processor-cooling');
  scriptPath = resolveMainScript(assignDir);
  run = runStudentMainScript(scriptPath);
  failIfScriptErrored(run);

  requireVars(run, {'power_W', 'ambient_C', 'maximum_junction_C', ...
                     'package_ihs_resistance_C_per_W', 'tim_thickness_mm', ...
                     'tim_conductivity_W_mK', 'tim_area_mm2', ...
                     'heatsink_resistance_C_per_W', 'tim_resistance_C_per_W', ...
                     'heatsink_base_C', 'ihs_surface_C', 'junction_C', ...
                     'margin_C', 'within_limit', 'within_limit_count', ...
                     'highest_junction_C', 'minimum_margin_C', 'results'});

  % The supplied five-element scenario never produces an exactly-zero
  % margin, so a `>` vs `>=` bug is numerically invisible against just
  % that data -- checked directly against the source expression instead.
  checkWithinLimitIncludesZero(scriptPath);

  expected_power_W = [25 65 105 150 210];
  if ~isequal(run.power_W, expected_power_W)
    error('APA-03 main script: power_W must remain [25 65 105 150 210]. Did a TODO accidentally edit it?');
  end
  if run.ambient_C ~= 24 || run.maximum_junction_C ~= 100
    error('APA-03 main script: ambient_C and maximum_junction_C must remain the supplied values (24 and 100).');
  end
  if abs(run.package_ihs_resistance_C_per_W - 0.18) >= 1e-10 || ...
     abs(run.tim_thickness_mm - 0.08) >= 1e-10 || ...
     abs(run.tim_conductivity_W_mK - 6) >= 1e-10 || ...
     abs(run.tim_area_mm2 - 900) >= 1e-10 || ...
     abs(run.heatsink_resistance_C_per_W - 0.22) >= 1e-10
    error('APA-03 main script: the supplied scenario constants must not be edited.');
  end

  expected_tim_R = 0.0148148148148148;
  if abs(run.tim_resistance_C_per_W - expected_tim_R) >= 1e-10
    error(['APA-03 main script: tim_resistance_C_per_W does not match ' ...
           'tim_resistance(tim_thickness_mm, tim_conductivity_W_mK, tim_area_mm2). ' ...
           'Call the function rather than computing this inline.']);
  end

  expected_base = [29.500000000000000, 38.300000000000000, 47.100000000000000, ...
                   57.000000000000000, 70.200000000000000];
  expected_ihs = [29.870370370370370, 39.262962962962959, 48.655555555555559, ...
                  59.222222222222221, 73.311111111111117];
  expected_junction = [34.370370370370367, 50.962962962962962, 67.555555555555557, ...
                        86.222222222222229, 111.111111111111114];
  expected_margin = [65.629629629629633, 49.037037037037038, 32.444444444444443, ...
                      13.777777777777771, -11.111111111111114];
  expected_within_limit = logical([1 1 1 1 0]);

  if ~isequal(size(run.heatsink_base_C), [1 5]) || ...
      max(abs(run.heatsink_base_C(:) - expected_base(:))) >= 1e-8
    error(['APA-03 main script: heatsink_base_C must be a 1-by-5 vector matching ' ...
           'the supplied scenario. Call processor_temperatures with all required ' ...
           'inputs and capture its outputs in order.']);
  end
  if ~isequal(size(run.ihs_surface_C), [1 5]) || ...
      max(abs(run.ihs_surface_C(:) - expected_ihs(:))) >= 1e-8
    error(['APA-03 main script: ihs_surface_C must be a 1-by-5 vector matching ' ...
           'the supplied scenario. processor_temperatures must be called with ' ...
           'three captured outputs in the required order (base, IHS, junction).']);
  end
  if ~isequal(size(run.junction_C), [1 5]) || ...
      max(abs(run.junction_C(:) - expected_junction(:))) >= 1e-8
    error(['APA-03 main script: junction_C must be a 1-by-5 vector matching the ' ...
           'supplied scenario.']);
  end
  if ~isequal(size(run.margin_C), [1 5]) || ...
      max(abs(run.margin_C(:) - expected_margin(:))) >= 1e-8
    error(['APA-03 main script: margin_C does not match thermal_margin(maximum_junction_C, junction_C).']);
  end

  if ~islogical(run.within_limit)
    error('APA-03 main script: within_limit must be a logical vector (use a relational expression on margin_C).');
  end
  if ~isequal(size(run.within_limit), [1 5]) || ~isequal(run.within_limit, expected_within_limit)
    error(['APA-03 main script: within_limit must include zero margin and exclude ' ...
           'negative margin. Use margin_C >= 0.']);
  end
  if run.within_limit_count ~= 4
    error(['APA-03 main script: within_limit_count must equal 4 (sum(within_limit)), ' ...
           'not a hard-coded constant.']);
  end
  if abs(run.highest_junction_C - 111.111111111111114) >= 1e-8
    error('APA-03 main script: highest_junction_C must equal max(junction_C).');
  end
  if abs(run.minimum_margin_C - (-11.111111111111114)) >= 1e-8
    error('APA-03 main script: minimum_margin_C must equal min(margin_C).');
  end

  if ~isequal(size(run.results), [5 6])
    error(['APA-03 main script: results must be 5-by-6 with power, heat-sink base, ' ...
           'IHS surface, junction, margin, and within-limit columns in that order.']);
  end
  expectedResults = [expected_power_W(:), expected_base(:), expected_ihs(:), ...
                      expected_junction(:), expected_margin(:), ...
                      double(expected_within_limit(:))];
  if max(abs(run.results(:, 1) - expectedResults(:, 1))) >= 1e-8 || ...
     max(abs(run.results(:, 2) - expectedResults(:, 2))) >= 1e-8 || ...
     max(abs(run.results(:, 3) - expectedResults(:, 3))) >= 1e-8 || ...
     max(abs(run.results(:, 4) - expectedResults(:, 4))) >= 1e-8 || ...
     max(abs(run.results(:, 5) - expectedResults(:, 5))) >= 1e-8
    error(['APA-03 main script: results must be 5-by-6 with power, heat-sink base, ' ...
           'IHS surface, junction, margin, and within-limit columns in that order.']);
  end
  if ~isequal(run.results(:, 6), expectedResults(:, 6))
    error(['APA-03 main script: the sixth column of results must contain the ' ...
           'numeric 1/0 form of within_limit.']);
  end

  if run.has_thickness_m || run.has_area_m2
    error(['APA-03 main script: thickness_m and area_m2 must stay local to ' ...
           'tim_resistance.m -- they must not appear in the main-script workspace.']);
  end
end

% ---------------------------------------------------------------------------
function checkWithinLimitIncludesZero(scriptPath)
%CHECKWITHINLIMITINCLUDESZERO  Source-level check that the within_limit
%   assignment treats zero margin as acceptable (margin_C >= 0, or an
%   equivalent like 0 <= margin_C) rather than excluding it (margin_C > 0).
%   Necessary because the supplied five-element scenario never produces an
%   exactly-zero margin_C value, so this can't be caught by comparing
%   within_limit's numeric result against the expected scenario output.
  source = fileread(scriptPath);
  source = strrep(source, sprintf('\r\n'), sprintf('\n'));
  lines = strsplit(source, sprintf('\n'));

  exprLine = '';
  for i = 1:numel(lines)
    tok = regexp(lines{i}, '^\s*within_limit\s*=\s*(.+?);?\s*$', 'tokens', 'once');
    if ~isempty(tok)
      exprLine = tok{1};
      break;
    end
  end

  if isempty(exprLine)
    error(['APA-03 main script: could not find a ''within_limit = ...'' ' ...
           'assignment line to check.']);
  end

  hasInclusive = ~isempty(regexp(exprLine, '(>=|<=)', 'once'));
  hasBareStrict = ~isempty(regexp(exprLine, '[^><=](>|<)[^=]', 'once')) || ...
                  ~isempty(regexp(exprLine, '^(>|<)[^=]', 'once'));

  if ~hasInclusive && hasBareStrict
    error(['APA-03 main script: within_limit must include zero margin and ' ...
           'exclude negative margin. Use margin_C >= 0.']);
  end
end

% ---------------------------------------------------------------------------
function checkMainScriptOutput()
  assignDir = fullfile(engr183.root(), 'assignments', 'u03-apa03-processor-cooling');
  scriptPath = resolveMainScript(assignDir);
  run = runStudentMainScript(scriptPath);
  failIfScriptErrored(run);

  lines = splitNonblankLines(run.capturedOutput);

  expected = { ...
    'TIM resistance: 0.01481 C/W'; ...
    'Highest junction temperature: 111.11 C'; ...
    'Minimum thermal margin: -11.11 C'; ...
    'Power levels within limit: 4 of 5' ...
  };

  found = false(numel(expected), 1);
  for i = 1:numel(expected)
    found(i) = any(strcmp(lines, expected{i}));
  end

  if all(found)
    return;
  end

  missing = expected(~found);
  error(['APA-03 main script: required output is missing or does not match. ' ...
         'Missing (or misformatted) line(s):\n  %s\n' ...
         'Check your fprintf format strings against the precision shown on the ' ...
         'APA page (%%.5f, %%.2f, %%d) and the exact wording of each label.'], ...
        strjoin(missing, sprintf('\n  ')));
end

% ---------------------------------------------------------------------------
function lines = splitNonblankLines(text)
%SPLITNONBLANKLINES  Identical, previously-debugged helper from
%   unit01_check.m -- see that file's header comment for why this
%   normalizes line endings, strips ANSI escapes, and drops \f before
%   splitting, to work identically on desktop Octave and the pinned
%   xeus-octave browser runtime.
  text = strrep(text, sprintf('\r\n'), sprintf('\n'));
  text = strrep(text, sprintf('\r'), sprintf('\n'));
  text = regexprep(text, '\x1b\[[0-9;]*[a-zA-Z]', '');
  text = strrep(text, sprintf('\f'), '');

  raw = strsplit(text, sprintf('\n'));
  lines = {};
  for i = 1:numel(raw)
    t = strtrim(raw{i});
    if ~isempty(t)
      lines{end+1} = t; %#ok<AGROW>
    end
  end
end
