% SETUP  Put the ENGR-183 course tools on your Octave path.
%
% Run this once each time you start Octave for this course:
%
%     >> cd  <the folder where you cloned this repo>
%     >> setup
%
% After that, engr183.runTests('unit00') and friends will work from
% anywhere.  Running it twice is harmless.

thisDir = fileparts(mfilename('fullpath'));
addpath(thisDir);

fprintf('\n');
fprintf('ENGR-183 course tools are ready.\n');
fprintf('Repo location: %s\n', thisDir);
fprintf('Octave version: %s\n', version());
fprintf('\n');
fprintf('Check your work at any time with:\n');
fprintf('    engr183.runTests(''unit00'')\n');
fprintf('\n');

clear thisDir
