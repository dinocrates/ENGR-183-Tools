%% ENGR 183 | Unit 4 Guided Practice solved verification fixture
% Processor Thermal Safety Monitor
% Name: Verification Fixture

clear;
clc;

student_name = "Verification Fixture";

%% Given thermal log and limits
core_temps_C = [62, 74, 79.9, 80, 88, 95, 98];
warning_C = 80;
shutdown_C = 95;

%% Analyze the complete log
[status_codes, first_warning_index, first_shutdown_index] = ...
    analyze_thermal_log(core_temps_C, warning_C, shutdown_C);

[highest_temperature_C, highest_index] = max(core_temps_C);

safe_count = sum(status_codes == 0);
warning_count = sum(status_codes == 1);
shutdown_count = sum(status_codes == 2);

%% Boundary checks
assert(classify_temperature(80, warning_C, shutdown_C) == 1);
assert(classify_temperature(95, warning_C, shutdown_C) == 2);

%% Engineering summary
fprintf("Samples processed: %d\n", numel(core_temps_C));

if first_warning_index > 0
  fprintf("First warning-or-higher sample: %d (%.1f C)\n", ...
          first_warning_index, core_temps_C(first_warning_index));
else
  fprintf("No warning sample was detected.\n");
end

if first_shutdown_index > 0
  fprintf("First shutdown sample: %d (%.1f C)\n", ...
          first_shutdown_index, core_temps_C(first_shutdown_index));
else
  fprintf("No shutdown sample was detected.\n");
end

fprintf("Highest temperature: %.1f C at sample %d\n", ...
        highest_temperature_C, highest_index);
fprintf("Status counts: safe=%d, warning=%d, shutdown=%d\n", ...
        safe_count, warning_count, shutdown_count);
