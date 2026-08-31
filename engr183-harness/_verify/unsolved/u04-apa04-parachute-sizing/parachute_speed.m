function speed_mps = parachute_speed(mass_kg, diameter_m)
  % PARACHUTE_SPEED Estimate steady descent speed.
  % diameter_m may be a scalar, row vector, or column vector.

  % Model constants
  g_mps2 = 9.81;
  air_density_kgpm3 = 1.225;
  drag_coefficient = 0.75;

  % TODO: Validate mass_kg as one positive finite numeric value.
  % TODO: Validate every diameter as positive and finite.
  % TODO: Calculate area and speed with element-wise operators.

  speed_mps = NaN(size(diameter_m));
end
