function result = u03_gp03_thermistor_check(criterion)
%U03_GP03_THERMISTOR_CHECK  Shared checks for Unit 3's GP-03 (Thermistor
%   Sensor Functions), called from u03_gp03_thermistor_tests.m via
%   ordinary engr183.spec(...) entries -- mirrors unit02_check.m /
%   u03_apa03_processor_cooling_check.m's shape: all of this exercise's
%   own logic (resolving the right files, running them in isolated
%   workspaces, checking interfaces/values/help/output) lives here so
%   +engr183/runTests.m and +engr183/spec.m stay generic.
%
%   R = U03_GP03_THERMISTOR_CHECK(CRITERION) returns true when CRITERION
%   passes, or throws an error with a specific, actionable message when it
%   does not. runTests.m shows err.message verbatim as the rubric line's
%   hint.
%
%   CRITERION is one of:
%     'required_function_files'            -- both function files exist
%     'main_script_resolves'               -- exactly one main script found
%     'thermistor_resistance_interface'    -- 3 inputs, 1 output declared
%     'thermistor_temperature_interface'   -- 4 inputs, 1 output declared
%     'thermistor_resistance_correctness'  -- divider equation/vectors
%     'thermistor_temperature_correctness' -- beta model/vectors
%     'function_help_documentation'        -- help blocks for both functions
%     'main_script_integration'            -- full main-script pipeline
%     'main_script_output'                 -- the five required printed lines

  assignDir = fullfile(engr183.root(), 'assignments', 'u03-gp03-thermistor');

  switch criterion
    case 'required_function_files'
      requireFileExists(assignDir, 'thermistor_resistance.m');
      requireFileExists(assignDir, 'thermistor_temperature.m');
      resolveMainScript(assignDir);   % also fails with an actionable message
      result = true;

    case 'main_script_resolves'
      resolveMainScript(assignDir);
      result = true;

    case 'thermistor_resistance_interface'
      checkInterface('thermistor_resistance', 3, 1);
      result = true;

    case 'thermistor_temperature_interface'
      checkInterface('thermistor_temperature', 4, 1);
      result = true;

    case 'thermistor_resistance_correctness'
      checkThermistorResistanceCorrectness();
      result = true;

    case 'thermistor_temperature_correctness'
      checkThermistorTemperatureCorrectness();
      result = true;

    case 'function_help_documentation'
      checkHelp('thermistor_resistance', { ...
        {{'resistance'}, 'describes thermistor resistance'}, ...
        {{'volt'}, 'the volts unit'}, ...
        {{'ohm'}, 'the ohms unit'}, ...
        {{'scalar'}, 'whether scalar input is supported'}, ...
        {{'vector'}, 'whether vector input is supported'} ...
      });
      checkHelp('thermistor_temperature', { ...
        {{'temperature'}, 'describes thermistor temperature'}, ...
        {{'ohm'}, 'the ohms unit'}, ...
        {{'kelvin', ' k '}, 'the Kelvin beta coefficient unit'}, ...
        {{'celsius', ' c '}, 'the degrees Celsius unit'}, ...
        {{'scalar'}, 'whether scalar input is supported'}, ...
        {{'vector'}, 'whether vector input is supported'}, ...
        {{'beta'}, 'the beta-model assumption'} ...
      });
      result = true;

    case 'main_script_integration'
      checkMainScriptIntegration();
      result = true;

    case 'main_script_output'
      checkMainScriptOutput();
      result = true;

    otherwise
      error('u03_gp03_thermistor_check:badCriterion', ...
            'Unknown criterion ''%s''.', criterion);
  end
end

% ---------------------------------------------------------------------------
function requireFileExists(assignDir, fileName)
  if exist(fullfile(assignDir, fileName), 'file') ~= 2
    error('%s was not found in assignments/u03-gp03-thermistor/.', fileName);
  end
end

% ---------------------------------------------------------------------------
function scriptPath = resolveMainScript(assignDir)
%RESOLVEMAINSCRIPT  Prefer a single personalized copy (GP03_Thermistor_*.m)
%   over the generic starter (U03_GP03_Thermistor_Starter.m). Same pattern
%   as u03_apa03_processor_cooling_check.m's resolveMainScript.

  generic = fullfile(assignDir, 'U03_GP03_Thermistor_Starter.m');
  personalized = dir(fullfile(assignDir, 'GP03_Thermistor_*.m'));

  if numel(personalized) > 1
    names = strjoin({personalized.name}, ', ');
    error(['More than one personalized copy was found (%s). ' ...
           'Keep only one GP03_Thermistor_*.m file in ' ...
           'assignments/u03-gp03-thermistor/.'], names);
  elseif numel(personalized) == 1
    scriptPath = fullfile(assignDir, personalized(1).name);
    return;
  end

  if exist(generic, 'file') ~= 2
    error(['Neither U03_GP03_Thermistor_Starter.m nor a personalized ' ...
           'GP03_Thermistor_*.m file was found in ' ...
           'assignments/u03-gp03-thermistor/.']);
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
function actual = callOrFail(fnName, args)
  try
    actual = feval(fnName, args{:});
  catch err
    error('%s.m raised an error: %s%s', fnName, engr183.flatten(err.message), ...
          engr183.errorLocation(err));
  end
end

% ---------------------------------------------------------------------------
function checkThermistorResistanceCorrectness()
  actual = callOrFail('thermistor_resistance', {2.5, 5, 10000});
  if ~isscalar(actual) || abs(actual - 10000) >= 1e-8
    error(['thermistor_resistance.m: expected 2.5 V to return 10000 ohm. ' ...
           'Check the divider denominator and the input order.']);
  end

  expected_voltage_V = [3.85 3.20 2.50 1.80 1.25];
  expected_resistance_ohm = [33478.2608695652, 17777.7777777778, ...
      10000.0000000000, 5625.0000000000, 3333.33333333333];
  actual = callOrFail('thermistor_resistance', {expected_voltage_V, 5, 10000});
  if ~isequal(size(actual), [1 5]) || ...
      max(abs(actual - expected_resistance_ohm)) >= 1e-8
    error(['thermistor_resistance.m: the supplied five-element voltage vector ' ...
           'does not produce the authoritative resistance vector.']);
  end

  actual = callOrFail('thermistor_resistance', {[2.5; 1.25], 5, 10000});
  if ~isequal(size(actual), [2 1]) || ...
      max(abs(actual - [10000; 3333.33333333333])) >= 1e-8
    error(['thermistor_resistance.m: a 2-by-1 voltage input must return a ' ...
           '2-by-1 resistance output. Use element-wise operations without ' ...
           'transposing the input.']);
  end

  actual = callOrFail('thermistor_resistance', {1.5, 3, 4700});
  if abs(actual - 4700) >= 1e-8
    error(['thermistor_resistance.m: expected 1.5 V, 3 V supply, and a ' ...
           '4700 ohm fixed resistor to return 4700 ohm. This checks for ' ...
           'hard-coded course constants.']);
  end

  actual = callOrFail('thermistor_resistance', {0, 5, 10000});
  if abs(actual) >= 1e-8
    error('thermistor_resistance.m: zero output voltage must return zero resistance.');
  end
end

% ---------------------------------------------------------------------------
function checkThermistorTemperatureCorrectness()
  actual = callOrFail('thermistor_temperature', {10000, 10000, 25, 3950});
  if ~isscalar(actual) || abs(actual - 25) >= 1e-10
    error(['thermistor_temperature.m: the nominal 10000-ohm case must return ' ...
           '25 C. Check the Celsius-to-Kelvin conversion and the outer ' ...
           'reciprocal.']);
  end

  expected_resistance_ohm = [33478.2608695652, 17777.7777777778, ...
      10000.0000000000, 5625.0000000000, 3333.33333333333];
  expected_temperature_C = [0.080164832950686, 12.590553964494234, ...
      25.000000000000000, 38.536243143050001, 51.959499825774515];
  actual = callOrFail('thermistor_temperature', ...
      {expected_resistance_ohm, 10000, 25, 3950});
  if ~isequal(size(actual), [1 5]) || ...
      max(abs(actual - expected_temperature_C)) >= 1e-4
    error(['thermistor_temperature.m: the supplied five-element resistance ' ...
           'vector does not produce the authoritative temperature vector.']);
  end

  actual = callOrFail('thermistor_temperature', ...
      {[10000; 3333.33333333333], 10000, 25, 3950});
  if ~isequal(size(actual), [2 1]) || ...
      max(abs(actual - [25; 51.959499825774515])) >= 1e-4
    error(['thermistor_temperature.m: a 2-by-1 resistance input must return ' ...
           'a 2-by-1 temperature output. Use element-wise operations without ' ...
           'transposing the input.']);
  end

  actual = callOrFail('thermistor_temperature', {10000, 10000, 30, 3950});
  if abs(actual - 30) >= 1e-10
    error(['thermistor_temperature.m: a nondefault nominal_temperature_C ' ...
           '(30 C) must be honored, not hard-coded to 25.']);
  end

  % Changing beta_K must change the nonnominal result consistent with the
  % beta equation -- computed independently here, not accepted from a
  % hard-coded nominal-only solution.
  nominal_K = 25 + 273.15;
  expectedAltK = 1 / ((1/nominal_K) + (1/5000) * log(3333.33333333333/10000));
  expectedAlt = expectedAltK - 273.15;
  actual = callOrFail('thermistor_temperature', ...
      {3333.33333333333, 10000, 25, 5000});
  if abs(actual - expectedAlt) >= 1e-4
    error(['thermistor_temperature.m: changing beta_K to 5000 does not change ' ...
           'the result consistent with the beta equation. Check that beta_K ' ...
           'is actually used in the calculation.']);
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

  contentChars = regexprep(lowerText, sprintf('[^a-z]|%s', fnName), '');
  if numel(contentChars) < 30
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
function run = runStudentMainScript(scriptPath)
%RUNSTUDENTMAINSCRIPT  Executes the main script in a workspace that is
%   entirely disposable -- same isolation approach as unit01_check.m's
%   runStudentScript. A genuine nested function call is required because
%   the starter begins with `clear;`, which would wipe a caller's own
%   locals too if eval'd directly from that caller's body. Nothing here
%   may be set before the evalc(...) line completes.
  try
    capturedOutput = evalc('eval(fileread(scriptPath));');
    scriptErrored = false;
    scriptErrMessage = '';
  catch err
    capturedOutput = '';
    scriptErrored = true;
    scriptErrMessage = [err.message engr183.errorLocation(err)];
  end

  varNames = {'supply_voltage_V', 'fixed_resistance_ohm', ...
              'nominal_resistance_ohm', 'nominal_temperature_C', 'beta_K', ...
              'output_voltage_V', 'measurement_count', 'resistance_ohm', ...
              'temperature_C', 'temperature_K_exists', ...
              'hottest_temperature_C', 'hottest_index', ...
              'voltage_at_hottest_V', 'resistance_at_hottest_ohm', ...
              'results', 'tolerance', 'nominal_resistance_check_ohm', ...
              'nominal_temperature_check_C'};

  run = struct('ok', ~scriptErrored, 'errMessage', scriptErrMessage, ...
               'capturedOutput', capturedOutput, 'has_temperature_K', false);
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
  run.has_temperature_K = exist('temperature_K', 'var') ~= 0;
end

% ---------------------------------------------------------------------------
function requireVars(run, names)
  for i = 1:numel(names)
    v = names{i};
    if ~run.(['has_' v])
      error('GP-03 main script: your script must create a variable named %s.', v);
    end
  end
end

% ---------------------------------------------------------------------------
function failIfScriptErrored(run)
  if ~run.ok
    error('GP-03 main script: your code raised an error: %s', ...
          engr183.flatten(run.errMessage));
  end
end

% ---------------------------------------------------------------------------
function checkMainScriptIntegration()
  assignDir = fullfile(engr183.root(), 'assignments', 'u03-gp03-thermistor');
  scriptPath = resolveMainScript(assignDir);
  run = runStudentMainScript(scriptPath);
  failIfScriptErrored(run);

  requireVars(run, {'measurement_count', 'output_voltage_V', 'resistance_ohm', ...
                     'temperature_C', 'temperature_K_exists', ...
                     'hottest_temperature_C', 'hottest_index', ...
                     'voltage_at_hottest_V', 'resistance_at_hottest_ohm', ...
                     'results', 'nominal_resistance_check_ohm', ...
                     'nominal_temperature_check_C', 'tolerance'});

  expected_voltage_V = [3.85 3.20 2.50 1.80 1.25];
  expected_resistance_ohm = [33478.2608695652, 17777.7777777778, ...
      10000.0000000000, 5625.0000000000, 3333.33333333333];
  expected_temperature_C = [0.080164832950686, 12.590553964494234, ...
      25.000000000000000, 38.536243143050001, 51.959499825774515];

  if run.measurement_count ~= 5
    error('GP-03 main script: measurement_count must equal 5 (numel(output_voltage_V)).');
  end
  if ~isequal(run.output_voltage_V, expected_voltage_V)
    error('GP-03 main script: output_voltage_V must remain [3.85 3.20 2.50 1.80 1.25].');
  end

  if ~isequal(size(run.resistance_ohm), [1 5]) || ...
      max(abs(run.resistance_ohm(:) - expected_resistance_ohm(:))) >= 1e-8
    error(['GP-03 main script: resistance_ohm must be a 1-by-5 vector from ' ...
           'thermistor_resistance(output_voltage_V, ...).']);
  end
  if ~isequal(size(run.temperature_C), [1 5]) || ...
      max(abs(run.temperature_C(:) - expected_temperature_C(:))) >= 1e-4
    error(['GP-03 main script: temperature_C must be a 1-by-5 vector from ' ...
           'thermistor_temperature(resistance_ohm, ...).']);
  end

  if run.temperature_K_exists ~= 0
    error(['GP-03 main script: temperature_K_exists must be 0. Keep ' ...
           'temperature_K local to thermistor_temperature.m.']);
  end
  if run.has_temperature_K
    error(['GP-03 main script: temperature_K must not appear in the ' ...
           'main-script workspace -- it should stay local to ' ...
           'thermistor_temperature.m.']);
  end

  if run.hottest_index ~= 5
    error('GP-03 main script: hottest_index does not identify measurement 5.');
  end
  if abs(run.hottest_temperature_C - 51.959499825774515) >= 1e-4
    error('GP-03 main script: hottest_temperature_C must equal max(temperature_C).');
  end
  if abs(run.voltage_at_hottest_V - 1.25) >= 1e-10
    error('GP-03 main script: voltage_at_hottest_V does not match output_voltage_V(hottest_index).');
  end
  if abs(run.resistance_at_hottest_ohm - 3333.33333333333) >= 1e-8
    error('GP-03 main script: resistance_at_hottest_ohm does not match resistance_ohm(hottest_index).');
  end

  if ~isequal(size(run.results), [5 3])
    error(['GP-03 main script: results must be 5-by-3 with voltage, resistance, ' ...
           'and temperature columns in that order.']);
  end
  if max(abs(run.results(:, 1) - expected_voltage_V(:))) >= 1e-10 || ...
     max(abs(run.results(:, 2) - expected_resistance_ohm(:))) >= 1e-8 || ...
     max(abs(run.results(:, 3) - expected_temperature_C(:))) >= 1e-4
    error(['GP-03 main script: results must be 5-by-3 with voltage, resistance, ' ...
           'and temperature columns in that order.']);
  end

  if abs(run.nominal_resistance_check_ohm - 10000) >= 1e-8
    error('GP-03 main script: nominal_resistance_check_ohm must equal 10000 ohm.');
  end
  if abs(run.nominal_temperature_check_C - 25) >= 1e-10
    error('GP-03 main script: nominal_temperature_check_C must equal 25 C.');
  end
  if abs(run.tolerance - 1e-10) >= 1e-20
    error('GP-03 main script: tolerance must equal 1e-10, as TODO 7 describes.');
  end
end

% ---------------------------------------------------------------------------
function checkMainScriptOutput()
  assignDir = fullfile(engr183.root(), 'assignments', 'u03-gp03-thermistor');
  scriptPath = resolveMainScript(assignDir);
  run = runStudentMainScript(scriptPath);
  failIfScriptErrored(run);

  lines = splitNonblankLines(run.capturedOutput);

  expected = { ...
    'Measurements processed: 5'; ...
    'Hottest temperature: 51.96 C'; ...
    'Voltage at hottest measurement: 1.25 V'; ...
    'Resistance at hottest measurement: 3333.33 ohm'; ...
    'Nominal-case temperature: 25.00 C' ...
  };

  found = false(numel(expected), 1);
  for i = 1:numel(expected)
    found(i) = any(strcmp(lines, expected{i}));
  end

  if all(found)
    return;
  end

  missing = expected(~found);
  error(['GP-03 main script: required output is missing or does not match. ' ...
         'Missing (or misformatted) line(s):\n  %s\n' ...
         'Check your fprintf format strings against the precision shown on the ' ...
         'GP page (%%d, %%.2f) and the exact wording of each label.'], ...
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
