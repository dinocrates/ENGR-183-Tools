% GP-05 public behavior checks

creep = read_creep_data('parkfield_xpk2_daily_excerpt.txt');
assert(isstruct(creep));
assert(numel(creep.slip_mm) == 40);
assert(creep.year(1) == 2013 && creep.day_of_year(1) == 151);
assert(abs(creep.slip_mm(end) - 218.18) < 1e-10);
assert(all(creep.valid_mask));

fid = fopen('gp05_optional_column_test.txt', 'w');
assert(fid ~= -1);
fprintf(fid, '2024 100 10.5 999\n2024 101 10.8 888\n');
fclose(fid);
extra = read_creep_data('gp05_optional_column_test.txt');
assert(isequal(extra.slip_mm, [10.5; 10.8]));

fid = fopen('gp05_bad_day_test.txt', 'w');
assert(fid ~= -1);
fprintf(fid, '2024 367 10.5\n');
fclose(fid);
raised = false;
try
  read_creep_data('gp05_bad_day_test.txt');
catch
  raised = true;
end
assert(raised);

fprintf('GP-05 public checks passed.\n');
