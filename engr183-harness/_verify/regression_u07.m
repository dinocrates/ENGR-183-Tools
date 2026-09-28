function regression_u07(kind, caseFilter)
% Focused mutations; preserve BOTH incoming files on success and failure.
% setup; addpath('_verify'); regression_u07('gp'); % separately: 'apa'
  here = fileparts(mfilename('fullpath')); root = fileparts(here);
  if nargin < 2, caseFilter = '.'; end % '^$' checks only fixture totals/goldens.
  config = jsondecode(fileread(fullfile(here,'u07-cases.json'))); c = config.(kind);
  files = {c.file,'solve_checked_system.m'};
  targets = cellfun(@(f) fullfile(root,'assignments',c.id,f),files,'UniformOutput',false);
  originals = cellfun(@fileread,targets,'UniformOutput',false);
  cleanup = onCleanup(@() restoreFiles(targets,originals));
  solved = cellfun(@(f) fileread(fullfile(here,'solved',c.id,f)),files,'UniformOutput',false);
  addpath(fullfile(root,'tests'));
  specs = feval([strrep(c.id,'-','_') '_tests']);
  keys = cellfun(@(s) s.args{1},specs,'UniformOutput',false);
  setappdata(0,'u07_verify_runs',0);
  for k = 1:numel(c.cases)
    test = c.cases(k);
    if isempty(regexp(test.name,caseFilter,'once')), continue; end
    source = mutate(solved{1},test.replace,test.name);
    helper = mutate(solved{2},test.helper,test.name);
    source = [sprintf('setappdata(0,''u07_verify_runs'',getappdata(0,''u07_verify_runs'')+1);\n') ...
      source sprintf('\n') test.append sprintf('\n')];
    restoreFiles(targets,{source,helper});
    before = getappdata(0,'u07_verify_runs'); oldPath = path(); oldDir = pwd();
    timer = tic(); report = evalc('results = engr183.runTests(c.id);'); elapsed = toc(timer);
    assert(strcmp(pwd(),oldDir) && strcmp(path(),oldPath),'Checker must restore working directory and path.');
    assert(getappdata(0,'u07_verify_runs')==before+1,'Exactly one student execution per Run Tests, including failures.');
    if isempty(test.fail)
      assert(all([results.passed]),[test.name ': ' report]);
    else
      for j = 1:numel(test.fail)
        idx = find(strcmp(keys,test.fail{j}));
        assert(numel(idx)==1 && ~results(idx).passed && ~isempty(results(idx).message), ...
          [test.name ': expected failure of ' test.fail{j} ': ' report]);
      end
    end
    if strcmp(test.name,'runtime error')
      assert(~isempty(strfind(results(2).message,'intentional Unit 7 error')));
      assert(~isempty(strfind(results(2).message,c.file)) && ~isempty(strfind(results(2).message,'line')));
    end
    fprintf('PASS %s | %s | %g/12 | one execution | %.3f s\n',kind,test.name,sum([results.earned]),elapsed);
  end
  for state = {'unsolved','solved'}
    fixture = cellfun(@(f) fileread(fullfile(here,state{1},c.id,f)),files,'UniformOutput',false);
    restoreFiles(targets,fixture);
    report = evalc('results = engr183.runTests(c.id);');
    expectedScore = 12; if strcmp(state{1},'unsolved'), expectedScore = c.starterScore; end
    assert(sum([results.earned])==expectedScore,report);
    golden = fullfile(here,'golden',[c.id '_' state{1} '.txt']);
    if exist(golden,'file')==2
      assert(strcmp(strrep(report,sprintf('\r\n'),sprintf('\n')), ...
        strrep(fileread(golden),sprintf('\r\n'),sprintf('\n'))),['Golden drift: ' golden sprintf('\n') report]);
    end
    fprintf('PASS %s | %s fixture %d/12 (golden checked when present)\n',kind,state{1},expectedScore);
  end
end
function source = mutate(source,pairs,label)
  source = strrep(source,sprintf('\r\n'),sprintf('\n'));
  for j = 1:numel(pairs)
    pair = pairs{j};
    assert(~isempty(strfind(source,pair{1})),['Unmatched mutation: ' label]);
    source = strrep(source,pair{1},pair{2});
  end
end
function restoreFiles(targets,contents)
  for j = 1:numel(targets)
    fid = fopen(targets{j},'wb'); assert(fid>=0);
    fwrite(fid,contents{j}); fclose(fid);
  end
  clear solve_checked_system;
end
