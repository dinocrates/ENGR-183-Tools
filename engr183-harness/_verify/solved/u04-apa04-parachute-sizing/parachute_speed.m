function speed_mps = parachute_speed(mass_kg, diameter_m)
  % PARACHUTE_SPEED Estimate steady descent speed.
  % diameter_m may be a scalar, row vector, or column vector.

  % Model constants
  g_mps2 = 9.81;
  air_density_kgpm3 = 1.225;
  drag_coefficient = 0.75;

  if ~isnumeric(mass_kg) || ~isscalar(mass_kg) || ~isfinite(mass_kg) || mass_kg <= 0
    error('parachute_speed:badMass', ...
      'mass_kg must be one positive finite numeric value.');
  end
  if ~isnumeric(diameter_m) || isempty(diameter_m) || ...
      ~all(isfinite(diameter_m(:))) || ~all(diameter_m(:) > 0)
    error('parachute_speed:badDiameter', ...
      'diameter_m must be nonempty numeric data whose values are all positive and finite.');
  end

  area_m2 = pi .* diameter_m.^2 ./ 4;
  speed_mps = sqrt((2 .* mass_kg .* g_mps2) ./ ...
                    (air_density_kgpm3 .* drag_coefficient .* area_m2));
end
