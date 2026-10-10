function specs = u09_gp09_cooling_tests()
% Twelve formative points; methods, interpretation and final PNGs need review.
  u09_gp09_cooling_check('reset');
  keys = {'personalization','execution','inputs','interpolation','fits','residuals','fit_plot','bracket','bisection','fzero','target_plot','output'};
  names = {'Personalization: completed Name and Date','Execution: saved script runs once','Inputs: supplied data, model and settings','Interpolation: queries and domain','Fits: coefficients and independent predictions','Residuals: measured minus predicted and RMSE','Fit figure: panels, series, scales and labels','Bracket: supplied model, signs and tolerance','Bisection: estimate and input error bound','fzero: convergence, temperature and agreement','Target figure: model, target and verified root','Output: labeled results and units'};
  specs = cell(1,numel(keys));
  for k=1:numel(keys)
    specs{k} = engr183.spec(names{k}, 'u09_gp09_cooling_check', {keys{k}}, true, 1);
  end
end
