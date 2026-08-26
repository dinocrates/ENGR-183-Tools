% ENGR 183 | APA-03: Processor Cooling-Stack Analyzer
% Name: Replace with your first and last name
% Date: Replace with today's date
%
% Complete this main script and the three required function files.
% Keep every file in the same Playground project or local folder.

clear;
clc;

%% Supplied processor scenario -- do not change

power_W = [25 65 105 150 210];
ambient_C = 24;
maximum_junction_C = 100;

package_ihs_resistance_C_per_W = 0.18;

tim_thickness_mm = 0.08;
tim_conductivity_W_mK = 6;
tim_area_mm2 = 900;

heatsink_resistance_C_per_W = 0.22;

%% TODO 1: Calculate TIM resistance through your function
% Call tim_resistance and store the returned value as
% tim_resistance_C_per_W.


%% TODO 2: Calculate the three temperature vectors
% Call processor_temperatures with all required inputs and capture:
% heatsink_base_C, ihs_surface_C, and junction_C.


%% TODO 3: Calculate thermal margin
% Call thermal_margin and store the returned vector as margin_C.


%% TODO 4: Analyze the returned vectors
% Create within_limit using a relational expression on margin_C.
% Create within_limit_count by summing the logical vector.
% Create highest_junction_C with max.
% Create minimum_margin_C with min.


%% TODO 5: Assemble the results matrix
% Create a 5-by-6 matrix named results with these columns:
% power_W, heatsink_base_C, ihs_surface_C, junction_C,
% margin_C, and within_limit.


%% TODO 6: Report the required output
% Match the labels, values, precision, and units shown on the APA page.


%% TODO 7: Interpretation comments
% 1. What does the sign of margin_C mean, and which supplied power
%    level produces a negative margin?
% Answer:
%
% 2. Which modeled resistance contributes the largest temperature
%    rise at any fixed power level? Explain using the supplied values.
% Answer:
%
% 3. Identify two reasons this steady-state model should not be
%    treated as an exact prediction for a real processor.
% Answer:
