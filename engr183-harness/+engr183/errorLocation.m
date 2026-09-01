function loc = errorLocation(err)
%ERRORLOCATION  A short " [raised in file.m, line N]" suffix identifying
%   which of the student's files an error came from.
%
%   ENGR183.ERRORLOCATION(ERR) inspects ERR.stack (as captured by a
%   try/catch) and returns a one-line suffix naming the innermost stack
%   frame that lives in an assignments/ folder -- a file the student
%   wrote -- and, when the call chain passes through more than one student
%   file, the next one out as well.
%
%   Harness internals (tests/, +engr183/) and eval/run wrapper frames are
%   skipped. A deliberate error() raised by a checker therefore has no
%   student frame and returns '', leaving that rubric line unchanged; only
%   an error that actually originated inside student code gets a location.
%
%   Examples:
%     ' [raised in tim_resistance.m, line 8]'
%     ' [raised in classify_temperature.m, line 5; called from analyze_thermal_log.m, line 4]'
%     ''   (error came from the checker, not from student code)
%
%   Used by ENGR183.RUNTESTS and the per-unit checkers so that
%     your code raised an error: operator +: nonconformant arguments (...)
%   becomes
%     your code raised an error: operator +: nonconformant arguments (...) [raised in classify_temperature.m, line 5]
%
%   Runs on every caught error, so it must never itself throw: the whole
%   body is guarded and any unexpected shape simply yields ''.
%
%   You should not need to call this yourself.

  loc = '';
  try
    stack = err.stack;
    if isempty(stack) || ~isfield(stack, 'file') || ~isfield(stack, 'line')
      return;
    end

    frames = {};
    for k = 1:numel(stack)
      f = stack(k);
      if isempty(f.file) || isempty(f.line)
        continue;
      end
      % Only frames in an assignments/ folder are student code. This also
      % excludes eval/run wrapper frames, whose "file" is a synthetic name
      % like 'cell[4]' with no path separators.
      if isempty(regexp(f.file, '[/\\]assignments[/\\]', 'once'))
        continue;
      end
      [~, base, ext] = fileparts(f.file);
      frames{end+1} = sprintf('%s%s, line %d', base, ext, f.line); %#ok<AGROW>
      if numel(frames) >= 2
        break;   % innermost frame plus one caller is enough context
      end
    end

    if isempty(frames)
      return;
    elseif numel(frames) == 1
      loc = sprintf(' [raised in %s]', frames{1});
    else
      loc = sprintf(' [raised in %s; called from %s]', frames{1}, frames{2});
    end
  catch
    loc = '';   % never let error reporting fail because of this helper
  end
end
