% ENGR 183 | Unit 8 Project | Solar-Panel Analysis and Report
% Name: Replace with your name
% Date: Replace with the date
% Implement the supplied equations; use the results in your PDF report.
clear;
clc;
close all;

% Supplied inputs: do not change, except selected_day may be 1 through 5.
data_filename = 'solar_station_measurements.csv';
required_power_W = 100;
minimum_met_pct = 80;
budget_USD = 800;
system_names = {'A', 'B', 'C'};
component_names = {'Solar panel', 'Charge controller', 'Mounting kit', ...
                   'Wiring kit', 'Charging interface'};
component_quantity = [2, 1, 1, 1, 1];
% Rows: A, B, C. Columns follow component_names. UNIT prices in $/item.
unit_price_USD = [120, 80, 75, 45, 40; ...
                  190, 105, 95, 60, 50; ...
                  280, 160, 110, 85, 65];
selected_day = 1;

% TODO 1: Read data_filename into raw_data. Its first row is a measurement.
% Store original_count. Build one logical valid_rows mask using all sensors
% for -999 and only voltage/current columns for the negative-value rule.
% Store clean_data, retained_count, rejected_count. If no rows remain,
% stop with a clear message before computing any percentage.

% TODO 2: Extract test_day and time_hr, and the N-by-3 voltage_V,
% current_A and temperature_C arrays, with system order A, B, C.

% TODO 3: Calculate power_W with element-wise multiplication.
% Across all retained rows calculate the 1-by-3 average_power_W,
% maximum_power_W, maximum_temperature_C, meeting_count and met_pct.
% A reading equal to 100 W counts. Use retained_count as denominator.

% TODO 4: Complete evaluate_system.m, then call the same helper for A/B/C.
% Pass component_quantity and each row of unit_price_USD, plus that system's
% met_pct, budget_USD and minimum_met_pct. Store the returned line_cost_USD
% (3-by-5), total_cost_USD and qualifies (1-by-3), and status_code (1-by-3 cell).
% Calculate cost_per_avg_W from returned totals. If average power is zero,
% use Inf. Do not type precomputed totals or classification answers.

% TODO 5: Select the least expensive qualifying system using calculated
% totals and flags. Store recommended_index and recommended_system.
% If none qualifies, use 0 and 'none'. Break ties in A/B/C order.

% TODO 6: Print original/retained/rejected counts and a labeled comparison
% of each system's calculated cost, power summaries, maximum temperature,
% meeting count, met_pct, cost_per_avg_W and status. Print the recommendation.

% TODO 7: Build day_rows for selected_day from the retained test_day array.
% Figure 1: time of day vs power for A/B/C on that day, plus the 100 W line.
% Figure 2: A/B/C bars for all-days met_pct, plus the 80% line; y limits 0-100.
% Use descriptive titles, units, readable labels/legend and distinct styles.

% TODO 8: Check a retained row by hand; test helper boundaries and both-fail
% conditions; rerun saved files. Export the two figures for your PDF report.
% Explain your calculations, decisions and findings in the 3-4 page report.
% Run Tests provides code feedback; it does not submit to Canvas or grade PDF.
% Submit the PDF, this completed script, and every helper .m file in Canvas.
