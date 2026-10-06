function varargout = bar(varargin)
% Preserve native MATLAB/Octave bar semantics and supplement browser rendering.
  native = getappdata(0, '__engr183_native_bar__');
  % Native update_data calls bar with two outputs to recalculate patch
  % coordinates. Preserve that non-plotting form without installing listeners.
  if nargout > 1
    [varargout{1:nargout}] = native(varargin{:});
    return;
  end
  handles = native(varargin{:});
  for k = 1:numel(handles)
    group = handles(k); ax = ancestor(group, 'axes');
    for prop = {'visible','xdata','ydata','basevalue','barwidth','barlayout'}
      addlistener(group, prop{1}, @(~,~) __engr183_bar_snapshot__(ax));
    end
    patches = findall(group, 'type', 'patch');
    for j = 1:numel(patches)
      for prop = {'xdata','ydata','facecolor','edgecolor','facealpha','linewidth','visible'}
        addlistener(patches(j), prop{1}, @(~,~) __engr183_bar_snapshot__(ax));
      end
    end
    if ~isappdata(ax, '__engr183_bar_listener__')
      setappdata(ax, '__engr183_bar_listener__', true);
      addlistener(ax, 'position', @(~,~) __engr183_bar_snapshot__(ax));
      addlistener(ax, 'children', @(~,~) __engr183_bar_snapshot__(ax));
    end
    __engr183_bar_snapshot__(ax);
  end
  if nargout, varargout{1} = handles; end
end
