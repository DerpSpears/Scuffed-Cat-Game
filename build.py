#!/usr/bin/env python3
"""Concatenate src/* into a single self-contained dist/index.html."""
import pathlib

root = pathlib.Path(__file__).parent
src = root / 'src'
dist = root / 'dist'
dist.mkdir(exist_ok=True)

top = (src / '00_shell_top.html').read_text()
# inline the base64 webfonts so dist/index.html stays fully offline
fonts_file = src / 'fonts.css'
fonts_css = fonts_file.read_text() if fonts_file.exists() else ''
if '/*FONTS*/' not in top:
    raise SystemExit('00_shell_top.html is missing the /*FONTS*/ placeholder')
top = top.replace('/*FONTS*/', fonts_css)
# NOTE: do not try to strip three.js' r150 deprecation console.warn - it is the
# first term of a comma expression that also contains the whole UMD wrapper.
three = (root / 'vendor' / 'three.min.js').read_text()

js_files = sorted(src.glob('*.js'))
parts = ['/* ==== %s ==== */\n%s' % (p.name, p.read_text()) for p in js_files]
game = '\n'.join(parts)

out = top + '\n<script>\n' + three + '\n</script>\n<script>\n' + game + '\n</script>\n</body>\n</html>\n'
target = dist / 'index.html'
target.write_text(out)
print('wrote %s  (%.1f KB total, game code %.1f KB, fonts %.1f KB, %d js files)'
      % (target, len(out) / 1024, len(game) / 1024, len(fonts_css) / 1024, len(js_files)))
