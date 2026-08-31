function status_code = classify_temperature(temp_C, warning_C, shutdown_C)
  % CLASSIFY_TEMPERATURE Classify one processor temperature.
  %   status_code = 0 for safe
  %   status_code = 1 for warning
  %   status_code = 2 for shutdown

  % TODO: Validate that each input is a finite numeric scalar.
  % TODO: Require warning_C < shutdown_C.
  % TODO: Test the most severe condition first.

  status_code = NaN;
end
