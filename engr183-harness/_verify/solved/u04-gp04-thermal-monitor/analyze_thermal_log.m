function [status_codes, first_warning_index, first_shutdown_index] = ...
    analyze_thermal_log(core_temps_C, warning_C, shutdown_C)
  % ANALYZE_THERMAL_LOG Classify every sample and record first events.

  if ~isnumeric(core_temps_C) || isempty(core_temps_C) || ~isvector(core_temps_C) || ...
      ~all(isfinite(core_temps_C(:)))
    error('analyze_thermal_log:badInput', ...
      'core_temps_C must be a nonempty finite numeric vector.');
  end
  if ~isnumeric(warning_C) || ~isscalar(warning_C) || ~isfinite(warning_C)
    error('analyze_thermal_log:badInput', 'warning_C must be a finite numeric scalar.');
  end
  if ~isnumeric(shutdown_C) || ~isscalar(shutdown_C) || ~isfinite(shutdown_C)
    error('analyze_thermal_log:badInput', 'shutdown_C must be a finite numeric scalar.');
  end
  if ~(warning_C < shutdown_C)
    error('analyze_thermal_log:badThresholds', ...
      'warning_C must be strictly less than shutdown_C.');
  end

  status_codes = zeros(size(core_temps_C));
  first_warning_index = 0;
  first_shutdown_index = 0;

  for k = 1:numel(core_temps_C)
    status_codes(k) = classify_temperature(core_temps_C(k), warning_C, shutdown_C);

    if status_codes(k) >= 1 && first_warning_index == 0
      first_warning_index = k;
    end
    if status_codes(k) == 2 && first_shutdown_index == 0
      first_shutdown_index = k;
    end
  end
end
