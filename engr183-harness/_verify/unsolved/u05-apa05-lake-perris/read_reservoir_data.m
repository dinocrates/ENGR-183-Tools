function data = read_reservoir_data(filename)
  % READ_RESERVOIR_DATA Parse and audit the Lake Perris CDEC CSV file.

  % TODO 1: Validate filename, open the file for reading, and check fid.

  % TODO 2: Read the header with fgetl. Confirm it is not empty.

  % TODO 3: Use textscan to parse nine comma-delimited columns:
  % text, text, number, text, text, text, number, text, text.
  % Close the file after reading.

  % TODO 4: Move the parsed columns into a structure with these fields:
  % station_id, duration, sensor_number, sensor_type, date_time,
  % observation_time, storage_af, data_flag, units.

  % TODO 5: Convert the first eight characters of each observation_time
  % value to a numeric YYYYMMDD date_code.

  % TODO 6: Create valid_mask. A valid Lake Perris storage row has station
  % PRR, sensor 15, sensor type STORAGE, units AF, a blank data flag, a
  % finite nonnegative storage value, and a finite date code.

  data = struct();
end
