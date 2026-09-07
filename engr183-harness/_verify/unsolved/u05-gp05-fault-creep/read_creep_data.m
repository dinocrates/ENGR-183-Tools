function creep = read_creep_data(filename)
  % READ_CREEP_DATA Read and validate a numeric USGS creepmeter file.

  % TODO 1: Verify filename is a character vector and open it for reading.
  % If fopen returns -1, raise an informative error. Close the file after
  % the check so dlmread can read it by name.

  % TODO 2: Read the whitespace-delimited numeric file with dlmread.

  % TODO 3: Require at least three columns. Ignore any columns after the
  % third; USGS documentation allows an optional fourth column.

  % TODO 4: Separate year, day_of_year, and slip_mm. Validate that years
  % are positive integers, days are integers from 1 through 366, and all
  % slip values are finite.

  % TODO 5: Return a structure with source_file, year, day_of_year,
  % slip_mm, and valid_mask fields. Use column vectors.

  creep = struct();
end
