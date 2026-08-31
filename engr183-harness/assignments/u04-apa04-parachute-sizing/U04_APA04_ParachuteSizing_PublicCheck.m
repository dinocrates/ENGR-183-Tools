%% ENGR 183 | Unit 4 APA-04 Public Check
% Run after implementing parachute_speed.m and size_parachute.m.

clear;
clc;

fprintf("Running APA-04 public checks...\n");

%% Check 1: scalar model calculation
actual_speed = parachute_speed(0.75, 0.50);
assert(abs(actual_speed - 9.031637791711) < 1e-9);

%% Check 2: vector input and shape preservation
diameters = [0.50, 1.00];
expected_speeds = [9.031637791711, 4.515818895856];
actual_speeds = parachute_speed(0.75, diameters);
assert(isequal(size(actual_speeds), size(diameters)));
assert(all(abs(actual_speeds - expected_speeds) < 1e-9));

column_diameters = [0.50; 1.00];
column_speeds = parachute_speed(0.75, column_diameters);
assert(isequal(size(column_speeds), size(column_diameters)));

%% Check 3: normal search
[d, v, ok, n] = size_parachute(0.75, 6.0, 1.0, 0.1);
assert(abs(d - 0.8) < 1e-12);
assert(abs(v - 5.644773619819) < 1e-9);
assert(ok == true);
assert(n == 6);

%% Check 4: first candidate is already safe
[d, v, ok, n] = size_parachute(0.75, 20.0, 1.0, 0.1);
assert(abs(d - 0.3) < 1e-12);
assert(ok == true);
assert(n == 1);

%% Check 5: maximum diameter is the first feasible design
[d, v, ok, n] = size_parachute(0.75, 4.8, 1.0, 0.1);
assert(abs(d - 1.0) < 1e-12);
assert(abs(v - 4.515818895856) < 1e-9);
assert(ok == true);
assert(n == 8);

%% Check 6: no feasible design within the allowed range
[d, v, ok, n] = size_parachute(0.75, 4.0, 1.0, 0.1);
assert(abs(d - 1.0) < 1e-12);
assert(abs(v - 4.515818895856) < 1e-9);
assert(ok == false);
assert(n == 8);

%% Check 7: invalid input must raise an error
raised_error = false;
try
  parachute_speed(-0.75, 0.50);
catch
  raised_error = true;
end
assert(raised_error == true);

fprintf("All APA-04 public checks passed.\n");
