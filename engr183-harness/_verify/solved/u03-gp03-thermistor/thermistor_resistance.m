function resistance_ohm = thermistor_resistance( ...
    output_voltage_V, supply_voltage_V, fixed_resistance_ohm)
%THERMISTOR_RESISTANCE Calculate thermistor resistance from divider voltage.
%   output_voltage_V is the measured thermistor voltage in volts and may
%   be a scalar, row vector, or column vector. supply_voltage_V is the
%   divider supply voltage in volts. fixed_resistance_ohm is the known
%   series resistance in ohms. resistance_ohm has the input voltage shape.

resistance_ohm = fixed_resistance_ohm .* output_voltage_V ./ ...
    (supply_voltage_V - output_voltage_V);

end
