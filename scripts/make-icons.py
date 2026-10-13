# Genera los PNG de public/ con las mismas formas que public/icon.svg (sin dependencias de SVG).
from PIL import Image, ImageDraw
import os
out = os.path.join(os.path.dirname(__file__), '..', 'public')
S = 4  # supersampling
img = Image.new('RGBA', (512 * S, 512 * S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
P = lambda pts: [(x * S, y * S) for x, y in pts]
d.rounded_rectangle((0, 0, 512 * S - 1, 512 * S - 1), radius=112 * S, fill='#2f6f5e')
d.polygon(P([(256, 96), (432, 184), (256, 272), (80, 184)]), fill='#f6c48f')
d.polygon(P([(80, 184), (256, 272), (256, 424), (80, 336)]), fill='#e9e1cf')
d.polygon(P([(256, 272), (432, 184), (432, 336), (256, 424)]), fill='#d2c6ab')
d.polygon(P([(353, 375), (397, 353), (397, 253), (353, 275)]), fill='#2f6f5e')
d.ellipse(P([(138, 278), (182, 322)]), fill='#2f6f5e')
for s in (180, 192, 512):
    im = img.resize((s, s), Image.LANCZOS)
    if s == 180:  # iOS no usa transparencia en apple-touch-icon
        bg = Image.new('RGBA', im.size, '#2f6f5e'); bg.alpha_composite(im); im = bg.convert('RGB')
    im.save(os.path.join(out, f'icon-{s}.png'))
