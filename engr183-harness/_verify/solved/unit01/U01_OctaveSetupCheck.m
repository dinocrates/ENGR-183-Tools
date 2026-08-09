% ENGR 183 GNU Octave Setup Verification
% Name: Jordan Lee
% Date: 2026-01-12

clear;
clc;

student_name = 'Jordan Lee';
course_number = 183;
force_N = 25;
distance_m = 3;
work_J = force_N * distance_m;
octave_version = version();

disp('GNU Octave setup verified.');
fprintf('Student: %s\n', student_name);
fprintf('Course: ENGR %d\n', course_number);
fprintf('GNU Octave version: %s\n', octave_version);
fprintf('Work check: %.1f J\n', work_J);
