% ENGR 183 | Unit 5 | GP-05
% From Sensor File to Engineering Summary
% Student: Replace with your name

clear;
clc;

data_filename = 'parkfield_xpk2_daily_excerpt.txt';
report_filename = 'GP05_fault_creep_summary.txt';

% CHECKPOINT 1: Inspect the data file before running code.
% Record your prediction for its rows, field meanings, and slip units.

% CHECKPOINT 2: Complete read_creep_data.m, then call the function.
% creep = read_creep_data(data_filename);

% CHECKPOINT 3: Calculate the basic summary.
% record_count = numel(creep.slip_mm);
% first_slip_mm = creep.slip_mm(1);
% final_slip_mm = creep.slip_mm(end);
% net_slip_change_mm = final_slip_mm - first_slip_mm;

% CHECKPOINT 4: Find the minimum and maximum slip and their row indices.
% Use those indices to recover the corresponding year and day of year.

% CHECKPOINT 5: Use diff to calculate consecutive changes.
% Find the largest increase and the row at which it ends.

% CHECKPOINT 6: Use fprintf to display a labeled engineering summary in
% the Command Window. Every measurement must include millimeter units.

% CHECKPOINT 7: Create report_filename with fopen(..., 'w').
% Check fid_out, write the same labeled evidence with fprintf, and close
% the report with fclose.

% REFLECTIONS -- answer in comments before submitting.
% 1. Why is the file's third column not just "a number"?
% 2. What evidence shows that the largest change is not the net change?
% 3. Why must this summary not be described as an earthquake forecast?
