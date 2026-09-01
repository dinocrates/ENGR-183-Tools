function result = u04_apa04_parachute_sizing_check(criterion)
%U04_APA04_PARACHUTE_SIZING_CHECK  Shared checks for Unit 4's APA-04
%   (Validated Model-Rocket Parachute Sizing Tool), called from
%   u04_apa04_parachute_sizing_tests.m via ordinary engr183.spec(...)
%   entries -- mirrors unit02_check.m / u03_apa03_processor_cooling_check.m's
%   shape: all of this assignment's own logic (calling the student's
%   functions directly and checking behavior) lives here so
%   +engr183/runTests.m and +engr183/spec.m stay generic.
%
%   R = U04_APA04_PARACHUTE_SIZING_CHECK(CRITERION) returns true when
%   CRITERION passes, or throws an error with a specific, actionable
%   message when it does not. runTests.m shows err.message verbatim as
%   the rubric line's hint.
%
%   CRITERION is one of:
%     'required_files'                 -- both functions + main + public check exist
%     'parachute_speed_correctness'    -- model calculations and shape
%     'parachute_speed_validation'     -- parachute_speed error cases
%     'size_parachute_search_behavior' -- published/boundary search cases
%     'size_parachute_general_cases'   -- nonpublished search cases
%     'size_parachute_validation'      -- size_parachute error cases
%     'public_check_passes_when_solved' -- the supplied checker itself runs

  assignDir = fullfile(engr183.root(), 'assignments', 'u04-apa04-parachute-sizing');
  diameterTol = 1e-12;
  speedTol = 1e-9;

  switch criterion
    case 'required_files'
      requireFileExists(assignDir, 'parachute_speed.m');
      requireFileExists(assignDir, 'size_parachute.m');
      requireFileExists(assignDir, 'U04_APA04_ParachuteSizing_Starter.m');
      requireFileExists(assignDir, 'U04_APA04_ParachuteSizing_PublicCheck.m');
      result = true;

    case 'parachute_speed_correctness'
      actual = callOrFail('parachute_speed', {0.75, 0.50});
      if ~isscalar(actual) || notClose(actual, 9.031637791711, speedTol)
        error(['parachute_speed.m: parachute_speed(0.75, 0.50) must return ' ...
               '9.031637791711 m/s. Check the area and speed formulas.']);
      end

      rowActual = callOrFail('parachute_speed', {0.75, [0.50, 1.00]});
      if ~isequal(size(rowActual), [1 2]) || ...
          notAllClose(rowActual, [9.031637791711, 4.515818895856], speedTol)
        error(['parachute_speed.m: a 1-by-2 diameter input must return a ' ...
               '1-by-2 speed output matching [9.031637791711, 4.515818895856].']);
      end

      colActual = callOrFail('parachute_speed', {0.75, [0.50; 1.00]});
      if ~isequal(size(colActual), [2 1]) || ...
          notAllClose(colActual, [9.031637791711; 4.515818895856], speedTol)
        error(['parachute_speed.m: a 2-by-1 diameter input must return a ' ...
               '2-by-1 speed output. Use element-wise operators without ' ...
               'transposing the input.']);
      end

      nondefaultActual = callOrFail('parachute_speed', {0.50, 0.60});
      if notClose(nondefaultActual, 6.145251147592, speedTol)
        error(['parachute_speed.m: parachute_speed(0.50, 0.60) must return ' ...
               '6.145251147592 m/s. This checks for hard-coded values from ' ...
               'the public-check example.']);
      end
      result = true;

    case 'parachute_speed_validation'
      cases = { ...
        {{"heavy", 0.50}, 'a nonnumeric mass_kg should raise an error'}, ...
        {{[], 0.50}, 'an empty mass_kg should raise an error'}, ...
        {{[0.75, 1.00], 0.50}, 'a nonscalar mass_kg should raise an error'}, ...
        {{0, 0.50}, 'a zero mass_kg should raise an error'}, ...
        {{-0.75, 0.50}, 'a negative mass_kg should raise an error'}, ...
        {{Inf, 0.50}, 'an Inf mass_kg should raise an error'}, ...
        {{NaN, 0.50}, 'a NaN mass_kg should raise an error'}, ...
        {{0.75, []}, 'an empty diameter_m should raise an error'}, ...
        {{0.75, 0}, 'a zero diameter_m should raise an error'}, ...
        {{0.75, -0.50}, 'a negative diameter_m should raise an error'}, ...
        {{0.75, [0.50, 0]}, 'a diameter_m vector containing zero should raise an error'}, ...
        {{0.75, [0.50, NaN]}, 'a diameter_m vector containing NaN should raise an error'}, ...
        {{0.75, [0.50, Inf]}, 'a diameter_m vector containing Inf should raise an error'}, ...
        {{0.75, "large"}, 'a nonnumeric diameter_m should raise an error'} ...
      };
      for i = 1:numel(cases)
        expectRaises('parachute_speed', cases{i}{1}, cases{i}{2});
      end
      result = true;

    case 'size_parachute_search_behavior'
      cases = { ...
        {0.75, 6.0, 1.0, 0.1, 0.80, 5.644773619819, true, 6, 'the published normal case'}, ...
        {0.75, 20.0, 1.0, 0.1, 0.30, [], true, 1, 'a target the first candidate already meets'}, ...
        {0.75, 4.8, 1.0, 0.1, 1.00, 4.515818895856, true, 8, 'a target only the maximum diameter meets'}, ...
        {0.75, 4.0, 1.0, 0.1, 1.00, 4.515818895856, false, 8, 'a target no candidate meets'}, ...
        {0.75, 16.0, 0.30, 0.10, 0.30, 15.052729652852, true, 1, 'max_diameter_m equal to the minimum, feasible'}, ...
        {0.75, 10.0, 0.30, 0.10, 0.30, 15.052729652852, false, 1, 'max_diameter_m equal to the minimum, infeasible'}, ...
        {0.75, 10.0, 0.50, 1.00, 0.50, 9.031637791711, true, 2, 'a step larger than the remaining range'}, ...
        {0.75, 5.0, 0.95, 0.20, 0.95, 4.753493574585, true, 5, 'a maximum not evenly divisible by the step'} ...
      };
      checkSearchCases(cases, diameterTol, speedTol);

      % None of the fixed cases above land exactly on the feasibility
      % boundary, so a `speed_mps < target_speed_mps` (strict) bug instead
      % of the required `<=` would slip past every one of them -- checked
      % directly here by setting the target to the exact speed the first
      % candidate (0.30 m) produces.
      targetAtMin = callOrFail('parachute_speed', {0.75, 0.30});
      [d, v, ok, n] = callOrFail4('size_parachute', {0.75, targetAtMin, 1.0, 0.1});
      if ~logical(ok) || n ~= 1 || notClose(d, 0.30, diameterTol)
        error(['size_parachute.m: feasible must be set from ' ...
               'speed_mps <= target_speed_mps (inclusive), not a strict <. ' ...
               'A candidate that exactly meets the target must be accepted ' ...
               'immediately.']);
      end
      result = true;

    case 'size_parachute_general_cases'
      cases = { ...
        {1.20, 7.0, 1.20, 0.15, 0.90, 6.346788094102, true, 5, 'a general nonpublished feasible case'}, ...
        {1.20, 4.0, 0.95, 0.20, 0.95, 6.012746615465, false, 5, 'a general nonpublished infeasible case'} ...
      };
      checkSearchCases(cases, diameterTol, speedTol);
      result = true;

    case 'size_parachute_validation'
      checkSizeParachuteValidation();
      result = true;

    case 'public_check_passes_when_solved'
      checkPath = fullfile(assignDir, 'U04_APA04_ParachuteSizing_PublicCheck.m');
      if exist(checkPath, 'file') ~= 2
        error('U04_APA04_ParachuteSizing_PublicCheck.m was not found in assignments/u04-apa04-parachute-sizing/.');
      end
      run = runIsolatedScript(checkPath);
      if ~run.ok
        error(['The public check did not pass: %s\n' ...
               'Complete parachute_speed.m and size_parachute.m, then rerun ' ...
               'the public check.'], engr183.flatten(run.errMessage));
      end
      if isempty(strfind(run.capturedOutput, 'All APA-04 public checks passed.'))
        error(['The public check ran without error, but did not print ' ...
               '''All APA-04 public checks passed.'' -- did you edit the ' ...
               'supplied public-check script?']);
      end
      result = true;

    otherwise
      error('u04_apa04_parachute_sizing_check:badCriterion', ...
            'Unknown criterion ''%s''.', criterion);
  end
end

% ---------------------------------------------------------------------------
function requireFileExists(assignDir, fileName)
  if exist(fullfile(assignDir, fileName), 'file') ~= 2
    error('%s was not found in assignments/u04-apa04-parachute-sizing/.', fileName);
  end
end

% ---------------------------------------------------------------------------
function actual = callOrFail(fnName, args)
  try
    actual = feval(fnName, args{:});
  catch err
    error('%s.m raised an error on a valid input: %s%s', fnName, ...
          engr183.flatten(err.message), engr183.errorLocation(err));
  end
end

% ---------------------------------------------------------------------------
function [a, b, c, d] = callOrFail4(fnName, args)
  try
    [a, b, c, d] = feval(fnName, args{:});
  catch err
    error('%s.m raised an error on a valid input: %s%s', fnName, ...
          engr183.flatten(err.message), engr183.errorLocation(err));
  end
end

% ---------------------------------------------------------------------------
function expectRaises(fnName, args, description)
%EXPECTRAISES  Calls fnName(args{:}) inside its own try/catch so one
%   invalid-input case can never abort the rest of the suite, and fails
%   (with a description of the violated behavior, not the hidden
%   implementation) only when the call unexpectedly succeeds.
  raised = false;
  try
    feval(fnName, args{:});
  catch
    raised = true;
  end
  if ~raised
    error('%s, but %s.m returned normally instead.', description, fnName);
  end
end

% ---------------------------------------------------------------------------
function tf = notClose(actual, expected, tol)
%NOTCLOSE  True when actual is NOT within tol of expected -- deliberately
%   NOT written as `abs(actual - expected) >= tol`, because Octave (like
%   MATLAB) makes every comparison against NaN false, including >=. That
%   phrasing would silently treat an unsolved stub's NaN placeholder as
%   "close enough" (0 >= tol is false, so is NaN >= tol -- both read as
%   "not wrong"). Negating a `<` comparison instead correctly reports NaN
%   as not-close, since NaN < tol is also false.
  tf = ~(isscalar(actual) && isnumeric(actual) && abs(actual - expected) < tol);
end

% ---------------------------------------------------------------------------
function tf = notAllClose(actual, expected, tol)
%NOTALLCLOSE  Vector form of notClose. Also deliberately avoids `max(abs(
%   actual(:) - expected(:))) >= tol`: Octave's max() ignores NaN entries
%   by default rather than propagating them, so a partially-NaN actual
%   vector could pass by only comparing its finite elements. Requiring
%   every element finite AND within tolerance catches that too.
  tf = ~(isequal(size(actual), size(expected)) && isnumeric(actual) && ...
         all(isfinite(actual(:))) && max(abs(actual(:) - expected(:))) < tol);
end

% ---------------------------------------------------------------------------
function checkSearchCases(cases, diameterTol, speedTol)
%CHECKSEARCHCASES  Each case is {mass, target, maxD, step, expD, expV,
%   expFeasible, expIterations, label}. expV may be [] to skip the speed
%   check (used when only the diameter/feasible/iterations matter).
  for i = 1:numel(cases)
    c = cases{i};
    [d, v, ok, n] = callOrFail4('size_parachute', {c{1}, c{2}, c{3}, c{4}});
    label = c{9};

    if notClose(d, c{5}, diameterTol)
      error(['size_parachute.m: diameter_m is wrong for %s (expected %.6f m, ' ...
             'got %.12f m). Do not hard-code the published 0.80 m answer -- ' ...
             'the search must be general.'], label, c{5}, d);
    end
    if ~isempty(c{6}) && notClose(v, c{6}, speedTol)
      error('size_parachute.m: speed_mps is wrong for %s (expected %.9f m/s, got %.12f m/s).', ...
            label, c{6}, v);
    end
    if logical(ok) ~= logical(c{7})
      error('size_parachute.m: feasible is wrong for %s (expected %d, got %d).', ...
            label, c{7}, ok);
    end
    if n ~= c{8}
      error(['size_parachute.m: iterations is wrong for %s (expected %d, got %d). ' ...
             'Check that the maximum diameter is tested as the final candidate ' ...
             'when the next ordinary step would exceed it.'], label, c{8}, n);
    end
  end
end

% ---------------------------------------------------------------------------
function checkSizeParachuteValidation()
%CHECKSIZEPARACHUTEVALIDATION  Independently probes each of the 4 input
%   positions with every invalid-value category the assignment specifies
%   (nonnumeric, empty, nonscalar, zero, negative, Inf, NaN), plus the
%   explicit too-small-maximum-diameter case.
  base = {0.75, 6.0, 1.0, 0.1};
  positionNames = {'mass_kg', 'target_speed_mps', 'max_diameter_m', 'diameter_step_m'};

  invalidByCategory = { ...
    {"bad", 'nonnumeric'}, ...
    {[], 'empty'}, ...
    {[1.0, 1.2], 'nonscalar'}, ...
    {0, 'zero'}, ...
    {-0.5, 'negative'}, ...
    {Inf, 'Inf'}, ...
    {NaN, 'NaN'} ...
  };

  for pos = 1:4
    for cat = 1:numel(invalidByCategory)
      args = base;
      args{pos} = invalidByCategory{cat}{1};
      description = sprintf('a %s %s should raise an error', ...
        invalidByCategory{cat}{2}, positionNames{pos});
      expectRaises('size_parachute', args, description);
    end
  end

  % Explicit brief cases beyond the generic per-position matrix above.
  extraCases = { ...
    {{"heavy", 6.0, 1.0, 0.1}, 'a nonnumeric mass_kg should raise an error'}, ...
    {{0.75, "fast", 1.0, 0.1}, 'a nonnumeric target_speed_mps should raise an error'}, ...
    {{0.75, [6.0, 7.0], 1.0, 0.1}, 'a nonscalar target_speed_mps should raise an error'}, ...
    {{0.75, 6.0, 0.299, 0.1}, 'a max_diameter_m below the 0.30 m minimum should raise an error'}, ...
    {{0.75, 6.0, [1.0, 1.2], 0.1}, 'a nonscalar max_diameter_m should raise an error'}, ...
    {{0.75, 6.0, 1.0, [0.1, 0.2]}, 'a nonscalar diameter_step_m should raise an error'} ...
  };
  for i = 1:numel(extraCases)
    expectRaises('size_parachute', extraCases{i}{1}, extraCases{i}{2});
  end
end

% ---------------------------------------------------------------------------
function run = runIsolatedScript(scriptPath)
%RUNISOLATEDSCRIPT  Executes the public check in a workspace that is
%   entirely disposable -- same isolation approach as unit01_check.m's
%   runStudentScript. A genuine nested function call is required because
%   the public check begins with `clear;`, which would wipe a caller's
%   own locals too if eval'd directly from that caller's body. Nothing
%   here may be set before the evalc(...) line completes.
  try
    capturedOutput = evalc('eval(fileread(scriptPath));');
    scriptErrored = false;
    scriptErrMessage = '';
  catch err
    capturedOutput = '';
    scriptErrored = true;
    scriptErrMessage = [err.message engr183.errorLocation(err)];
  end
  run = struct('ok', ~scriptErrored, 'errMessage', scriptErrMessage, ...
               'capturedOutput', capturedOutput);
end
