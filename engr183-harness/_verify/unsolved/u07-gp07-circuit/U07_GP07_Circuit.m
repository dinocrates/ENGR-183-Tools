% ENGR 183 | GP-07 | Solving a Resistor Network
% Name: Replace with your name
% Date: Replace with the date
% Ideal teaching circuit: six equal resistors, three unknown node voltages.
% Every voltage is measured relative to the common 0 V ground.
clear;
clc;
close all;

% Supplied inputs -- keep unchanged.
supply_V = 12.0;
changed_supply_V = 10.8;
resistance_ohm = 1000;
tolerance_V = 1e-10;
tolerance_mA = 1e-10;
node_number = [1; 2; 3];

% TODO 1: Build A (3-by-3) from the supplied equations, using [V1; V2; V3].
% Build b_V = [supply_V; 0; 0] (3-by-1).

% TODO 2: Open solve_checked_system.m and finish its rank check and outputs.
% Then return to this main script. Keep the supplied input checks.

% TODO 3: Call solve_checked_system(A, b_V). Store node_voltage_V, residual_V,
% and condition_number. Calculate matrix_rank and max_residual_V.
% Use assert to require max_residual_V < tolerance_V.

% TODO 4: Test the same A with known_b_V = [13; 0; 0].
% Independently expected voltages are [5; 2; 1] V. Store the returned
% known_voltage_V, known_residual_V, and known_condition_number.
% Calculate known_error_V and known_test_passed; assert the test passes.

% TODO 5: Calculate source_current_mA, link_current_mA (2-by-1), and
% ground_current_mA (3-by-1) using the directions on the Canvas page.
% Calculate kcl_balance_mA (incoming minus outgoing at each node),
% then max_kcl_balance_mA. Assert it is below tolerance_mA.

% TODO 6: Build changed_b_V using changed_supply_V. Call the same solver.
% Store changed_node_voltage_V, changed_residual_V, changed_condition_number,
% and changed_max_residual_V; assert the changed residual passes.
% Calculate signed supply_change_pct and voltage_change_pct (norm-based magnitude).

% TODO 7: Plot original and changed node voltages against node_number in one figure.
% Use distinct markers/styles, title, labels with units, legend, and grid.
% Print the rank, condition number, both voltage vectors, residual, known-answer
% error, branch currents, maximum current imbalance, and both percent changes.

% TODO 8: Write 3-4 sentences as MATLAB comments. Include a numerical result,
% the effect of lowering the supply, what a small residual establishes,
% and one limitation of this ideal circuit model.
% Interpretation:
%
%
% End interpretation.

% Run File, inspect the figure, and use Run Tests for feedback.
% Save the completed figure as GP07_node_voltages.png using the camera button.
% Submit this completed script, solve_checked_system.m, and the PNG in Canvas.
% Do not submit tool-side tests or a public-check file.
