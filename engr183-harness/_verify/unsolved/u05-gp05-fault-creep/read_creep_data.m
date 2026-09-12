function creep = read_creep_data(filename)
  % READ_CREEP_DATA Import and validate a numeric USGS creepmeter file.

  % TODO 1: Verify that filename is a nonempty row character vector.
  % Raise an informative error when the input contract is not satisfied.

  % TODO 2: Import the complete numeric file with readmatrix.
  % Do not call fopen before readmatrix.
  % raw = readmatrix(filename);

  % TODO 3: Require a nonempty matrix with at least three columns.
  % USGS documentation allows an optional fourth column, so ignore all
  % columns after the third.

  % TODO 4: Extract year, day_of_year, and slip_mm from columns 1:3.
  % Require positive integer years, integer days from 1 through 366,
  % and finite slip values.

  % TODO 5: Return column vectors in a structure with these exact fields:
  % source_file, year, day_of_year, slip_mm, and valid_mask.
  % Because invalid records raise an error in this guided practice,
  % valid_mask should contain true for every returned record.

  creep = struct();
end
