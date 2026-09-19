% The WASM kernel defers beingdeleted listeners until drawnow, after their
% objects are gone. Use synchronous DeleteFcn cleanup for the legend and its
% icons. Keep the rest of the bundled Octave 10.3.0 implementation unchanged.
__engr183_legend_source__ = fileread(which('legend'));
__engr183_patches__ = {
  'addlistener (hl, "beingdeleted", @delete_legend_cb);', ...
  'set (hl, "deletefcn", {@__engr183_delete_legend__, get(hl, "deletefcn")});', 1;
  'addlistener (h2, "beingdeleted", @(~, ~) dellistener (lsn{:}));', ...
  '__engr183_legend_links__ (h2, [], lsn);', 1;
  'addlistener (hicon, "beingdeleted", @(~, ~) dellistener (lsn{:}));', ...
  '__engr183_legend_links__ (hicon, [], lsn);', 2;
};
for __engr183_i__ = 1:rows(__engr183_patches__)
  % Detect upstream changes during kernel upgrades instead of silently
  % shipping an incomplete patch. The vendored archive is never modified.
  assert(numel(strfind(__engr183_legend_source__, __engr183_patches__{__engr183_i__, 1})) ...
    == __engr183_patches__{__engr183_i__, 3}, ...
    'Browser legend cleanup patch does not match the bundled Octave version');
  __engr183_legend_source__ = strrep(__engr183_legend_source__, ...
    __engr183_patches__{__engr183_i__, 1}, __engr183_patches__{__engr183_i__, 2});
endfor
__engr183_fid__ = fopen('/tmp/engr183-graphics/legend.m', 'w');
fputs(__engr183_fid__, __engr183_legend_source__);
fclose(__engr183_fid__);
clear __engr183_fid__ __engr183_legend_source__ __engr183_patches__ __engr183_i__;
