function __engr183_legend_links__(h, ~, lsn)
  % Each legend icon can mirror several properties of its plotted object.
  % Collect all the links instead of overwriting DeleteFcn for each one.
  listeners = getappdata(h, '__engr183_cleanup__');
  if nargin == 3
    if isempty(listeners), listeners = {}; endif
    listeners{end+1} = lsn;
    setappdata(h, '__engr183_cleanup__', listeners);
    set(h, 'deletefcn', @__engr183_legend_links__);
  else
    for ii = 1:numel(listeners)
      if ishghandle(listeners{ii}{1})
        dellistener(listeners{ii}{:});
      endif
    endfor
  endif
endfunction
