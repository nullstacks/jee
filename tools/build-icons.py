"""Regenerates public/icons/* from one geometry.

The mark: three bars that rise, crossed by a cut-off line. Bars that clear the
line turn amber. That is the whole product in one glyph: ranks against a cut-off.

Run:  python3 tools/build-icons.py     (needs playwright + chromium)
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"

BOTTOM, LINE, W = 21.0, 12.8, 3.4
BARS = [(8.5, 15.0), (14.0, 10.0), (19.5, 6.0)]   # (centre x, top y)
WHITE, HOT = "#ffffff", "#ff7a2f"


def glyph(scale=1.0):
    parts = [f'<path d="M5.5 {LINE}H22.5" stroke="{WHITE}" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round"/>']
    for cx, top in BARS:
        x = cx - W / 2
        r = W / 2
        parts.append(f'<rect x="{x}" y="{top}" width="{W}" height="{BOTTOM - top}" rx="{r}" fill="{WHITE}"/>')
        if top < LINE:
            parts.append(
                f'<path d="M{x} {LINE}V{top + r}a{r} {r} 0 0 1 {W} 0V{LINE}Z" fill="{HOT}"/>'
            )
    g = "".join(parts)
    if scale != 1.0:
        o = 14 * (1 - scale)
        g = f'<g transform="translate({o:.3f} {o:.3f}) scale({scale})">{g}</g>'
    return g


def svg(rx, scale=1.0, size=512):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 28 28">'
        '<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#2e2e38"/><stop offset="1" stop-color="#111114"/></linearGradient></defs>'
        f'<rect width="28" height="28" rx="{rx}" fill="url(#t)"/>{glyph(scale)}</svg>'
    )


FILES = {
    "icon.svg": svg(8),
    "icon-maskable.svg": svg(0, 0.72),
    "apple-touch.svg": svg(0, 0.92),
}
for name, body in FILES.items():
    (OUT / name).write_text(body)

PNGS = [
    ("favicon-32.png", 32, FILES["icon.svg"], True),
    ("icon-192.png", 192, FILES["icon.svg"], True),
    ("icon-512.png", 512, FILES["icon.svg"], True),
    ("icon-maskable-512.png", 512, FILES["icon-maskable.svg"], False),
    ("apple-touch-icon.png", 180, FILES["apple-touch.svg"], False),
]

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, px, markup, transparent in PNGS:
        pg = b.new_page(viewport={"width": px, "height": px})
        m = markup.replace('width="512" height="512"', f'width="{px}" height="{px}"')
        pg.set_content(f'<body style="margin:0;background:transparent">{m}</body>')
        pg.screenshot(path=str(OUT / name), omit_background=transparent, clip={"x": 0, "y": 0, "width": px, "height": px})
        pg.close()
    b.close()
print("icons written to", OUT)
