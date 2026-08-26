function temperature_C = thermistor_temperature( ...
    resistance_ohm, nominal_resistance_ohm, ...
    nominal_temperature_C, beta_K)
%THERMISTOR_TEMPERATURE Convert thermistor resistance to degrees Celsius.
%   resistance_ohm is a scalar or vector thermistor resistance in ohms.
%   nominal_resistance_ohm is the reference resistance in ohms measured
%   at nominal_temperature_C in degrees Celsius. beta_K is the simplified
%   constant-beta model coefficient in Kelvin. temperature_C preserves
%   the scalar, row-vector, or column-vector shape of resistance_ohm.

nominal_temperature_K = nominal_temperature_C + 273.15;

temperature_K = 1 ./ ((1 ./ nominal_temperature_K) + ...
    (1 ./ beta_K) .* log(resistance_ohm ./ nominal_resistance_ohm));

temperature_C = temperature_K - 273.15;

end
