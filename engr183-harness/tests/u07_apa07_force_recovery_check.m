function result = u07_apa07_force_recovery_check(criterion)
% Project-specific wrapper; each specification explicitly resets its snapshot.
  result = u07_system_check('apa', criterion);
end
