function [x, residual, condition_number] = solve_checked_system(A, b)
% SOLVE_CHECKED_SYSTEM Solve a finite, real, square linear system.
% A is n-by-n; b is n-by-1. Units are set by the caller's model.
% A full-rank result can still be sensitive: inspect condition_number.

    % Supplied input checks: keep these lines.
    assert(isnumeric(A) && isreal(A) && ismatrix(A) && ~isempty(A), ...
        'A must be a nonempty real numeric matrix.');
    assert(isnumeric(b) && isreal(b) && ismatrix(b), ...
        'b must be a real numeric column vector.');
    [n_rows, n_cols] = size(A);
    assert(n_rows == n_cols, 'A must be square.');
    assert(isequal(size(b), [n_rows 1]), ...
        'b must be a column with one entry per equation.');
    assert(all(isfinite(A(:))) && all(isfinite(b(:))), ...
        'A and b must contain only finite values.');

    % TODO 2: Reject rank(A) < n_cols with a clear error message.
    % Then calculate x with backslash, residual = A*x - b,
    % and condition_number = cond(A). Return all three outputs.
end
