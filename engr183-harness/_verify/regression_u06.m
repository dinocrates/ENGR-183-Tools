function regression_u06(kind)
% Focused fixture mutations shared with the browser driver (u06-cases.json).
% Run separately: setup; addpath('_verify'); regression_u06('gp') / ('apa').
% Restore the exact incoming source even on a failed assertion.
  here = fileparts(mfilename('fullpath'));
  root = fileparts(here);
  config = jsondecode(fileread(fullfile(here, 'u06-cases.json')));
  c = config.(kind);
  target = fullfile(root, 'assignments', c.id, c.file);
  original = fileread(target);
  cleanup = onCleanup(@() restore(target, original));
  solved = fileread(fullfile(here, 'solved', c.id, c.file));
  addpath(fullfile(root, 'tests'));
  specs = feval([strrep(c.id,'-','_') '_tests']);
  keys = cellfun(@(s) s.args{1}, specs, 'UniformOutput', false);
  setappdata(0, 'u06_verify_runs', 0);
  for k = 1:numel(c.cases)
    test = c.cases(k);
    source = solved;
    for j = 1:numel(test.replace)
      pair = test.replace{j};
      assert(~isempty(strfind(source, pair{1})), ['Unmatched fixture mutation: ' test.name]);
      source = strrep(source, pair{1}, pair{2});
    end
    source = [source sprintf('\n') test.append sprintf('\n')];
    source = [sprintf('setappdata(0, ''u06_verify_runs'', getappdata(0, ''u06_verify_runs'')+1);\n') source];
    restore(target, source);
    before = getappdata(0, 'u06_verify_runs');
    timer = tic();
    report = evalc('results = engr183.runTests(c.id);');
    elapsed = toc(timer);
    assert(getappdata(0, 'u06_verify_runs') == before+1, 'Expected exactly one student execution per invocation.');
    if isempty(test.fail)
      assert(all([results.passed]), [test.name ': ' report]);
    else
      for j = 1:numel(test.fail)
        idx = find(strcmp(keys, test.fail{j}));
        assert(numel(idx)==1 && ~results(idx).passed && ~isempty(results(idx).message), ...
          [test.name ': expected failure for ' test.fail{j} ': ' report]);
      end
    end
    if strcmp(test.name, 'runtime error')
      assert(results(1).passed && ~isempty(strfind(results(2).message, 'intentional Unit 6 error')));
      assert(~isempty(strfind(results(2).message, c.file)) && ~isempty(strfind(results(2).message, 'line')));
    end
    fprintf('PASS %s | %s | %g/10 | one execution | %.3f s\n', kind, test.name, sum([results.earned]), elapsed);
  end
  % The normal golden convention, checked without rewriting expected output.
  for state = {'unsolved', 'solved'}
    restore(target, fileread(fullfile(here, state{1}, c.id, c.file)));
    actual = evalc('engr183.runTests(c.id);');
    expectedPath = fullfile(here,'golden',[c.id '_' state{1} '.txt']);
    if exist(expectedPath,'file') == 2
      assert(strcmp(actual, fileread(expectedPath)), ['Golden drift: ' expectedPath]);
      fprintf('PASS %s | %s golden\n', kind, state{1});
    end
  end
end

function restore(target, text)
  fid = fopen(target, 'w');
  assert(fid >= 0, ['Cannot write fixture ' target]);
  cleanup = onCleanup(@() fclose(fid));
  fputs(fid, text);
end
