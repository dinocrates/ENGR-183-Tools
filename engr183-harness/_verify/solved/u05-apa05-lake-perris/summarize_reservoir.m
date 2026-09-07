function summary = summarize_reservoir(data, operational_capacity_af)
  % SUMMARIZE_RESERVOIR Summarize rows marked valid by read_reservoir_data.
  %   summary = SUMMARIZE_RESERVOIR(data, operational_capacity_af) uses
  %   only the rows of DATA whose valid_mask is true and returns a
  %   structure of results in acre-feet.
  %
  %   Every *_index field refers to a row of the original DATA structure,
  %   not to a position within the valid subset.
  %
  %   Fields of the returned structure:
  %     valid_count, invalid_count
  %     first_storage_af, last_storage_af, net_change_af
  %     min_storage_af, min_index, max_storage_af, max_index
  %     largest_increase_af, largest_increase_index
  %     largest_decrease_af, largest_decrease_index
  %     ending_percent_capacity   last valid storage as a percent of
  %                               operational_capacity_af
  %
  %   Raises an error if operational_capacity_af is not a positive finite
  %   scalar, if a required field is missing, or if fewer than two valid
  %   records are present.

  if ~isnumeric(operational_capacity_af) || ~isscalar(operational_capacity_af) || ...
     ~isfinite(operational_capacity_af) || operational_capacity_af <= 0
    error('summarize_reservoir:badCapacity', ...
          'operational_capacity_af must be a positive finite scalar.');
  end

  required = {'storage_af', 'valid_mask', 'date_code'};
  for k = 1:numel(required)
    if ~isfield(data, required{k})
      error('summarize_reservoir:missingField', ...
            'data is missing the ''%s'' field -- call read_reservoir_data first.', ...
            required{k});
    end
  end

  valid_rows = find(data.valid_mask);
  if numel(valid_rows) < 2
    error('summarize_reservoir:tooFewValid', ...
          'At least two valid records are required to summarize.');
  end

  storage = data.storage_af(valid_rows);

  summary = struct();
  summary.valid_count = numel(valid_rows);
  summary.invalid_count = numel(data.valid_mask) - summary.valid_count;

  summary.first_storage_af = storage(1);
  summary.last_storage_af = storage(end);
  summary.net_change_af = summary.last_storage_af - summary.first_storage_af;

  [summary.min_storage_af, min_pos] = min(storage);
  summary.min_index = valid_rows(min_pos);
  [summary.max_storage_af, max_pos] = max(storage);
  summary.max_index = valid_rows(max_pos);

  day_change = diff(storage);
  [summary.largest_increase_af, inc_pos] = max(day_change);
  summary.largest_increase_index = valid_rows(inc_pos + 1);
  [summary.largest_decrease_af, dec_pos] = min(day_change);
  summary.largest_decrease_index = valid_rows(dec_pos + 1);

  summary.ending_percent_capacity = ...
    summary.last_storage_af / operational_capacity_af * 100;
end
