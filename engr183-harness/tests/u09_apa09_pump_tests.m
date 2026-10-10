function specs = u09_apa09_pump_tests()
% Twelve formative points; methods, interpretation and final PNGs need review.
  u09_apa09_pump_check('reset');
  keys = {'personalization','execution','inputs','interpolation','fits_residuals','fit_plot','selected_model_bracket','bisection','fzero_balance','comparison','extrapolation','figures_output'};
  names = {'Personalization: completed Name and Date','Execution: saved script runs once','Inputs: supplied data, model and settings','Interpolation: queries and domain','Fits/residuals: both models and training RMSE','Fit figure: panels, series, scales and labels','Selection: model and original bracket','Bisection: estimate and input error bound','fzero: selected root and head balance','Comparison: both roots and flow decisions','Extrapolation: estimates outside observations','Operating figure and labeled results'};
  specs = cell(1,numel(keys));
  for k=1:numel(keys)
    specs{k} = engr183.spec(names{k}, 'u09_apa09_pump_check', {keys{k}}, true, 1);
  end
end
