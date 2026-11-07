"""Link-preview images (Open Graph, 1200x630) for each language -> web/public/og/og-{lang}.png.

Run from web/ after `npm ci`:  python3 scripts/make-og-images.py
Needs Pillow (with FreeType variation support) and fonttools with brotli. Uses the site's own Inter font from @fontsource-variable/inter.
"""
import io
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

WEB = Path(__file__).resolve().parent.parent
OUT = WEB / 'public' / 'og'
FONT = WEB / 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'

W, H = 1200, 630
BG, INK, MUTED, ACCENT, NAVY, SKY = '#f6f5f2', '#141413', '#52514e', '#d52b1e', '#243447', '#86b6ef'

TEXT = {
    'fr': ('Qui finance la politique suisse ?',
           'Recettes et dons déclarés pour chaque votation, élection et parti, d’après les données officielles.',
           'Données officielles du Contrôle fédéral des finances'),
    'de': ('Wer finanziert die Schweizer Politik?',
           'Deklarierte Einnahmen und Zuwendungen für jede Abstimmung, Wahl und Partei, nach offiziellen Daten.',
           'Offizielle Daten der Eidgenössischen Finanzkontrolle'),
    'it': ('Chi finanzia la politica svizzera?',
           'Entrate e liberalità dichiarate per ogni votazione, elezione e partito, secondo i dati ufficiali.',
           'Dati ufficiali del Controllo federale delle finanze'),
    'en': ('Who funds Swiss politics?',
           'Declared revenue and donations for every vote, election and party, from official data.',
           'Official data from the Swiss Federal Audit Office'),
}


def font(weight, size):
    """Inter at a given weight: woff2 -> TTF in memory, weight set on the variable font by Pillow."""
    tt = TTFont(str(FONT))
    tt.flavor = None
    buf = io.BytesIO()
    tt.save(buf)
    buf.seek(0)
    fnt = ImageFont.truetype(buf, size)
    fnt.set_variation_by_axes([weight])
    return fnt


def wrap(draw, text, fnt, width):
    lines, line = [], ''
    for word in text.split(' '):
        trial = f'{line} {word}'.strip()
        if draw.textlength(trial, font=fnt) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def logo(draw, x, y, s):
    """The favicon (ballot box), drawn at size s."""
    k = s / 32
    draw.rounded_rectangle([x, y, x + s, y + s], radius=7 * k, fill=NAVY)
    draw.rounded_rectangle([x + 7 * k, y + 15 * k, x + 25 * k, y + 25 * k], radius=2 * k, fill='white')
    draw.rounded_rectangle([x + 12 * k, y + 6 * k, x + 20 * k, y + 17 * k], radius=1.5 * k, fill=SKY)
    draw.rectangle([x + 10 * k, y + 14 * k, x + 22 * k, y + 16 * k], fill=NAVY)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    f_brand, f_title, f_lead, f_foot = font(650, 34), font(750, 74), font(420, 34), font(500, 25)
    left, width = 96, W - 2 * 96
    for lang, (title, lead, foot) in TEXT.items():
        img = Image.new('RGB', (W, H), BG)
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, 14, H], fill=ACCENT)
        logo(d, left, 72, 56)
        d.text((left + 76, 100), 'polimoney.ch', font=f_brand, fill=INK, anchor='lm')
        y = 196
        for line in wrap(d, title, f_title, width):
            d.text((left, y), line, font=f_title, fill=INK)
            y += 88
        y += 18
        for line in wrap(d, lead, f_lead, width):
            d.text((left, y), line, font=f_lead, fill=MUTED)
            y += 48
        d.line([left, H - 104, W - left, H - 104], fill='#dddbd5', width=2)
        d.text((left, H - 62), foot, font=f_foot, fill=MUTED, anchor='lm')
        d.text((W - left, H - 62), 'FR · DE · IT · EN', font=f_foot, fill=MUTED, anchor='rm')
        img.save(OUT / f'og-{lang}.png', optimize=True)
        print(f'og-{lang}.png', (OUT / f'og-{lang}.png').stat().st_size, 'bytes, last text line at y =', y)


if __name__ == '__main__':
    main()
