% ENGR 183 | GP-02: Tensile-Test Data Analysis
% Name: Replace with your first and last name
% Date: Replace with today's date
%
% Follow the instructor's video and complete each numbered TODO.
% The measured rows below are selected directly from Ansys's public
% 04_raw_test_data.csv example. No values were interpolated.

clear;
clc;

% Specimen dimensions documented with the source data
gauge_width_mm = 15.0068;
gauge_thickness_mm = 1.5077;
gauge_length_mm = 79.97724;

% Selected measured load-displacement rows
extension_mm = [0 0.005282184 0.01001418 0.01984217 0.02967017 ...
    0.03986217 0.05005417 0.06024617 0.08026617 0.1002862 ...
    0.1246739 0.1497899 0.1749059 0.2000219 0.2305979 ...
    0.2604459 0.2993939 0.3390699 0.3794739 0.5094219 ...
    1.019753 2.047683 3.039223 4.021663 4.954593 ...
    5.977063 6.949673 7.957593 9.000452 9.931562 ...
    11.08948 11.91868 12.11778 12.95238 14.00258 ...
    15.04908 15.99758 16.95018 18.01818];

force_N = [0 273.392 515.661 1058.21 1615.09 ...
    2267.17 2909.35 3441.66 4460.9 5292.12 ...
    6030.53 6492.54 6808.86 7058.64 7282.14 ...
    7452.41 7627.46 7773.5 7903.51 8318.78 ...
    9508.63 10894.3 11646.1 12133 12446.9 ...
    12692.6 12856.4 12974.8 13057.7 13105.5 ...
    13139.9 13148.1 13148.5 13145.4 13128.3 ...
    13089.4 13009.6 12773.1 11960.3];

% TODO 1: Inspect the data with size, length, and numel.

% TODO 2: Calculate initial_area_mm2 from width and thickness.

% TODO 3: Use element-wise division to calculate stress_MPa.
% Remember: 1 N/mm^2 = 1 MPa.

% TODO 4: Calculate strain and strain_percent for every measurement.

% TODO 5: Retrieve the fifth force, fifth extension, and last extension.

% TODO 6: Use max with two outputs to find ultimate_strength_MPa
% and uts_index. Then retrieve force_at_uts_N and strain_at_uts_percent.

% TODO 7: Create early_region_mask for strain <= 0.0015 and use it
% to retrieve early_region_stress_MPa.

% TODO 8: Combine column vectors into this 39-by-4 results matrix:
% [force_N, extension_mm, stress_MPa, strain_percent]

% TODO 9: Use fprintf to report area, UTS, its index, force at UTS,
% and strain at UTS. Match the precision shown on the Canvas page.
