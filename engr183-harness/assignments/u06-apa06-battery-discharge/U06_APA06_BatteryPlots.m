% ENGR 183 | APA-06 | Battery Discharge
% Name: Replace with your name
% Date: Replace with the date
% Synthetic teaching data; 3.20 V is an exercise cutoff.
% All starting data are included below.

clear;
clc;
close all;

time_min = (0:10:120)';
voltage_A_V = [4.20; 4.08; 3.99; 3.92; 3.87; 3.82; 3.76; ...
               3.66; 3.48; 3.27; 3.08; 2.96; 2.84];
current_A_A = 2.0 * ones(size(time_min));
voltage_B_V = [4.20; 4.10; 4.02; 3.97; 3.92; 3.88; 3.84; ...
               3.80; 3.73; 3.58; 3.38; 3.19; 3.02];
current_B_A = 2.0 * ones(size(time_min));
cutoff_V = 3.20;

% TODO 1: Calculate power_A_W and power_B_W from voltage and current.
% Use element-wise multiplication so matching samples are paired.

% TODO 2: Create one figure with subplot(2, 1, 1) and subplot(2, 1, 2).
% Top: both voltage curves and the horizontal 3.20 V cutoff.
% Bottom: both calculated power curves.
% Choose distinguishable line/marker styles and keep each battery's
% style consistent across the panels. Add descriptive titles,
% labels with units, legends, and grid to both panels.
% Use xlim([0 120]) in both panels and show all data and the cutoff.

% TODO 3: Print each battery's final power, clearly labeled with W units.
% Use the final elements of the calculated arrays.

% TODO 4: Write a 50-100 word interpretation as MATLAB comments.
% Identify the first supplied sample strictly below 3.20 V for each
% battery, include a numerical comparison, and explain one limitation.
% Interpretation:
%
%
% End interpretation.

% Run File, inspect both panels, then use Run Tests for feedback.
% Export the figure with the plot toolbar camera button as:
% APA06_battery_comparison.png
% Download this completed .m file and submit both files in Canvas.
