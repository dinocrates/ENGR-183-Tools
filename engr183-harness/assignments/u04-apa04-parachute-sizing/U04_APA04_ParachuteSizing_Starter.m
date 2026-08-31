%% ENGR 183 | Unit 4 Applied Programming Assignment
% Validated Model-Rocket Parachute Sizing Tool
% Replace Student Name before submitting.

clear;
clc;

student_name = "Student Name";

%% Design requirements
mass_kg = 0.75;
target_speed_mps = 6.0;
max_diameter_m = 1.00;
diameter_step_m = 0.10;

%% Search for a feasible parachute
% TODO: Call size_parachute and store all four outputs.
diameter_m = NaN;
speed_mps = NaN;
feasible = false;
iterations = 0;

if feasible
  feasible_text = "yes";
else
  feasible_text = "no";
end

fprintf("Selected diameter: %.2f m\n", diameter_m);
fprintf("Predicted descent speed: %.2f m/s\n", speed_mps);
fprintf("Feasible design: %s\n", feasible_text);
fprintf("Candidates tested: %d\n", iterations);

%% Required constrained-case check
% This target cannot be met with the maximum permitted diameter.
% TODO: Call size_parachute with a 4.0 m/s target.
constrained_diameter_m = NaN;
constrained_speed_mps = NaN;
constrained_feasible = false;
constrained_iterations = 0;

if constrained_feasible
  constrained_text = "yes";
else
  constrained_text = "no";
end

fprintf("\nConstrained-case feasible: %s\n", constrained_text);
fprintf("Last tested diameter: %.2f m\n", constrained_diameter_m);
fprintf("Last predicted speed: %.2f m/s\n", constrained_speed_mps);
