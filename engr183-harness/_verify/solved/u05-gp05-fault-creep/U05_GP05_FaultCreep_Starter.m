% ENGR 183 | Unit 5 | GP-05 solved verification fixture
% From Sensor File to Engineering Summary
% Student: Verification Fixture

clear;
clc;

data_filename = 'parkfield_xpk2_daily_excerpt.txt';
report_filename = 'GP05_fault_creep_summary.txt';

% CHECKPOINT 2: load the file.
creep = read_creep_data(data_filename);

% CHECKPOINT 3: record count, first and final slip, net slip change.
record_count = numel(creep.slip_mm);
first_slip_mm = creep.slip_mm(1);
final_slip_mm = creep.slip_mm(end);
net_slip_change_mm = final_slip_mm - first_slip_mm;

% CHECKPOINT 4: extremes and where they occur.
[min_slip_mm, min_row] = min(creep.slip_mm);
[max_slip_mm, max_row] = max(creep.slip_mm);
min_year = creep.year(min_row);
min_day = creep.day_of_year(min_row);
max_year = creep.year(max_row);
max_day = creep.day_of_year(max_row);

% CHECKPOINT 5: largest consecutive increase.
daily_change_mm = diff(creep.slip_mm);
[largest_increase_mm, change_index] = max(daily_change_mm);
largest_increase_row = change_index + 1;

% CHECKPOINT 6: engineering summary.
fprintf('Records: %d\n', record_count);
fprintf('First slip: %.2f mm  Final slip: %.2f mm\n', first_slip_mm, final_slip_mm);
fprintf('Net slip change: %.2f mm\n', net_slip_change_mm);
fprintf('Minimum slip: %.2f mm on %d day %d (row %d)\n', ...
        min_slip_mm, min_year, min_day, min_row);
fprintf('Maximum slip: %.2f mm on %d day %d (row %d)\n', ...
        max_slip_mm, max_year, max_day, max_row);
fprintf('Largest daily increase: %.2f mm ending on %d day %d (row %d)\n', ...
        largest_increase_mm, creep.year(largest_increase_row), ...
        creep.day_of_year(largest_increase_row), largest_increase_row);

% CHECKPOINT 7: write the report file.
fid = fopen(report_filename, 'w');
if fid == -1
  error('Could not open %s for writing.', report_filename);
end
fprintf(fid, 'GP-05 Fault Creep Summary\n');
fprintf(fid, 'Source file: %s\n', creep.source_file);
fprintf(fid, 'Records: %d\n', record_count);
fprintf(fid, 'First slip (mm): %.2f\n', first_slip_mm);
fprintf(fid, 'Final slip (mm): %.2f\n', final_slip_mm);
fprintf(fid, 'Net slip change (mm): %.2f\n', net_slip_change_mm);
fprintf(fid, 'Minimum slip (mm): %.2f on %d day %d\n', min_slip_mm, min_year, min_day);
fprintf(fid, 'Maximum slip (mm): %.2f on %d day %d\n', max_slip_mm, max_year, max_day);
fprintf(fid, 'Largest daily increase (mm): %.2f ending %d day %d\n', ...
        largest_increase_mm, creep.year(largest_increase_row), ...
        creep.day_of_year(largest_increase_row));
fprintf(fid, 'Interpretation boundary: this is a summary of past surface-slip measurements, not an earthquake forecast.\n');
fclose(fid);

% REFLECTIONS
% 1. The third column is a measurement of surface-fault slip in millimeters,
%    with instrument and scaling context -- not a bare number.
% 2. Net change is 1.10 mm end to end, but the largest single day-to-day
%    increase is only 0.25 mm, so most of the motion was gradual.
% 3. Creepmeter data record past surface slip; they are not a hazard model
%    and must not be presented as a forecast.
