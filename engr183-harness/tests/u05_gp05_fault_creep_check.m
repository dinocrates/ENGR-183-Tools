function result = u05_gp05_fault_creep_check(criterion)
%U05_GP05_FAULT_CREEP_CHECK  Shared checks for Unit 5's GP-05 (From Sensor
%   File to Engineering Summary), called from u05_gp05_fault_creep_tests.m
%   via ordinary engr183.spec(...) entries -- mirrors
%   u04_gp04_thermal_monitor_check.m / u03_apa03_processor_cooling_check.m's
%   shape: all of this exercise's own logic lives here so
%   +engr183/runTests.m and +engr183/spec.m stay generic.
%
%   R = U05_GP05_FAULT_CREEP_CHECK(CRITERION) returns true when CRITERION
%   passes, or throws an error with a specific, actionable message when it
%   does not. runTests.m shows err.message verbatim as the rubric hint.
%
%   CRITERION is one of:
%     'required_files'            -- read_creep_data.m + main script exist
%     'read_creep_data_correctness' -- struct fields/values for the real file
%     'read_creep_data_validation'  -- invalid inputs raise an error
%     'read_creep_data_help'      -- the help block is complete
%     'public_check_passes'       -- the supplied public check runs clean
%     'main_script_summary'       -- computed record count / extremes / changes
%     'main_script_report'        -- a labeled report file is written

  assignDir = fullfile(engr183.root(), 'assignments', 'u05-gp05-fault-creep');
  dataFile = fullfile(assignDir, 'parkfield_xpk2_daily_excerpt.txt');

  switch criterion
    case 'required_files'
      requireFileExists(assignDir, 'read_creep_data.m');
      resolveMainScript(assignDir);
      result = true;

    case 'read_creep_data_correctness'
      checkInterface('read_creep_data', 1, 1);
      creep = callOrFail('read_creep_data', {dataFile});
      if ~isstruct(creep)
        error('read_creep_data.m must return a structure.');
      end
      needed = {'source_file', 'year', 'day_of_year', 'slip_mm', 'valid_mask'};
      for k = 1:numel(needed)
        if ~isfield(creep, needed{k})
          error('read_creep_data.m: the returned structure is missing the field ''%s''.', needed{k});
        end
      end
      n = 40;
      if numel(creep.slip_mm) ~= n || numel(creep.year) ~= n || ...
         numel(creep.day_of_year) ~= n || numel(creep.valid_mask) ~= n
        error('read_creep_data.m: every data field must have %d elements for the supplied file.', n);
      end
      if size(creep.slip_mm, 2) ~= 1 || size(creep.year, 2) ~= 1 || ...
         size(creep.day_of_year, 2) ~= 1 || size(creep.valid_mask, 2) ~= 1
        error('read_creep_data.m: year, day_of_year, slip_mm, and valid_mask must be column vectors.');
      end
      if creep.year(1) ~= 2013 || creep.day_of_year(1) ~= 151
        error('read_creep_data.m: the first record must be year 2013, day of year 151.');
      end
      if abs(creep.slip_mm(1) - 217.08) >= 1e-9 || abs(creep.slip_mm(end) - 218.18) >= 1e-9
        error('read_creep_data.m: slip_mm must run from 217.08 to 218.18 for the supplied file.');
      end
      if ~islogical(creep.valid_mask) || ~all(creep.valid_mask)
        error('read_creep_data.m: valid_mask must be logical and true for every record in the supplied (clean) file.');
      end

      % A fourth column is allowed by the USGS docs and must be ignored.
      extraPath = [tempname() '.txt'];
      writeLines(extraPath, {'2024 100 10.5 999', '2024 101 10.8 888'});
      cleanExtra = onCleanup(@() deleteQuietly(extraPath));
      extra = callOrFail('read_creep_data', {extraPath});
      if ~isequal(extra.slip_mm(:), [10.5; 10.8])
        error('read_creep_data.m: a fourth column must be ignored (expected slip_mm [10.5; 10.8]).');
      end

      % Results must be derived from whatever file is given, not hardcoded
      % to the authentic excerpt's own answers.
      altPath = [tempname() '.txt'];
      writeLines(altPath, {'2020 10 5.50', '2020 11 -3.25', '2021 200 42.00'});
      cleanAlt = onCleanup(@() deleteQuietly(altPath));
      alt = callOrFail('read_creep_data', {altPath});
      if numel(alt.slip_mm) ~= 3 || ~isequal(alt.year(:), [2020; 2020; 2021]) || ...
         ~isequal(alt.day_of_year(:), [10; 11; 200]) || ...
         any(abs(alt.slip_mm(:) - [5.50; -3.25; 42.00]) > 1e-9)
        error(['read_creep_data.m: results must be derived from the file given, not ' ...
               'hardcoded to the authentic excerpt (a different 3-record file did not ' ...
               'produce matching year/day_of_year/slip_mm values).']);
      end
      result = true;

    case 'read_creep_data_validation'
      expectRaises('read_creep_data', {42}, ...
        'a non-character filename should raise an error');
      expectRaises('read_creep_data', {''}, ...
        'an empty filename should raise an error');
      expectRaises('read_creep_data', {['ab'; 'cd']}, ...
        'a non-row (multi-row character) filename should raise an error');
      expectRaises('read_creep_data', {fullfile(assignDir, 'no_such_creep_file.txt')}, ...
        'an unopenable file should raise an error');

      zeroDay = [tempname() '.txt'];
      writeLines(zeroDay, {'2024 0 10.5'});
      c0 = onCleanup(@() deleteQuietly(zeroDay));
      expectRaises('read_creep_data', {zeroDay}, ...
        'a day of year of 0 should raise an error');

      badDay = [tempname() '.txt'];
      writeLines(badDay, {'2024 367 10.5'});
      c1 = onCleanup(@() deleteQuietly(badDay));
      expectRaises('read_creep_data', {badDay}, ...
        'a day of year outside 1-366 should raise an error');

      nonIntYear = [tempname() '.txt'];
      writeLines(nonIntYear, {'2024.5 100 10.5'});
      c2 = onCleanup(@() deleteQuietly(nonIntYear));
      expectRaises('read_creep_data', {nonIntYear}, ...
        'a non-integer year should raise an error');

      nonIntDay = [tempname() '.txt'];
      writeLines(nonIntDay, {'2024 100.5 10.5'});
      c3 = onCleanup(@() deleteQuietly(nonIntDay));
      expectRaises('read_creep_data', {nonIntDay}, ...
        'a non-integer day of year should raise an error');

      infYear = [tempname() '.txt'];
      writeLines(infYear, {'Inf 100 10.5'});
      c4 = onCleanup(@() deleteQuietly(infYear));
      expectRaises('read_creep_data', {infYear}, ...
        'a non-finite year should raise an error');

      % NaN must land on a line after the first: resolveHeaderLines only
      % inspects the file's first line, and a literal "NaN" token there
      % would itself be (mis)read as a non-numeric header cell.
      nanSlip = [tempname() '.txt'];
      writeLines(nanSlip, {'2024 100 10.5', '2024 101 NaN'});
      c5 = onCleanup(@() deleteQuietly(nanSlip));
      expectRaises('read_creep_data', {nanSlip}, ...
        'a NaN slip value should raise an error');

      infSlip = [tempname() '.txt'];
      writeLines(infSlip, {'2024 100 Inf'});
      c6 = onCleanup(@() deleteQuietly(infSlip));
      expectRaises('read_creep_data', {infSlip}, ...
        'an infinite slip value should raise an error');

      twoCol = [tempname() '.txt'];
      writeLines(twoCol, {'2024 100', '2024 101'});
      c7 = onCleanup(@() deleteQuietly(twoCol));
      expectRaises('read_creep_data', {twoCol}, ...
        'a file with fewer than three columns should raise an error');
      result = true;

    case 'read_creep_data_help'
      checkHelp('read_creep_data', { ...
        {{'creepmeter', 'creep', 'slip'}, 'what the file/function describes'}, ...
        {{'year'}, 'the year column'}, ...
        {{'day of year', 'day_of_year', 'day-of-year'}, 'the day-of-year column'}, ...
        {{'millimet', ' mm'}, 'the millimetre slip unit'}, ...
        {{'valid_mask', 'valid mask', 'mask'}, 'the valid_mask field'}, ...
        {{'error', 'raise', 'invalid'}, 'the error behaviour on bad input'} ...
      });
      result = true;

    case 'public_check_passes'
      run = runScriptInDir(assignDir, 'U05_GP05_FaultCreep_PublicCheck.m', ...
                           {'gp05_optional_column_test.txt', 'gp05_bad_day_test.txt'});
      if ~run.ok
        error(['The supplied public check did not pass. Complete ' ...
               'read_creep_data.m, then run U05_GP05_FaultCreep_PublicCheck ' ...
               'yourself to see which assertion failed.']);
      end
      if isempty(strfind(run.capturedOutput, 'GP-05 public checks passed.'))
        error(['The public check ran without error but did not print ' ...
               '''GP-05 public checks passed.'' -- did you edit the supplied file?']);
      end
      result = true;

    case 'main_script_summary'
      run = runMainScript(assignDir);
      failIfScriptErrored(run);
      requireVars(run, {'record_count', 'first_slip_mm', 'final_slip_mm', ...
                        'net_slip_change_mm', 'min_slip_mm', 'min_row', ...
                        'max_slip_mm', 'max_row', 'largest_increase_mm', ...
                        'largest_increase_row'});
      approx(run.record_count, 40, 0, 'record_count', 'numel of the slip data');
      approx(run.first_slip_mm, 217.08, 1e-9, 'first_slip_mm', 'creep.slip_mm(1)');
      approx(run.final_slip_mm, 218.18, 1e-9, 'final_slip_mm', 'creep.slip_mm(end)');
      approx(run.net_slip_change_mm, 1.1, 1e-9, 'net_slip_change_mm', 'final minus first slip');
      approx(run.min_slip_mm, 217.06, 1e-9, 'min_slip_mm', 'min of the slip data');
      approx(run.min_row, 4, 0, 'min_row', 'the row index of the minimum slip');
      approx(run.max_slip_mm, 218.18, 1e-9, 'max_slip_mm', 'max of the slip data');
      approx(run.max_row, 40, 0, 'max_row', 'the row index of the maximum slip');
      approx(run.largest_increase_mm, 0.25, 1e-9, 'largest_increase_mm', 'max of diff(slip_mm)');
      approx(run.largest_increase_row, 39, 0, 'largest_increase_row', ...
             'the row where the largest day-to-day increase ends');
      % The point of the exercise: largest single change is not the net change.
      if abs(run.largest_increase_mm - run.net_slip_change_mm) < 1e-6
        error(['Main script: largest_increase_mm and net_slip_change_mm should ' ...
               'not be equal -- re-check CHECKPOINT 5 (diff, then max).']);
      end
      result = true;

    case 'main_script_report'
      [run, reportText] = runMainScriptCapturingReport(assignDir);
      failIfScriptErrored(run);
      if isempty(reportText)
        error(['Main script: no report file was written. CHECKPOINT 7 must ' ...
               'fopen(report_filename, ''w''), fprintf labeled results, and fclose.']);
      end
      low = lower(reportText);
      needs = { ...
        {{'record'}, 'the record count'}, ...
        {{'net'}, 'the net slip change'}, ...
        {{'minimum', 'min slip', 'min '}, 'the minimum slip'}, ...
        {{'maximum', 'max slip', 'max '}, 'the maximum slip'}, ...
        {{'largest'}, 'the largest daily increase'}, ...
        {{'mm', 'millimet'}, 'millimeter units'}, ...
        {{'source', 'parkfield', 'xpk2', 'usgs'}, 'the data source'}, ...
        {{'day'}, 'the year/day-of-year dates for each result'}, ...
        {{'forecast', 'not a forecast', 'interpretation'}, 'the interpretation boundary'} ...
      };
      for k = 1:numel(needs)
        if ~anyContains(low, needs{k}{1})
          error('Main script: the report file does not appear to state %s.', needs{k}{2});
        end
      end
      % Console confirmation too: the summary must reach the Command Window.
      cons = lower(run.capturedOutput);
      if ~anyContains(cons, {'record'}) || ~anyContains(cons, {'slip'})
        error(['Main script: CHECKPOINT 6 must also print a summary to the ' ...
               'Command Window (labels naming records and slip).']);
      end
      result = true;

    otherwise
      error('u05_gp05_fault_creep_check:badCriterion', ...
            'Unknown criterion ''%s''.', criterion);
  end
end

% ---------------------------------------------------------------------------
function requireFileExists(assignDir, fileName)
  if exist(fullfile(assignDir, fileName), 'file') ~= 2
    error('%s was not found in assignments/u05-gp05-fault-creep/.', fileName);
  end
end

% ---------------------------------------------------------------------------
function scriptPath = resolveMainScript(assignDir)
%RESOLVEMAINSCRIPT  Prefer a single personalized copy
%   (GP05_FaultCreep_*.m) over the generic starter. The public-check file
%   never matches either name, so it is never mistaken for the main script.
  generic = fullfile(assignDir, 'U05_GP05_FaultCreep_Starter.m');
  personalized = dir(fullfile(assignDir, 'GP05_FaultCreep_*.m'));
  if numel(personalized) > 1
    error(['More than one personalized copy was found (%s). Keep only one ' ...
           'GP05_FaultCreep_*.m file in assignments/u05-gp05-fault-creep/.'], ...
          strjoin({personalized.name}, ', '));
  elseif numel(personalized) == 1
    scriptPath = fullfile(assignDir, personalized(1).name);
    return;
  end
  if exist(generic, 'file') ~= 2
    error(['Neither U05_GP05_FaultCreep_Starter.m nor a personalized ' ...
           'GP05_FaultCreep_*.m file was found in ' ...
           'assignments/u05-gp05-fault-creep/.']);
  end
  scriptPath = generic;
end

% ---------------------------------------------------------------------------
function checkInterface(fnName, expectedNargin, expectedNargout)
  if exist(fnName, 'file') ~= 2
    error('%s.m was not found -- have you created it yet?', fnName);
  end
  if nargin(fnName) ~= expectedNargin
    error('%s.m must declare exactly %d input(s), but it declares %d.', ...
          fnName, expectedNargin, nargin(fnName));
  end
  if nargout(fnName) ~= expectedNargout
    error('%s.m must declare exactly %d output(s), but it declares %d.', ...
          fnName, expectedNargout, nargout(fnName));
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
function expectRaises(fnName, args, description)
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
function approx(actual, expected, tol, name, meaning)
  if ~isnumeric(actual) || ~isscalar(actual) || ~isfinite(actual) || ...
     abs(double(actual) - expected) > tol
    error('Main script: %s must equal %g (%s), but it is %s.', ...
          name, expected, meaning, mat2str(actual));
  end
end

% ---------------------------------------------------------------------------
function tf = anyContains(haystack, needles)
  tf = false;
  for k = 1:numel(needles)
    if ~isempty(strfind(haystack, needles{k}))
      tf = true;
      return;
    end
  end
end

% ---------------------------------------------------------------------------
function writeLines(path, lines)
  fid = fopen(path, 'w');
  if fid == -1
    error('u05_gp05_fault_creep_check:tempWrite', 'Could not create a temp file for validation checks.');
  end
  for k = 1:numel(lines)
    fprintf(fid, '%s\n', lines{k});
  end
  fclose(fid);
end

% ---------------------------------------------------------------------------
function deleteQuietly(path)
%DELETEQUIETLY  Remove a file with no output on any code path. `delete`
%   emits a *warning* when the file is absent -- which runTests would flag
%   as stray output -- so use unlink with both outputs captured (that form
%   returns a status instead of printing), guarded by an exist() check.
  if exist(path, 'file') == 2
    [~, ~] = unlink(path);
  end
end

% ---------------------------------------------------------------------------
function checkHelp(fnName, evidenceGroups)
%CHECKHELP  Tolerant keyword-based evidence check against `help fnName` --
%   same approach as u03_apa03_processor_cooling_check.m's checkHelp.
  if exist(fnName, 'file') ~= 2
    error('%s.m was not found -- have you created it yet?', fnName);
  end
  try
    helpText = evalc(['help ' fnName]);
  catch err
    error('%s.m: calling ''help %s'' raised an error: %s', fnName, fnName, ...
          engr183.flatten(err.message));
  end
  low = lower(helpText);
  if ~isempty(strfind(low, 'todo'))
    error(['%s.m: the help block still contains TODO text. Replace every ' ...
           'TODO placeholder with real documentation.'], fnName);
  end
  contentChars = regexprep(low, sprintf('[^a-z]|%s', fnName), '');
  if numel(contentChars) < 40
    error(['%s.m: the help block looks too short to describe the purpose, ' ...
           'input, output fields, units, and error behaviour.'], fnName);
  end
  for k = 1:numel(evidenceGroups)
    keywords = evidenceGroups{k}{1};
    description = evidenceGroups{k}{2};
    if ~anyContains(low, keywords)
      error(['%s.m: the help block does not appear to describe %s. ' ...
             'Expected wording like: %s.'], fnName, description, strjoin(keywords, ' / '));
    end
  end
end

% ---------------------------------------------------------------------------
function run = runScriptInDir(assignDir, scriptName, tempOutputs)
%RUNSCRIPTINDIR  cd into assignDir, run a script by name in an isolated
%   workspace (both the public check and the main script begin with
%   `clear;`), restore the directory, and delete any temp files the script
%   is expected to create. LIFO onCleanup: temp-file cleanup registered
%   after the cd restore so it runs first, while still in assignDir.
  oldPwd = pwd();
  restoreDir = onCleanup(@() cd(oldPwd));
  cd(assignDir);
  absTemps = cellfun(@(n) fullfile(assignDir, n), tempOutputs, 'UniformOutput', false);
  cleanTemps = onCleanup(@() deleteMany(absTemps));
  run = evalScriptIsolated(scriptName);
end

% ---------------------------------------------------------------------------
function deleteMany(paths)
  for k = 1:numel(paths)
    deleteQuietly(paths{k});
  end
end

% ---------------------------------------------------------------------------
function run = evalScriptIsolated(scriptName)
%EVALSCRIPTISOLATED  Genuine nested call so the script's `clear;` cannot
%   wipe a caller's locals -- see unit01_check.m's runStudentScript header
%   for the full rationale. Nothing may be assigned in this workspace
%   before the evalc line completes.
  try
    capturedOutput = evalc('eval(fileread(scriptName));');
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

% ---------------------------------------------------------------------------
function run = runMainScript(assignDir)
  scriptPath = resolveMainScript(assignDir);
  [~, scriptName, ext] = fileparts(scriptPath);
  scriptName = [scriptName ext];
  oldPwd = pwd();
  restoreDir = onCleanup(@() cd(oldPwd));
  cd(assignDir);
  cleanReport = onCleanup(@() deleteQuietly(fullfile(assignDir, 'GP05_fault_creep_summary.txt')));
  run = harvestMainScript(scriptName);
end

% ---------------------------------------------------------------------------
function run = harvestMainScript(scriptName)
%HARVESTMAINSCRIPT  Isolated run that also collects the variables the main
%   script is supposed to create. Nothing may be assigned before the
%   evalc line -- same constraint as unit01_check.m's runStudentScript.
  try
    capturedOutput = evalc('eval(fileread(scriptName));');
    scriptErrored = false;
    scriptErrMessage = '';
  catch err
    capturedOutput = '';
    scriptErrored = true;
    scriptErrMessage = [err.message engr183.errorLocation(err)];
  end

  wanted = {'record_count', 'first_slip_mm', 'final_slip_mm', ...
            'net_slip_change_mm', 'min_slip_mm', 'min_row', 'max_slip_mm', ...
            'max_row', 'largest_increase_mm', 'largest_increase_row'};
  run = struct('ok', ~scriptErrored, 'errMessage', scriptErrMessage, ...
               'capturedOutput', capturedOutput);
  for i = 1:numel(wanted)
    run.(['has_' wanted{i}]) = false;
    run.(wanted{i}) = [];
  end
  if scriptErrored
    return;
  end
  for i = 1:numel(wanted)
    if exist(wanted{i}, 'var')
      run.(['has_' wanted{i}]) = true;
      run.(wanted{i}) = eval(wanted{i});
    end
  end
end

% ---------------------------------------------------------------------------
function [run, reportText] = runMainScriptCapturingReport(assignDir)
  scriptPath = resolveMainScript(assignDir);
  [~, scriptName, ext] = fileparts(scriptPath);
  scriptName = [scriptName ext];
  oldPwd = pwd();
  restoreDir = onCleanup(@() cd(oldPwd));
  cd(assignDir);
  cleanReport = onCleanup(@() deleteQuietly(fullfile(assignDir, 'GP05_fault_creep_summary.txt')));
  run = evalScriptIsolated(scriptName);
  reportText = '';
  if exist('GP05_fault_creep_summary.txt', 'file') == 2
    reportText = fileread('GP05_fault_creep_summary.txt');
  end
end

% ---------------------------------------------------------------------------
function failIfScriptErrored(run)
  if ~run.ok
    error('Main script: your code raised an error: %s', engr183.flatten(run.errMessage));
  end
end

% ---------------------------------------------------------------------------
function requireVars(run, names)
  for i = 1:numel(names)
    if ~run.(['has_' names{i}])
      error('Main script: your script must create a variable named %s.', names{i});
    end
  end
end
