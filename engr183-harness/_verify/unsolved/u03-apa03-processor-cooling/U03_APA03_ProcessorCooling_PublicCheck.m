% ENGR 183 | APA-03 Public Function Check
% Run this script after completing the three required function files.
% A passing public check does not replace the main-script requirements.

clear;
clc;

tolerance = 1e-10;

%% Check 1: TIM resistance and unit conversion

computed_tim_R = tim_resistance(0.10, 5, 1000);
expected_tim_R = 0.02;

assert(abs(computed_tim_R - expected_tim_R) < tolerance, ...
    'Check 1 failed: tim_resistance scalar case is incorrect.');

%% Check 2: TIM function accepts a vector thickness

computed_tim_vector = tim_resistance([0.05 0.10], 5, 1000);
expected_tim_vector = [0.01 0.02];

assert(max(abs(computed_tim_vector - expected_tim_vector)) < tolerance, ...
    'Check 2 failed: tim_resistance vector case is incorrect.');

%% Check 3: Processor temperature nodes

[computed_base_C, computed_ihs_C, computed_junction_C] = ...
    processor_temperatures([50 100], 25, 0.10, 0.02, 0.20);

expected_base_C = [35 45];
expected_ihs_C = [36 47];
expected_junction_C = [41 57];

assert(max(abs(computed_base_C - expected_base_C)) < tolerance, ...
    'Check 3a failed: heat-sink base temperatures are incorrect.');

assert(max(abs(computed_ihs_C - expected_ihs_C)) < tolerance, ...
    'Check 3b failed: IHS surface temperatures are incorrect.');

assert(max(abs(computed_junction_C - expected_junction_C)) < tolerance, ...
    'Check 3c failed: junction temperatures are incorrect.');

%% Check 4: Thermal margin sign and vector behavior

computed_margin_C = thermal_margin(90, computed_junction_C);
expected_margin_C = [49 33];

assert(max(abs(computed_margin_C - expected_margin_C)) < tolerance, ...
    'Check 4 failed: thermal_margin is incorrect.');

fprintf('All APA-03 public function checks passed.\n');
