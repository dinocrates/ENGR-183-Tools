function [diameter_m, speed_mps, feasible, iterations] = ...
    size_parachute(mass_kg, target_speed_mps, max_diameter_m, diameter_step_m)
  % SIZE_PARACHUTE Search candidate diameters from 0.30 m upward.

  min_diameter_m = 0.30;

  % TODO: Validate four positive finite numeric scalar inputs.
  % TODO: Require max_diameter_m >= min_diameter_m.
  % TODO: Initialize every output before the loop.
  % TODO: Calculate a maximum iteration count.
  % TODO: Search until the target is met or a bound is reached.

  diameter_m = min_diameter_m;
  speed_mps = Inf;
  feasible = false;
  iterations = 0;
end
