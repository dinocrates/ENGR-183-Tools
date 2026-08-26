function [heatsink_base_C, ihs_surface_C, junction_C] = ...
    processor_temperatures(power_W, ambient_C, ...
    package_ihs_resistance_C_per_W, tim_resistance_C_per_W, ...
    heatsink_resistance_C_per_W)
%PROCESSOR_TEMPERATURES TODO: Add a one-line purpose statement.
%   TODO: Document all inputs, their units, the three outputs, vector
%   support, the steady-state assumption, and the required node order.

% TODO: Calculate heatsink_base_C from ambient and heat-sink resistance.
heatsink_base_C = [];

% TODO: Calculate ihs_surface_C from the heat-sink base and TIM rise.
ihs_surface_C = [];

% TODO: Calculate junction_C from the IHS surface and package/IHS rise.
junction_C = [];

end
