% ENGR 183 | GP-03 solved verification fixture
% Name: Verification Fixture
% Date: 2026-08-24

clear;
clc;

supply_voltage_V = 5;
fixed_resistance_ohm = 10000;
nominal_resistance_ohm = 10000;
nominal_temperature_C = 25;
beta_K = 3950;

output_voltage_V = [3.85 3.20 2.50 1.80 1.25];

measurement_count = numel(output_voltage_V);

resistance_ohm = thermistor_resistance( ...
    output_voltage_V, supply_voltage_V, fixed_resistance_ohm);

temperature_C = thermistor_temperature( ...
    resistance_ohm, nominal_resistance_ohm, ...
    nominal_temperature_C, beta_K);

temperature_K_exists = exist('temperature_K', 'var');

[hottest_temperature_C, hottest_index] = max(temperature_C);
voltage_at_hottest_V = output_voltage_V(hottest_index);
resistance_at_hottest_ohm = resistance_ohm(hottest_index);

results = [output_voltage_V(:), resistance_ohm(:), temperature_C(:)];

tolerance = 1e-10;

nominal_resistance_check_ohm = thermistor_resistance( ...
    2.5, supply_voltage_V, fixed_resistance_ohm);

nominal_temperature_check_C = thermistor_temperature( ...
    nominal_resistance_ohm, nominal_resistance_ohm, ...
    nominal_temperature_C, beta_K);

assert(abs(nominal_resistance_check_ohm - 10000) < tolerance, ...
    'Nominal thermistor resistance check failed.');

assert(abs(nominal_temperature_check_C - 25) < tolerance, ...
    'Nominal thermistor temperature check failed.');

fprintf('Measurements processed: %d\n', measurement_count);
fprintf('Hottest temperature: %.2f C\n', hottest_temperature_C);
fprintf('Voltage at hottest measurement: %.2f V\n', ...
    voltage_at_hottest_V);
fprintf('Resistance at hottest measurement: %.2f ohm\n', ...
    resistance_at_hottest_ohm);
fprintf('Nominal-case temperature: %.2f C\n', ...
    nominal_temperature_check_C);

% temperature_K stays local because only temperature_C is returned.
% The nominal resistance/temperature pair verifies both model inputs.
