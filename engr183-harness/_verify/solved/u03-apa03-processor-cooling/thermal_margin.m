function margin_C = thermal_margin(maximum_junction_C, junction_C)
%THERMAL_MARGIN Calculate remaining processor junction thermal margin.
%   maximum_junction_C is the allowed maximum in degrees Celsius.
%   junction_C is a scalar or vector actual temperature in degrees
%   Celsius. margin_C preserves input shape. Positive margin is below
%   the limit, zero is exactly at the limit, and negative is above it.

margin_C = maximum_junction_C - junction_C;

end
