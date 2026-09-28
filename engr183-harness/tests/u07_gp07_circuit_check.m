function result = u07_gp07_circuit_check(criterion)
% Project-specific wrapper; each specification explicitly resets its snapshot.
  result = u07_system_check('gp', criterion);
end
