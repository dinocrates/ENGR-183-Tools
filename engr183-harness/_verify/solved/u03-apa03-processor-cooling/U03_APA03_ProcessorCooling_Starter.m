% ENGR 183 | APA-03 solved verification fixture
% Name: Verification Fixture
% Date: 2026-08-24

clear;
clc;

power_W = [25 65 105 150 210];
ambient_C = 24;
maximum_junction_C = 100;

package_ihs_resistance_C_per_W = 0.18;

tim_thickness_mm = 0.08;
tim_conductivity_W_mK = 6;
tim_area_mm2 = 900;

heatsink_resistance_C_per_W = 0.22;

tim_resistance_C_per_W = tim_resistance( ...
    tim_thickness_mm, tim_conductivity_W_mK, tim_area_mm2);

[heatsink_base_C, ihs_surface_C, junction_C] = ...
    processor_temperatures(power_W, ambient_C, ...
    package_ihs_resistance_C_per_W, tim_resistance_C_per_W, ...
    heatsink_resistance_C_per_W);

margin_C = thermal_margin(maximum_junction_C, junction_C);

within_limit = margin_C >= 0;
within_limit_count = sum(within_limit);
highest_junction_C = max(junction_C);
minimum_margin_C = min(margin_C);

results = [power_W(:), heatsink_base_C(:), ihs_surface_C(:), ...
    junction_C(:), margin_C(:), within_limit(:)];

fprintf('TIM resistance: %.5f C/W\n', tim_resistance_C_per_W);
fprintf('Highest junction temperature: %.2f C\n', ...
    highest_junction_C);
fprintf('Minimum thermal margin: %.2f C\n', minimum_margin_C);
fprintf('Power levels within limit: %d of %d\n', ...
    within_limit_count, numel(power_W));

% Negative margin means the junction exceeds its limit; 210 W fails.
% The 0.22 C/W heat-sink path produces the largest temperature rise.
% Real systems vary with airflow and transient power or temperature.
