% APA-05 public behavior checks

data = read_reservoir_data('lake_perris_storage_2025Q1.csv');
assert(isstruct(data));
assert(numel(data.storage_af) == 90);
assert(sum(data.valid_mask) == 90);
assert(data.date_code(1) == 20250101);
assert(data.date_code(end) == 20250331);

summary = summarize_reservoir(data, 131452);
assert(summary.valid_count == 90);
assert(summary.invalid_count == 0);
assert(abs(summary.first_storage_af - 105347) < 1e-10);
assert(abs(summary.last_storage_af - 112255) < 1e-10);
assert(abs(summary.net_change_af - 6908) < 1e-10);
assert(abs(summary.min_storage_af - 105347) < 1e-10);
assert(abs(summary.max_storage_af - 112474) < 1e-10);
assert(data.date_code(summary.max_index) == 20250330);
assert(abs(summary.largest_increase_af - 478) < 1e-10);
assert(data.date_code(summary.largest_increase_index) == 20250313);
assert(abs(summary.largest_decrease_af - (-219)) < 1e-10);
assert(data.date_code(summary.largest_decrease_index) == 20250331);
assert(abs(summary.ending_percent_capacity - 85.3961902443) < 1e-6);

write_reservoir_report('apa05_public_check_report.txt', data, summary);
fid = fopen('apa05_public_check_report.txt', 'r');
assert(fid ~= -1);
report_text = fscanf(fid, '%c');
fclose(fid);
assert(~isempty(strfind(report_text, 'Net storage change')));
assert(~isempty(strfind(report_text, 'Interpretation boundary')));

fprintf('APA-05 public checks passed.\n');
