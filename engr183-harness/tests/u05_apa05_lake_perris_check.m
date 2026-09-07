function result = u05_apa05_lake_perris_check(criterion)
%U05_APA05_LAKE_PERRIS_CHECK  Shared checks for Unit 5's APA-05 (Lake
%   Perris Reservoir Data Audit), called from u05_apa05_lake_perris_tests.m
%   via ordinary engr183.spec(...) entries -- mirrors
%   u03_apa03_processor_cooling_check.m's shape: all of this assignment's
%   own logic lives here so +engr183/runTests.m and +engr183/spec.m stay
%   generic.
%
%   R = U05_APA05_LAKE_PERRIS_CHECK(CRITERION) returns true when CRITERION
%   passes, or throws an error with a specific, actionable message when it
%   does not. runTests.m shows err.message verbatim as the rubric hint.
%
%   CRITERION is one of:
%     'required_files'                 -- 3 functions + main script exist
%     'read_reservoir_data_correctness'-- parse the CSV, fields, date_code, mask
%     'read_reservoir_data_validation' -- invalid inputs raise an error
%     'summarize_reservoir_correctness'-- every summary value + index remapping
%     'summarize_reservoir_validation' -- invalid inputs raise an error
%     'write_reservoir_report_output'  -- a labeled report file is written
%     'function_help_documentation'    -- help blocks for all 3 functions
%     'public_check_passes'            -- the supplied public check runs clean
%     'main_script_pipeline'           -- main script calls all 3 and confirms

  assignDir = fullfile(engr183.root(), 'assignments', 'u05-apa05-lake-perris');
  dataFile = fullfile(assignDir, 'lake_perris_storage_2025Q1.csv');

  switch criterion
    case 'required_files'
      requireFileExists(assignDir, 'read_reservoir_data.m');
      requireFileExists(assignDir, 'summarize_reservoir.m');
      requireFileExists(assignDir, 'write_reservoir_report.m');
      requireFileExists(assignDir, 'U05_APA05_LakePerris_PublicCheck.m');
      resolveMainScript(assignDir);
      result = true;

    case 'read_reservoir_data_correctness'
      checkInterface('read_reservoir_data', 1, 1);
      data = callOrFail('read_reservoir_data', {dataFile});
      if ~isstruct(data)
        error('read_reservoir_data.m must return a structure.');
      end
      for f = {'storage_af', 'date_code', 'valid_mask'}
        if ~isfield(data, f{1})
          error('read_reservoir_data.m: the structure is missing the field ''%s''.', f{1});
        end
      end
      if numel(data.storage_af) ~= 90
        error('read_reservoir_data.m: storage_af must have 90 elements for the supplied file (got %d).', ...
              numel(data.storage_af));
      end
      if abs(data.storage_af(1) - 105347) >= 1e-6 || abs(data.storage_af(end) - 112255) >= 1e-6
        error('read_reservoir_data.m: storage_af must run from 105347 to 112255 for the supplied file.');
      end
      if data.date_code(1) ~= 20250101 || data.date_code(end) ~= 20250331
        error('read_reservoir_data.m: date_code must be the YYYYMMDD form of the first 8 characters of date_time (expected 20250101 .. 20250331).');
      end
      if numel(data.valid_mask) ~= 90 || sum(logical(data.valid_mask)) ~= 90
        error('read_reservoir_data.m: every row of the supplied file is a valid Lake Perris storage reading, so valid_mask must be all true.');
      end

      % Synthetic file with one bad row per rule -- the frozen file is
      % entirely clean, so validity logic is only exercised here.
      bad = [tempname() '.csv'];
      writeLines(bad, { ...
        'STATION_ID,DURATION,SENSOR_NUMBER,SENSOR_TYPE,DATE TIME,OBS DATE,VALUE,DATA_FLAG,UNITS', ...
        'PRR,D,15,STORAGE,20250101 0000,20250101 0000,100000, ,AF', ...      % valid
        'XXX,D,15,STORAGE,20250102 0000,20250102 0000,100001, ,AF', ...      % wrong station
        'PRR,D,15,STORAGE,20250103 0000,20250103 0000,100002,e,AF', ...      % flagged
        'PRR,D,15,STORAGE,20250104 0000,20250104 0000,-5, ,AF', ...          % negative
        'PRR,D,20,STORAGE,20250105 0000,20250105 0000,100004, ,AF' });       % wrong sensor
      cb = onCleanup(@() deleteQuietly(bad));
      bd = callOrFail('read_reservoir_data', {bad});
      if numel(bd.valid_mask) ~= 5 || ~isequal(logical(bd.valid_mask(:)), logical([1;0;0;0;0]))
        error(['read_reservoir_data.m: valid_mask must exclude rows with the ' ...
               'wrong station, a non-blank data flag, a negative storage value, ' ...
               'or the wrong sensor number. Expected [1 0 0 0 0].']);
      end
      result = true;

    case 'read_reservoir_data_validation'
      expectRaises('read_reservoir_data', {17}, ...
        'a non-character filename should raise an error');
      expectRaises('read_reservoir_data', {fullfile(assignDir, 'no_such_reservoir.csv')}, ...
        'an unopenable file should raise an error');
      emptyHeader = [tempname() '.csv'];
      writeLines(emptyHeader, {''});
      ce = onCleanup(@() deleteQuietly(emptyHeader));
      expectRaises('read_reservoir_data', {emptyHeader}, ...
        'a file with an empty header line should raise an error');
      result = true;

    case 'summarize_reservoir_correctness'
      checkInterface('summarize_reservoir', 2, 1);
      data = callOrFail('read_reservoir_data', {dataFile});
      s = callOrFail('summarize_reservoir', {data, 131452});
      expect(s, 'valid_count', 90, 0);
      expect(s, 'invalid_count', 0, 0);
      expect(s, 'first_storage_af', 105347, 1e-6);
      expect(s, 'last_storage_af', 112255, 1e-6);
      expect(s, 'net_change_af', 6908, 1e-6);
      expect(s, 'min_storage_af', 105347, 1e-6);
      expect(s, 'max_storage_af', 112474, 1e-6);
      expect(s, 'largest_increase_af', 478, 1e-6);
      expect(s, 'largest_decrease_af', -219, 1e-6);
      expect(s, 'ending_percent_capacity', 112255 / 131452 * 100, 1e-6);
      checkDate(data, s, 'max_index', 20250330);
      checkDate(data, s, 'largest_increase_index', 20250313);
      checkDate(data, s, 'largest_decrease_index', 20250331);

      % Index remapping: with invalid rows present, *_index must point at
      % rows of the ORIGINAL structure, not positions in the valid subset.
      synth = struct();
      synth.storage_af = [999; 100; 150; 900; 120; 130];
      synth.date_code = [20250101; 20250102; 20250103; 20250104; 20250105; 20250106];
      synth.valid_mask = logical([0; 1; 1; 0; 1; 1]);      % valid rows: 2 3 5 6 -> [100 150 120 130]
      s2 = callOrFail('summarize_reservoir', {synth, 1000});
      if s2.valid_count ~= 4 || s2.invalid_count ~= 2
        error('summarize_reservoir.m: valid_count/invalid_count must count rows by valid_mask (expected 4 valid, 2 invalid).');
      end
      if s2.min_index ~= 2 || s2.max_index ~= 3
        error(['summarize_reservoir.m: min/max index must be a row of the ORIGINAL ' ...
               'structure, not a position in the valid subset. For the ' ...
               'mixed-validity probe the minimum (100) is row 2 and the maximum ' ...
               '(150) is row 3.']);
      end
      if s2.largest_increase_index ~= 3 || s2.largest_decrease_index ~= 5
        error(['summarize_reservoir.m: largest-change indices must be rows of the ' ...
               'original structure. Increase 100->150 ends at row 3; decrease ' ...
               '150->120 ends at row 5.']);
      end
      result = true;

    case 'summarize_reservoir_validation'
      data = callOrFail('read_reservoir_data', {dataFile});
      expectRaisesArgs('summarize_reservoir', {data, -1}, ...
        'a nonpositive operational capacity should raise an error');
      expectRaisesArgs('summarize_reservoir', {data, [1 2]}, ...
        'a nonscalar operational capacity should raise an error');
      expectRaisesArgs('summarize_reservoir', {rmfield(data, 'valid_mask'), 131452}, ...
        'a structure missing valid_mask should raise an error');
      oneValid = struct('storage_af', [1; 2], 'date_code', [20250101; 20250102], ...
                        'valid_mask', logical([1; 0]));
      expectRaisesArgs('summarize_reservoir', {oneValid, 1000}, ...
        'fewer than two valid records should raise an error');
      result = true;

    case 'write_reservoir_report_output'
      checkInterface('write_reservoir_report', 3, 0);
      data = callOrFail('read_reservoir_data', {dataFile});
      s = callOrFail('summarize_reservoir', {data, 131452});
      outPath = [tempname() '.txt'];
      co = onCleanup(@() deleteQuietly(outPath));
      try
        write_reservoir_report(outPath, data, s);
      catch err
        error('write_reservoir_report.m raised an error on valid inputs: %s%s', ...
              engr183.flatten(err.message), engr183.errorLocation(err));
      end
      if exist(outPath, 'file') ~= 2
        error('write_reservoir_report.m: no file was created at the given path.');
      end
      low = lower(fileread(outPath));
      needs = { ...
        {{'valid'}, 'the valid record count'}, ...
        {{'invalid'}, 'the invalid record count'}, ...
        {{'net storage change', 'net change'}, 'the net storage change'}, ...
        {{'minimum', 'min storage'}, 'the minimum storage'}, ...
        {{'maximum', 'max storage'}, 'the maximum storage'}, ...
        {{'largest daily increase', 'largest increase'}, 'the largest daily increase'}, ...
        {{'largest daily decrease', 'largest decrease'}, 'the largest daily decrease'}, ...
        {{'percent', 'capacity'}, 'the ending percent of operational capacity'}, ...
        {{'interpretation boundary'}, 'the interpretation boundary'} ...
      };
      for k = 1:numel(needs)
        if ~anyContains(low, needs{k}{1})
          error('write_reservoir_report.m: the report does not appear to state %s.', needs{k}{2});
        end
      end
      if isempty(strfind(fileread(outPath), '20250313'))
        error('write_reservoir_report.m: the largest-increase line must be labeled with its date (20250313) from data.date_code.');
      end
      result = true;

    case 'function_help_documentation'
      checkHelp('read_reservoir_data', { ...
        {{'cdec', 'california data exchange', 'reservoir', 'storage'}, 'the data source'}, ...
        {{'acre-feet', 'acre feet', ' af'}, 'the acre-feet unit'}, ...
        {{'valid_mask', 'valid mask'}, 'the valid_mask field'}, ...
        {{'date_code', 'date code', 'yyyymmdd'}, 'the date_code field'}, ...
        {{'error', 'raise'}, 'the error behaviour'} ...
      });
      checkHelp('summarize_reservoir', { ...
        {{'valid'}, 'that it uses only valid rows'}, ...
        {{'index', 'row'}, 'that indices refer to original rows'}, ...
        {{'capacity'}, 'the operational-capacity input'}, ...
        {{'error', 'raise'}, 'the error behaviour'} ...
      });
      checkHelp('write_reservoir_report', { ...
        {{'report', 'audit'}, 'that it writes the audit report'}, ...
        {{'interpretation', 'boundary', 'does not support'}, 'the interpretation boundary'}, ...
        {{'error', 'raise', 'cannot be opened'}, 'the error behaviour'} ...
      });
      result = true;

    case 'public_check_passes'
      run = runScriptInDir(assignDir, 'U05_APA05_LakePerris_PublicCheck.m', ...
                           {'apa05_public_check_report.txt'});
      if ~run.ok
        error(['The supplied public check did not pass. Complete ' ...
               'read_reservoir_data.m, summarize_reservoir.m, and ' ...
               'write_reservoir_report.m, then run ' ...
               'U05_APA05_LakePerris_PublicCheck yourself to see which ' ...
               'assertion failed.']);
      end
      if isempty(strfind(run.capturedOutput, 'APA-05 public checks passed.'))
        error(['The public check ran without error but did not print ' ...
               '''APA-05 public checks passed.'' -- did you edit the supplied file?']);
      end
      result = true;

    case 'main_script_pipeline'
      [run, reportWritten] = runMainScript(assignDir);
      failIfScriptErrored(run);
      if ~reportWritten
        error('Main script: no APA05_lake_perris_audit.txt report file was written -- call write_reservoir_report.');
      end
      low = lower(run.capturedOutput);
      if isempty(strfind(low, 'apa05_lake_perris_audit.txt'))
        error('Main script: the console confirmation must name the output file (APA05_lake_perris_audit.txt).');
      end
      if ~anyContains(low, {'valid'}) || ~anyContains(low, {'invalid'})
        error('Main script: the console confirmation must state the number of valid and invalid records.');
      end
      result = true;

    otherwise
      error('u05_apa05_lake_perris_check:badCriterion', ...
            'Unknown criterion ''%s''.', criterion);
  end
end

% ---------------------------------------------------------------------------
function requireFileExists(assignDir, fileName)
  if exist(fullfile(assignDir, fileName), 'file') ~= 2
    error('%s was not found in assignments/u05-apa05-lake-perris/.', fileName);
  end
end

% ---------------------------------------------------------------------------
function scriptPath = resolveMainScript(assignDir)
  generic = fullfile(assignDir, 'U05_APA05_LakePerris_Starter.m');
  personalized = dir(fullfile(assignDir, 'APA05_LakePerris_*.m'));
  if numel(personalized) > 1
    error(['More than one personalized copy was found (%s). Keep only one ' ...
           'APA05_LakePerris_*.m file in assignments/u05-apa05-lake-perris/.'], ...
          strjoin({personalized.name}, ', '));
  elseif numel(personalized) == 1
    scriptPath = fullfile(assignDir, personalized(1).name);
    return;
  end
  if exist(generic, 'file') ~= 2
    error(['Neither U05_APA05_LakePerris_Starter.m nor a personalized ' ...
           'APA05_LakePerris_*.m file was found in assignments/u05-apa05-lake-perris/.']);
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
function expectRaisesArgs(fnName, args, description)
  expectRaises(fnName, args, description);
end

% ---------------------------------------------------------------------------
function expect(s, field, expected, tol)
  if ~isfield(s, field)
    error('summarize_reservoir.m: the summary is missing the field ''%s''.', field);
  end
  v = s.(field);
  if ~isnumeric(v) || ~isscalar(v) || ~isfinite(v) || abs(double(v) - expected) > tol
    error('summarize_reservoir.m: %s must equal %.10g, but it is %s.', ...
          field, expected, mat2str(v));
  end
end

% ---------------------------------------------------------------------------
function checkDate(data, s, indexField, expectedCode)
  if ~isfield(s, indexField)
    error('summarize_reservoir.m: the summary is missing the field ''%s''.', indexField);
  end
  idx = s.(indexField);
  if ~isnumeric(idx) || ~isscalar(idx) || idx < 1 || idx > numel(data.date_code) || idx ~= round(idx)
    error('summarize_reservoir.m: %s must be a valid row index into the data structure.', indexField);
  end
  if data.date_code(idx) ~= expectedCode
    error('summarize_reservoir.m: %s points at date_code %d, but it should point at %d.', ...
          indexField, data.date_code(idx), expectedCode);
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
    error('u05_apa05_lake_perris_check:tempWrite', 'Could not create a temp file for checks.');
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
    error('%s.m: the help block still contains TODO text.', fnName);
  end
  contentChars = regexprep(low, sprintf('[^a-z]|%s', fnName), '');
  if numel(contentChars) < 40
    error('%s.m: the help block looks too short to describe the purpose, inputs, outputs, and error behaviour.', fnName);
  end
  for k = 1:numel(evidenceGroups)
    if ~anyContains(low, evidenceGroups{k}{1})
      error('%s.m: the help block does not appear to describe %s. Expected wording like: %s.', ...
            fnName, evidenceGroups{k}{2}, strjoin(evidenceGroups{k}{1}, ' / '));
    end
  end
end

% ---------------------------------------------------------------------------
function run = runScriptInDir(assignDir, scriptName, tempOutputs)
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
function [run, reportWritten] = runMainScript(assignDir)
  scriptPath = resolveMainScript(assignDir);
  [~, base, ext] = fileparts(scriptPath);
  scriptName = [base ext];
  oldPwd = pwd();
  restoreDir = onCleanup(@() cd(oldPwd));
  cd(assignDir);
  reportPath = fullfile(assignDir, 'APA05_lake_perris_audit.txt');
  cleanReport = onCleanup(@() deleteQuietly(reportPath));
  deleteQuietly(reportPath);
  run = evalScriptIsolated(scriptName);
  reportWritten = exist(reportPath, 'file') == 2;
end

% ---------------------------------------------------------------------------
function failIfScriptErrored(run)
  if ~run.ok
    error('Main script: your code raised an error: %s', engr183.flatten(run.errMessage));
  end
end
