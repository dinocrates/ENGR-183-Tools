function varargout = print(varargin)
% Browser-only PNG handoff: native Ghostscript is absent from this WASM build.
% Only the standard PNG filename/resolution form on Plotly figures is adapted.
% Other devices, options and invalid calls retain native print validation.
  native=getappdata(0,'__engr183_native_print__');
  args=varargin; h=get(0,'currentfigure');
  if ~isempty(args) && isnumeric(args{1}) && isscalar(args{1})
    h=args{1}; args=args(2:end);
  end
  supported=nargout==0 && ~isempty(h) && isfigure(h) && ...
    strcmp(graphics_toolkit(h),'plotly');
  filename=''; png=false;
  for k=1:numel(args)
    arg=args{k};
    if ~ischar(arg), supported=false;
    elseif strcmp(arg,'-dpng'), png=true;
    elseif ~isempty(regexp(arg,'^-r[0-9]+$','once'))
      % Browser camera resolution is controlled by the existing renderer.
    elseif isempty(filename) && ~isempty(regexpi(arg,'^[^-].*\.png$','once'))
      filename=arg;
    else, supported=false;
    end
  end
  if supported && png && ~isempty(filename)
    requireAxes=findall(h,'type','axes');
    if isempty(requireAxes), error('print: no axes object in figure to print'); end
    fprintf('PNG export: select this figure in Saved figures, use PNG/camera, and save as %s. No native PNG file was written.\n',filename);
    return;
  end
  if nargout, [varargout{1:nargout}]=native(varargin{:}); else, native(varargin{:}); end
end
