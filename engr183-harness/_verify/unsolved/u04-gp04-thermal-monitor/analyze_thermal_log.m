function [status_codes, first_warning_index, first_shutdown_index] = ...
    analyze_thermal_log(core_temps_C, warning_C, shutdown_C)
  % ANALYZE_THERMAL_LOG Classify every sample and record first events.

  % TODO: Validate a nonempty, finite numeric vector.
  % TODO: Preallocate status_codes with the same shape as core_temps_C.
  % TODO: Initialize both "not found" indices to 0.
  % TODO: Loop through every sample and call classify_temperature.
  % TODO: Record each first event only once.

  status_codes = [];
  first_warning_index = 0;
  first_shutdown_index = 0;
end
