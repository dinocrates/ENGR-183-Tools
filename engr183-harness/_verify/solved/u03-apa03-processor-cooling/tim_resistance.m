function resistance_C_per_W = tim_resistance( ...
    thickness_mm, conductivity_W_mK, area_mm2)
%TIM_RESISTANCE Calculate one-dimensional TIM thermal resistance.
%   thickness_mm is a scalar or vector material thickness in millimeters.
%   conductivity_W_mK is thermal conductivity in W/(m*K). area_mm2 is
%   contact area in square millimeters. resistance_C_per_W is thermal
%   resistance in degrees Celsius per watt and preserves input shape.
%   The model assumes one-dimensional conduction and constant properties.

thickness_m = thickness_mm ./ 1000;
area_m2 = area_mm2 ./ 1e6;

resistance_C_per_W = thickness_m ./ ...
    (conductivity_W_mK .* area_m2);

end
