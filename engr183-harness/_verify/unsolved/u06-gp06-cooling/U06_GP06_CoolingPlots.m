% ENGR 183 | GP-06 | Cooling-System Comparison
% Name: Replace with your name
% Date: Replace with the date
% Synthetic teaching data; 70 C is an exercise design limit.
% All starting data are included below.

clear;
clc;
close all;

time_min = (0:12)';
temp_A_C = [25; 34; 42; 49; 55; 60; 64; 67; 69; 71; 72; 73; 74];
temp_B_C = [25; 32; 37; 41; 44; 46; 47; 48; 49; 49; 50; 50; 50];
limit_C = 70;

% TODO 1: Calculate delta_C = temperature A minus temperature B.
% Store the last difference in final_delta_C and print it with units.

% TODO 2: Create one figure and its top panel: subplot(2, 1, 1).
% Plot A with '-o', B with '--s', and the limit as a black dashed line.
% Use hold on / hold off to keep all three series in the same panel.
% Add a descriptive title, Time (min), Temperature (C), a legend, and grid.
% Use xlim([0 12]) and ylim([20 85]).

% TODO 3: Add the bottom panel: subplot(2, 1, 2).
% Plot delta_C against time_min with '-d'. Add a descriptive title,
% Time (min), A - B temperature (C), and grid.
% Use xlim([0 12]) and ylim([0 30]).

% TODO 4: Write a 2-3 sentence interpretation as MATLAB comments.
% Include a numerical comparison, what the exercise limit reveals,
% and one limitation of these synthetic, discrete samples.
% Interpretation:
%
%
% End interpretation.

% Run File, inspect both panels, then use Run Tests for feedback.
% Export the figure with the plot toolbar camera button as:
% GP06_cooling_comparison.png
% Download this completed .m file and submit both files in Canvas.
