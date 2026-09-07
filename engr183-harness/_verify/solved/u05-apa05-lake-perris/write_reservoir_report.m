function write_reservoir_report(filename, data, summary)
  % WRITE_RESERVOIR_REPORT Write a labeled, human-readable audit report.
  %   write_reservoir_report(filename, data, summary) writes the results
  %   in SUMMARY (from summarize_reservoir) to the text file named by the
  %   character vector FILENAME, using the date codes in DATA to label the
  %   minimum, maximum, and largest-change rows.
  %
  %   The report states the data source, the valid and invalid record
  %   counts, the first and last storage, the net change, the minimum and
  %   maximum with their dates, the largest daily increase and decrease
  %   with their dates, the ending percent of operational capacity, and an
  %   interpretation boundary describing what the audit does and does not
  %   support.
  %
  %   Raises an error if FILENAME is not text or cannot be opened for
  %   writing.

  if ~ischar(filename) || isempty(filename)
    error('write_reservoir_report:badFilename', ...
          'filename must be a nonempty character vector.');
  end

  fid = fopen(filename, 'w');
  if fid == -1
    error('write_reservoir_report:cannotOpen', ...
          'Could not open ''%s'' for writing.', filename);
  end

  fprintf(fid, 'Lake Perris Reservoir Data Audit\n');
  fprintf(fid, 'Source rows read: %d\n', numel(data.storage_af));
  fprintf(fid, 'Valid records: %d\n', summary.valid_count);
  fprintf(fid, 'Invalid records: %d\n', summary.invalid_count);
  fprintf(fid, 'First storage (AF): %.0f\n', summary.first_storage_af);
  fprintf(fid, 'Last storage (AF): %.0f\n', summary.last_storage_af);
  fprintf(fid, 'Net storage change (AF): %.0f\n', summary.net_change_af);
  fprintf(fid, 'Minimum storage (AF): %.0f on %d\n', ...
          summary.min_storage_af, data.date_code(summary.min_index));
  fprintf(fid, 'Maximum storage (AF): %.0f on %d\n', ...
          summary.max_storage_af, data.date_code(summary.max_index));
  fprintf(fid, 'Largest daily increase (AF): %.0f on %d\n', ...
          summary.largest_increase_af, data.date_code(summary.largest_increase_index));
  fprintf(fid, 'Largest daily decrease (AF): %.0f on %d\n', ...
          summary.largest_decrease_af, data.date_code(summary.largest_decrease_index));
  fprintf(fid, 'Ending percent of operational capacity: %.2f\n', ...
          summary.ending_percent_capacity);
  fprintf(fid, ['Interpretation boundary: this audit summarizes published daily ' ...
                'storage observations. It supports statements about how the ' ...
                'recorded storage changed over the period; it does not support ' ...
                'reservoir operating decisions or any claim about water rights, ' ...
                'inflow, or release volumes.\n']);

  fclose(fid);
end
