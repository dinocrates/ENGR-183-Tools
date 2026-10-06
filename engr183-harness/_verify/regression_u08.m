function regression_u08(caseFilter, syntheticChecks)
% Local instructor fixtures only; preserve exact incoming files on every exit.
  if nargin<1, caseFilter='.'; end
  if nargin<2, syntheticChecks=true; end
  here=fileparts(mfilename('fullpath')); root=fileparts(here); id='u08-project-solar-station';
  directory=fullfile(root,'assignments',id);
  files={'SolarStation_Analysis.m','evaluate_system.m','solar_station_measurements.csv'};
  originals=cellfun(@(f) fileread(fullfile(directory,f)),files,'UniformOutput',false);
  cleanup=onCleanup(@() restore(directory,files,originals));
  solved=cellfun(@(f) fileread(fullfile(here,'solved',id,f)),files(1:2),'UniformOutput',false);
  addpath(fullfile(root,'tests')); specs=u08_project_solar_station_tests();
  keys=cellfun(@(s) s.args{1},specs,'UniformOutput',false);
  cases=jsondecode(fileread(fullfile(here,'u08-cases.json')));
  for k=1:numel(cases)
    c=cases(k); if isempty(regexp(c.name,caseFilter,'once')), continue; end
    main=[mutate(solved{1},c.replace) sprintf('\n') c.append sprintf('\n')];
    helper=mutate(solved{2},c.helper); restore(directory,files,{main,helper,originals{3}});
    if strcmp(c.name,'numbered figures')
      sentinel=figure(1,'visible','off'); plot([1 2],[7 8]);
    end
    oldDir=pwd(); oldPath=path(); timer=tic(); report=evalc('r=engr183.runTests(id);');
    assert(strcmp(pwd(),oldDir) && strcmp(path(),oldPath),'Run Tests must restore cwd/path.');
    if isempty(c.fail), assert(all([r.passed]),[c.name ': ' report]);
    else
      for j=1:numel(c.fail)
        idx=find(strcmp(keys,c.fail{j})); assert(numel(idx)==1 && ~r(idx).passed,[c.name ': ' report]);
      end
    end
    if strcmp(c.name,'runtime failure')
      assert(~isempty(strfind(r(end).message,'SolarStation_Analysis.m, line')),'Runtime errors must include student file and line.');
    end
    if strcmp(c.name,'numbered figures')
      assert(ishandle(sentinel) && isequal(get(findall(sentinel,'type','line'),'ydata'),[7 8]), ...
        'Numbered test figures must preserve the pre-existing user figure.');
      delete(sentinel);
    end
    fprintf('PASS %s | %g/12 | %.2f s\n',c.name,sum([r.earned]),toc(timer));
  end
  for state={'unsolved','solved'}
    content=cellfun(@(f) fileread(fullfile(here,state{1},id,f)),files(1:2),'UniformOutput',false);
    restore(directory,files,[content originals(3)]);
    report=evalc('r=engr183.runTests(id);'); target=12*strcmp(state{1},'solved');
    assert(sum([r.earned])==target,report);
    golden=fullfile(here,'golden',[id '_' state{1} '.txt']);
    if exist(golden,'file')==2
      assert(strcmp(strrep(report,sprintf('\r\n'),sprintf('\n')),strrep(fileread(golden),sprintf('\r\n'),sprintf('\n'))),'Golden drift.');
    end
    fprintf('PASS %s fixture | %d/12\n',state{1},target);
  end
  if ~syntheticChecks, return; end
  % Exact 100 W and 80%, valid zeros, and negative non-sentinel temperatures.
  raw=[(1:5)' repmat(9,5,1) ones(5,9)];
  raw(:,[3 6 9])=10; raw(:,4)=[10;10;10;10;0]; raw(:,7)=11; raw(:,10)=0;
  raw(:,[5 8 11])=-5;
  restore(directory,files,[solved originals(3)]); dlmwrite(fullfile(directory,files{3}),raw,',');
  report=evalc('r=engr183.runTests(id);'); assert(all([r.passed]),report);
  fprintf('PASS synthetic exact 100 W / 80%%, zero average -> Inf, zero valid, negative temperature valid\n');
  bad=strrep(solved{1},'power_W >= required_power_W','power_W > required_power_W');
  restore(directory,files(1),{bad});
  report=evalc('r=engr183.runTests(id);'); assert(~r(strcmp(keys,'summaries')).passed,report);
  fprintf('PASS strict 100 W boundary mutation rejected\n');
  % More than one invalid sensor counts the shared row once; preserve ordering.
  raw(2,3)=-999; raw(2,8)=-999; raw(3,10)=-0.25;
  restore(directory,files(1:2),solved); dlmwrite(fullfile(directory,files{3}),raw,',');
  report=evalc('r=engr183.runTests(id);'); assert(all([r.passed]),report);
  fprintf('PASS synthetic multiple-invalid-sensor rows counted once\n');
  % N=0: stop before percentages, with a clear student message.
  raw(:,3)=-999; dlmwrite(fullfile(directory,files{3}),raw,',');
  oldDir=pwd(); dirCleanup=onCleanup(@() cd(oldDir)); cd(directory);
  outcome=runEmpty(); cd(oldDir); clear dirCleanup;
  assert(~outcome.hasPercentage && ~isempty(regexpi(outcome.message,'no.*(valid|observation)|zero|empty','once')));
  fprintf('PASS N=0 stops clearly before percentages\n');
  % Zero power, full-precision near-80 percentage, and deterministic ties.
  raw=[ones(501,1) linspace(9,15,501)' ones(501,9)];
  raw(:,[3 6 9])=10; raw(:,[4 7 10])=0; raw(1:400,4)=10; raw(:,7)=11;
  restore(directory,files,[solved originals(3)]); dlmwrite(fullfile(directory,files{3}),raw,',','precision','%.17g');
  report=evalc('r=engr183.runTests(id);'); assert(all([r.passed]),report);
  fprintf('PASS near-80 percentage stays unrounded\n');
  % Tie behavior is a direct Run File fixture, because assignment inputs stay fixed in Run Tests.
  raw(:,[4 7 10])=11; dlmwrite(fullfile(directory,files{3}),raw,',');
  main=strrep(solved{1},'selected_day = 1;','selected_day = 1; unit_price_USD(2,:) = unit_price_USD(1,:);');
  restore(directory,files(1),{main}); oldDir=pwd(); dirCleanup=onCleanup(@() cd(oldDir)); cd(directory);
  selected=runRecommendation(); cd(oldDir); clear dirCleanup;
  assert(selected==1,'Equal qualifying costs must select A before B.');
  fprintf('PASS tied qualifying costs select first system\n');
  restore(directory,files,[solved originals(3)]);
  sentinel=figure('visible','off'); plot([1 2],[7 8]); set(sentinel,'handlevisibility','off');
  report=evalc('r=engr183.runTests(id);');
  assert(ishandle(sentinel) && all([r.passed]),report);
  assert(isequal(get(findall(sentinel,'type','line'),'ydata'),[7 8])); delete(sentinel);
  fprintf('PASS pre-existing figure preserved; temporary test figures cleaned up\n');
end
function out=runEmpty()
  try, source('SolarStation_Analysis.m'); message=''; catch err, message=err.message; end
  out=struct('message',message,'hasPercentage',exist('met_pct','var')==1);
end
function selected=runRecommendation()
  evalc('source(''SolarStation_Analysis.m'');'); selected=recommended_index; close all;
end
function text=mutate(text,pairs)
  text=strrep(text,sprintf('\r\n'),sprintf('\n'));
  for k=1:numel(pairs)
    p=pairs{k}; assert(~isempty(strfind(text,p{1})),'Unmatched mutation.'); text=strrep(text,p{1},p{2});
  end
end
function restore(directory,files,contents)
  for k=1:numel(files)
    fid=fopen(fullfile(directory,files{k}),'wb'); assert(fid>=0); fwrite(fid,contents{k}); fclose(fid);
  end
  clear evaluate_system;
end
