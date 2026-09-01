function result = u04_gp04_thermal_monitor_check(criterion)
%U04_GP04_THERMAL_MONITOR_CHECK  Shared checks for Unit 4's GP-04
%   (Processor Thermal Safety Monitor), called from
%   u04_gp04_thermal_monitor_tests.m via ordinary engr183.spec(...)
%   entries -- mirrors unit02_check.m / u03_gp03_thermistor_check.m's
%   shape: all of this exercise's own logic (calling the student's
%   functions directly and checking behavior) lives here so
%   +engr183/runTests.m and +engr183/spec.m stay generic.
%
%   R = U04_GP04_THERMAL_MONITOR_CHECK(CRITERION) returns true when
%   CRITERION passes, or throws an error with a specific, actionable
%   message when it does not. runTests.m shows err.message verbatim as
%   the rubric line's hint.
%
%   CRITERION is one of:
%     'required_files'                 -- both function files + main script exist
%     'classification_and_boundaries'  -- classify_temperature boundary cases
%     'classification_validation'      -- classify_temperature error cases
%     'complete_log_behavior'          -- the supplied 7-sample log
%     'shape_and_sentinel_behavior'    -- analyze_thermal_log shape/sentinels
%     'log_validation'                 -- analyze_thermal_log error cases

  assignDir = fullfile(engr183.root(), 'assignments', 'u04-gp04-thermal-monitor');

  switch criterion
    case 'required_files'
      requireFileExists(assignDir, 'classify_temperature.m');
      requireFileExists(assignDir, 'analyze_thermal_log.m');
      requireFileExists(assignDir, 'U04_GP04_ThermalMonitor_Starter.m');
      result = true;

    case 'classification_and_boundaries'
      cases = { ...
        {62, 80, 95, 0, 'a safe sample below the warning threshold should return status code 0'}, ...
        {80, 80, 95, 1, 'the warning threshold itself should return status code 1 (>=, not >)'}, ...
        {94.9, 80, 95, 1, 'a sample just below shutdown should return status code 1'}, ...
        {95, 80, 95, 2, 'the shutdown threshold itself should return status code 2 (>=, not >)'}, ...
        {110, 80, 95, 2, 'a sample above shutdown should return status code 2'} ...
      };
      for i = 1:numel(cases)
        c = cases{i};
        actual = callOrFail('classify_temperature', c(1:3));
        if ~isequal(actual, c{4})
          error('%s (got %s).', c{5}, mat2str(actual));
        end
      end
      result = true;

    case 'classification_validation'
      cases = { ...
        {{[62, 80], 80, 95}, 'a nonscalar temp_C should raise an error'}, ...
        {{NaN, 80, 95}, 'a NaN temp_C should raise an error'}, ...
        {{Inf, 80, 95}, 'an Inf temp_C should raise an error'}, ...
        {{'hot', 80, 95}, 'a nonnumeric temp_C should raise an error'}, ...
        {{80, [75, 80], 95}, 'a nonscalar warning_C should raise an error'}, ...
        {{80, 80, NaN}, 'a NaN shutdown_C should raise an error'}, ...
        {{80, 95, 95}, 'warning_C == shutdown_C should raise an error'}, ...
        {{80, 96, 95}, 'warning_C > shutdown_C should raise an error'} ...
      };
      for i = 1:numel(cases)
        expectRaises('classify_temperature', cases{i}{1}, cases{i}{2});
      end
      result = true;

    case 'complete_log_behavior'
      log_C = [62, 74, 79.9, 80, 88, 95, 98];
      [status_codes, first_warning_index, first_shutdown_index] = ...
        callOrFail3('analyze_thermal_log', {log_C, 80, 95});
      if ~isequal(status_codes, [0, 0, 0, 1, 1, 2, 2])
        error('status_codes for the supplied 7-sample log is incorrect (got %s).', mat2str(status_codes));
      end
      if first_warning_index ~= 4
        error('first_warning_index for the supplied log must be 4 (got %s).', mat2str(first_warning_index));
      end
      if first_shutdown_index ~= 6
        error('first_shutdown_index for the supplied log must be 6 (got %s).', mat2str(first_shutdown_index));
      end
      result = true;

    case 'shape_and_sentinel_behavior'
      cases = { ...
        {[62; 80; 95], [0; 1; 2], 2, 3, 'a column-vector log'}, ...
        {[20, 40, 79.9], [0, 0, 0], 0, 0, 'an all-safe log'}, ...
        {[70, 80, 94.9], [0, 1, 1], 2, 0, 'a warning-only log'}, ...
        {[95, 70, 100], [2, 0, 2], 1, 1, 'a log whose first sample is shutdown'}, ...
        {95, 2, 1, 1, 'a scalar one-sample log'} ...
      };
      for i = 1:numel(cases)
        c = cases{i};
        log_C = c{1};
        [status_codes, fw, fs] = callOrFail3('analyze_thermal_log', {log_C, 80, 95});
        if ~isequal(status_codes, c{2})
          error('status_codes is wrong for %s (got %s).', c{5}, mat2str(status_codes));
        end
        if ~isequal(size(status_codes), size(log_C))
          error('status_codes did not preserve the row/column shape of %s.', c{5});
        end
        if fw ~= c{3}
          error('first_warning_index is wrong for %s (expected %d, got %s).', c{5}, c{3}, mat2str(fw));
        end
        if fs ~= c{4}
          error('first_shutdown_index is wrong for %s (expected %d, got %s).', c{5}, c{4}, mat2str(fs));
        end
      end
      result = true;

    case 'log_validation'
      cases = { ...
        {{[], 80, 95}, 'an empty core_temps_C should raise an error'}, ...
        {{[70, 80; 90, 100], 80, 95}, 'a matrix core_temps_C should raise an error'}, ...
        {{[70, NaN], 80, 95}, 'a NaN sample should raise an error'}, ...
        {{[70, Inf], 80, 95}, 'an Inf sample should raise an error'}, ...
        {{'hot', 80, 95}, 'a nonnumeric core_temps_C should raise an error'}, ...
        {{[70, 80], 95, 95}, 'warning_C == shutdown_C should raise an error'} ...
      };
      for i = 1:numel(cases)
        expectRaises('analyze_thermal_log', cases{i}{1}, cases{i}{2});
      end
      result = true;

    otherwise
      error('u04_gp04_thermal_monitor_check:badCriterion', ...
            'Unknown criterion ''%s''.', criterion);
  end
end

% ---------------------------------------------------------------------------
function requireFileExists(assignDir, fileName)
  if exist(fullfile(assignDir, fileName), 'file') ~= 2
    error('%s was not found in assignments/u04-gp04-thermal-monitor/.', fileName);
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
function [a, b, c] = callOrFail3(fnName, args)
  try
    [a, b, c] = feval(fnName, args{:});
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
