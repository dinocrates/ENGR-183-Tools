% ENGR-183 APA-09: Pump Operating Point
% Name:                         Date:
clear; clc; close all;
% Synthetic data at one fixed pump speed; no external file required.
Q = [0 10 20 30 40 50 60];       % Flow in L/min
H = [42 41 38 34 28 20 10];      % Pump head in m
Q_query = 35;                     % L/min
Q_required = 57;                  % Exercise flow requirement, L/min
Q_outside = 80;                   % Outside the measured range
Hsystem = @(q) 5 + 0.003.*q.^2;   % Head in m when q is in L/min
Qfine = linspace(0,60,301);
tol_Q = 0.001;                    % Bisection half-width, L/min
max_iter = 100;

%% TODO 1 — Interpolation and its domain
% Compute H35 with linear interp1 at Q_query.
% Compute H80_interp at Q_outside using linear interp1 without extrap.
% Print both results and explain the out-of-range result later.

%% TODO 2 — Fit and compare
% Compute p_linear (degree 1) and p_quad (degree 2).
% Compute r_linear and r_quad as measured minus predicted at Q.
% Compute rmse_linear and rmse_quad.
% Print coefficients, residual vectors, and both RMSE values.
% Create a 2-by-2 figure: fits above, corresponding residuals below.
% Match axes: top y [0 50], bottom y [-5 5], all x [0 60].
% Add units, titles, legends, zero lines, and export APA09_fit_residuals.png.

%% TODO 3 — Model choice and root equation
% Choose p_selected from your two fitted coefficient vectors.
% Justify the choice in comments using RMSE, residual shape, and physics.
% Define Hpump with polyval and form F(q) = Hpump(q) - Hsystem(q).
% Store original bracket as a0=0 and b0=60; print F at both endpoints.
% Explain continuity and the sign change before using either solver.

%% TODO 4 — Bisection and fzero
% Adapt the GP bisection loop to F, a0, b0, tol_Q, and max_iter.
% Reset a=a0 and b=b0. Handle endpoint roots and invalid brackets.
% Store Q_bisect, half_width, and iterations; stop with an error
% if max_iter is reached without meeting the stopping condition.
% Use fzero on F with [a0 b0] (not the narrowed bracket).
% Store Q_root, root_residual, and exitflag; require exitflag==1.
% Store H_pump_root, H_system_root, and abs(Q_bisect-Q_root).
% Print all these results with units, including half_width.

%% TODO 5 — Compare model decisions and extrapolation
% Solve the operating point separately for the linear and quadratic fits.
% Store Q_linear and Q_quad; check each fzero exitflag.
% Use if/else and each unrounded flow to test >= Q_required.
% Print both decisions and which model you recommend within this exercise.
% Compute H80_linear and H80_quad with polyval at Q_outside.
% Report why these are not validated pump specifications.

%% TODO 6 — Operating-point figure and explanation
% Plot measured pump data, selected pump fit, and system curve over 0-60.
% Mark (Q_root,H_pump_root); label axes with units, title, and legend.
% Export APA09_operating_point.png.
% Write an 8-10 sentence interpretation addressing the page prompts.
