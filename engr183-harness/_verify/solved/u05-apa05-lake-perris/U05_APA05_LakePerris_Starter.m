% ENGR 183 | Unit 5 | APA-05 solved verification fixture
% Lake Perris Reservoir Data Audit
% Student: Verification Fixture

clear;
clc;

data_filename = 'lake_perris_storage_2025Q1.csv';
report_filename = 'APA05_lake_perris_audit.txt';
operational_capacity_af = 131452;

data = read_reservoir_data(data_filename);
summary = summarize_reservoir(data, operational_capacity_af);
write_reservoir_report(report_filename, data, summary);

fprintf('Wrote %s\n', report_filename);
fprintf('Valid records: %d   Invalid records: %d\n', ...
        summary.valid_count, summary.invalid_count);
fprintf('Net storage change: %.0f AF   Ending capacity: %.2f%%\n', ...
        summary.net_change_af, summary.ending_percent_capacity);

% REFLECTIONS
% 1. A blank DATA_FLAG means CDEC published the value without a quality
%    marker. It does not prove the sensor was accurate that day, only that
%    the record was not flagged.
% 2. Acre-feet and the 131,452 AF operational-capacity source are part of
%    the evidence because "85% full" is meaningless without both the unit
%    and the capacity figure it is measured against.
% 3. Duplicating a single row would most change the largest-daily-change
%    results: a repeated value inserts a zero day-to-day change and shifts
%    every later index by one.
% 4. This audit supports "recorded storage rose about 6,908 AF over the
%    quarter." It cannot support "the reservoir was operated well" or any
%    claim about inflow, release, or water rights.
