function M = readmatrix(filename, varargin)
%READMATRIX  Read numeric data from a delimited text file (MATLAB-compatible).
%
%   M = READMATRIX(FILENAME) reads FILENAME -- a .csv/.txt/.tsv/.dat file --
%   and returns its contents as a numeric matrix. The delimiter is
%   auto-detected (comma, tab, semicolon, or runs of whitespace), and a
%   single leading header row is auto-detected and skipped if the first
%   line isn't numeric. A field that can't be parsed as a number becomes
%   NaN, same as real MATLAB.
%
%       data = readmatrix('readings.csv');
%       data = readmatrix(engr183.data('readings.csv'));   % bundled data
%
%   Name-value options (a subset of real MATLAB's):
%
%   'NumHeaderLines', N   Skip exactly N lines before reading data,
%                         instead of auto-detecting a header row.
%
%   'Delimiter', DELIM    Use DELIM instead of auto-detecting one. DELIM
%                         is a single character, or one of the names
%                         'comma', 'tab', 'semicolon', 'space'.
%
%   'Range', RANGE        Read only part of the file. RANGE is relative
%                         to the data (after any header row is removed),
%                         and can be:
%                           - [STARTROW STARTCOL]
%                           - [STARTROW STARTCOL ENDROW ENDCOL]
%                           - an Excel-style reference, e.g. 'A2' or
%                             'B2:D10'
%
%   'OutputType', TYPE    'double' (default) or 'string'. 'string'
%                         returns every field as text with no numeric
%                         conversion. Other MATLAB OutputType values
%                         (single, int32, ...) are not supported here.
%
%   'TreatAsMissing', TOK Treat each string in TOK (a single string, or
%                         a cell array of strings) as a missing value,
%                         becoming NaN, in addition to empty fields --
%                         for example 'TreatAsMissing', 'NA'.
%
%   Comma/semicolon/tab-delimited fields may be double-quoted (so a
%   quoted field can itself contain the delimiter); doubled quotes
%   ("") inside a quoted field decode to a single ". This does not read
%   spreadsheet (.xlsx) files -- only delimited text.
%
%   This is a course-provided compatibility function: real MATLAB, and
%   desktop Octave with the io package installed, both ship a
%   READMATRIX natively. This course's environments (the browser
%   Playground and the plain Octave install students use locally) don't
%   have that package, so ENGR-183 ships this version instead, kept
%   identical in both places -- see engr183-harness/compat/.

  if nargin < 1 || ~ischar(filename) || isempty(filename)
    error('engr183:readmatrix:badFile', ...
          'Give the file name as text, for example:\n    readmatrix(''data.csv'')');
  end
  if exist(filename, 'file') ~= 2
    error('engr183:readmatrix:notFound', 'File not found: %s', filename);
  end

  opts = parseOptions(varargin);

  rawLines = readAllLines(filename);
  while ~isempty(rawLines) && isempty(strtrim(rawLines{end}))
    rawLines(end) = [];
  end
  if isempty(rawLines)
    M = [];
    return;
  end

  delim = resolveDelimiter(opts, rawLines);
  nHeader = resolveHeaderLines(opts, rawLines, delim);
  if nHeader >= numel(rawLines)
    M = [];
    return;
  end

  cellData = toCellMatrix(rawLines(nHeader+1:end), delim);
  cellData = applyRange(cellData, opts);

  if strcmpi(opts.OutputType, 'string')
    M = cellData;
  else
    M = toNumeric(cellData, opts.TreatAsMissing);
  end
end

% ---------------------------------------------------------------------
function rawLines = readAllLines(filename)
  fid = fopen(filename, 'r');
  if fid < 0
    error('engr183:readmatrix:openFailed', 'Could not open file: %s', filename);
  end
  rawLines = {};
  tline = fgetl(fid);
  while ischar(tline)
    rawLines{end+1} = tline; %#ok<AGROW>
    tline = fgetl(fid);
  end
  fclose(fid);
end

% ---------------------------------------------------------------------
function opts = parseOptions(args)
  opts = struct('NumHeaderLines', [], 'Delimiter', '', 'Range', [], ...
                'OutputType', 'double', 'TreatAsMissing', {{}});
  if mod(numel(args), 2) ~= 0
    error('engr183:readmatrix:badOptions', ...
          'Options must be given as name-value pairs, e.g. ''NumHeaderLines'', 1.');
  end
  validNames = {'NumHeaderLines', 'Delimiter', 'Range', 'OutputType', 'TreatAsMissing'};
  for k = 1:2:numel(args)
    name = args{k};
    if ~ischar(name)
      error('engr183:readmatrix:badOptions', 'Option names must be text.');
    end
    idx = find(strcmpi(validNames, name), 1);
    if isempty(idx)
      error('engr183:readmatrix:badOptions', ...
            ['Unrecognized option ''%s''. This course''s readmatrix supports: ' ...
             'NumHeaderLines, Delimiter, Range, OutputType, TreatAsMissing.'], name);
    end
    opts.(validNames{idx}) = args{k+1};
  end
  if ischar(opts.TreatAsMissing)
    opts.TreatAsMissing = {opts.TreatAsMissing};
  end
  if ~ischar(opts.OutputType) || ~any(strcmpi(opts.OutputType, {'double', 'string'}))
    error('engr183:readmatrix:badOptions', ...
          ['This course''s readmatrix supports OutputType ''double'' (default) ' ...
           'or ''string'' only.']);
  end
end

% ---------------------------------------------------------------------
function delim = resolveDelimiter(opts, rawLines)
  if ~isempty(opts.Delimiter)
    delim = normalizeDelimiterName(opts.Delimiter);
    return;
  end
  candidates = {',', sprintf('\t'), ';'};
  sampleLines = rawLines(1:min(5, numel(rawLines)));
  delim = '';
  bestScore = 0;
  for c = 1:numel(candidates)
    d = candidates{c};
    counts = zeros(1, numel(sampleLines));
    for L = 1:numel(sampleLines)
      counts(L) = numel(splitDelimLine(sampleLines{L}, d)) - 1;
    end
    if counts(1) > 0 && all(counts == counts(1)) && counts(1) > bestScore
      bestScore = counts(1);
      delim = d;
    end
  end
  % delim stays '' (whitespace-run splitting) if nothing consistent was found
end

function d = normalizeDelimiterName(raw)
  if ~ischar(raw)
    error('engr183:readmatrix:badOptions', 'Delimiter must be text.');
  end
  switch lower(strtrim(raw))
    case 'comma'
      d = ',';
    case 'tab'
      d = sprintf('\t');
    case 'semicolon'
      d = ';';
    case 'space'
      d = ' ';
    otherwise
      d = raw;
  end
end

% ---------------------------------------------------------------------
function n = resolveHeaderLines(opts, rawLines, delim)
  if ~isempty(opts.NumHeaderLines)
    n = opts.NumHeaderLines;
    return;
  end
  fields = splitDelimLine(rawLines{1}, delim);
  n = 0;
  for k = 1:numel(fields)
    f = strtrim(fields{k});
    if isempty(f)
      continue;
    end
    if isnan(str2double(f))
      n = 1;
      break;
    end
  end
end

% ---------------------------------------------------------------------
% Quote-aware split of one line on a single-character delimiter. delim
% == '' splits on runs of whitespace instead (and isn't quote-aware --
% whitespace-delimited files in this course don't use quoting).
function fields = splitDelimLine(line, delim)
  if isempty(delim)
    trimmed = strtrim(line);
    if isempty(trimmed)
      fields = {''};
    else
      fields = regexp(trimmed, '\s+', 'split');
    end
    return;
  end
  if numel(delim) > 1
    fields = strsplit(line, delim);
    return;
  end

  fields = {};
  buf = '';
  inQuotes = false;
  n = numel(line);
  i = 1;
  while i <= n
    c = line(i);
    if inQuotes
      if c == '"'
        if i < n && line(i + 1) == '"'
          buf = [buf '"']; %#ok<AGROW>
          i = i + 1;
        else
          inQuotes = false;
        end
      else
        buf = [buf c]; %#ok<AGROW>
      end
    else
      if c == '"' && isempty(buf)
        inQuotes = true;
      elseif c == delim
        fields{end + 1} = buf; %#ok<AGROW>
        buf = '';
      else
        buf = [buf c]; %#ok<AGROW>
      end
    end
    i = i + 1;
  end
  fields{end + 1} = buf;
end

% ---------------------------------------------------------------------
function cellData = toCellMatrix(dataLines, delim)
  n = numel(dataLines);
  rows = cell(1, n);
  maxCols = 0;
  for i = 1:n
    rows{i} = splitDelimLine(dataLines{i}, delim);
    maxCols = max(maxCols, numel(rows{i}));
  end
  cellData = cell(n, maxCols);
  for i = 1:n
    f = rows{i};
    for j = 1:maxCols
      if j <= numel(f)
        cellData{i, j} = f{j};
      else
        cellData{i, j} = '';
      end
    end
  end
end

% ---------------------------------------------------------------------
function out = applyRange(cellData, opts)
  if isempty(opts.Range)
    out = cellData;
    return;
  end
  [nRows, nCols] = size(cellData);
  spec = opts.Range;
  if isnumeric(spec)
    if numel(spec) == 2
      r0 = spec(1); c0 = spec(2); r1 = nRows; c1 = nCols;
    elseif numel(spec) == 4
      r0 = spec(1); c0 = spec(2); r1 = spec(3); c1 = spec(4);
    else
      error('engr183:readmatrix:badRange', ...
            ['Numeric ''Range'' must have 2 elements [startRow startCol] ' ...
             'or 4 elements [startRow startCol endRow endCol].']);
    end
  elseif ischar(spec)
    [r0, c0, r1, c1] = parseExcelRange(spec, nRows, nCols);
  else
    error('engr183:readmatrix:badRange', ...
          'Range must be a numeric vector or an Excel-style range string.');
  end

  r0 = max(r0, 1); c0 = max(c0, 1);
  r1 = min(r1, nRows); c1 = min(c1, nCols);
  if r0 > r1 || c0 > c1
    error('engr183:readmatrix:badRange', 'Range is empty or out of bounds for this file.');
  end
  out = cellData(r0:r1, c0:c1);
end

function [r0, c0, r1, c1] = parseExcelRange(spec, nRows, nCols)
  parts = strsplit(strtrim(spec), ':');
  [r0, c0] = parseExcelCell(parts{1});
  if numel(parts) > 1
    [r1, c1] = parseExcelCell(parts{2});
  else
    r1 = nRows; c1 = nCols;
  end
end

function [row, col] = parseExcelCell(ref)
  tok = regexp(strtrim(ref), '^([A-Za-z]+)(\d+)$', 'tokens', 'once');
  if isempty(tok)
    error('engr183:readmatrix:badRange', ...
          'Could not parse Excel-style cell reference ''%s''.', ref);
  end
  col = excelColToNum(tok{1});
  row = str2double(tok{2});
end

function n = excelColToNum(letters)
  letters = upper(letters);
  n = 0;
  for k = 1:numel(letters)
    n = n * 26 + (double(letters(k)) - double('A') + 1);
  end
end

% ---------------------------------------------------------------------
function M = toNumeric(cellData, missing)
  [nRows, nCols] = size(cellData);
  M = nan(nRows, nCols);
  for i = 1:nRows
    for j = 1:nCols
      raw = strtrim(cellData{i, j});
      if isempty(raw) || any(strcmp(raw, missing))
        M(i, j) = NaN;
      else
        M(i, j) = str2double(raw);
      end
    end
  end
end
