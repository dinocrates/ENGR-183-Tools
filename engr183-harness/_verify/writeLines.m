function writeLines(path, lines)
%WRITELINES  Write a cell array of literal text lines to PATH, one per
%   line. Plain string writes -- none of LINES is ever passed through
%   sprintf/fprintf as a format string, so a stray '%' in a line (e.g. a
%   fixture's own fprintf call) is written byte-for-byte, not
%   reinterpreted.
%
%   Scratch-only, used by regression_*.m driver scripts to materialize
%   deliberately broken/edge-case fixture files without maintaining a
%   forest of tiny files on disk.

  fid = fopen(path, 'w');
  if fid < 0
    error('writeLines: could not open %s for writing.', path);
  end
  for i = 1:numel(lines)
    fwrite(fid, lines{i});
    fwrite(fid, sprintf('\n'));
  end
  fclose(fid);
end
