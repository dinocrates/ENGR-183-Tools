%% ENGR 183 | Unit 4 APA-04 solved verification fixture
% Validated Model-Rocket Parachute Sizing Tool
% Name: Verification Fixture

clear;
clc;

student_name = "Verification Fixture";

%% Design requirements
mass_kg = 0.75;
target_speed_mps = 6.0;
max_diameter_m = 1.00;
diameter_step_m = 0.10;

%% Search for a feasible parachute
[diameter_m, speed_mps, feasible, iterations] = ...
    size_parachute(mass_kg, target_speed_mps, max_diameter_m, diameter_step_m);

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
[constrained_diameter_m, constrained_speed_mps, constrained_feasible, ...
    constrained_iterations] = size_parachute(mass_kg, 4.0, max_diameter_m, diameter_step_m);

if constrained_feasible
  constrained_text = "yes";
else
  constrained_text = "no";
end

fprintf("\nConstrained-case feasible: %s\n", constrained_text);
fprintf("Last tested diameter: %.2f m\n", constrained_diameter_m);
fprintf("Last predicted speed: %.2f m/s\n", constrained_speed_mps);
