function result = unit01_check(criterion)
%UNIT01_CHECK  Shared checks for Unit 1 (OR-01 GNU Octave Setup and First
%   Script), called from unit01_tests.m via ordinary engr183.spec(...)
%   entries -- this keeps +engr183/runTests.m and +engr183/spec.m generic;
%   all of Unit 1's own logic (resolving the right file, running it in an
%   isolated workspace, checking placeholders/values/output) lives here.
%
%   R = UNIT01_CHECK(CRITERION) returns true when CRITERION passes, or
%   throws an error with a specific, actionable message when it does not.
%   runTests.m shows err.message verbatim as the rubric line's hint.
%
%   CRITERION is one of:
%     'name_placeholder'    -- the "% Name:" comment was personalized
%     'date_placeholder'    -- the "% Date:" comment was personalized
%     'student_name_value'  -- student_name is no longer the placeholder
%     'stored_values'       -- the script runs and computes work_J correctly
%     'output_lines'        -- the five required lines print, in order

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

    case 'student_name_value'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);
      if ~run.has_student_name
        error('Your script must create a variable named student_name.');
      end
      name = strtrim(run.student_name);
      if strcmp(name, 'Replace with your first and last name')
        error('student_name still contains the starter placeholder.');
      end
      if isempty(name) || isempty(strfind(name, ' '))
        error('student_name should contain your first and last name, e.g. ''Jane Smith''.');
      end
      result = true;

    case 'stored_values'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);

      required = {'student_name', 'course_number', 'force_N', 'distance_m', ...
                   'work_J', 'octave_version'};
      for i = 1:numel(required)
        v = required{i};
        if ~run.(['has_' v])
          error('Your script must create a variable named %s.', v);
        end
      end

      if ~isequal(run.course_number, 183)
        error('Expected course_number to be 183, but the script created %s.', ...
              mat2str(run.course_number));
      end

      expectedWork = run.force_N * run.distance_m;
      if abs(run.work_J - expectedWork) > 1e-9
        error(['Expected work_J to equal force_N * distance_m (%.6g), ' ...
               'but the script created work_J = %.6g.'], expectedWork, run.work_J);
      end
      if abs(run.work_J - 75) > 1e-9
        error('Expected work_J to be 75, but the script created work_J = %.6g.', run.work_J);
      end

      if ~strcmp(strtrim(run.octave_version), strtrim(version()))
        error(['octave_version does not match the running Octave version ' ...
               '(expected %s, got %s).'], version(), run.octave_version);
      end

      result = true;

    case 'output_lines'
      run = runStudentScript(scriptPath);
      failIfScriptErrored(run);

      lines = splitNonblankLines(run.capturedOutput);

      expected = { ...
        'GNU Octave setup verified.'; ...
        sprintf('Student: %s', run.student_name); ...
        'Course: ENGR 183'; ...
        sprintf('GNU Octave version: %s', version()); ...
        'Work check: 75.0 J' ...
      };

      if numel(lines) < numel(expected)
        error(['Expected %d output lines, but your script printed %d. ' ...
               'Run the script and check for errors.'], numel(expected), numel(lines));
      end

      ordinal = {'first', 'second', 'third', 'fourth', 'fifth'};
      for i = 1:numel(expected)
        if ~strcmp(lines{i}, expected{i})
          error('The %s output line must be: %s', ordinal{i}, expected{i});
        end
      end

      result = true;

    otherwise
      error('unit01_check:badCriterion', 'Unknown criterion ''%s''.', criterion);
  end
end

% ---------------------------------------------------------------------------
function scriptPath = resolveTargetScript()
%RESOLVETARGETSCRIPT  Prefer a single personalized copy
%   (U01_OctaveSetupCheck_*.m, e.g. from the Playground's Add File
%   workflow) over the generic starter, so the same checker works whether
%   or not a student has renamed their file yet for Canvas submission.

  assignDir = fullfile(engr183.root(), 'assignments', 'unit01');
  generic = fullfile(assignDir, 'U01_OctaveSetupCheck.m');
  personalized = dir(fullfile(assignDir, 'U01_OctaveSetupCheck_*.m'));

  if numel(personalized) > 1
    names = strjoin({personalized.name}, ', ');
    error(['More than one personalized copy was found (%s). ' ...
           'Keep only one U01_OctaveSetupCheck_*.m file in assignments/unit01/.'], names);
  elseif numel(personalized) == 1
    scriptPath = fullfile(assignDir, personalized(1).name);
    return;
  end

  if exist(generic, 'file') ~= 2
    error('U01_OctaveSetupCheck.m was not found in assignments/unit01/.');
  end
  scriptPath = generic;
end

% ---------------------------------------------------------------------------
function checkCommentPersonalized(scriptPath, label, failMessage)
%CHECKCOMMENTPERSONALIZED  Matches the "% Name:"/"% Date:" comment line
%   against `label`, one whole line at a time -- not one regexp against
%   the whole file with 'lineanchors' set.
%
%   Two real, only-caught-by-testing-both-runtimes bugs happened here:
%   1. A plain (.*)  capture group greedily matched all the way to the end
%      of the FILE, not just the line, because `.` matches newlines even
%      with 'lineanchors' set (that option only changes what ^/$ anchor
%      to -- it doesn't stop `.` from crossing lines). Fixed at the time by
%      switching to [^\r\n]*.
%   2. That fix still relied on 'lineanchors' to make ^/$ match at each
%      line boundary within the whole-file string -- which desktop Octave
%      10.3.0 honors, but the pinned xeus-octave 0.6.2 browser runtime
%      does not: confirmed directly that with a personalized file, this
%      check still reported the placeholder failure message every time,
%      while the execution-based checks (which also read the same file,
%      just via eval instead of regexp) correctly saw the personalized
%      content. 'lineanchors' silently not applying meant ^ only anchored
%      to the very start of the whole file -- never true for the second or
%      third line -- so the match failed unconditionally regardless of
%      personalization. Splitting into individual lines first and running
%      an ordinary (non-multiline) regexp against each one sidesteps the
%      question of whether either runtime's 'lineanchors' behaves the same,
%      since a single line's own start/end IS the whole string being
%      matched -- no multiline mode needed at all.
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
function lines = splitNonblankLines(text)
%SPLITNONBLANKLINES  Normalizes line endings and strips control characters
%   that a terminal-clear could plausibly emit (confirmed directly against
%   Octave 10.3.0 that evalc-captured output from a script calling clc
%   contains none of these -- clc is a no-op under output capture -- but
%   this is defensive against the pinned xeus-octave browser runtime
%   behaving differently, per this checker's requirement to work in both).
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
%   entirely disposable -- this is a genuine separate function call, not
%   just an eval()/evalc() wrapper inside unit01_check itself, which
%   matters because the starter begins with `clear;`. eval()/evalc() alone
%   do NOT create a new workspace -- they run in the CALLING function's
%   workspace -- confirmed directly against Octave 10.3.0: a bare
%   evalc('eval(fileread(path))') called straight from unit01_check's own
%   body let the student's `clear;` wipe unit01_check's own local
%   variables (scriptPath included). Only a genuine nested function call
%   isolates it, since Octave gives every function invocation its own
%   fresh workspace no matter what eval/evalc do inside it -- verified
%   with this exact two-function structure before relying on it here.
%
%   Subtlety that cost a debugging round-trip: NOTHING in this function's
%   workspace may be set before the evalc(...) line below runs, including
%   the eventual return struct itself. The student's `clear;` fires while
%   evaluating that line's right-hand side, before the assignment to
%   capturedOutput actually lands -- so it wipes whatever already existed
%   in this workspace at that moment (confirmed directly: pre-building the
%   result struct first, then assigning capturedOutput into one of its
%   fields, silently wiped the struct itself). capturedOutput survives
%   only because its assignment completes strictly after the clear. Every
%   other output field is therefore built fresh, after the fact, from
%   whatever the student's script left behind.
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
               'capturedOutput', capturedOutput, ...
               'has_student_name', false, 'has_course_number', false, ...
               'has_force_N', false, 'has_distance_m', false, ...
               'has_work_J', false, 'has_octave_version', false, ...
               'student_name', '', 'course_number', [], 'force_N', [], ...
               'distance_m', [], 'work_J', [], 'octave_version', '');

  if scriptErrored
    return;
  end

  names = {'student_name', 'course_number', 'force_N', 'distance_m', ...
           'work_J', 'octave_version'};
  for i = 1:numel(names)
    n = names{i};
    if exist(n, 'var')
      run.(['has_' n]) = true;
      run.(n) = eval(n);
    end
  end
end
