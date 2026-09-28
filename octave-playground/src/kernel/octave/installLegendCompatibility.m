% The WASM kernel defers beingdeleted listeners until drawnow, after their
% objects are gone. Use synchronous DeleteFcn cleanup for the legend and its
% icons. The Plotly toolkit also skips handle-hidden legend marker objects.
% Expose those to the renderer while keeping them out of legend's own item
% bookkeeping, which expects only a text object and main icon per entry.
__engr183_legend_source__ = fileread(which('legend'));
__engr183_patches__ = {
  'addlistener (hl, "beingdeleted", @delete_legend_cb);', ...
  'set (hl, "deletefcn", {@__engr183_delete_legend__, get(hl, "deletefcn")});', 1;
  'addlistener (h2, "beingdeleted", @(~, ~) dellistener (lsn{:}));', ...
  '__engr183_legend_links__ (h2, [], lsn);', 1;
  'addlistener (hicon, "beingdeleted", @(~, ~) dellistener (lsn{:}));', ...
  '__engr183_legend_links__ (hicon, [], lsn);', 2;
  'hmarker = __go_line__ (hl, "handlevisibility", "off", ...', ...
  'hmarker = __go_line__ (hl, "handlevisibility", "on", ...', 1;
  'get (hl, "children")', '__engr183_legend_children__ (hl)', 3;
};
for __engr183_i__ = 1:rows(__engr183_patches__)
  % Detect upstream changes during kernel upgrades instead of silently
  % shipping an incomplete patch. The vendored archive is never modified.
  assert(numel(strfind(__engr183_legend_source__, __engr183_patches__{__engr183_i__, 1})) ...
    == __engr183_patches__{__engr183_i__, 3}, ...
    'Browser legend compatibility patch does not match the bundled Octave version');
  __engr183_legend_source__ = strrep(__engr183_legend_source__, ...
    __engr183_patches__{__engr183_i__, 1}, __engr183_patches__{__engr183_i__, 2});
endfor
__engr183_fid__ = fopen('/tmp/engr183-graphics/legend.m', 'w');
fputs(__engr183_fid__, __engr183_legend_source__);
fclose(__engr183_fid__);
clear __engr183_fid__ __engr183_legend_source__ __engr183_patches__ __engr183_i__;
