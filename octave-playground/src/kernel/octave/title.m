function h = title(varargin)
  % Keep Octave's argument validation, axes selection, properties and handle.
  % The original function handle is saved before this browser-only shim is
  % added to the path. It remains bound to Octave's own title.m.
  native_title = getappdata(0, '__engr183_native_title__');
  ht = native_title(varargin{:});
  ax = get(ht, 'parent');

  if ~isappdata(ht, '__engr183_title_listener__')
    setappdata(ht, '__engr183_title_listener__', true);
    for prop = {'string', 'position', 'color', 'fontsize', 'fontweight', ...
                'fontangle', 'visible', 'interpreter'}
      addlistener(ht, prop{1}, @(~, ~) publish_titles(ax));
    end
  end
  if ~isappdata(ax, '__engr183_title_listener__')
    setappdata(ax, '__engr183_title_listener__', true);
    addlistener(ax, 'position', @(~, ~) publish_titles(ax));
    % plot()/cla can replace the title object itself, removing its listeners.
    % A subsequent axes child update must also refresh the title snapshot.
    addlistener(ax, 'children', @(~, ~) publish_titles(ax));
  end
  publish_titles(ax);
  if nargout > 0
    h = ht;
  end
end

function publish_titles(ax)
  persistent publishing = false;
  if publishing, return; end
  unwind_protect
    publishing = true;
    publish_snapshot(ax);
  unwind_protect_cleanup
    publishing = false;
  end_unwind_protect
end

function publish_snapshot(ax)
  if ~ishghandle(ax) || strcmp(get(ax, 'beingdeleted'), 'on'), return; end
  fig = ancestor(ax, 'figure');
  if isempty(fig) || ~strcmp(graphics_toolkit(fig), 'plotly'), return; end
  if strcmp(get(fig, 'beingdeleted'), 'on'), return; end
  id = get(fig, '__plot_stream__');
  if isempty(id), return; end

  % Send a complete snapshot so title('') and cleared axes remove old titles.
  annotations = {};
  figpos = getpixelposition(fig);
  axes_handles = findall(fig, 'type', 'axes');
  for k = 1:numel(axes_handles)
    a = axes_handles(k);
    t = get(a, 'title');
    if ~ishghandle(t) || strcmp(get(t, 'beingdeleted'), 'on'), continue; end
    str = get(t, 'string');
    if isempty(str) || strcmp(get(t, 'visible'), 'off'), continue; end
    if ischar(str), str = cellstr(str); end
    % Plotly annotations accept HTML. Escape literal text before adding breaks.
    str = strrep(str, '&', '&amp;');
    str = strrep(str, '<', '&lt;');
    str = strrep(str, '>', '&gt;');
    label = strjoin(str(:)', '<br>');
    if strcmp(get(t, 'fontweight'), 'bold'), label = ['<b>' label '</b>']; end
    if strcmp(get(t, 'fontangle'), 'italic'), label = ['<i>' label '</i>']; end
    pos = getpixelposition(a, true);
    rgb = round(255 * get(t, 'color'));
    % Paper coordinates keep titles above their axes when zooming/resizing.
    annotations{end + 1} = sprintf([ ...
      '{"text":%s,"xref":"paper","yref":"paper","x":%.17g,"y":%.17g,' ...
      '"xanchor":"center","yanchor":"bottom","yshift":4,"showarrow":false,' ...
      '"font":{"size":%.17g,"color":"rgb(%d,%d,%d)"}}'], ...
      json_string(label), (pos(1) - 1 + pos(3) / 2) / figpos(3), ...
      (pos(2) - 1 + pos(4)) / figpos(4), get(t, 'fontsize'), rgb);
  end
  out = struct();
  out.('application/vnd.engr183.plot-titles+json') = ...
    ['{"figureId":' json_string(id) ',"annotations":[' strjoin(annotations, ',') ']}'];
  display_data(out);
end

function quoted = json_string(value)
  % This WASM build has no RapidJSON/jsonencode support. Only strings need
  % escaping; the numeric fields above are generated with sprintf.
  value = strrep(value, char(92), [char(92) char(92)]);
  value = strrep(value, '"', [char(92) '"']);
  for code = 0:31
    value = strrep(value, char(code), sprintf('\\u%04x', code));
  end
  quoted = ['"' value '"'];
end
