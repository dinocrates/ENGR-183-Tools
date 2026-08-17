% ENGR 183 | APA-02: Solar-Panel I-V Data Analysis
% Name: Replace with your first and last name
% Date: Replace with today's date
%
% Complete every numbered TODO. Do not use loops, if statements, plotting,
% or file-import commands. Work with the supplied vectors as whole arrays.
%
% The rows below are selected directly from Sandia National Laboratories
% reference trace 4137_25_1_08302018.csv. No values were interpolated.

clear;
clc;

voltage_V = [0.018686 0.037373 1.9995 3.9958 6.0015 ...
    8.0009 10.007 12.012 13.99 16.017 ...
    18.001 20.016 22.044 24.031 25.977 ...
    27.983 29.979 31.001 31.502 31.997 ...
    32.362 32.499 32.997 33.502 34 ...
    34.498 35 36 36.999 38.002 ...
    38.5 38.999 39.251 39.506 39.703 ...
    39.799 39.864];

current_A = [9.6956 9.7035 9.6887 9.6757 9.6675 ...
    9.6645 9.6536 9.6562 9.6567 9.6534 ...
    9.6455 9.6427 9.6359 9.6336 9.6234 ...
    9.605 9.5772 9.5348 9.4547 9.3512 ...
    9.2694 9.2208 9.0497 8.8212 8.5646 ...
    8.2148 7.8088 6.7799 5.4257 3.8182 ...
    2.8656 1.8512 1.3094 0.81731 0.30021 ...
    0.096633 0.0019878];

% TODO 1: Confirm that voltage_V and current_A have the same number
% of elements. Store the number in measurement_count.

% TODO 2: Calculate power_W for every measured operating point.

% TODO 3: Use max with two outputs to find max_power_W and mpp_index.

% TODO 4: Use mpp_index to retrieve voltage_at_mpp_V and
% current_at_mpp_A.

% TODO 5: For this introductory analysis, approximate open-circuit
% voltage and short-circuit current with:
%   open_circuit_voltage_V = max(voltage_V)
%   short_circuit_current_A = max(current_A)

% TODO 6: Calculate fill_factor as a decimal ratio:
% max_power_W / (open_circuit_voltage_V * short_circuit_current_A)

% TODO 7: Normalize both measurement vectors by their maximum values.
% Required names: normalized_voltage and normalized_current

% TODO 8: Create high_power_mask for points whose power is at least
% 90% of max_power_W. Use the mask to retrieve high_power_voltage_V.

% TODO 9: Build a 37-by-5 results matrix with columns:
% [voltage_V, current_A, power_W, normalized_voltage, normalized_current]

% TODO 10: Use fprintf to report max power, MPP index, voltage and
% current at MPP, open-circuit voltage, short-circuit current,
% fill factor, and the number of high-power points.
