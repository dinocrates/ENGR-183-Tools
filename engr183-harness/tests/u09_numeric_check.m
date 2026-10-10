function result = u09_numeric_check(kind, criterion)
% One genuine isolated execution, including failures, per specification reset.
% Function handles stay in Octave. Scores establish evidence, not source methods.
  persistent snapshots;
  if isempty(snapshots), snapshots=struct(); end
  result=true;
  if strcmp(criterion,'reset')
    snapshots=struct();
    if isappdata(0,'u09_owned_figures')
      own=getappdata(0,'u09_owned_figures'); delete(own(ishandle(own)));
      rmappdata(0,'u09_owned_figures');
    end
    return;
  end
  c=contract(kind); filename=fullfile(engr183.root(),'assignments',c.id,c.file);
  if strcmp(criterion,'personalization'), personalize(filename); return; end
  if ~isfield(snapshots,kind)
    try, snapshots.(kind)=capture(filename);
    catch err
      snapshots.(kind)=struct('ok',false,'error',[err.message engr183.errorLocation(err)]);
    end
  end
  s=snapshots.(kind);
  require(s.ok,['Fix the script execution error: ' s.error]);
  switch criterion
    case 'execution', return;
    case 'inputs'
      names=fieldnames(c.inputs);
      for k=1:numel(names), variable(s,names{k},c.inputs.(names{k}),1e-12); end
      if strcmp(kind,'apa'), handleValues(s,'Hsystem',[0 13 35 60],@(q) 5+.003*q.^2); end
    case 'interpolation'
      if strcmp(kind,'gp')
        variable(s,'T5',47.5); variable(s,'T_queries',[58.5 47.5 40.5]); missing(s,'T14_linear');
      else, variable(s,'H35',31); missing(s,'H80_interp'); end
    case 'fits', fits(s,c);
    case 'residuals', residuals(s,c);
    case 'fits_residuals', fits(s,c); residuals(s,c);
    case 'fit_plot', fitPlot(s,c);
    case {'bracket','selected_model_bracket'}, rootModel(s,c);
    case 'bisection'
      [model,root]=rootModel(s,c);
      x=scalar(s,c.bisect); width=scalar(s,'half_width'); n=scalar(s,'iterations');
      require(abs(x-root)<=.001+1e-9,'The bisection estimate must be within 0.001 input units of the selected root.');
      require(width>=0 && width<=.001+1e-12,'Report a nonnegative bracket half_width no larger than the input tolerance, not an output-residual tolerance.');
      require(n==fix(n) && n>=1 && n<=100,'Report an integer midpoint count within max_iter; equivalent stopping conventions are accepted.');
      require(abs(x-root)<=width+1e-9,'The reported half_width does not bound the actual root error.');
      % Validate the implied enclosing interval, allowing different loop conventions.
      ends=model([x-width x+width]);
      require(all(isfinite(ends)) && isreal(ends) && prod(sign(ends))<=0 || ...
        max(abs(ends))<=1e-8,'The interval implied by estimate +/- half_width must enclose the root.');
    case {'fzero','fzero_balance'}
      [model,root,selected]=rootModel(s,c); x=scalar(s,c.root);
      variable(s,c.root,root); variable(s,'exitflag',1,0);
      actual=model(x); variable(s,'root_residual',actual,1e-8);
      require(abs(actual)<=1e-6,'Recomputed root residual must be at most 1e-6; a stored zero is insufficient.');
      difference=abs(scalar(s,c.bisect)-x);
      require(difference<=.001+1e-9,'Bisection and fzero must agree within the stated input tolerance.');
      if strcmp(kind,'gp')
        variable(s,'T_check',25+60*exp(-.2*x),1e-8); variable(s,'T_check',40);
        variable(s,'solver_difference',difference,1e-9);
      else
        variable(s,'H_pump_root',polyval(selected,x),1e-8);
        variable(s,'H_system_root',5+.003*x^2,1e-8);
        require(abs(s.vars.H_pump_root-s.vars.H_system_root)<=1e-6,'Pump and system heads must balance within 1e-6 m.');
      end
    case 'comparison'
      variable(s,'Q_linear',58.610848134889); variable(s,'Q_quad',55.883663721769);
      decision(s.output,'linear',true); decision(s.output,'quad',false);
    case 'extrapolation'
      variable(s,'H80_linear',4); variable(s,'H80_quad',-14.5); missing(s,'H80_interp');
    case 'target_plot', rootPlot(s,c);
    case 'output', checkOutput(s,c);
    case 'figures_output', rootPlot(s,c); checkOutput(s,c);
    otherwise, error('Unknown Unit 9 criterion: %s',criterion);
  end
end

function c=contract(kind)
  c.kind=kind;
  if strcmp(kind,'gp')
    c.id='u09-gp09-cooling'; c.file='U09_GP09_Cooling.m';
    c.x=[0 2 4 6 8 10]; c.y=[85 66 51 44 37 34];
    c.inputs=struct('t',c.x,'T',c.y,'tfine',linspace(0,10,201),'target_C',40);
    c.p={[-4.985714285714286 77.76190476190476],[.5 -9.985714285714286 84.42857142857143]};
    c.coeffs={'p1','p2'}; c.residuals={'r1','r2'}; c.rmse={'rmse1','rmse2'};
    c.errors=[5.079682529763 .956182887468]; c.top=[25 90]; c.bottom=[-8 8];
    c.bisect='t_bisect'; c.root='t_root'; c.tol='tol_min';
  else
    c.id='u09-apa09-pump'; c.file='U09_APA09_Pump.m';
    c.x=[0 10 20 30 40 50 60]; c.y=[42 41 38 34 28 20 10];
    c.inputs=struct('Q',c.x,'H',c.y,'Qfine',linspace(0,60,301), ...
      'Q_query',35,'Q_required',57,'Q_outside',80,'tol_Q',.001,'max_iter',100);
    c.p={[-.528571428571429 46.285714285714286],[-.00880952380952381 0 41.88095238095238]};
    c.coeffs={'p_linear','p_quad'}; c.residuals={'r_linear','r_quad'}; c.rmse={'rmse_linear','rmse_quad'};
    c.errors=[3.057276365576 .184427778391]; c.top=[0 50]; c.bottom=[-5 5];
    c.bisect='Q_bisect'; c.root='Q_root'; c.tol='tol_Q';
  end
end

function personalize(filename)
  require(exist(filename,'file')==2,'Create the named main script.');
  comments=regexp(fileread(filename),'(?m)^\s*%[^\r\n]*','match');
  text=strjoin(comments,sprintf('\n'));
  for label={'Name','Date'}
    token=regexpi(text,[label{1} ':\s*([^\r\n]*?)(?=\s+(?:Name|Date):|$|[\r\n])'],'tokens','once');
    require(~isempty(token) && ~isempty(strtrim(token{1})) && ...
      isempty(regexpi(strtrim(token{1}),'^(replace|your|enter|todo|name|date|\?+|_+|\[|<)','once')), ...
      ['Fill in the ' label{1} ' comment; combined Name/Date or separate lines are accepted.']);
  end
end
function fits(s,c)
  for k=1:2
    variable(s,c.coeffs{k},c.p{k});
    p=s.vars.(c.coeffs{k}); q=c.x(end)*[.17 .43 .81];
    require(same(polyval(p,q),polyval(c.p{k},q),1e-6),'Check fitted predictions at independent points and use the required polynomial degree.');
  end
end
function residuals(s,c)
  for k=1:2
    expected=c.y-polyval(c.p{k},c.x); variable(s,c.residuals{k},expected);
    variable(s,c.rmse{k},c.errors(k));
    variable(s,c.coeffs{k},c.p{k});
    variable(s,c.residuals{k},c.y-polyval(s.vars.(c.coeffs{k}),c.x));
    r=s.vars.(c.residuals{k}); e=scalar(s,c.rmse{k});
    require(e>=0 && abs(e-sqrt(mean(r(:).^2)))<=1e-6,'RMSE must be nonnegative sqrt(mean(residual.^2)), consistent with all residuals.');
  end
end
function [model,root,selected]=rootModel(s,c)
  variable(s,c.tol,.001,1e-12); variable(s,'max_iter',100,0); selected=[];
  q=c.x(end)*[0 .13 .47 .89 1];
  if strcmp(c.kind,'gp')
    handleValues(s,'Tmodel',q,@(x) 25+60*exp(-.2*x));
    model=@(x) 25+60*exp(-.2*x)-40;
    handleValues(s,'f',q,model); root=6.931471805599453;
  else
    variable(s,'a0',0,1e-12); variable(s,'b0',60,1e-12);
    require(isfield(s.vars,'p_selected'),'Choose p_selected from one of the fitted coefficient vectors.');
    selected=s.vars.p_selected;
    isLinear=same(selected,c.p{1},1e-6); isQuad=same(selected,c.p{2},1e-6);
    require(isLinear || isQuad,'p_selected must be one of the correct degree-1 or degree-2 candidate fits.');
    k=1+isQuad; variable(s,c.coeffs{k},selected);
    % Independent expected model; do not let student coefficients define the oracle.
    selected=c.p{k}; handleValues(s,'Hpump',q,@(x) polyval(selected,x));
    handleValues(s,'Hsystem',q,@(x) 5+.003*x.^2);
    model=@(x) polyval(selected,x)-(5+.003*x.^2);
    handleValues(s,'F',q,model);
    root=58.610848134889; if isQuad, root=55.883663721769; end
  end
  endpoints=model([0 c.x(end)]);
  require(prod(sign(endpoints))<0,'The original bracket must contain an opposite-sign crossing.');
end
function handleValues(s,name,q,model)
  require(isfield(s.vars,name) && isa(s.vars.(name),'function_handle'),['Define ' name ' as the requested function handle.']);
  fn=s.vars.(name);
  require(same(fn(q),model(q),1e-6),['Check ' name ' at several independent points, including both original endpoints.']);
end
function variable(s,name,expected,tol)
  if nargin<4, tol=1e-6; end
  require(isfield(s.vars,name),['Create the variable ' name '.']);
  require(same(s.vars.(name),expected,tol),sprintf('Check %s: expected %d finite real value(s) in order; row or column vectors are accepted, matrices are not.',name,numel(expected)));
end
function x=scalar(s,name)
  require(isfield(s.vars,name),['Create the variable ' name '.']); x=s.vars.(name);
  require(isnumeric(x) && isreal(x) && isscalar(x) && isfinite(x),[name ' must be a finite real numeric scalar.']);
end
function missing(s,name)
  require(isfield(s.vars,name) && isnumeric(s.vars.(name)) && isreal(s.vars.(name)) && ...
    isscalar(s.vars.(name)) && isnan(s.vars.(name)),[name ' must be the NaN/NA scalar returned by linear interp1 outside the data range without extrapolation.']);
end
function yes=same(a,b,tol)
  if nargin<3, tol=1e-6; end
  yes=isnumeric(a) && isreal(a) && isvector(a) && numel(a)==numel(b) && ...
    all(isfinite(a(:))) && all(abs(a(:)-b(:))<=tol);
end

function a=figureAxes(s,count)
  require(isempty(s.graphicsError),['Graphics inspection unverified; instructor visual review required: ' s.graphicsError]);
  matches=find(cellfun(@numel,s.figures)==count);
  require(numel(matches)==1,sprintf('Create a separate figure with %d data axes (legends/colorbars are excluded).',count));
  a=s.figures{matches};
end
function fitPlot(s,c)
  a=figureAxes(s,4); pos=cell2mat(cellfun(@(x) x.position,a,'UniformOutput',false)');
  [~,order]=sort(pos(:,2),'descend'); top=order(1:2); bottom=order(3:4);
  [~,ix]=sort(pos(top,1)); top=top(ix); [~,ix]=sort(pos(bottom,1)); bottom=bottom(ix);
  require(min(pos(top,2))>=max(pos(bottom,2)+pos(bottom,4))-2 && ...
    all(pos([top(1) bottom(1)],1)+pos([top(1) bottom(1)],3)<=pos([top(2) bottom(2)],1)+2), ...
    'Arrange linear/quadratic fits left/right above their matching residual panels in a 2-by-2 layout.');
  for k=1:2
    up=a{top(k)}; low=a{bottom(k)};
    require(abs(up.position(1)-low.position(1))<.15*up.position(3),'Place each residual panel directly below its fitted model.');
    labels(up,c,false); labels(low,c,true);
    require(same(up.xlim,[0 c.x(end)]) && same(low.xlim,[0 c.x(end)]) && ...
      same(up.ylim,c.top) && same(low.ylim,c.bottom),'Use the specified common x limits and fit/residual y limits; avoid clipping or mismatched scales.');
    m=series(up,c.x,c.y,'measurements'); legendEntry(up,m,'meas|data|observ');
    p=c.p{k}; fit=curve(up,[0 c.x(end)],@(x) polyval(p,x),true,'fitted model');
    legendEntry(up,fit,'fit|linear|quad|model|poly');
    r=series(low,c.x,c.y-polyval(p,c.x),'measured-minus-predicted residuals');
    legendEntry(low,r,'resid|error|meas.*pred');
    zero=curve(low,[0 c.x(end)],@(x) zeros(size(x)),false,'zero residual reference');
    legendEntry(low,zero,'zero|reference|(^|\W)0(\W|$)');
    require(~has(lower(legendLabel(low,zero)),'fit|model'),'The zero reference is not a fitted model; label its meaning correctly.');
  end
end
function rootPlot(s,c)
  [model,root,p]=rootModel(s,c); a=figureAxes(s,1); a=a{1}; labels(a,c,false);
  if strcmp(c.kind,'gp')
    fn=@(x) model(x)+40; height=40;
    l=curve(a,[0 10],fn,true,'supplied exponential model'); legendEntry(a,l,'exp|supplied|model|cool');
    l=curve(a,[0 10],@(x) 40+zeros(size(x)),false,'40 C target'); legendEntry(a,l,'40|target');
  else
    fn=@(x) polyval(p,x); height=fn(root);
    l=series(a,c.x,c.y,'pump measurements'); legendEntry(a,l,'meas|data|observ');
    l=curve(a,[0 60],fn,true,'selected pump model'); legendEntry(a,l,'pump|select|fit|model');
    l=curve(a,[0 60],@(x) 5+.003*x.^2,true,'system model'); legendEntry(a,l,'system');
  end
  l=series(a,root,height,'verified root point');
  require(~strcmp(l.marker,'none'),'Mark the root point with a visible symbol.'); legendEntry(a,l,'root|operat|intersect|solution');
  require(a.xlim(1)<=0 && a.xlim(2)>=c.x(end) && ...
    a.ylim(1)<=min([c.y fn(c.x) height])+1e-6 && a.ylim(2)>=max([c.y fn(c.x) height])-1e-6, ...
    'Show the full model range, observations and marked root without clipping.');
end
function l=series(a,x,y,description)
  for k=1:numel(a.lines)
    l=a.lines{k};
    if strcmp(l.visible,'on') && same(l.x,x) && same(l.y,y) && ...
      (~strcmp(l.marker,'none') || ~strcmp(l.linestyle,'none')), return; end
  end
  error('Plot the correct %s values against their original input coordinates.',description);
end
function l=curve(a,range,fn,dense,description)
  for k=1:numel(a.lines)
    l=a.lines{k}; x=l.x;
    if ~isnumeric(x) || ~isreal(x) || ~isvector(x) || ~all(isfinite(x)) || numel(x)<2, continue; end
    if dense && numel(x)<20, continue; end
    if same([min(x) max(x)],range) && same(l.y,fn(x)) && ...
       strcmp(l.visible,'on') && ~strcmp(l.linestyle,'none'), return; end
  end
  error('Draw the %s across the entire supplied range, using a dense grid for model curves.',description);
end
function labels(a,c,residual)
  require(numel(strtrim(a.title))>=3,'Give each data axes a descriptive title.');
  x=lower(a.xlabel); y=lower(a.ylabel);
  if strcmp(c.kind,'gp')
    require(has(x,'time') && has(x,'min'),'Label the horizontal axis Time (min).');
    quantity='temp'; unit='(^|[^a-z])c([^a-z]|$)|celsius';
  else
    require(has(x,'flow|discharge') && has(x,'l\s*/\s*min|lit.*min'),'Label the horizontal axis Flow (L/min).');
    quantity='head'; unit='(^|[^a-z])m([^a-z]|$)|met';
  end
  if residual, quantity='resid|meas.*pred|error'; end
  require(has(y,quantity) && has(y,unit),'Label the vertical axis with the plotted quantity and its units.');
  require(a.grid,'Enable the grid on each data axes.');
end
function value=legendLabel(a,l)
  require(a.legendAvailable,'Legend association is unverified in this toolkit; instructor visual review is required.');
  idx=find(a.legendHandles==l.handle);
  require(~isempty(idx),'Include every required series in its associated axes legend.');
  value=textValue(a.legendLabels(idx));
end
function legendEntry(a,l,pattern)
  require(has(lower(legendLabel(a,l)),pattern),'Associate readable legend labels with the correct measurements, model, residual, reference or root series.');
end

function checkOutput(s,c)
% Rounded console evidence, separately from full-precision numerical checks.
  o=s.output;
  if strcmp(c.kind,'gp')
    outputValue(o,'5.*min',47.5,'c');
    for n=[58.5 47.5 40.5], outputValue(o,'3.*5.*7',n,'c'); end
    outputMissing(o,'14');
    outputValue(o,'linear.*rmse|rmse.*linear',c.errors(1),'c');
    outputValue(o,'quad',c.errors(2),'c'); outputValue(o,'quad.*5',47,'c');
    endpoints=[45 -6.879883005803];
    outputValue(o,'temp.*root|verif|t_check',40,'c');
  else
    outputValue(o,'35',31,'m'); outputMissing(o,'80');
    for k=1:2
      label='linear'; if k==2, label='quad'; end
      outputVector(o,[label '.*coeff|coeff.*' label],c.p{k});
      outputVector(o,[label '.*resid|resid.*' label],c.y-polyval(c.p{k},c.x));
      outputValue(o,'rmse',c.errors(k),'m');
    end
    [model,~,p]=rootModel(s,c); endpoints=model([0 60]);
    outputValue(o,'pump.*head|head.*pump',polyval(p,scalar(s,c.root)),'m');
    outputValue(o,'system.*head|head.*system',5+.003*scalar(s,c.root)^2,'m');
    outputValue(o,'linear',58.610848134889,'l/min'); outputValue(o,'quad',55.883663721769,'l/min');
    outputValue(o,'80|extrap',4,'m'); outputValue(o,'80|extrap',-14.5,'m');
  end
  unit='min'; outUnit='c'; if strcmp(c.kind,'apa'), unit='l/min'; outUnit='m'; end
  for n=endpoints, outputValue(o,'endpoint|bracket|f\(a|f\(b',n,outUnit); end
  outputValue(o,'bisect',scalar(s,c.bisect),unit);
  outputValue(o,'midpoint|iter|count|checks',scalar(s,'iterations'),'');
  outputValue(o,'half.?width',scalar(s,'half_width'),unit);
  outputValue(o,'fzero',scalar(s,c.root),unit);
  outputValue(o,'resid',scalar(s,'root_residual'),outUnit);
  outputValue(o,'exitflag|status',1,'');
  outputValue(o,'diff|agreement',abs(scalar(s,c.bisect)-scalar(s,c.root)),unit);
  if strcmp(c.kind,'gp')
    [model,~]=rootModel(s,c); outputValue(o,'resid',model(scalar(s,c.bisect)),'c');
  end
end
function outputValue(output,label,value,unit)
  lines=strsplit(lower(output),sprintf('\n')); found=false;
  for k=1:numel(lines)
    if has(lines{k},label) && (isempty(unit) || has(lines{k},['(?<![a-z])' unit '(?![a-z])']))
      nums=numbers(lines{k});
      if any(abs(nums-value)<=max(5e-4,abs(value)*5e-5)), found=true; break; end
    end
  end
  require(found,sprintf('Print %g with a meaningful %s label and %s units (reasonable rounding is accepted).',value,label,unit));
end
function outputMissing(output,label)
  require(has(lower(output),[label '[^\n]*(nan|\<na\>)']), ...
    'Print the out-of-range query and its NaN/NA result without extrapolation.');
end
function outputVector(output,label,expected)
  lines=strsplit(lower(output),sprintf('\n')); found=false;
  for k=1:numel(lines)
    if ~has(lines{k},label), continue; end
    values=numbers(lines{k}); scale=1; j=k+1;
    % Native disp can use a shared exponent, blank lines, and column headers.
    while numel(values)<numel(expected) && j<=numel(lines)
      line=strtrim(lines{j}); j=j+1;
      if isempty(line) || has(line,'^columns? '), continue; end
      if ~has(line,'^[-+0-9.]'), break; end
      nums=numbers(line);
      if has(line,'\*\s*$') && numel(nums)==1, scale=nums(1);
      else, values=[values scale*nums]; end
    end
    if same(values,expected,max(5e-4,abs(scale)*5e-5)), found=true; break; end
  end
  require(found,'Print each coefficient and residual vector with its model label, in order; default disp precision is sufficient.');
end
function decision(output,label,meets)
  lines=strsplit(lower(output),sprintf('\n')); found=false;
  for k=1:numel(lines)
    line=lines{k};
    if ~has(line,label) || ~has(line,'57') || ~has(line,'l\s*/\s*min'), continue; end
    negative=has(line,'does not meet|not meet|fails?|below|insufficient');
    positive=has(line,'meets?|passes?|satisf');
    if (meets && positive && ~negative) || (~meets && negative), found=true; break; end
  end
  require(found,'Print each model''s decision against 57 L/min: linear meets; quadratic does not. Branches, unrounded comparisons and status checks also need source review.');
end
function n=numbers(text)
  tokens=regexp(text,'(?<![a-z])[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?','match');
  n=cellfun(@str2double,tokens);
end
function value=textValue(value)
  if iscell(value), value=strjoin(value(:)',' '); end
  if ~ischar(value), value=''; elseif size(value,1)>1, value=strjoin(cellstr(value)',' '); end
end
function yes=has(text,pattern), yes=~isempty(regexp(text,pattern,'once')); end
function require(yes,message), if ~yes, error('%s',message); end; end

function s=capture(filename)
% Reuse Unit 8's temporary numbered-figure isolation. Never rewrite saved code.
  oldDir=pwd(); oldPath=path(); scratch=tempname(); mkdir(scratch);
  before=findall(0,'type','figure'); visibility=cell(size(before));
  currentFigure=get(0,'currentfigure');
  for k=1:numel(before), visibility{k}=get(before(k),'handlevisibility'); set(before(k),'handlevisibility','off'); end
  visible=get(0,'defaultfigurevisible'); set(0,'defaultfigurevisible','off');
  cleanup=onCleanup(@() restoreCapture(oldDir,oldPath,scratch,before,visibility,visible,currentFigure));
  [~,name,ext]=fileparts(filename); name=[name ext];
  writeText(fullfile(scratch,name),fileread(filename));
  % Give each test copy its own numbered figures, preserving existing plots.
  % The pinned Plotly toolkit requires ordinary positive integer figure handles.
  setappdata(0,'u09_native_figure',@figure);
  setappdata(0,'u09_figure_ids',[]); setappdata(0,'u09_figure_handles',[]);
  setappdata(0,'u09_figure_next',max([0;before(:)])+1000);
  figureWrapper=sprintf(['function h=figure(varargin)\n' ...
    'native=getappdata(0,''u09_native_figure'');\n' ...
    'ids=getappdata(0,''u09_figure_ids''); handles=getappdata(0,''u09_figure_handles'');\n' ...
    'if nargin>=1 && isnumeric(varargin{1}) && isscalar(varargin{1}) && varargin{1}>0 && varargin{1}==fix(varargin{1})\n' ...
    ' idx=find(ids==varargin{1},1);\n' ...
    ' if ~isempty(idx) && ishandle(handles(idx)), h=native(handles(idx),varargin{2:end}); return; end\n' ...
    ' if any(handles==varargin{1}), h=native(varargin{:}); return; end\n' ...
    ' requested=varargin{1}; props=varargin(2:end);\n' ...
    'else, requested=NaN; props=varargin; end\n' ...
    'number=getappdata(0,''u09_figure_next'')+1; while ishandle(number), number=number+1; end\n' ...
    'h=native(number,props{:}); ids(end+1)=requested; handles(end+1)=h;\n' ...
    'setappdata(0,''u09_figure_ids'',ids); setappdata(0,''u09_figure_handles'',handles);\n' ...
    'setappdata(0,''u09_figure_next'',number);\nend\n']);
  writeText(fullfile(scratch,'figure.m'),figureWrapper);
  state=projectState(scratch);
  s=executeScript(fullfile(scratch,name));
  s.figures={}; s.graphicsError='';
  try
    drawnow;
    figures=setdiff(findall(0,'type','figure'),before);
    for k=1:numel(figures)
      axesHandles=findall(figures(k),'type','axes'); a={};
      for j=1:numel(axesHandles)
        if any(strcmpi(get(axesHandles(j),'tag'),{'legend','colorbar'})), continue; end
        a{end+1}=readAxes(axesHandles(j));
      end
      s.figures{end+1}=a;
    end
  catch err, s.graphicsError=err.message; end
  clear state;
end
function restoreCapture(oldDir,oldPath,scratch,before,visibility,visible,currentFigure)
  own=setdiff(findall(0,'type','figure'),before);
  if ~isempty(own)
    if strcmp(graphics_toolkit(own(1)),'plotly')
      set(own,'visible','off','handlevisibility','off');
      old=getappdata(0,'u09_owned_figures');
      setappdata(0,'u09_owned_figures',[old(:);own(:)]);
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
  clear figure;
  if isappdata(0,'u09_calls'), rmappdata(0,'u09_calls'); end
  for key={'u09_native_figure','u09_figure_ids','u09_figure_handles','u09_figure_next'}
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
  clear figure;
end
function restoreState(oldDir,oldPath)
  cd(oldDir); engr183.restorePathQuietly(oldPath); clear figure;
end
function writeText(filename,text)
  fid=fopen(filename,'wb'); require(fid>=0,['Cannot create temporary check file: ' filename]);
  cleanup=onCleanup(@() fclose(fid)); fwrite(fid,text);
end
function s=executeScript(scriptPath)
% Assign all capture locals after execution: student clear remains unmodified.
  try, output=evalc('source(scriptPath);'); failure='';
  catch err
    output=''; failure=err.message;
    for frame=1:numel(err.stack)
      [~,name,ext]=fileparts(err.stack(frame).file);
      if any(strcmp(name,{'U09_GP09_Cooling','U09_APA09_Pump'}))
        failure=[failure sprintf(' [raised in %s%s, line %d]',name,ext,err.stack(frame).line)];
        break;
      end
    end
  end
  failure=regexprep(failure,'[^\s:]*[\\/](U09_GP09_Cooling|U09_APA09_Pump)\.m','$1.m');
  s=struct('ok',isempty(failure),'error',failure,'output',output,'vars',struct());
  names={'t','T','tfine','target_C','T5','T_queries','T14_linear', ...
    'p1','p2','r1','r2','rmse1','rmse2','Tmodel','f','tol_min', ...
    't_bisect','t_root','T_check','solver_difference', ...
    'Q','H','Q_query','Q_required','Q_outside','Qfine','Hsystem','tol_Q', ...
    'H35','H80_interp','p_linear','p_quad','r_linear','r_quad','rmse_linear','rmse_quad', ...
    'p_selected','Hpump','F','a0','b0','Q_bisect','Q_root','H_pump_root','H_system_root', ...
    'Q_linear','Q_quad','H80_linear','H80_quad', ...
    'a','b','half_width','iterations','root_residual','exitflag','max_iter'};
  for k=1:numel(names)
    if exist(names{k},'var'), s.vars.(names{k})=eval(names{k}); end
  end
end
function a = readAxes(h)
  a.position = getpixelposition(h, true);
  a.xlim = get(h, 'xlim'); a.ylim = get(h, 'ylim');
  a.title = textValue(get(get(h, 'title'), 'string'));
  a.xlabel = textValue(get(get(h, 'xlabel'), 'string'));
  a.ylabel = textValue(get(get(h, 'ylabel'), 'string'));
  a.grid = strcmp(get(h, 'xgrid'), 'on') && strcmp(get(h, 'ygrid'), 'on');
  a.lines = {};
  handles = findall(h, 'type', 'line');
  for k = 1:numel(handles)
    l = get(handles(k));
    a.lines{end+1} = struct('handle', handles(k), 'x', l.xdata, 'y', l.ydata, ...
      'linestyle', l.linestyle, 'marker', l.marker, 'color', l.color, 'visible', l.visible);
  end
  a.legendHandles = []; a.legendLabels = {}; a.legendAvailable = true;
  legends = findall(ancestor(h, 'figure'), 'type', 'axes', 'tag', 'legend');
  for k = 1:numel(legends)
    if ~strcmp(get(legends(k), 'visible'), 'on'), continue; end
    peers = getappdata(legends(k), '__peer_objects__');
    if isempty(peers)
      % Legacy gnuplot legend stores plotted objects in userdata.
      info = get(legends(k), 'userdata');
      if isstruct(info) && isfield(info, 'handles'), peers = info.handles; end
    end
    if isempty(peers), a.legendAvailable = false; continue; end
    belongs = arrayfun(@(p) isequal(ancestor(p, 'axes'), h), peers);
    if ~any(belongs), continue; end
    strings = get(legends(k), 'string');
    if ischar(strings), strings = cellstr(strings); end
    if numel(peers) ~= numel(strings), a.legendAvailable = false; continue; end
    peers = peers(belongs); strings = strings(belongs);
    a.legendHandles = [a.legendHandles; peers(:)];
    a.legendLabels = [a.legendLabels; strings(:)];
  end
end

