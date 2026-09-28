import titleSource from './octave/title.m?raw';
import installLegendCompatibility from './octave/installLegendCompatibility.m?raw';
import deleteLegend from './octave/__engr183_delete_legend__.m?raw';
import legendLinks from './octave/__engr183_legend_links__.m?raw';
import legendChildren from './octave/__engr183_legend_children__.m?raw';

function writeSource(name: string, source: string): string {
  const bytes = Array.from(new TextEncoder().encode(source));
  return [
    `__engr183_fid__ = fopen('/tmp/engr183-graphics/${name}.m', 'w');`,
    `fwrite(__engr183_fid__, uint8([${bytes.join(',')}]), 'uint8');`,
    `fclose(__engr183_fid__); clear __engr183_fid__;`,
  ].join('\n');
}

/** Install only in the browser kernel; desktop Octave needs no workaround. */
export function installGraphicsCode(): string {
  return [
    `setappdata(0, '__engr183_native_title__', @title);`,
    `mkdir('/tmp/engr183-graphics');`,
    writeSource('__engr183_delete_legend__', deleteLegend),
    writeSource('__engr183_legend_links__', legendLinks),
    writeSource('__engr183_legend_children__', legendChildren),
    installLegendCompatibility,
    writeSource('title', titleSource),
    // These intentional shadows should not produce student-facing warnings.
    `__engr183_warning__ = warning('query', 'Octave:shadowed-function');`,
    `warning('off', 'Octave:shadowed-function');`,
    `addpath('/tmp/engr183-graphics');`,
    `warning(__engr183_warning__.state, 'Octave:shadowed-function'); clear __engr183_warning__;`,
  ].join('\n');
}
