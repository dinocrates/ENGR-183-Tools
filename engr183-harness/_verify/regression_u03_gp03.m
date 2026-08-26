% REGRESSION_U03_GP03  Edge-case regression coverage for GP-03 (Thermistor
% Sensor Functions) beyond the plain solved/unsolved fixtures that
% run.m/check_golden.m already cover.
%
% Each case materializes a deliberately broken or edge-case set of files
% into assignments/u03-gp03-thermistor/, runs the real rubric checker, and
% asserts a *specific* criterion fails or passes with an actionable
% message -- catching a regression in the checker itself, not grading
% student code. assignments/ is restored to the plain unsolved starter set
% when this finishes, matching run.m's contract.
%
% Not wired into check_golden.m (that script is solved/unsolved-only by
% design); run this by hand after changing
% tests/u03_gp03_thermistor_check.m:
%
%     octave-cli --no-gui --eval "setup; run('_verify/regression_u03_gp03.m')"

here = fileparts(mfilename('fullpath'));       % .../_verify
root = fileparts(here);                        % repo root
addpath(here);

unit = 'u03-gp03-thermistor';
assignDir = fullfile(root, 'assignments', unit);
solvedDir = fullfile(here, 'solved', unit);
unsolvedDir = fullfile(here, 'unsolved', unit);

fnNames = {'thermistor_resistance', 'thermistor_temperature'};

fprintf('\n########## regression: %s ##########\n', unit);

% ---------------------------------------------------------------------
% Case 1: a single personalized main filename is preferred over the
% (still-unsolved) generic starter.
% ---------------------------------------------------------------------
restoreUnitFiles(assignDir, solvedDir, fnNames);
copyfile(fullfile(unsolvedDir, 'U03_GP03_Thermistor_Starter.m'), ...
         fullfile(assignDir, 'U03_GP03_Thermistor_Starter.m'));
copyfile(fullfile(solvedDir, 'U03_GP03_Thermistor_Starter.m'), ...
         fullfile(assignDir, 'GP03_Thermistor_Smith.m'));
expectCriterion(unit, 'output', true, '', ...
  'Case 1: personalized main script preferred over unsolved generic starter');

% ---------------------------------------------------------------------
% Case 2: two ambiguous personalized main filenames stop with an
% actionable message instead of silently choosing one.
% ---------------------------------------------------------------------
restoreUnitFiles(assignDir, solvedDir, fnNames);
copyfile(fullfile(assignDir, 'U03_GP03_Thermistor_Starter.m'), ...
         fullfile(assignDir, 'GP03_Thermistor_Smith.m'));
copyfile(fullfile(assignDir, 'U03_GP03_Thermistor_Starter.m'), ...
         fullfile(assignDir, 'GP03_Thermistor_Jones.m'));
expectCriterion(unit, 'resolves', false, 'more than one', ...
  'Case 2: ambiguous personalized main filenames');
delete(fullfile(assignDir, 'GP03_Thermistor_Smith.m'));
delete(fullfile(assignDir, 'GP03_Thermistor_Jones.m'));

% ---------------------------------------------------------------------
% Case 3: thermistor_resistance silently collapses a vector input to its
% first element (a "scalar-only" implementation).
% ---------------------------------------------------------------------
restoreUnitFiles(assignDir, solvedDir, fnNames);
writeLines(fullfile(assignDir, 'thermistor_resistance.m'), { ...
  'function resistance_ohm = thermistor_resistance( ...', ...
  '    output_voltage_V, supply_voltage_V, fixed_resistance_ohm)', ...
  '%THERMISTOR_RESISTANCE Buggy: scalar-only, ignores vector shape.', ...
  '%   output_voltage_V is a scalar or vector voltage in volts.', ...
  '%   supply_voltage_V is the divider supply in volts. fixed_resistance_ohm', ...
  '%   is the known series resistance in ohms. resistance_ohm is the', ...
  '%   thermistor resistance in ohms.', ...
  '', ...
  'v = output_voltage_V(1);', ...
  'resistance_ohm = fixed_resistance_ohm .* v ./ (supply_voltage_V - v);', ...
  '', ...
  'end' ...
});
clear(fnNames{:});
expectCriterion(unit, 'thermistor_resistance: divider equation', false, '', ...
  'Case 3: thermistor_resistance collapses vector input to scalar');

% ---------------------------------------------------------------------
% Case 4: thermistor_resistance uses the wrong divider denominator
% (a hard-coded/incorrect equation).
% ---------------------------------------------------------------------
restoreUnitFiles(assignDir, solvedDir, fnNames);
writeLines(fullfile(assignDir, 'thermistor_resistance.m'), { ...
  'function resistance_ohm = thermistor_resistance( ...', ...
  '    output_voltage_V, supply_voltage_V, fixed_resistance_ohm)', ...
  '%THERMISTOR_RESISTANCE Buggy: wrong divider denominator.', ...
  '%   output_voltage_V is a scalar or vector voltage in volts.', ...
  '%   supply_voltage_V is the divider supply in volts. fixed_resistance_ohm', ...
  '%   is the known series resistance in ohms. resistance_ohm is the', ...
  '%   thermistor resistance in ohms.', ...
  '', ...
  'resistance_ohm = fixed_resistance_ohm .* output_voltage_V ./ supply_voltage_V;', ...
  '', ...
  'end' ...
});
clear(fnNames{:});
expectCriterion(unit, 'thermistor_resistance: divider equation', false, '', ...
  'Case 4: thermistor_resistance wrong divider denominator');

% ---------------------------------------------------------------------
% Case 5: main script fabricates temperature_K in its own workspace
% (leaking what should stay local to thermistor_temperature.m).
% ---------------------------------------------------------------------
restoreUnitFiles(assignDir, solvedDir, fnNames);
mainLines = strsplit(fileread(fullfile(solvedDir, 'U03_GP03_Thermistor_Starter.m')), sprintf('\n'));
for k = 1:numel(mainLines)
  if ~isempty(strfind(mainLines{k}, 'temperature_K_exists = exist(''temperature_K'', ''var'');'))
    mainLines{k} = sprintf('%s\ntemperature_K = temperature_C + 273.15;', mainLines{k});
  end
end
writeLines(fullfile(assignDir, 'U03_GP03_Thermistor_Starter.m'), mainLines);
clear(fnNames{:});
expectCriterion(unit, 'calls both functions', false, 'temperature_k', ...
  'Case 5: main script fabricates temperature_K locally');

% ---------------------------------------------------------------------
% Case 6: results matrix columns are swapped.
% ---------------------------------------------------------------------
restoreUnitFiles(assignDir, solvedDir, fnNames);
mainLines = strsplit(fileread(fullfile(solvedDir, 'U03_GP03_Thermistor_Starter.m')), sprintf('\n'));
for k = 1:numel(mainLines)
  if ~isempty(strfind(mainLines{k}, 'results = [output_voltage_V(:), resistance_ohm(:), temperature_C(:)];'))
    mainLines{k} = 'results = [temperature_C(:), resistance_ohm(:), output_voltage_V(:)];';
  end
end
writeLines(fullfile(assignDir, 'U03_GP03_Thermistor_Starter.m'), mainLines);
clear(fnNames{:});
expectCriterion(unit, 'calls both functions', false, '', ...
  'Case 6: results matrix columns swapped');

% ---------------------------------------------------------------------
% restore assignments/ to the plain unsolved starter set
% ---------------------------------------------------------------------
restoreUnitFiles(assignDir, unsolvedDir, fnNames);
fprintf('Done. assignments/%s restored to unsolved stubs.\n', unit);
