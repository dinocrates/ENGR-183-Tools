function report(unit, results, noisy)
%REPORT  Print the rubric report for a set of results.
%
%   ENGR183.REPORT(UNIT, RESULTS) is called for you by ENGR183.RUNTESTS.
%   Plain ASCII only, so it reads correctly in the Octave GUI, the
%   Windows console, and a Jupyter notebook alike.
%
%   NOISY is an optional list of criteria indices that passed but printed
%   stray output, usually a missing semicolon.

  if nargin < 3
    noisy = [];
  end

  width = 68;
  rule = repmat('-', 1, width);
  practice = any(strcmp(unit, {'u06-gp06-cooling', 'u06-apa06-battery-discharge'}));
  reportLabel = 'rubric check';
  if practice, reportLabel = 'code-check feedback'; end

  fprintf('\n%s\n', rule);
  fprintf('ENGR-183  |  %s  |  %s\n', upper(unit), reportLabel);
  fprintf('%s\n', rule);

  if isempty(results)
    fprintf('No criteria to check.\n%s\n\n', rule);
    return;
  end

  total = 0;
  earned = 0;
  met = 0;

  for k = 1:numel(results)
    r = results(k);
    total = total + r.points;
    earned = earned + r.earned;
    if r.passed
      met = met + 1;
      tag = '[ PASS ]';
    else
      tag = '[ FAIL ]';
    end

    label = r.name;
    maxLabel = width - 20;
    if numel(label) > maxLabel
      label = [label(1:maxLabel-3) '...'];
    end

    score = sprintf('%g/%g', r.earned, r.points);
    pad = width - 9 - numel(label) - numel(score);
    if pad < 1
      pad = 1;
    end
    fprintf('%s %s%s%s\n', tag, label, repmat(' ', 1, pad), score);

    if ~r.passed && ~isempty(r.message)
      fprintf('         -> %s\n', r.message);
    end
  end

  fprintf('%s\n', rule);

  if total > 0
    pct = 100 * earned / total;
  else
    pct = 0;
  end

  fprintf('Score: %g/%g points (%.0f%%)   Criteria met: %d of %d\n', ...
          earned, total, pct, met, numel(results));

  if practice
    fprintf(['\nPractice feedback only; this is not the final Canvas grade.\n' ...
      'Review calculation methods and interpretation with the Canvas rubric.\n' ...
      'Inspect both panels and export the PNG; download the named .m file.\n' ...
      'Check filenames, readability and complete submission in Canvas.\n' ...
      'Run Tests never submits to Canvas.\n']);
  elseif met == numel(results)
    fprintf('\nEverything passes. Nice work - you are ready to submit.\n');
  else
    remaining = numel(results) - met;
    if remaining == 1
      fprintf('\n1 criterion left. Read the arrow above for the hint.\n');
    else
      fprintf('\n%d criteria left. Read the arrows above for hints.\n', remaining);
    end
  end
  if ~isempty(noisy)
    fprintf(['\nStyle note: your code printed values while running.\n' ...
             'That is usually a missing semicolon at the end of a line.\n' ...
             'It does not cost you points here, but get in the habit now.\n']);
  end

  fprintf('%s\n\n', rule);
end
