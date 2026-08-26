function expectCriterion(unit, nameSubstr, expectPass, messageSubstr, caseLabel)
%EXPECTCRITERION  Regression-test helper: run engr183.runTests(unit)
%   silently, find the one rubric criterion whose name contains
%   NAMESUBSTR, and assert its pass/fail status matches EXPECTPASS.
%
%   If MESSAGESUBSTR is nonempty, also asserts that criterion's failure
%   message contains it (case-insensitive). Prints one PASS/FAIL line
%   labeled CASELABEL -- this is a check on the *harness's* behavior for
%   a deliberately broken/edge-case submission, not a check on student
%   code, so failure here means the harness itself needs fixing.
%
%   Scratch-only, used by regression_*.m driver scripts.

  if nargin < 4
    messageSubstr = '';
  end
  if nargin < 5
    caseLabel = nameSubstr;
  end

  evalc('r = engr183.runTests(unit);');

  idx = find(~cellfun(@isempty, strfind({r.name}, nameSubstr)), 1);
  if isempty(idx)
    fprintf('FAIL %s: no criterion matching ''%s'' was found\n', caseLabel, nameSubstr);
    return;
  end

  crit = r(idx);
  if crit.passed ~= expectPass
    fprintf('FAIL %s: criterion ''%s'' -- expected passed=%d, got passed=%d (message: %s)\n', ...
            caseLabel, crit.name, expectPass, crit.passed, crit.message);
    return;
  end

  if ~isempty(messageSubstr) && isempty(strfind(lower(crit.message), lower(messageSubstr)))
    fprintf('FAIL %s: criterion ''%s'' message did not contain ''%s'' (got: %s)\n', ...
            caseLabel, crit.name, messageSubstr, crit.message);
    return;
  end

  fprintf('OK   %s\n', caseLabel);
end
