function __engr183_legend_patch__(icon)
  % Publish the real patch sample on its native legend axes. Keep the native
  % icon, peer_object, property links, and returned legend handles intact.
  ax = ancestor(icon, 'axes');
  for prop = {'xdata','ydata','facecolor','edgecolor','facealpha','linewidth','visible'}
    addlistener(icon, prop{1}, @(~,~) __engr183_bar_snapshot__(ax));
  end
  if ~isappdata(ax, '__engr183_patch_listener__')
    setappdata(ax, '__engr183_patch_listener__', true);
    addlistener(ax, 'position', @(~,~) __engr183_bar_snapshot__(ax));
    addlistener(ax, 'visible', @(~,~) __engr183_bar_snapshot__(ax));
  end
end
