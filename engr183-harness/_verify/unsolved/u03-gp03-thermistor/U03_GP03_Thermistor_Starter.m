% ENGR 183 | GP-03: Thermistor Sensor Functions
% Name: Replace with your first and last name
% Date: Replace with today's date
%
% Follow the instructor's video and complete each numbered TODO.
% Keep thermistor_resistance.m and thermistor_temperature.m in the
% same Playground project or local folder as this main script.

clear;
clc;

%% Supplied sensor constants

supply_voltage_V = 5;
fixed_resistance_ohm = 10000;
nominal_resistance_ohm = 10000;
nominal_temperature_C = 25;
beta_K = 3950;

%% Supplied voltage measurements

output_voltage_V = [3.85 3.20 2.50 1.80 1.25];

%% TODO 1: Inspect the measurement vector
% Create measurement_count with numel.


%% TODO 2: Convert voltage to resistance
% Call thermistor_resistance with the complete voltage vector.
% Store the returned vector as resistance_ohm.


%% TODO 3: Convert resistance to temperature
% Call thermistor_temperature with the resistance vector and the
% supplied nominal values. Store the result as temperature_C.


%% TODO 4: Demonstrate local scope
% Use exist('temperature_K', 'var') and store the result as
% temperature_K_exists. It should equal zero in this script.


%% TODO 5: Locate the hottest measurement
% Use max with two outputs to create hottest_temperature_C and
% hottest_index. Then retrieve voltage_at_hottest_V and
% resistance_at_hottest_ohm with the same index.


%% TODO 6: Assemble the results matrix
% Create a 5-by-3 matrix named results with these columns:
% output voltage, thermistor resistance, and temperature.


%% TODO 7: Verify two known cases
% A 2.5 V output should produce 10000 ohm with this divider.
% A 10000-ohm thermistor should produce 25 C with this beta model.
% Store the computed values as nominal_resistance_check_ohm and
% nominal_temperature_check_C. Use tolerance = 1e-10 and two asserts.


%% TODO 8: Report the result
% Match the labels, values, precision, and units shown on the GP page.


%% TODO 9: Reflection comments
% 1. Why is temperature_K useful inside the function but unnecessary
%    in the main-script workspace?
% Answer:
%
% 2. Why is the 10-kilohm, 25 C nominal case a useful test of this
%    two-function pipeline?
% Answer:
