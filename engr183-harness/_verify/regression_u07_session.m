function regression_u07_session()
% GP -> APA -> GP, helper edits, failure/correction; preserve incoming work.
  here = fileparts(mfilename('fullpath')); root = fileparts(here);
  config = jsondecode(fileread(fullfile(here,'u07-cases.json')));
  targets = {}; originals = {}; starters = {};
  for kind = {'gp','apa'}
    c = config.(kind{1});
    for file = {c.file,'solve_checked_system.m'}
      targets{end+1} = fullfile(root,'assignments',c.id,file{1});
      originals{end+1} = fileread(targets{end});
      starters{end+1} = fileread(fullfile(here,'unsolved',c.id,file{1}));
    end
  end
  cleanup = onCleanup(@() restoreFiles(targets,originals));
  restoreFiles(targets,starters);
  check(config.gp.id,2); check(config.apa.id,3); check(config.gp.id,2);
  % Do NOT clear the helper here: the checker's explicit invalidation is tested.
  write(targets{2},starters{4}); check(config.gp.id,3);
  write(targets{2},strrep(starters{4},'x = A\b;','x = [1;2;3];'));
  check(config.gp.id,2); check(config.apa.id,3);
  write(targets{2},starters{4}); check(config.gp.id,3);
  write(targets{2},starters{2}); check(config.gp.id,2);
  fprintf('PASS same session: GP -> APA -> GP, edited helper, failing and corrected helper.\n');
end
function check(id,score)
  report = evalc('r = engr183.runTests(id);');
  assert(sum([r.earned])==score,report);
end
function write(target,content)
  fid = fopen(target,'wb'); assert(fid>=0); fwrite(fid,content); fclose(fid);
end
function restoreFiles(targets,contents)
  for j = 1:numel(targets), write(targets{j},contents{j}); end
  clear solve_checked_system;
end
