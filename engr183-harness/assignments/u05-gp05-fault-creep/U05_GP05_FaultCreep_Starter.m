% ENGR 183 | Unit 5 | GP-05
% From Sensor File to Engineering Summary
% Student: Replace with your name

clear;
clc;

data_filename = 'parkfield_xpk2_daily_excerpt.txt';
report_filename = 'GP05_fault_creep_summary.txt';

% CHECKPOINT 1: Open the data file in the editor. Predict the number of
% rows, the three field meanings, and the unit of slip before running.

% CHECKPOINT 2: Complete read_creep_data.m, then load the file.
% creep = read_creep_data(data_filename);

% CHECKPOINT 3: Compute record_count, first_slip_mm, final_slip_mm, and
% net_slip_change_mm from fields of the creep structure.

% CHECKPOINT 4: Find min_slip_mm and max_slip_mm and their row indices
% (min_row, max_row). Use the indices to recover the year and day of year
% at each extreme (min_year, min_day, max_year, max_day).

% CHECKPOINT 5: Use diff to find largest_increase_mm, the largest
% consecutive day-to-day increase, and largest_increase_row, the row at
% which that increase ends.

% CHECKPOINT 6: Print a concise engineering summary to the Command Window.

% CHECKPOINT 7: Create report_filename with fopen(..., 'w'), check the file
% ID is not -1, write the labeled results with fprintf, and close it with
% fclose.

% REFLECTIONS -- answer in comments before submitting.
% 1. Why is the file's third column not just "a number"?
% 2. What evidence shows that the largest change is not the net change?
% 3. Why must this summary not be described as an earthquake forecast?
