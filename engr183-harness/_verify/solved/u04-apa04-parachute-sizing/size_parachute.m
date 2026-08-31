function [diameter_m, speed_mps, feasible, iterations] = ...
    size_parachute(mass_kg, target_speed_mps, max_diameter_m, diameter_step_m)
  % SIZE_PARACHUTE Search candidate diameters from 0.30 m upward.

  min_diameter_m = 0.30;

  if ~isnumeric(mass_kg) || ~isscalar(mass_kg) || ~isfinite(mass_kg) || mass_kg <= 0
    error('size_parachute:badMass', 'mass_kg must be one positive finite numeric scalar.');
  end
  if ~isnumeric(target_speed_mps) || ~isscalar(target_speed_mps) || ...
      ~isfinite(target_speed_mps) || target_speed_mps <= 0
    error('size_parachute:badTarget', ...
      'target_speed_mps must be one positive finite numeric scalar.');
  end
  if ~isnumeric(max_diameter_m) || ~isscalar(max_diameter_m) || ...
      ~isfinite(max_diameter_m) || max_diameter_m <= 0
    error('size_parachute:badMaxDiameter', ...
      'max_diameter_m must be one positive finite numeric scalar.');
  end
  if ~isnumeric(diameter_step_m) || ~isscalar(diameter_step_m) || ...
      ~isfinite(diameter_step_m) || diameter_step_m <= 0
    error('size_parachute:badStep', ...
      'diameter_step_m must be one positive finite numeric scalar.');
  end
  if max_diameter_m < min_diameter_m
    error('size_parachute:maxTooSmall', ...
      'max_diameter_m must be at least %.2f m.', min_diameter_m);
  end

  % Every output is initialized before the loop runs, so a design that
  % never becomes feasible still has a well-defined last-tested result.
  diameter_m = min_diameter_m;
  speed_mps = Inf;
  feasible = false;
  iterations = 0;

  % Iteration guard: the number of steps needed to walk from the minimum
  % to the maximum diameter, plus one for the starting candidate itself.
  max_iterations = ceil((max_diameter_m - min_diameter_m) / diameter_step_m) + 1;

  while iterations < max_iterations
    candidate_m = min_diameter_m + iterations * diameter_step_m;
    if candidate_m >= max_diameter_m
      candidate_m = max_diameter_m;
    end

    iterations = iterations + 1;
    diameter_m = candidate_m;
    speed_mps = parachute_speed(mass_kg, diameter_m);
    feasible = speed_mps <= target_speed_mps;

    if feasible || candidate_m >= max_diameter_m
      break;
    end
  end
end
