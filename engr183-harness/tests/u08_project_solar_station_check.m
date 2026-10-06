function result = u08_project_solar_station_check(criterion)
% Cached baseline plus isolated changed-input probes; never edit student files.
% Branch/source checks are heuristics backed by behavioral probes, not proofs.
  persistent baseline;
  result = true;
  if strcmp(criterion,'reset')
    baseline=[]; clear evaluate_system;
    % The browser processes graphics listeners at the end of an execution.
    % Retire only our previous, already-flushed figures on the next invocation.
    if isappdata(0,'u08_owned_figures')
      owned=getappdata(0,'u08_owned_figures'); owned=owned(ishandle(owned));
      delete(owned); rmappdata(0,'u08_owned_figures');
    end
    return;
  end
  directory=fullfile(engr183.root(),'assignments','u08-project-solar-station');
  if any(strcmp(criterion,{'helper_costs','helper_decisions','branching'}))
    state=projectState(directory);
    checkHelper(criterion,fullfile(directory,'evaluate_system.m')); return;
  end
  if isempty(baseline)
    try, baseline=capture(directory,'baseline');
    catch err
      baseline=struct('ok',false,'error',err.message,'vars',struct(),'calls',{{}}, ...
        'axes',{{}},'graphicsError','');
    end
  end
  s=baseline; e=oracle(dlmread(fullfile(directory,'solar_station_measurements.csv'),','));
  switch criterion
    case 'cleaning'
      compareFields(s,e,{'raw_data','original_count','valid_rows','clean_data','retained_count','rejected_count','test_day','time_hr'});
    case 'power'
      compareFields(s,e,{'voltage_V','current_A','temperature_C','power_W'});
    case 'summaries'
      compareFields(s,e,{'average_power_W','maximum_power_W','maximum_temperature_C','meeting_count','met_pct'});
    case 'integration'
      checkIntegration(s,e);
    case 'recommendation'
      compareFields(s,e,{'recommended_index','recommended_system'});
    case 'dynamic'
      require(isfield(s.vars,'recommended_index'), 'Complete TODO 4-5 before testing changed prices and budget.');
      for mode={'price','budget'}
        changed=capture(directory,mode{1}); expected=e;
        if strcmp(mode{1},'price'), expected.unit_price_USD(3,1)=100;
        else, expected.budget_USD=400; end
        expected=costs(expected);
        try
          checkChanged(changed,expected);
        catch err
          if ~changed.analysisOnly, rethrow(err); end
          % Retry the original plotting statements before judging a failed
          % calculation-only probe. Never skip later analysis statements.
          changed=capture(directory,mode{1},false);
          checkChanged(changed,expected);
        end
      end
    case 'power_plot'
      checkPowerPlot(s,e);
    case 'percent_plot'
      checkPercentPlot(s,e);
    case 'output'
      require(s.ok,['Finish the script before checking printed results: ' s.error]);
      checkOutput(s.output,e);
    otherwise, error('Unknown Unit 8 criterion: %s',criterion);
  end
end

function checkChanged(s,e)
  require(s.ok,['Changed-input run: ' s.error]);
  checkIntegration(s,e);
  compareFields(s,e,{'recommended_index','recommended_system'});
end

function e=oracle(raw)
% Independent observation-by-observation oracle; never trust student flags.
  e.raw_data=raw; e.original_count=size(raw,1); e.valid_rows=true(size(raw,1),1);
  for i=1:size(raw,1)
    for j=3:11
      if raw(i,j)==-999, e.valid_rows(i)=false; end
    end
    for j=[3 4 6 7 9 10]
      if raw(i,j)<0, e.valid_rows(i)=false; end
    end
  end
  e.clean_data=raw(e.valid_rows,:); e.retained_count=size(e.clean_data,1);
  e.rejected_count=e.original_count-e.retained_count;
  e.test_day=e.clean_data(:,1); e.time_hr=e.clean_data(:,2);
  e.voltage_V=e.clean_data(:,[3 6 9]); e.current_A=e.clean_data(:,[4 7 10]);
  e.temperature_C=e.clean_data(:,[5 8 11]); e.power_W=e.voltage_V.*e.current_A;
  e.required_power_W=100; e.minimum_met_pct=80; e.budget_USD=800;
  e.average_power_W=mean(e.power_W,1); e.maximum_power_W=max(e.power_W,[],1);
  e.maximum_temperature_C=max(e.temperature_C,[],1);
  e.meeting_count=sum(e.power_W>=100,1); e.met_pct=100*e.meeting_count/e.retained_count;
  e.component_quantity=[2 1 1 1 1];
  e.unit_price_USD=[120 80 75 45 40;190 105 95 60 50;280 160 110 85 65];
  e=costs(e);
end
function e=costs(e)
  e.line_cost_USD=zeros(3,5); e.total_cost_USD=zeros(1,3);
  e.qualifies=false(1,3); e.status_code=cell(1,3);
  for k=1:3
    for j=1:5
      e.line_cost_USD(k,j)=e.component_quantity(j)*e.unit_price_USD(k,j);
      e.total_cost_USD(k)=e.total_cost_USD(k)+e.line_cost_USD(k,j);
    end
    performance=e.met_pct(k)>=e.minimum_met_pct;
    affordable=e.total_cost_USD(k)<=e.budget_USD;
    e.qualifies(k)=performance && affordable;
    codes={'fails_both','over_budget','fails_performance','qualifies'};
    e.status_code{k}=codes{1+performance+2*affordable};
  end
  e.cost_per_avg_W=e.total_cost_USD./e.average_power_W;
  e.cost_per_avg_W(e.average_power_W==0)=Inf;
  e.recommended_index=0; e.recommended_system='none'; best=Inf;
  for k=1:3
    if e.qualifies(k) && e.total_cost_USD(k)<best
      e.recommended_index=k; best=e.total_cost_USD(k); e.recommended_system=char('A'+k-1);
    end
  end
end

function checkHelper(criterion,filename)
  require(exist(filename,'file')==2,'Create evaluate_system.m and complete TODO 4a-4b.');
  if strcmp(criterion,'branching')
    code=u08_source(fileread(filename));
    code=regexprep(code,'\.\.\.[^\r\n]*\r?\n',' ');
    conditions=regexp(code,'\<(?:if|elseif)\>[^\n;]*','match');
    evidence=strjoin(conditions,' ');
    assignments=regexp(code,'\<(\w+)\>\s*=(?!=)([^;\n]+)','tokens');
    visited=false(size(assignments));
    for pass=1:numel(assignments)
      for k=1:numel(assignments)
        if ~visited(k) && has(evidence,['\<' assignments{k}{1} '\>'])
          evidence=[evidence ' ' assignments{k}{2}];
          visited(k)=true;
        end
      end
    end
    require(~isempty(conditions) && has(code,'\<else\>') && ...
      has(evidence,'\<(total_cost_USD|budget_USD)\>') && ...
      has(evidence,'\<(met_pct|minimum_met_pct)\>'), ...
      'TODO 4b: use meaningful if/elseif/else (nested if/else is fine) to classify cost and performance. Comments and strings do not count.');
    % Alias tracing permits named predicates. Behavior still checks all outcomes.
    criterion='helper_decisions';
  end
  cases={ [2 1],[100 50],80,800,80; [2 1],[100 50],79.999,800,80; ...
    [2 1],[400 1],80,800,80; [2 1],[400 1],79.999,800,80; ...
    [2 1],[350 100],80,800,80; [2 1],[350 100.01],80,800,80; ...
    [3 2 1],[90 40 25],90,800,80; [0 1],[999 25],90,800,80; ...
    [2 1],[100 50],80,200,85; [2 1],[100 50],80,250,75; ...
    3,17,0,51,0; [1 2 4 0],[7 13 2 500],100,40,100};
  for k=1:size(cases,1)
    q=cases{k,1}; p=cases{k,2}; pct=cases{k,3}; budget=cases{k,4}; minimum=cases{k,5};
    try, [line,total,flag,status]=evaluate_system(q,p,pct,budget,minimum);
    catch err
      error('TODO 4a-4b: evaluate_system must return all four outputs on valid inputs (case %d): %s%s',k,err.message,engr183.errorLocation(err));
    end
    require(same(line,q.*p) && same(total,dot(q,p)), ...
      'TODO 4a: calculate matching quantity * unit price, then sum ALL line costs; use the arguments and support any vector length.');
    if strcmp(criterion,'helper_costs'), continue; end
    performance=pct>=minimum; affordable=dot(q,p)<=budget;
    codes={'fails_both','over_budget','fails_performance','qualifies'};
    require(islogical(flag) && isscalar(flag) && flag==(performance && affordable) && ...
      ischar(status) && isequal(status,codes{1+performance+2*affordable}), ...
      sprintf('TODO 4b: wrong classification in case %d. Use supplied thresholds, full precision, <= budget and >= minimum; return a logical flag and exact status code.',k));
  end
end

function checkIntegration(s,e)
  compareFields(s,e,{'required_power_W','minimum_met_pct','budget_USD','component_quantity', ...
    'unit_price_USD','line_cost_USD','total_cost_USD','qualifies','status_code','cost_per_avg_W'});
  for k=1:3
    observed=false;
    for j=1:numel(s.calls)
      c=s.calls{j};
      if same(c.args{1},e.component_quantity) && same(c.args{2},e.unit_price_USD(k,:)) && ...
        same(c.args{3},e.met_pct(k)) && same(c.args{4},e.budget_USD) && same(c.args{5},e.minimum_met_pct)
        observed=same(c.values{1},e.line_cost_USD(k,:)) && same(c.values{2},e.total_cost_USD(k)) && ...
          isequal(c.values{3},e.qualifies(k)) && isequal(c.values{4},e.status_code{k});
        if observed, break; end
      end
    end
    require(observed,sprintf('TODO 4: call evaluate_system for System %c with its measured percentage and supplied component/threshold inputs, and use all returned values.',char('A'+k-1)));
  end
end

function compareFields(s,e,names)
  for k=1:numel(names)
    name=names{k};
    require(isfield(s.vars,name),['Complete the TODO that creates ' name '. ' s.error]);
    expected=e.(name); actual=s.vars.(name);
    if isnumeric(expected), correct=same(actual,expected);
    else, correct=isequal(actual,expected) && strcmp(class(actual),class(expected)); end
    require(correct,['Check ' name ': use the supplied equations, required dimensions, shared retained rows and unrounded values.']);
  end
end
function yes=same(a,b)
  yes=isnumeric(a) && isreal(a) && isequal(size(a),size(b));
  if yes
    equalInf=isinf(a(:)) & isinf(b(:)) & sign(a(:))==sign(b(:));
    yes=all(equalInf | (isfinite(a(:)) & isfinite(b(:)) & abs(a(:)-b(:))<=1e-8));
  end
end

function s=capture(directory,mode,analysisOnly)
% Work on a temporary copy, instrumenting the helper without rewriting originals.
  if nargin<3, analysisOnly=~strcmp(mode,'baseline'); end
  oldDir=pwd(); oldPath=path(); scratch=tempname(); mkdir(scratch);
  before=findall(0,'type','figure'); visibility=cell(size(before));
  currentFigure=get(0,'currentfigure');
  for k=1:numel(before), visibility{k}=get(before(k),'handlevisibility'); set(before(k),'handlevisibility','off'); end
  visible=get(0,'defaultfigurevisible'); set(0,'defaultfigurevisible','off');
  cleanup=onCleanup(@() restoreCapture(oldDir,oldPath,scratch,before,visibility,visible,currentFigure));
  files=dir(fullfile(directory,'*.m'));
  for required={'SolarStation_Analysis.m','evaluate_system.m'}
    require(exist(fullfile(directory,required{1}),'file')==2, ...
      ['Create ' required{1} ' in this project and complete its TODOs.']);
  end
  for k=1:numel(files), writeText(fullfile(scratch,files(k).name),fileread(fullfile(directory,files(k).name))); end
  writeText(fullfile(scratch,'solar_station_measurements.csv'),fileread(fullfile(directory,'solar_station_measurements.csv')));
  helper=fileread(fullfile(scratch,'evaluate_system.m'));
  [a,b]=regexp(u08_source(helper),'\<evaluate_system\>','start','end','once');
  require(~isempty(a),'Keep the evaluate_system function declaration in evaluate_system.m.');
  helper=[helper(1:a-1) '__u08_student_evaluate' helper(b+1:end)];
  writeText(fullfile(scratch,'__u08_student_evaluate.m'),helper);
  wrapper=sprintf(['function [a,b,c,d]=evaluate_system(varargin)\n' ...
    '[a,b,c,d]=__u08_student_evaluate(varargin{:});\n' ...
    'calls=getappdata(0,''u08_calls'');\n' ...
    'calls{end+1}=struct(''args'',{varargin},''values'',{{a,b,c,d}});\n' ...
    'setappdata(0,''u08_calls'',calls);\nend\n']);
  writeText(fullfile(scratch,'evaluate_system.m'),wrapper);
  % Give each test copy its own numbered figures, preserving existing plots.
  % The pinned Plotly toolkit requires ordinary positive integer figure handles.
  setappdata(0,'u08_native_figure',@figure);
  setappdata(0,'u08_figure_ids',[]); setappdata(0,'u08_figure_handles',[]);
  setappdata(0,'u08_figure_next',max([0;before(:)])+1000);
  figureWrapper=sprintf(['function h=figure(varargin)\n' ...
    'native=getappdata(0,''u08_native_figure'');\n' ...
    'ids=getappdata(0,''u08_figure_ids''); handles=getappdata(0,''u08_figure_handles'');\n' ...
    'if nargin>=1 && isnumeric(varargin{1}) && isscalar(varargin{1}) && varargin{1}>0 && varargin{1}==fix(varargin{1})\n' ...
    ' idx=find(ids==varargin{1},1);\n' ...
    ' if ~isempty(idx) && ishandle(handles(idx)), h=native(handles(idx),varargin{2:end}); return; end\n' ...
    ' if any(handles==varargin{1}), h=native(varargin{:}); return; end\n' ...
    ' requested=varargin{1}; props=varargin(2:end);\n' ...
    'else, requested=NaN; props=varargin; end\n' ...
    'number=getappdata(0,''u08_figure_next'')+1; while ishandle(number), number=number+1; end\n' ...
    'h=native(number,props{:}); ids(end+1)=requested; handles(end+1)=h;\n' ...
    'setappdata(0,''u08_figure_ids'',ids); setappdata(0,''u08_figure_handles'',handles);\n' ...
    'setappdata(0,''u08_figure_next'',number);\nend\n']);
  writeText(fullfile(scratch,'figure.m'),figureWrapper);
  source=fileread(fullfile(scratch,'SolarStation_Analysis.m'));
  if ~strcmp(mode,'baseline')
    code=u08_source(source);
    if strcmp(mode,'price')
      pattern='\<unit_price_USD\>\s*=\s*\[[^\]]*\]\s*;'; insert='unit_price_USD(3,1)=100;';
    else
      pattern='\<budget_USD\>\s*=\s*800\s*;'; insert='budget_USD=400;';
    end
    [a,b]=regexp(code,pattern,'start','end','once');
    require(~isempty(a),'Keep the supplied input declarations unchanged so changed-input practice checks can run.');
    source=[source(1:b) sprintf('\n%s\n',insert) source(b+1:end)];
  end
  shortened=false;
  if analysisOnly && numel(files)==2, [source,shortened]=withoutPlotCalls(source); end
  writeText(fullfile(scratch,'SolarStation_Analysis.m'),source);
  state=projectState(scratch);
  setappdata(0,'u08_calls',{});
  s=executeScript(fullfile(scratch,'SolarStation_Analysis.m'));
  s.analysisOnly=shortened;
  % Flush before deleting: the WASM toolkit defers graphics callbacks until
  % drawnow; deleting unrendered legends/bars can leave stale native handles.
  if ~shortened, drawnow; end
  s.calls=getappdata(0,'u08_calls'); s.axes={}; s.graphicsError='';
  try
    figures=setdiff(findall(0,'type','figure'),before);
    for k=1:numel(figures)
      axesHandles=findall(figures(k),'type','axes');
      for j=1:numel(axesHandles)
        if any(strcmpi(get(axesHandles(j),'tag'),{'legend','colorbar'})), continue; end
        a=readAxes(axesHandles(j)); a.figure=k; s.axes{end+1}=a;
      end
    end
  catch err, s.graphicsError=err.message; end
  clear state;
end

function [source,changed]=withoutPlotCalls(source)
% Remove only standalone plotting calls in a controlled copy. Preserve every
% calculation, branch, and statement after the figures (including overrides).
% Handle assignments, introspection, eval and extra helpers use a full run.
  original=source; code=u08_source(source); changed=false;
  graphics='figure|plot|bar|subplot|axes|hold|grid|legend|title|xlabel|ylabel|xlim|ylim|axis|set';
  pattern=['(?m)^[ \t]*(?:' graphics ')\>'];
  while true
    [a,b]=regexp(code,pattern,'start','end','once');
    if isempty(a), break; end
    depth=0; finish=b; continuation=false;
    for k=b+1:numel(code)
      c=code(k);
      if any(c=='([{'), depth=depth+1; end
      if any(c==')]}'), depth=depth-1; end
      if k>=3 && strcmp(code(k-2:k),'...'), continuation=true; end
      if depth==0 && (c==';' || (c==char(10) && ~continuation)), finish=k; break; end
      if c==char(10), continuation=false; end
      finish=k;
    end
    % These are calls/commands, never assignments to similarly named variables.
    if has(code(b+1:finish),'^\s*='), source=original; changed=false; return; end
    keep=source(a:finish)==char(10) | source(a:finish)==char(13);
    part=source(a:finish); part(~keep)=' '; source(a:finish)=part;
    code(a:finish)=part; changed=true;
  end
  code=u08_source(source);
  if has(code,['\<(' graphics '|line|yline|text|scatter|patch|fill|gca|gcf|get|findobj|findall|ishandle|eval|evalin|feval|run|source)\>'])
    source=original; changed=false;
  end
end
function restoreCapture(oldDir,oldPath,scratch,before,visibility,visible,currentFigure)
  own=setdiff(findall(0,'type','figure'),before);
  if ~isempty(own)
    if strcmp(graphics_toolkit(own(1)),'plotly')
      set(own,'visible','off','handlevisibility','off');
      old=getappdata(0,'u08_owned_figures');
      setappdata(0,'u08_owned_figures',[old(:);own(:)]);
    else
      delete(own);
    end
  end
  for k=1:numel(before)
    if ishandle(before(k)), set(before(k),'handlevisibility',visibility{k}); end
  end
  set(0,'defaultfigurevisible',visible);
  if isempty(currentFigure) || ishandle(currentFigure), set(0,'currentfigure',currentFigure); end
  cd(oldDir); engr183.restorePathQuietly(oldPath);
  clear evaluate_system __u08_student_evaluate figure;
  if isappdata(0,'u08_calls'), rmappdata(0,'u08_calls'); end
  for key={'u08_native_figure','u08_figure_ids','u08_figure_handles','u08_figure_next'}
    if isappdata(0,key{1}), rmappdata(0,key{1}); end
  end
  % scratch is created by tempname above and never supplied by student code.
  if exist(scratch,'dir')==7
    require(strcmp(canonicalize_file_name(fileparts(scratch)),canonicalize_file_name(tempdir())), ...
      'Temporary cleanup must stay inside the runtime temporary directory.');
    rmdir(scratch,'s');
  end
end
function cleanup=projectState(directory)
  oldDir=pwd(); oldPath=path(); cleanup=onCleanup(@() restoreState(oldDir,oldPath));
  entries=strsplit(oldPath,pathsep()); changed=false;
  for k=1:numel(entries)
    if ~isempty(entries{k}) && ~strcmp(entries{k},'.') && ~is_absolute_filename(entries{k})
      entries{k}=fullfile(oldDir,entries{k}); changed=true;
    end
  end
  if changed, engr183.restorePathQuietly(strjoin(entries,pathsep())); end
  state=warning('query','Octave:shadowed-function'); warning('off','Octave:shadowed-function');
  cd(directory); addpath(directory,'-begin');
  warning(state.state,'Octave:shadowed-function');
  clear evaluate_system __u08_student_evaluate figure;
end
function restoreState(oldDir,oldPath)
  cd(oldDir); engr183.restorePathQuietly(oldPath); clear evaluate_system __u08_student_evaluate figure;
end
function writeText(filename,text)
  fid=fopen(filename,'wb'); require(fid>=0,['Cannot create temporary check file: ' filename]);
  cleanup=onCleanup(@() fclose(fid)); fwrite(fid,text);
end
function s=executeScript(scriptPath)
% Student clear must not erase caller state or cleanup objects.
  try, output=evalc('source(scriptPath);'); failure='';
  catch err
    output=''; failure=err.message;
    for frame=1:numel(err.stack)
      [~,name,ext]=fileparts(err.stack(frame).file);
      if any(strcmp(name,{'SolarStation_Analysis','__u08_student_evaluate'}))
        name=strrep(name,'__u08_student_evaluate','evaluate_system');
        failure=[failure sprintf(' [raised in %s%s, line %d]',name,ext,err.stack(frame).line)];
        break;
      end
    end
  end
  % Hide random temporary paths in feedback/goldens but retain file and line.
  failure=regexprep(failure,'[^\s:]*[\\/](__u08_student_evaluate|SolarStation_Analysis)\.m','$1.m');
  failure=strrep(failure,'__u08_student_evaluate','evaluate_system');
  s=struct('ok',isempty(failure),'error',failure,'output',output,'vars',struct());
  names={'raw_data','original_count','retained_count','rejected_count','valid_rows','clean_data', ...
    'test_day','time_hr','voltage_V','current_A','temperature_C','power_W','average_power_W', ...
    'maximum_power_W','maximum_temperature_C','meeting_count','met_pct','component_quantity', ...
    'unit_price_USD','line_cost_USD','total_cost_USD','cost_per_avg_W','qualifies','status_code', ...
    'recommended_index','recommended_system','selected_day','day_rows','required_power_W','minimum_met_pct','budget_USD'};
  for k=1:numel(names)
    if exist(names{k},'var'), s.vars.(names{k})=eval(names{k}); end
  end
end

function checkPowerPlot(s,e)
  require(isempty(s.graphicsError),['Graphics need visual review: ' s.graphicsError]);
  require(isfield(s.vars,'selected_day') && isscalar(s.vars.selected_day) && ...
    any(s.vars.selected_day==1:5),'TODO 7: selected_day must be an integer 1-5.');
  e.day_rows=e.test_day==s.vars.selected_day; compareFields(s,e,{'day_rows'});
  for k=1:numel(s.axes)
    a=s.axes{k}; matched=[];
    for j=1:3
      idx=findSeries(a,e.time_hr(e.day_rows),e.power_W(e.day_rows,j));
      if ~isempty(idx), matched(end+1)=idx; end
    end
    if numel(matched)~=3, continue; end
    require(reference(a,100,9,15),'TODO 7: include the 100 W reference across the selected day.');
    require(has(lower(a.title),['day\s*' num2str(s.vars.selected_day)]) && ...
      has(lower(a.xlabel),'time|hour') && has(lower(a.xlabel),'hr|hour|\(h\)') && ...
      has(lower(a.ylabel),'power') && has(lower(a.ylabel),'\<w\>|watt'), ...
      'TODO 7: title identifies the selected day; label time (hr) and power (W).');
    require(numel(a.legendLabels)>=3,'TODO 7: add a legend identifying Systems A, B and C.');
    for j=1:3
      line=a.lines{matched(j)}; idx=find(a.legendHandles==line.handle);
      require(numel(idx)==1 && has(lower(a.legendLabels{idx}),['\<' lower(char('A'+j-1)) '\>']), ...
        'TODO 7: each power series must have the correct A/B/C legend label.');
      for m=1:j-1
        other=a.lines{matched(m)};
        require(~strcmp(line.linestyle,other.linestyle) || ~strcmp(line.marker,other.marker), ...
          'TODO 7: distinguish all three systems with line styles and/or markers.');
      end
    end
    require(a.xlim(1)<=9 && a.xlim(2)>=15 && a.ylim(1)<=min(e.power_W(e.day_rows,:)(:)) && ...
      a.ylim(2)>=max(e.power_W(e.day_rows,:)(:)), 'TODO 7: axis limits must show all selected-day measurements.');
    return;
  end
  error('TODO 7: plot the three retained power columns against time_hr for exactly selected_day.');
end
function checkPercentPlot(s,e)
  require(isempty(s.graphicsError),['Graphics need visual review: ' s.graphicsError]);
  for k=1:numel(s.axes)
    a=s.axes{k}; correct=false; positions=[]; heights=[];
    for j=1:numel(a.bars)
      bar=a.bars{j};
      if same(bar.x(:),(1:3)') && same(bar.y(:),e.met_pct(:)), correct=true; end
      positions=[positions;bar.x(:)]; heights=[heights;bar.y(:)];
    end
    [positions,order]=sort(positions);
    if same(positions,(1:3)') && same(heights(order),e.met_pct(:)), correct=true; end
    if ~correct, continue; end
    require(reference(a,80,1,3),'TODO 7: add the 80 percent reference line across all three bars.');
    require(same(a.ylim,[0 100]),'TODO 7: use a 0-100 percent vertical axis.');
    require(~isempty(strtrim(a.title)) && has(lower(a.xlabel),'system') && ...
      has(lower(a.ylabel),'%|percent|pct'),'TODO 7: give the percentage chart a descriptive title and system/percent axis labels.');
    labels=a.xticklabel; if ischar(labels), labels=cellstr(labels); end
    for j=1:3
      idx=find(abs(a.xtick-j)<1e-8,1);
      require(~isempty(idx) && iscell(labels) && numel(labels)>=idx && ...
        has(lower(labels{idx}),['\<' lower(char('A'+j-1)) '\>']), 'TODO 7: label bar positions A, B and C in order.');
    end
    require(numel(unique(cellfun(@(x) x.figure,s.axes)))>=2,'TODO 7: create two separate figures for the report.');
    return;
  end
  error('TODO 7: create A/B/C bars using the all-days met_pct values (0-100).');
end
function idx=findSeries(a,x,y)
  idx=[];
  for k=1:numel(a.lines)
    l=a.lines{k};
    if strcmp(l.visible,'on') && same(l.x(:),x(:)) && same(l.y(:),y(:))
      idx=k; return;
    end
  end
end
function yes=reference(a,threshold,xmin,xmax)
  yes=false;
  for k=1:numel(a.lines)
    l=a.lines{k};
    if strcmp(l.visible,'on') && numel(l.x)>=2 && all(abs(l.y-threshold)<1e-8) && min(l.x)<=xmin && max(l.x)>=xmax
      yes=true; return;
    end
  end
end
function a=readAxes(h)
  a.xtick=get(h,'xtick'); a.xticklabel=get(h,'xticklabel');
  a.xlim=get(h,'xlim'); a.ylim=get(h,'ylim');
  a.title=textValue(get(get(h,'title'),'string'));
  a.xlabel=textValue(get(get(h,'xlabel'),'string')); a.ylabel=textValue(get(get(h,'ylabel'),'string'));
  a.lines={}; handles=findall(h,'type','line');
  for k=1:numel(handles)
    l=get(handles(k)); a.lines{end+1}=struct('handle',handles(k),'x',l.xdata,'y',l.ydata, ...
      'linestyle',l.linestyle,'marker',l.marker,'visible',l.visible);
  end
  a.bars={}; groups=findall(h,'type','hggroup');
  for k=1:numel(groups)
    if isprop(groups(k),'bargroup') && strcmp(get(groups(k),'visible'),'on')
      a.bars{end+1}=struct('x',get(groups(k),'xdata'),'y',get(groups(k),'ydata'));
    end
  end
  a.legendLabels={}; a.legendHandles=[];
  legends=findall(ancestor(h,'figure'),'type','axes','tag','legend');
  for k=1:numel(legends)
    peers=getappdata(legends(k),'__peer_objects__');
    if isempty(peers)
      info=get(legends(k),'userdata');
      if isstruct(info) && isfield(info,'handles'), peers=info.handles; end
    end
    labels=get(legends(k),'string'); if ischar(labels), labels=cellstr(labels); end
    if numel(peers)~=numel(labels), continue; end
    for j=1:numel(peers)
      if isequal(ancestor(peers(j),'axes'),h)
        a.legendHandles(end+1)=peers(j); a.legendLabels{end+1}=labels{j};
      end
    end
  end
end
function checkOutput(output,e)
% Flexible comparison table or labeled blocks. Interpretation is manual review.
  low=lower(output);
  labels={'original','retained','rejected','cost','average','maximum','temperature','meeting','status','recommendation'};
  patterns={'original','retained','rejected','cost','average|avg|mean','maximum|max', ...
    'temperature|temp','meeting|meets|met','status','recommend'};
  for k=1:numel(labels)
    require(has(low,patterns{k}),['TODO 6: print a readable label for ' labels{k} '.']);
  end
  require(has(low,'usd|\$') && has(low,'\<w\>|watt') && has(low,'%|percent') && has(low,'\<c\>|celsius'), ...
    'TODO 6: label dollars, watts, temperature in C, and percent.');
  expected=[e.original_count e.retained_count e.rejected_count e.total_cost_USD e.average_power_W ...
    e.maximum_power_W e.maximum_temperature_C e.meeting_count e.met_pct e.cost_per_avg_W];
  tokens=regexp(low,'(?<![a-z])[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?|inf','match');
  values=cellfun(@str2double,tokens);
  for k=1:numel(expected)
    require(any(abs(values-expected(k))<=0.011 | (isinf(values) & isinf(expected(k)))), ...
      'TODO 6: print all counts and all systems'' cost, power, temperature and performance summaries (two decimal places is sufficient).');
  end
  for k=1:3
    require(has(low,['\<' lower(char('A'+k-1)) '\>']) && ~isempty(strfind(low,e.status_code{k})), ...
      'TODO 6: identify A/B/C and print their status codes.');
  end
  require(has(low,['recommend[^\n]*\<' lower(e.recommended_system) '\>']), ...
    'TODO 6: print the calculated recommendation with a readable label.');
end
function value=textValue(value)
  if iscell(value), value=strjoin(value(:)',' '); end
  if ~ischar(value), value=''; elseif size(value,1)>1, value=strjoin(cellstr(value)',' '); end
end
function yes=has(text,pattern), yes=~isempty(regexp(text,pattern,'once')); end
function require(yes,message), if ~yes, error('%s',message); end; end
