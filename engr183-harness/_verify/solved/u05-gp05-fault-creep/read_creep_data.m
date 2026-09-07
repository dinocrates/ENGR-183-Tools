function creep = read_creep_data(filename)
  % READ_CREEP_DATA Read and validate a numeric USGS creepmeter file.
  %   creep = READ_CREEP_DATA(filename) reads the whitespace-delimited
  %   daily creepmeter file named by the character vector FILENAME and
  %   returns a structure describing it.
  %
  %   The file has one record per line: year, day of year, and scaled
  %   surface-fault slip in millimeters. A fourth column is permitted by
  %   the USGS documentation and is ignored.
  %
  %   Fields of the returned structure (all column vectors):
  %     source_file   the FILENAME that was read
  %     year          integer calendar year, one per record
  %     day_of_year   integer day of year, 1 through 366
  %     slip_mm       surface-fault slip in millimeters, finite
  %     valid_mask    logical, true for every record that passed validation
  %
  %   Raises an error if FILENAME is not text, cannot be opened, has fewer
  %   than three columns, or contains a non-integer year, an out-of-range
  %   day of year, or a non-finite slip value.

  if ~ischar(filename) || isempty(filename)
    error('read_creep_data:badFilename', ...
          'filename must be a nonempty character vector.');
  end

  fid = fopen(filename, 'r');
  if fid == -1
    error('read_creep_data:cannotOpen', ...
          'Could not open ''%s'' for reading.', filename);
  end
  fclose(fid);

  raw = dlmread(filename);

  if columns(raw) < 3
    error('read_creep_data:tooFewColumns', ...
          '''%s'' must have at least three columns (year, day of year, slip).', ...
          filename);
  end

  year = raw(:, 1);
  day_of_year = raw(:, 2);
  slip_mm = raw(:, 3);

  if any(year <= 0) || any(year ~= round(year))
    error('read_creep_data:badYear', ...
          'Every year must be a positive integer.');
  end
  if any(day_of_year ~= round(day_of_year)) || ...
     any(day_of_year < 1) || any(day_of_year > 366)
    error('read_creep_data:badDayOfYear', ...
          'Every day of year must be an integer from 1 through 366.');
  end
  if ~all(isfinite(slip_mm))
    error('read_creep_data:badSlip', ...
          'Every slip value must be finite.');
  end

  creep = struct( ...
    'source_file', filename, ...
    'year', year(:), ...
    'day_of_year', day_of_year(:), ...
    'slip_mm', slip_mm(:), ...
    'valid_mask', true(numel(slip_mm), 1));
end
