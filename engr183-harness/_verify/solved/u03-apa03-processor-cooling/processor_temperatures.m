function [heatsink_base_C, ihs_surface_C, junction_C] = ...
    processor_temperatures(power_W, ambient_C, ...
    package_ihs_resistance_C_per_W, tim_resistance_C_per_W, ...
    heatsink_resistance_C_per_W)
%PROCESSOR_TEMPERATURES Calculate three steady-state processor nodes.
%   power_W is scalar or vector processor heat flow in watts. ambient_C
%   is ambient air temperature in degrees Celsius. The three resistance
%   inputs are in degrees Celsius per watt. The returned outputs are, in
%   order, heat-sink base, IHS surface, and processor junction temperature
%   in degrees Celsius. Each output preserves the shape of power_W.
%   The model assumes steady-state heat flow and constant resistances.

heatsink_base_C = ambient_C + ...
    power_W .* heatsink_resistance_C_per_W;

ihs_surface_C = heatsink_base_C + ...
    power_W .* tim_resistance_C_per_W;

junction_C = ihs_surface_C + ...
    power_W .* package_ihs_resistance_C_per_W;

end
