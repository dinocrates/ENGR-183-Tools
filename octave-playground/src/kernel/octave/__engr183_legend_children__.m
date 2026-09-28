function kids = __engr183_legend_children__(hl)
  % Legend markers must have visible handles for xeus-octave's renderer.
  % Keep Octave's original text/icon pairs for layout, reuse and outputs.
  % markertruesize is the native property identifying its auxiliary markers.
  kids = get(hl, 'children');
  kids = kids(! isprop(kids, 'markertruesize'));
end
