function __engr183_delete_legend__(hl, event, original)
  % Equivalent to legend.m's reset_cb/delete_legend_cb, but executed by
  % DeleteFcn while the handle is valid. Keep this in its own file: the WASM
  % kernel can lose legend's private function scope during legend('off').
  listeners = getappdata(hl, '__listeners__');
  for ii = 1:numel(listeners)
    if ishghandle(listeners{ii}{1})
      dellistener(listeners{ii}{:});
    endif
  endfor
  hax = getappdata(hl, '__axes_handle__');
  for h = hax(:)'
    if ~ishghandle(h) || strcmp(get(h, 'beingdeleted'), 'on'), continue; endif
    units = get(h, 'units');
    set(h, 'units', getappdata(hl, '__original_units__'), ...
        'looseinset', getappdata(hl, '__original_looseinset__'), ...
        'units', units, '__legend_handle__', []);
  endfor
  % Preserve a user callback supplied when the legend was created.
  if iscell(original) && ~isempty(original)
    feval(original{1}, hl, event, original{2:end});
  elseif isa(original, 'function_handle')
    original(hl, event);
  elseif ischar(original) && ~isempty(original)
    evalin('base', original);
  endif
endfunction
