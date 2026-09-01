function result = u02_gp02_tensile_check(criterion)
%U02_GP02_TENSILE_CHECK  Shared checks for Unit 2's GP-02 guided-practice
%   exercise (Tensile-Test Data Analysis), called from
%   u02_gp02_tensile_tests.m via ordinary engr183.spec(...) entries.
%   Mirrors unit01_check.m/unit02_check.m's shape: all of this exercise's
%   own logic (resolving the right file, running it in an isolated
%   workspace, checking values) lives here so +engr183/runTests.m and
%   +engr183/spec.m stay generic.
%
%   Note on the exercise id: 'u02-gp02-tensile' (with hyphens) is what the
%   Playground passes to engr183.runTests(...) and what the assignments/
%   and _verify/ folders are named -- hyphens are fine in a path. This
%   *file*, and the spec function it's paired with, are named with
%   underscores instead, because Octave function names can't contain
%   hyphens; +engr183/runTests.m sanitizes hyphens to underscores only
%   when building the '<unit>_tests' function name it feval's, which is
%   what makes that split work.
%
%   R = U02_GP02_TENSILE_CHECK(CRITERION) returns true when CRITERION
%   passes, or throws an error with a specific, actionable message when it
%   does not. runTests.m shows err.message verbatim as the rubric line's
%   hint.
%
%   CRITERION is one of the seven guided-practice checkpoints:
%     'checkpoint1_inspect'   -- force_N/extension_mm untouched; force_size,
%                                 extension_length, measurement_count correct
%     'checkpoint2_transform' -- initial_area_mm2, stress_MPa, strain,
%                                 strain_percent correct
%     'checkpoint3_retrieve'  -- fifth_force_N, fifth_extension_mm,
%                                 last_extension_mm correct
%     'checkpoint4_locate_uts' -- ultimate_strength_MPa, uts_index,
%                                 force_at_uts_N, strain_at_uts_percent correct
%     'checkpoint5_select'    -- early_region_mask, early_region_stress_MPa
%                                 correct
%     'checkpoint6_organize'  -- results is the correct 39-by-4 matrix
%     'checkpoint7_report'    -- fprintf output matches the required lines

  scriptPath = resolveTargetScript();

  switch criterion
    case 'checkpoint1_inspect'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      requireVars(run, {'force_N', 'extension_mm', 'force_size', ...
                         'extension_length', 'measurement_count'}, 'TODO 1');

      if ~isnumeric(run.force_N) || ~isnumeric(run.extension_mm)
        error('force_N and extension_mm must stay numeric vectors -- TODO 1 should not change their type.');
      end
      [okForce, msgForce] = compareVectors(run.force_N, referenceForce());
      if ~okForce
        error(['force_N no longer matches the supplied measurements (%s). ' ...
               'Did TODO 1-9 accidentally edit the data instead of just reading it?'], msgForce);
      end
      [okExt, msgExt] = compareVectors(run.extension_mm, referenceExtension());
      if ~okExt
        error(['extension_mm no longer matches the supplied measurements (%s). ' ...
               'Did TODO 1-9 accidentally edit the data instead of just reading it?'], msgExt);
      end
      if ~isequal(run.force_size, [1 39])
        error('Expected force_size to be [1 39] (from size(force_N)), but got %s.', ...
              mat2str(run.force_size));
      end
      if ~isequal(run.extension_length, 39)
        error('Expected extension_length to be 39 (from length(extension_mm)), but got %s.', ...
              mat2str(run.extension_length));
      end
      if ~isequal(run.measurement_count, 39)
        error('Expected measurement_count to be 39, but got %s.', mat2str(run.measurement_count));
      end
      result = true;

    case 'checkpoint2_transform'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      requireVars(run, {'gauge_width_mm', 'gauge_thickness_mm', 'gauge_length_mm', ...
                         'force_N', 'extension_mm', 'initial_area_mm2', 'stress_MPa', ...
                         'strain', 'strain_percent'}, 'TODO 2-4');

      expectedArea = run.gauge_width_mm * run.gauge_thickness_mm;
      if ~relClose(run.initial_area_mm2, expectedArea, 1e-7)
        error(['initial_area_mm2 does not match gauge_width_mm * gauge_thickness_mm ' ...
               '(TODO 2).']);
      end

      if ~isnumeric(run.stress_MPa) || ~isequal(size(run.stress_MPa), [1 39])
        error('stress_MPa should be a 1-by-39 numeric vector (got %s) -- TODO 3.', ...
              sizeDescription(run.stress_MPa));
      end
      expectedStress = run.force_N ./ run.initial_area_mm2;
      if ~allRelClose(run.stress_MPa, expectedStress, 1e-7)
        error('stress_MPa does not match force_N ./ initial_area_mm2 (TODO 3).');
      end

      if ~isnumeric(run.strain) || ~isequal(size(run.strain), [1 39])
        error('strain should be a 1-by-39 numeric vector (got %s) -- TODO 4.', ...
              sizeDescription(run.strain));
      end
      expectedStrain = run.extension_mm ./ run.gauge_length_mm;
      if ~allRelClose(run.strain, expectedStrain, 1e-7)
        error('strain does not match extension_mm ./ gauge_length_mm (TODO 4).');
      end

      if ~isnumeric(run.strain_percent) || ~isequal(size(run.strain_percent), [1 39])
        error('strain_percent should be a 1-by-39 numeric vector (got %s) -- TODO 4.', ...
              sizeDescription(run.strain_percent));
      end
      if ~allRelClose(run.strain_percent, run.strain .* 100, 1e-7)
        error('strain_percent does not match strain .* 100 (TODO 4).');
      end
      result = true;

    case 'checkpoint3_retrieve'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      requireVars(run, {'force_N', 'extension_mm', 'fifth_force_N', ...
                         'fifth_extension_mm', 'last_extension_mm'}, 'TODO 5');

      if ~relClose(run.fifth_force_N, run.force_N(5), 1e-9)
        error('fifth_force_N does not match force_N(5) (TODO 5).');
      end
      if ~relClose(run.fifth_extension_mm, run.extension_mm(5), 1e-9)
        error('fifth_extension_mm does not match extension_mm(5) (TODO 5).');
      end
      if ~relClose(run.last_extension_mm, run.extension_mm(end), 1e-9)
        error('last_extension_mm does not match extension_mm(end) (TODO 5).');
      end
      if ~relClose(run.fifth_force_N, 1615.09, 1e-7)
        error('Expected fifth_force_N to be 1615.09, but got %.6g.', run.fifth_force_N);
      end
      if ~relClose(run.fifth_extension_mm, 0.02967017, 1e-7)
        error('Expected fifth_extension_mm to be 0.02967017, but got %.6g.', run.fifth_extension_mm);
      end
      if ~relClose(run.last_extension_mm, 18.01818, 1e-7)
        error('Expected last_extension_mm to be 18.01818, but got %.6g.', run.last_extension_mm);
      end
      result = true;

    case 'checkpoint4_locate_uts'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      requireVars(run, {'stress_MPa', 'force_N', 'strain_percent', ...
                         'ultimate_strength_MPa', 'uts_index', 'force_at_uts_N', ...
                         'strain_at_uts_percent'}, 'TODO 6');

      if ~isscalar(run.uts_index) || run.uts_index ~= round(run.uts_index)
        error('uts_index should be a single integer (the second output of max), but got %s.', ...
              mat2str(run.uts_index));
      end
      [expectedMax, expectedIdx] = max(run.stress_MPa);
      if ~relClose(run.ultimate_strength_MPa, expectedMax, 1e-7)
        error(['ultimate_strength_MPa does not match max(stress_MPa) (TODO 6). ' ...
               'Use the FIRST output of max with two outputs.']);
      end
      if run.uts_index ~= expectedIdx
        error(['uts_index does not match the index max(stress_MPa) actually returns. ' ...
               'Remember to use the SECOND output of max with two outputs.']);
      end
      if run.uts_index ~= 33
        error('Expected uts_index to identify measurement 33, but got %d.', run.uts_index);
      end
      if ~relClose(run.ultimate_strength_MPa, 581.1298466806, 1e-7)
        error('Expected ultimate_strength_MPa to be about 581.13 MPa, but got %.6g.', ...
              run.ultimate_strength_MPa);
      end
      if ~relClose(run.force_at_uts_N, run.force_N(run.uts_index), 1e-9)
        error('force_at_uts_N does not match force_N(uts_index).');
      end
      if ~relClose(run.strain_at_uts_percent, run.strain_percent(run.uts_index), 1e-9)
        error('strain_at_uts_percent does not match strain_percent(uts_index).');
      end
      if ~relClose(run.strain_at_uts_percent, 15.1515356119, 1e-7)
        error('Expected strain_at_uts_percent to be about 15.15%%, but got %.6g.', ...
              run.strain_at_uts_percent);
      end
      result = true;

    case 'checkpoint5_select'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      requireVars(run, {'strain', 'stress_MPa', 'early_region_mask', ...
                         'early_region_stress_MPa'}, 'TODO 7');

      if numel(run.early_region_mask) ~= 39
        error('early_region_mask should have 39 elements (one per measurement), but has %d -- TODO 7.', ...
              numel(run.early_region_mask));
      end
      expectedMask = run.strain <= 0.0015;
      if ~isequal(logical(run.early_region_mask(:)), logical(expectedMask(:)))
        error('early_region_mask does not match strain <= 0.0015 (TODO 7).');
      end
      if sum(run.early_region_mask) ~= 10
        error('Expected early_region_mask to select 10 measured points, but it selected %d.', ...
              sum(run.early_region_mask));
      end
      expectedStress = run.stress_MPa(logical(expectedMask));
      if numel(run.early_region_stress_MPa) ~= numel(expectedStress) || ...
         ~allRelClose(run.early_region_stress_MPa, expectedStress, 1e-7)
        error('early_region_stress_MPa does not match stress_MPa(early_region_mask) (TODO 7).');
      end
      if ~relClose(run.early_region_stress_MPa(1), 0, 1e-9)
        error('Expected the first selected stress in early_region_stress_MPa to be 0.');
      end
      if ~relClose(run.early_region_stress_MPa(end), 233.8980784, 1e-6)
        error('Expected the last selected stress in early_region_stress_MPa to be about 233.90 MPa.');
      end
      result = true;

    case 'checkpoint6_organize'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      requireVars(run, {'force_N', 'extension_mm', 'stress_MPa', ...
                         'strain_percent', 'results'}, 'TODO 8');

      actualSize = size(run.results);
      if isequal(actualSize, [1 156])
        error(['Your four row vectors were joined end to end, producing a 1-by-156 row. ' ...
               'Transpose each quantity into a column before combining them so that each ' ...
               'row represents one measurement event.']);
      end
      if ~isequal(actualSize, [39 4])
        error('results should be a 39-by-4 matrix (got %s). Check transposes and column order.', ...
              mat2str(actualSize));
      end
      expected = [run.force_N(:) run.extension_mm(:) run.stress_MPa(:) run.strain_percent(:)];
      if ~allRelClose(run.results(:, 1), expected(:, 1), 1e-9)
        error('Column 1 of results does not match force_N transposed to a column.');
      end
      if ~allRelClose(run.results(:, 2), expected(:, 2), 1e-9)
        error('Column 2 of results does not match extension_mm transposed to a column.');
      end
      if ~allRelClose(run.results(:, 3), expected(:, 3), 1e-7)
        error('Column 3 of results does not match stress_MPa transposed to a column.');
      end
      if ~allRelClose(run.results(:, 4), expected(:, 4), 1e-7)
        error('Column 4 of results does not match strain_percent transposed to a column.');
      end
      result = true;

    case 'checkpoint7_report'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);

      lines = splitNonblankLines(run.capturedOutput);
      expected = { ...
        'Initial area: 22.6258 mm^2'; ...
        'Ultimate tensile strength: 581.13 MPa'; ...
        'UTS measurement index: 33'; ...
        'Force at UTS: 13148.5 N'; ...
        'Strain at UTS: 15.15 %' ...
      };

      found = false(numel(expected), 1);
      for i = 1:numel(expected)
        found(i) = any(strcmp(lines, expected{i}));
      end

      if all(found)
        result = true;
        return;
      end

      missing = expected(~found);
      % strjoin's delimiter is inserted literally (it does not reinterpret
      % backslash escapes the way sprintf/error's own format string does),
      % so the '\n  ' separator has to come from sprintf('\n  ') to actually
      % be a newline rather than the four literal characters \, n, space,
      % space.
      error(['TODO 9''s printed output is missing or does not match the required lines. ' ...
             'Missing (or misformatted) line(s):\n  %s\n' ...
             'Check your fprintf format strings against the precision shown on the Canvas page ' ...
             '(e.g. %%.4f, %%.2f, %%d, %%.1f) and the exact wording of each label.'], ...
            strjoin(missing, sprintf('\n  ')));

    otherwise
      error('u02_gp02_tensile_check:badCriterion', 'Unknown criterion ''%s''.', criterion);
  end
end

% ---------------------------------------------------------------------------
function scriptPath = resolveTargetScript()
%RESOLVETARGETSCRIPT  Prefer a single personalized copy
%   (U02_GP02_TensileTest_*.m) over the generic starter, same pattern as
%   unit01_check.m/unit02_check.m's resolveTargetScript.

  assignDir = fullfile(engr183.root(), 'assignments', 'u02-gp02-tensile');
  generic = fullfile(assignDir, 'U02_GP02_TensileTest.m');
  personalized = dir(fullfile(assignDir, 'U02_GP02_TensileTest_*.m'));

  if numel(personalized) > 1
    names = strjoin({personalized.name}, ', ');
    error(['More than one personalized copy was found (%s). ' ...
           'Keep only one U02_GP02_TensileTest_*.m file in assignments/u02-gp02-tensile/.'], names);
  elseif numel(personalized) == 1
    scriptPath = fullfile(assignDir, personalized(1).name);
    return;
  end

  if exist(generic, 'file') ~= 2
    error('U02_GP02_TensileTest.m was not found in assignments/u02-gp02-tensile/.');
  end
  scriptPath = generic;
end

% ---------------------------------------------------------------------------
function failIfScriptErrored(run)
  if ~run.ok
    error('your code raised an error: %s', engr183.flatten(run.errMessage));
  end
end

% ---------------------------------------------------------------------------
function requireVars(run, names, todoHint)
  for i = 1:numel(names)
    v = names{i};
    if ~run.(['has_' v])
      error('Your script must create a variable named %s (see %s).', v, todoHint);
    end
  end
end

% ---------------------------------------------------------------------------
function ok = relClose(actual, expected, relTol)
%RELCLOSE  True when |actual - expected| is within relTol of |expected|,
%   with a small absolute floor so comparisons against 0 (e.g. the first
%   early_region_stress_MPa value) still work.
  tol = max(relTol * abs(expected), 1e-9);
  ok = isnumeric(actual) && isscalar(actual) && abs(actual - expected) <= tol;
end

% ---------------------------------------------------------------------------
function ok = allRelClose(actual, expected, relTol)
  actual = actual(:);
  expected = expected(:);
  if ~isnumeric(actual) || numel(actual) ~= numel(expected)
    ok = false;
    return;
  end
  tol = max(relTol .* abs(expected), 1e-9);
  ok = all(abs(actual - expected) <= tol);
end

% ---------------------------------------------------------------------------
function [ok, msg] = compareVectors(actual, expected)
  if ~isequal(size(actual), size(expected))
    ok = false;
    msg = sprintf('expected size %s, got %s', mat2str(size(expected)), mat2str(size(actual)));
    return;
  end
  d = abs(actual(:) - expected(:));
  if all(d <= 1e-9)
    ok = true;
    msg = '';
  else
    [worst, idx] = max(d);
    ok = false;
    msg = sprintf('largest difference %.6g at element %d', worst, idx);
  end
end

% ---------------------------------------------------------------------------
function s = sizeDescription(value)
  if isnumeric(value)
    s = mat2str(size(value));
  else
    s = class(value);
  end
end

% ---------------------------------------------------------------------------
function v = referenceExtension()
%REFERENCEEXTENSION  The exact, unmodified extension_mm measurements
%   supplied in the starter -- used to detect accidental edits to the
%   measured data. Public data, not an answer key: these are the starter's
%   own given values, not anything a student derives.
  v = [0 0.005282184 0.01001418 0.01984217 0.02967017 ...
      0.03986217 0.05005417 0.06024617 0.08026617 0.1002862 ...
      0.1246739 0.1497899 0.1749059 0.2000219 0.2305979 ...
      0.2604459 0.2993939 0.3390699 0.3794739 0.5094219 ...
      1.019753 2.047683 3.039223 4.021663 4.954593 ...
      5.977063 6.949673 7.957593 9.000452 9.931562 ...
      11.08948 11.91868 12.11778 12.95238 14.00258 ...
      15.04908 15.99758 16.95018 18.01818];
end

% ---------------------------------------------------------------------------
function v = referenceForce()
%REFERENCEFORCE  The exact, unmodified force_N measurements supplied in
%   the starter. See referenceExtension's note above.
  v = [0 273.392 515.661 1058.21 1615.09 ...
      2267.17 2909.35 3441.66 4460.9 5292.12 ...
      6030.53 6492.54 6808.86 7058.64 7282.14 ...
      7452.41 7627.46 7773.5 7903.51 8318.78 ...
      9508.63 10894.3 11646.1 12133 12446.9 ...
      12692.6 12856.4 12974.8 13057.7 13105.5 ...
      13139.9 13148.1 13148.5 13145.4 13128.3 ...
      13089.4 13009.6 12773.1 11960.3];
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

% ---------------------------------------------------------------------------
function run = runStudentScript(scriptPath)
%RUNSTUDENTSCRIPT  Executes the student's script in a workspace that is
%   entirely disposable -- same isolation approach as unit01_check.m's
%   runStudentScript (see that file for the full rationale). Nothing in
%   this workspace may be set before the evalc(...) line completes, since
%   the student's `clear;` fires partway through evaluating that line's
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

  varNames = {'force_N', 'extension_mm', 'gauge_width_mm', 'gauge_thickness_mm', ...
              'gauge_length_mm', 'force_size', 'extension_length', 'measurement_count', ...
              'initial_area_mm2', 'stress_MPa', 'strain', 'strain_percent', ...
              'fifth_force_N', 'fifth_extension_mm', 'last_extension_mm', ...
              'ultimate_strength_MPa', 'uts_index', 'force_at_uts_N', ...
              'strain_at_uts_percent', 'early_region_mask', 'early_region_stress_MPa', ...
              'results'};

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
