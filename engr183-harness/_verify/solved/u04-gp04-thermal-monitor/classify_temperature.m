function status_code = classify_temperature(temp_C, warning_C, shutdown_C)
  % CLASSIFY_TEMPERATURE Classify one processor temperature.
  %   status_code = 0 for safe
  %   status_code = 1 for warning
  %   status_code = 2 for shutdown

  if ~isnumeric(temp_C) || ~isscalar(temp_C) || ~isfinite(temp_C)
    error('classify_temperature:badInput', 'temp_C must be a finite numeric scalar.');
  end
  if ~isnumeric(warning_C) || ~isscalar(warning_C) || ~isfinite(warning_C)
    error('classify_temperature:badInput', 'warning_C must be a finite numeric scalar.');
  end
  if ~isnumeric(shutdown_C) || ~isscalar(shutdown_C) || ~isfinite(shutdown_C)
    error('classify_temperature:badInput', 'shutdown_C must be a finite numeric scalar.');
  end
  if ~(warning_C < shutdown_C)
    error('classify_temperature:badThresholds', 'warning_C must be strictly less than shutdown_C.');
  end

  if temp_C >= shutdown_C
    status_code = 2;
  elseif temp_C >= warning_C
    status_code = 1;
  else
    status_code = 0;
  end
end
