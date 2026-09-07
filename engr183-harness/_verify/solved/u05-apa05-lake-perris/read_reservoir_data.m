function data = read_reservoir_data(filename)
  % READ_RESERVOIR_DATA Parse and audit the Lake Perris CDEC CSV file.
  %   data = READ_RESERVOIR_DATA(filename) reads the California Data
  %   Exchange Center (CDEC) daily-storage CSV named by the character
  %   vector FILENAME and returns a structure describing every row.
  %
  %   The file has a one-line header followed by nine comma-delimited
  %   columns: station id, duration, sensor number, sensor type, date
  %   time, observation time, storage value in acre-feet, data flag, and
  %   units.
  %
  %   Fields of the returned structure:
  %     station_id, duration, sensor_type, date_time, observation_time,
  %     data_flag, units   cell arrays of character vectors, one per row
  %     sensor_number, storage_af                column vectors of numbers
  %     date_code          column vector: the first eight characters of
  %                        each date_time value as a YYYYMMDD number
  %     valid_mask         logical column vector, true for a row that is
  %                        Lake Perris (station PRR), sensor 15, sensor
  %                        type STORAGE, units AF, has a blank data flag,
  %                        and has a finite nonnegative storage value and
  %                        a finite date code
  %
  %   Raises an error if FILENAME is not text, cannot be opened, or has an
  %   empty header line.

  if ~ischar(filename) || isempty(filename)
    error('read_reservoir_data:badFilename', ...
          'filename must be a nonempty character vector.');
  end

  fid = fopen(filename, 'r');
  if fid == -1
    error('read_reservoir_data:cannotOpen', ...
          'Could not open ''%s'' for reading.', filename);
  end

  header = fgetl(fid);
  if ~ischar(header) || isempty(strtrim(header))
    fclose(fid);
    error('read_reservoir_data:emptyHeader', ...
          '''%s'' has no header line.', filename);
  end

  columns_cell = textscan(fid, '%s %s %f %s %s %s %f %s %s', ...
                          'Delimiter', ',');
  fclose(fid);

  data = struct();
  data.station_id = columns_cell{1};
  data.duration = columns_cell{2};
  data.sensor_number = columns_cell{3}(:);
  data.sensor_type = columns_cell{4};
  data.date_time = columns_cell{5};
  data.observation_time = columns_cell{6};
  data.storage_af = columns_cell{7}(:);
  data.data_flag = columns_cell{8};
  data.units = columns_cell{9};

  n = numel(data.storage_af);
  data.date_code = zeros(n, 1);
  for k = 1:n
    stamp = data.date_time{k};
    if numel(stamp) >= 8
      data.date_code(k) = str2double(stamp(1:8));
    else
      data.date_code(k) = NaN;
    end
  end

  is_prr = cellfun(@(s) strcmp(strtrim(s), 'PRR'), data.station_id);
  is_sensor_15 = data.sensor_number == 15;
  is_storage = cellfun(@(s) strcmp(strtrim(s), 'STORAGE'), data.sensor_type);
  is_af = cellfun(@(s) strcmp(strtrim(s), 'AF'), data.units);
  is_blank_flag = cellfun(@(s) isempty(strtrim(s)), data.data_flag);
  is_good_value = isfinite(data.storage_af) & data.storage_af >= 0;
  is_good_date = isfinite(data.date_code);

  data.valid_mask = is_prr(:) & is_sensor_15(:) & is_storage(:) & is_af(:) & ...
                    is_blank_flag(:) & is_good_value(:) & is_good_date(:);
end
