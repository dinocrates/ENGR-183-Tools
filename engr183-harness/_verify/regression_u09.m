function regression_u09(kind, caseFilter)
% Mutation evidence, exactly-once execution, restoration and inline edge cases.
% Run each kind in a separate Octave process; instructor fixtures are private.
  if nargin<2, caseFilter='.'; end
  here=fileparts(mfilename('fullpath')); root=fileparts(here);
  config=jsondecode(fileread(fullfile(here,'u09-cases.json'))); c=config.(kind);
  target=fullfile(root,'assignments',c.id,c.file); original=fileread(target);
  cleanup=onCleanup(@() writeText(target,original));
  solved=fileread(fullfile(here,'solved',c.id,c.file));
  addpath(fullfile(root,'tests'));
  specs=feval([strrep(c.id,'-','_') '_tests']); keys=cellfun(@(s) s.args{1},specs,'UniformOutput',false);
  setappdata(0,'u09_verify_runs',0);
  for k=1:numel(c.cases)
    t=c.cases(k); if isempty(regexp(t.name,caseFilter,'once')), continue; end
    source=strrep(solved,sprintf('\r\n'),sprintf('\n'));
    for j=1:numel(t.replace)
      pair=t.replace{j}; assert(~isempty(strfind(source,pair{1})),['Unmatched mutation: ' t.name]);
      source=strrep(source,pair{1},pair{2});
    end
    source=[sprintf('setappdata(0,''u09_verify_runs'',getappdata(0,''u09_verify_runs'')+1);\n') source sprintf('\n') t.append sprintf('\n')];
    writeText(target,source);
    before=getappdata(0,'u09_verify_runs'); oldDir=pwd(); oldPath=path();
    report=evalc('results=engr183.runTests(c.id);');
    assert(getappdata(0,'u09_verify_runs')==before+1,'Exactly one execution, including failed runs.');
    assert(strcmp(pwd(),oldDir) && strcmp(path(),oldPath),'Restore caller cwd and path.');
    if isempty(t.fail), assert(all([results.passed]),[t.name ': ' report]);
    else
      for j=1:numel(t.fail)
        idx=find(strcmp(keys,t.fail{j}));
        assert(numel(idx)==1 && ~results(idx).passed && ~isempty(results(idx).message), ...
          [t.name ': expected ' t.fail{j} ' to fail: ' report]);
      end
    end
    if strcmp(t.name,'runtime error')
      assert(~isempty(strfind(results(2).message,c.file)) && ~isempty(strfind(results(2).message,'line')),report);
    end
    fprintf('PASS %s | %s | %g/12 | exactly one execution\n',kind,t.name,sum([results.earned]));
    if ~isempty(t.review), fprintf('MANUAL SOURCE REVIEW: %s\n',t.review); end
  end
  for state={'unsolved','solved'}
    writeText(target,fileread(fullfile(here,state{1},c.id,c.file)));
    report=evalc('results=engr183.runTests(c.id);');
    expected=12; if strcmp(state{1},'unsolved'), expected=2; end
    assert(sum([results.earned])==expected,report);
    golden=fullfile(here,'golden',[c.id '_' state{1} '.txt']);
    if exist(golden,'file')==2
      assert(strcmp(strrep(report,sprintf('\r\n'),sprintf('\n')),strrep(fileread(golden),sprintf('\r\n'),sprintf('\n'))),['Golden drift: ' report]);
    end
    fprintf('PASS %s | %s %d/12 (golden checked if present)\n',kind,state{1},expected);
  end
  edgeCases(solved,kind);
  % An unrelated existing figure must survive student close all / figure(1).
  sentinel=figure(77,'visible','off'); line=plot([0 1],[2 3]);
  writeText(target,solved); evalc('engr183.runTests(c.id);');
  assert(ishandle(sentinel) && ishandle(line) && isequal(get(line,'ydata'),[2 3]));
  delete(sentinel); fprintf('PASS %s | existing figure preserved\n',kind);
end
function edgeCases(source,kind)
% Execute the actual inline loop in a controlled workspace, not a student API.
  if strcmp(kind,'gp'), fn='f'; estimate='t_bisect'; tol='tol_min'; else, fn='F'; estimate='Q_bisect'; tol='tol_Q'; end
  start=strfind(source,['fa = ' fn '(a);']); stop=strfind(source,'if ~converged');
  assert(numel(start)==1 && numel(stop)==1);
  finish=strfind(source(stop:end),sprintf('\nend'));
  block=source(start:stop+finish(1)+3);
  functions={@(x) x,@(x) x-1,@(x) x+2,@(x) NaN+zeros(size(x)),@(x) 1i+x,@(x) x-.3};
  for edge=1:numel(functions)
    F=functions{edge}; a=0; b=1; cap=100; if edge==6, cap=1; end
    try
      eval([fn '=F; ' tol '=.001; max_iter=cap;']); evalc(block);
      assert(edge<=2,'Invalid endpoints or exhausted loop must throw.');
      assert(eval(estimate)==edge-1 && half_width==0 && iterations==0);
    catch err
      if edge<=2, rethrow(err); end
      assert(~isempty(regexp(err.message,'finite and real|opposite signs|did not reach','once')),err.message);
    end
  end
  fprintf('PASS %s | inline endpoints, same signs, nonfinite/complex, iteration exhaustion\n',kind);
end
function writeText(filename,text)
  fid=fopen(filename,'wb'); assert(fid>=0); fwrite(fid,text); fclose(fid);
end
