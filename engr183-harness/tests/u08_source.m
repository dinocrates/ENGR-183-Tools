function code = u08_source(source)
% Replace comments/literals with spaces, preserving offsets and line breaks.
% Small MATLAB lexer for technique/fixture checks, not a semantic proof.
  code = source; i = 1; n = numel(source); block = false;
  while i <= n
    if block
      if i<n && strcmp(source(i:i+1),'%}'), code(i:i+1)='  '; i=i+2; block=false;
      else
        if source(i)~=char(10) && source(i)~=char(13), code(i)=' '; end
        i=i+1;
      end
    elseif source(i)=='%' || source(i)=='#'
      if i<n && source(i)=='%' && source(i+1)=='{'
        code(i:i+1)='  '; i=i+2; block=true;
      else
        while i<=n && source(i)~=char(10), code(i)=' '; i=i+1; end
      end
    elseif source(i)==char(34) || source(i)==char(39)
      quote=source(i); previous=i-1;
      % An immediately adjacent expression terminator denotes transpose.
      transpose=quote==char(39) && previous>=1 && ...
        ~isempty(regexp(source(previous),'[\w\)\]\}.]','once'));
      if transpose, i=i+1; continue; end
      code(i)=' '; i=i+1;
      while i<=n
        c=source(i); code(i)=' '; i=i+1;
        if c==quote
          if i<=n && source(i)==quote, code(i)=' '; i=i+1;
          else, break; end
        end
      end
    else, i=i+1;
    end
  end
end
