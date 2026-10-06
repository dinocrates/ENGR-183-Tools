function __engr183_bar_snapshot__(ax)
% Publish native bar patch geometry; do not create proxy graphics objects.
  persistent publishing = false;
  if publishing || ~ishghandle(ax) || strcmp(get(ax,'beingdeleted'),'on'), return; end
  fig=ancestor(ax,'figure');
  if isempty(fig) || strcmp(get(fig,'beingdeleted'),'on') || ~strcmp(graphics_toolkit(fig),'plotly'), return; end
  id=get(fig,'__plot_stream__'); if isempty(id), return; end
  unwind_protect
    publishing=true; entries={}; figpos=getpixelposition(fig);
    groups=findall(fig,'type','hggroup');
    for k=1:numel(groups)
      g=groups(k);
      if ~isprop(g,'bargroup') || strcmp(get(g,'beingdeleted'),'on') || strcmp(get(g,'visible'),'off'), continue; end
      a=ancestor(g,'axes'); if strcmp(get(a,'visible'),'off'), continue; end
      pos=getpixelposition(a,true);
      xd=[pos(1)-1,pos(1)-1+pos(3)]/figpos(3);
      yd=[pos(2)-1,pos(2)-1+pos(4)]/figpos(4);
      patches=findall(g,'type','patch');
      for j=1:numel(patches)
        p=patches(j);
        if strcmp(get(p,'beingdeleted'),'on') || strcmp(get(p,'visible'),'off'), continue; end
        x=get(p,'xdata'); y=get(p,'ydata');
        if size(x,1)~=4 || ~isequal(size(x),size(y)), continue; end
        horizontal=strcmp(get(g,'horizontal'),'on');
        if horizontal, tmp=x; x=y; y=tmp; end
        centers=(min(x,[],1)+max(x,[],1))/2; widths=max(x,[],1)-min(x,[],1);
        bases=y(1,:); heights=y(2,:)-y(1,:);
        orientation='v'; if horizontal, orientation='h'; end
        face=get(p,'facecolor'); edge=get(p,'edgecolor');
        if ischar(face) && strcmp(face,'none'), face='rgba(0,0,0,0)'; end
        % Flat color uses the axes palette when a scalar native color is absent.
        if ischar(face) && any(strcmp(face,{'flat','interp','auto'}))
          palette=get(a,'colororder'); face=palette(mod(k-1,size(palette,1))+1,:);
        end
        opacity=get(p,'facealpha'); if ~isnumeric(opacity), opacity=1; end
        lineWidth=get(p,'linewidth');
        if ischar(edge) && strcmp(edge,'none'), edge='rgba(0,0,0,0)'; lineWidth=0; end
        entries{end+1}=sprintf(['{"xDomain":%s,"yDomain":%s,"centers":%s,' ...
          '"widths":%s,"heights":%s,"bases":%s,"orientation":%s,' ...
          '"color":%s,"edgeColor":%s,"lineWidth":%.17g,"opacity":%.17g}'], ...
          numbers(xd),numbers(yd),numbers(centers),numbers(widths),numbers(heights),numbers(bases), ...
          quoted(orientation),quoted(color(face)),quoted(color(edge)),lineWidth,opacity);
      end
    end
    out=struct(); out.('application/vnd.engr183.plot-bars+json')= ...
      ['{"figureId":' quoted(id) ',"bars":[' strjoin(entries,',') ']}'];
    display_data(out);
  unwind_protect_cleanup
    publishing=false;
  end_unwind_protect
end
function result=numbers(values)
  parts=cell(1,numel(values));
  for k=1:numel(values)
    if isfinite(values(k)), parts{k}=sprintf('%.17g',values(k)); else, parts{k}='null'; end
  end
  result=['[' strjoin(parts,',') ']'];
end
function result=color(value)
  if isnumeric(value), result=sprintf('rgb(%d,%d,%d)',round(255*value));
  else, result=value; end
end
function result=quoted(value)
  value=strrep(value,char(92),[char(92) char(92)]);
  value=strrep(value,'"',[char(92) '"']);
  for code=0:31, value=strrep(value,char(code),sprintf('\\u%04x',code)); end
  result=['"' value '"'];
end
