% ENGR 183 | APA-07 | Recovering Forces from Coupled Sensor Readings
% Name: Replace with your name
% Date: Replace with the date
% Synthetic linear sensor model. Channels 1 and 2 are deliberately similar.
% Forces are signed axis components in N; readings are in mV.
clear;
clc;
close all;

% Supplied inputs -- keep unchanged.
sensor_mV = [118.00; 117.96; 54.00];
known_force_N = [20; -10; 30];
known_sensor_mV = [21.00; 20.99; 26.50];
delta_sensor_mV = [0; 0.020; 0];
residual_tolerance_mV = 1e-9;
force_tolerance_N = 1e-8;
component_number = [1; 2; 3];

% TODO 1: Translate the three response equations on Canvas into C (3-by-3).
% Keep the unknown order [Fx; Fy; Fz] and retain all coefficient digits.

% TODO 2: Call the supplied solve_checked_system(C, sensor_mV). Store force_N,
% residual_mV, and condition_number. Calculate matrix_rank and
% max_residual_mV. Assert the maximum residual is below residual_tolerance_mV.

% TODO 3: Use known_sensor_mV in the same solver to recover recovered_known_force_N,
% known_residual_mV, and known_condition_number. Compare with known_force_N.
% Store known_error_N = the largest absolute force error and known_test_passed.
% Assert that known_error_N is below force_tolerance_N.

% TODO 4: Add delta_sensor_mV to sensor_mV to make changed_sensor_mV.
% Solve for changed_force_N, changed_residual_mV, changed_condition_number.
% Calculate changed_max_residual_mV and assert it is below the residual tolerance.
% Calculate delta_force_N, input_change_pct, and force_change_pct.
% Use 100*norm(change)/norm(original) for each percent; use the default 2-norm.

% TODO 5: Create one figure comparing force_N and changed_force_N at components
% 1, 2, 3 (Fx, Fy, Fz). Use different markers/styles, a title, N units,
% a correct legend, grid, and readable component labels. Show negative values.
% Print rank, condition number, both force vectors, both maximum residuals,
% the known-load error, and both relative changes with labels and units.

% TODO 6: Write 100-150 words as MATLAB comments. Explain the result using the
% evidence requested on Canvas; distinguish residual, rank, conditioning,
% and sensitivity. Do not claim the synthetic model validates a real sensor.
% Interpretation:
%
%
% End interpretation.

% The completed solve_checked_system.m from GP-07 is supplied in this project.
% Run File, inspect the figure, and use Run Tests for feedback.
% Export APA07_force_comparison.png with the plot toolbar camera button.
% Submit this script, solve_checked_system.m, and the PNG in Canvas.
% Do not submit tool-side tests or a public-check file.
