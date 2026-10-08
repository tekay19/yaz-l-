"""MEB ortak sınav kâğıtlarını öğrenci gibi kötü, sıkışık el yazısıyla doldurup
telefonla çekilmiş fotoğraf gibi kaydeder.

  python scripts/meb-handwriting.py            # her sınavdan 10 öğrenci
  python scripts/meb-handwriting.py --count 50 # her sınavdan 50 öğrenci
  python scripts/meb-handwriting.py --exam tr8 --students t01,t02
  python scripts/meb-handwriting.py --names-on-all-pages --count 6 --out eval/data/meb-elyazisi-isimli
  python scripts/meb-handwriting.py --difficulty extreme --count 50 --seed 12 --out eval/data/meb-elyazisi-cok-zor
  python scripts/meb-handwriting.py --difficulty hard --count 50 --names-everywhere --out eval/data/meb-elyazisi-zor-isimli

--difficulty normal|hard|extreme: yazıyı ve fotoğrafı giderek daha kötü yapar
(eğri, sıkışık, üst üste binen harfler; silik kurşun kalem; mürekkep lekesi;
bulanık, karanlık, gölgeli, hareketli çekim). Doğru metin hep aynıdır: okunmayan
yer okuyucu için hata sayılır.

Kaynaklar:
  eval/data/meb/*.pdf                         MEB cevaplı kitapçıkları (cevaplar beyazla kapatılır)
  eval/klasik/meb/<sinav>-students-{A,B}.json öğrenci cevapları ve beklenen puanlar
Çıktı:
  eval/data/meb-elyazisi/<sinav>/<id>-p<N>.jpg ve manifest.json
Yazı tipleri eval/data/meb-elyazisi/fonts altındadır (Google Fonts, OFL);
yoksa betik onları indirir.

Aynı tohum (seed) aynı görüntüleri üretir; öğrenci başına yazı tipi, boyut,
eğim, renk ve fotoğraf koşulları öğrenci kimliğinden türetilir.
"""
import argparse
import json
import math
import os
import random
import shutil
import urllib.request
from contextlib import contextmanager

try:
    import pymupdf as fitz  # PyMuPDF
except ImportError:
    import fitz
import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'eval', 'data', 'meb-elyazisi')
FONT_DIR = os.path.join(OUT, 'fonts')
ZOOM = 2.6  # PDF noktası → piksel; A4'e yakın sayfa ~1437 x 2027 piksel

# Türkçe harflerin tamamı olan el yazısı fontları (fontTools ile doğrulandı)
FONTS = {
    'Caveat.ttf': 'ofl/caveat/Caveat%5Bwght%5D.ttf',
    'Kalam-Regular.ttf': 'ofl/kalam/Kalam-Regular.ttf',
    'PatrickHand-Regular.ttf': 'ofl/patrickhand/PatrickHand-Regular.ttf',
    'IndieFlower-Regular.ttf': 'ofl/indieflower/IndieFlower-Regular.ttf',
    'ShadowsIntoLight.ttf': 'ofl/shadowsintolight/ShadowsIntoLight.ttf',
    'ArchitectsDaughter-Regular.ttf': 'ofl/architectsdaughter/ArchitectsDaughter-Regular.ttf',
    'CaveatBrush-Regular.ttf': 'ofl/caveatbrush/CaveatBrush-Regular.ttf',
}
# matematik işaretleri (√ ∛ ∈ ≤ ⇒ ∩ …) el yazısı fontlarında yok; bunlar buradan
FALLBACK = 'DejaVuSans.ttf'

# Her sınav: PDF, cevap anahtarının kapatılacağı alanlar ve her sorunun yazı
# alanı (PDF noktası, sayfa 0'dan). Yazı alanı kapatılan alanın içindedir.
EXAMS = {
    'mat9': {
        'pdf': 'eval/data/meb/9S_Mat_2_Don_1_Yaz_sabah_cevap.pdf',
        'rubric': 'eval/klasik/meb/mat9-rubric.json',
        'blank': [(0, 40, 465, 515, 730), (1, 40, 118, 515, 302), (1, 40, 522, 515, 730),
                  (2, 40, 268, 515, 436), (2, 40, 506, 515, 730), (3, 40, 122, 515, 338),
                  (3, 40, 483, 515, 688)],
        'areas': {1: (0, 50, 470, 508, 728), 2: (1, 50, 122, 508, 300), 3: (1, 50, 526, 508, 728),
                  4: (2, 50, 272, 508, 434), 5: (2, 50, 510, 508, 728), 6: (3, 50, 126, 508, 336),
                  7: (3, 50, 486, 508, 686)},
    },
    'tr8': {
        'pdf': 'eval/data/meb/8S_Turkce_1_Donem_1_Yazili_MEB_SABAH_CEV.pdf',
        'rubric': 'eval/klasik/meb/tr8-rubric.json',
        # 1-3. sorulardaki noktalı satırlar da kapatılır: öğrencinin yazdığı
        # etiketler ("Cümle:") zaten cevap satırlarındadır
        'blank': [(0, 40, 352, 515, 730), (1, 40, 136, 515, 232), (1, 40, 272, 515, 540),
                  (1, 40, 640, 515, 730), (2, 40, 230, 515, 466), (2, 40, 564, 515, 730),
                  (3, 40, 196, 515, 690)],
        'areas': {1: (0, 50, 356, 508, 728), 2: (1, 50, 138, 508, 232), 3: (1, 50, 274, 508, 538),
                  4: (1, 50, 642, 508, 728), 5: (2, 50, 232, 508, 464), 6: (2, 50, 566, 508, 728),
                  7: (3, 50, 198, 508, 688)},
    },
}
TOP_NAME = (175, 8, 400, 34)  # 2-4. sayfaların üst kenarı, sayfa başlığının üstü (PDF noktası)
NAME_AT = (205, 147)  # "Adı ve Soyadı:" satırı (PDF noktası, sayfa 0)
CLASS_AT = (205, 165)
NUMBER_AT = (205, 176)

INKS = [(22, 38, 128), (18, 30, 105), (35, 52, 150), (28, 28, 34), (45, 45, 55)]
PENCILS = [(88, 88, 98), (110, 110, 120), (70, 72, 82)]  # silik kurşun kalem (zor düzeylerde)

# Zorluk düzeyleri. normal ilk setin değerleridir (aynı tohum aynı görüntü);
# hard ve extreme yazıyı ve fotoğrafı giderek bozar. Aralıklar (alt, üst).
#   slant/jitter/wobble: eğim, kelime başına dönme, taban çizgisi kayması
#   tracking/leading/gap: harf aralığı (eksi: harfler üst üste biner), satır ve kelime aralığı
#   glyph_rot/glyph_grow/advance: harf harf dönme, büyüme ve ilerleme
#   dropout: silik çıkan harf oranı; smudge: cevabın sürülme olasılığı; fade: mürekkep koyuluğu
#   pencil: kurşun kalem kullanma olasılığı; weights: kalem kalınlığı seçenekleri
#   persp/rot/far/blur/noise/light/shadow/motion/glare/quality: fotoğraf koşulları
LEVELS = {
    'normal': dict(
        slant=(-4, 4), jitter=(2.0, 5.0), wobble=(0.08, 0.2), tracking=(-0.06, 0.05), leading=(0.72, 0.98),
        gap=(0.7, 1.25), glyph_rot=7, glyph_grow=(0.9, 1.12), advance=(0.93, 1.05), squash=(1, 1), dropout=0,
        smudge=0, fade=(0.92, 0.92), pencil=0, weights=[0, 0, 0, 1], tiny=0.2, size=(14.5, 19.5),
        tiny_size=(11, 13.5), persp=(0.035, 0.025), rot=0, far=0.25, blur=(0.5, 1.2), noise=(3, 7),
        light=(0.12, 0.3), shadow=(0.6, 0.12, 0.25), motion=0, glare=0, quality=(60, 82)),
    'hard': dict(
        slant=(-8, 8), jitter=(3.5, 7), wobble=(0.12, 0.28), tracking=(-0.09, 0.04), leading=(0.66, 0.9),
        gap=(0.55, 1.2), glyph_rot=11, glyph_grow=(0.85, 1.18), advance=(0.9, 1.04), squash=(0.85, 1.15),
        dropout=0.025, smudge=0.15, fade=(0.8, 0.95), pencil=0.2, weights=[0, 0, 1], tiny=0.3,
        size=(13.5, 18), tiny_size=(10.5, 12.5), persp=(0.05, 0.035), rot=2.5, far=0.3, blur=(0.6, 1.1),
        noise=(4, 9), light=(0.18, 0.38), shadow=(0.75, 0.15, 0.3), motion=0.1, glare=0.12, quality=(55, 78)),
    'extreme': dict(
        slant=(-14, 14), jitter=(4.5, 9), wobble=(0.18, 0.34), tracking=(-0.12, 0.0), leading=(0.62, 0.82),
        gap=(0.4, 1.05), glyph_rot=14, glyph_grow=(0.8, 1.26), advance=(0.86, 1.03), squash=(0.75, 1.25),
        dropout=0.03, smudge=0.3, fade=(0.65, 0.9), pencil=0.35, weights=[0, 0, 1], tiny=0.4,
        size=(12, 16.5), tiny_size=(10, 12), persp=(0.07, 0.05), rot=4, far=0.4, blur=(0.7, 1.25),
        noise=(6, 12), light=(0.25, 0.46), shadow=(0.9, 0.2, 0.36), motion=0.2, glare=0.2, quality=(45, 68)),
}
L = LEVELS['normal']  # main() seçilen düzeyi buraya koyar


@contextmanager
def level(name):
    """Geçici olarak başka bir zorluk düzeyinde yazar (isim alanları için)."""
    global L
    prev, L = L, LEVELS[name]
    try:
        yield
    finally:
        L = prev

# Windows'ta DejaVuSans; macOS ve Linux'ta eşdeğer geniş kapsamlı bir font
FALLBACK_SOURCES = [
    os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', FALLBACK),
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/Library/Fonts/Arial Unicode.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]


def ensure_fonts():
    os.makedirs(FONT_DIR, exist_ok=True)
    for name, src in FONTS.items():
        path = os.path.join(FONT_DIR, name)
        if not os.path.exists(path):
            urllib.request.urlretrieve('https://github.com/google/fonts/raw/main/' + src, path)
    fb = os.path.join(FONT_DIR, FALLBACK)
    if not os.path.exists(fb):
        src = next((p for p in FALLBACK_SOURCES if os.path.exists(p)), None)
        assert src, f'{FALLBACK} ya da eşdeğeri bulunamadı: {FALLBACK_SOURCES}'
        shutil.copy(src, fb)
    for name in FONTS:
        cmap = TTFont(os.path.join(FONT_DIR, name)).getBestCmap()
        missing = [c for c in 'şŞğĞıİçÇöÖüÜ' if ord(c) not in cmap]
        assert not missing, f'{name} Türkçe harf eksik: {missing}'


class Pen:
    """Bir öğrencinin yazısı: yazı tipi, boyut, eğim, aralık, mürekkep."""

    def __init__(self, rng, font_name, size):
        self.rng = rng
        self.font_name = font_name
        self.size = size
        self.cmap = TTFont(os.path.join(FONT_DIR, font_name)).getBestCmap()
        self._fonts = {}
        self.slant = rng.uniform(*L['slant'])          # derece; yazının genel eğimi
        self.jitter = rng.uniform(*L['jitter'])        # kelime başına dönme (±derece)
        self.wobble = rng.uniform(*L['wobble'])        # taban çizgisi kayması (boyutun oranı)
        self.tracking = rng.uniform(*L['tracking'])    # harf aralığı (boyutun oranı)
        self.leading = rng.uniform(*L['leading'])      # satır aralığı; < 1 sıkışık
        self.ink = rng.choice(INKS)
        self.weight = rng.choice(L['weights'])         # bazı öğrenciler kalın basar
        if L['pencil'] and rng.random() < L['pencil']:  # silik kurşun kalem
            self.ink = rng.choice(PENCILS)
        lo, hi = L['fade']
        self.alpha = lo if lo == hi else rng.uniform(lo, hi)  # mürekkep koyuluğu

    def font(self, size, fallback=False):
        key = (int(size), fallback)
        if key not in self._fonts:
            path = os.path.join(FONT_DIR, FALLBACK if fallback else self.font_name)
            self._fonts[key] = ImageFont.truetype(path, int(size))
        return self._fonts[key]

    def has(self, ch):
        return ord(ch) in self.cmap


def glyph_runs(text):
    """'10^8' gibi üsleri ayırır: [(metin, üst_mü)]"""
    runs, i = [], 0
    while i < len(text):
        if text[i] == '^' and i + 1 < len(text):
            j = i + 1
            if text[j] == '(':
                k = text.find(')', j)
                j = k + 1 if k > 0 else len(text)
                runs.append((text[i + 2:j - 1], True))
            else:
                while j < len(text) and (text[j].isalnum() or text[j] in '-−'):
                    j += 1
                runs.append((text[i + 1:j], True))
            i = j
            continue
        if runs and not runs[-1][1]:
            runs[-1] = (runs[-1][0] + text[i], False)
        else:
            runs.append((text[i], False))
        i += 1
    return runs


def render_word(pen, word, size):
    """Bir kelimeyi şeffaf bir görüntüye yazar; harf harf, eksik glifler yedek fonttan."""
    rng = pen.rng
    pieces = []  # (karakter, font, yükseklik kayması)
    for text, sup in glyph_runs(word):
        s = size * (0.62 if sup else 1.0)
        for ch in text:
            if ch == '∛':  # küp kök: küçük 3 ve √
                pieces.append(('3', pen.font(size * 0.5, not pen.has('3')), -size * 0.45))
                ch = '√'
            pieces.append((ch, pen.font(s, not pen.has(ch)), -size * 0.42 if sup else 0))
    width = 0
    for ch, f, _ in pieces:
        width += f.getlength(ch) * (1 + rng.uniform(-0.04, 0.04)) + size * pen.tracking
    w = int(max(1, width) * max(1.15, L['glyph_grow'][1] + 0.03) + size * 0.8)  # büyüyen harfler kesilmesin
    h = int(size * 2.2)
    base = size * 1.4  # taban çizgisi; üsler bunun üstünde, harfler bunun üzerinde hizalı
    img = Image.new('L', (w, h), 0)
    x = size * 0.2
    for ch, f, dy in pieces:
        # harf harf: boyut, eğim ve yükseklik biraz oynar — elle yazılmış gibi
        grow = rng.uniform(*L['glyph_grow'])
        cf = ImageFont.truetype(f.path, max(6, int(f.size * grow)))
        cw = int(cf.getlength(ch)) + int(size * 0.5) + 2
        cimg = Image.new('L', (cw, int(size * 1.9)), 0)
        ImageDraw.Draw(cimg).text((size * 0.2, size * 1.3), ch, font=cf, fill=255, anchor='ls',
                                  stroke_width=pen.weight, stroke_fill=255)
        sx = 1.0
        if L['squash'][0] != L['squash'][1]:  # harf dar ya da geniş: a/o/e birbirine benzer
            sx = rng.uniform(*L['squash'])
            cimg = cimg.resize((max(1, int(cimg.width * sx)), cimg.height), Image.BICUBIC)
        cimg = cimg.rotate(rng.uniform(-L['glyph_rot'], L['glyph_rot']), resample=Image.BICUBIC)
        if L['dropout'] and rng.random() < L['dropout']:  # kalem basmadı: harf silik çıkar
            faint = rng.uniform(0.25, 0.55)
            cimg = cimg.point(lambda v: int(v * faint))
        y = base - size * 1.3 + dy + rng.uniform(-1, 1) * size * pen.wobble * 0.45
        img.paste(Image.new('L', cimg.size, 255), (int(x - size * 0.2), int(y)), cimg)
        x += cf.getlength(ch) * sx * rng.uniform(*L['advance']) + size * pen.tracking
    angle = pen.slant + rng.uniform(-pen.jitter, pen.jitter)
    return img.rotate(angle, resample=Image.BICUBIC, expand=True), x


def layout(pen, lines, width, size):
    """Satırları yazı alanı genişliğine göre kelime kelime böler (biraz taşabilir)."""
    space = size * 0.32
    out = []  # (kelimeler, üstü_çizili)
    for line in lines:
        text, crossed = (line, False) if isinstance(line, str) else (line['text'], line.get('crossed', False))
        words, cur, cur_w = text.split(), [], 0
        limit = width * pen.rng.uniform(0.9, 0.98)  # harfler büyüyüp kaydığından biraz taşar
        for wd in words:
            wl = sum(pen.font(size, not pen.has(c)).getlength(c) for c in wd.replace('^', ''))
            if cur and cur_w + space + wl > limit:
                out.append((cur, crossed))
                cur, cur_w = [], 0
            cur.append(wd)
            cur_w += (space if cur_w else 0) + wl
        if cur:
            out.append((cur, crossed))
    return out


def write_answer(page_img, pen, lines, box, scale):
    """Bir sorunun cevabını sayfa görüntüsüne yazar; sığmazsa yazıyı küçültür."""
    x0, y0, x1, y1 = [v * scale for v in box]
    size = pen.size
    for _ in range(12):
        rows = layout(pen, lines, x1 - x0, size)
        if len(rows) * size * 1.25 * pen.leading <= (y1 - y0) or size < pen.size * 0.55:
            break
        size *= 0.9
    ink_layer = Image.new('L', page_img.size, 0)
    y = y0 + size * 0.1
    indent = pen.rng.uniform(0, size * 0.8)
    for words, crossed in rows:
        x = x0 + indent + pen.rng.uniform(-size * 0.25, size * 0.25)
        line_start, line_end = x, x
        drift = pen.rng.uniform(-0.03, 0.03)  # satır hafifçe yukarı/aşağı kayar
        for wd in words:
            img, adv = render_word(pen, wd, size)
            yy = y + (x - x0) * drift + pen.rng.uniform(-1, 1) * size * pen.wobble
            ink_layer.paste(Image.new('L', img.size, 255), (int(x), int(yy - size * 0.45)), img)
            x += adv + size * 0.32 * pen.rng.uniform(*L['gap'])
            line_end = x
        if crossed:  # dalgalı bir çizgiyle üstünü çizer
            d = ImageDraw.Draw(ink_layer)
            pts, xx = [], line_start
            mid = y + size * 0.95
            while xx < line_end:
                pts.append((xx, mid + pen.rng.uniform(-size * 0.12, size * 0.12)))
                xx += size * 0.5
            d.line(pts, fill=255, width=max(2, int(size * 0.09)))
            if pen.rng.random() < 0.5:
                d.line([(p[0], p[1] + size * 0.18) for p in pts], fill=255, width=max(2, int(size * 0.07)))
        y += size * 1.25 * pen.leading
    if L['smudge'] and pen.rng.random() < L['smudge']:
        # elle sürülmüş yazı: kaymış, bulanık bir kopya yazının üstüne biner
        region = (int(x0), int(y0), int(x1), int(y1))
        sub = ink_layer.crop(region)
        dx, dy = pen.rng.uniform(-0.7, 0.7) * size, pen.rng.uniform(-0.2, 0.6) * size
        smear = sub.filter(ImageFilter.GaussianBlur(size * pen.rng.uniform(0.1, 0.25)))
        smear = smear.transform(sub.size, Image.AFFINE, (1, 0, -dx, 0, 1, -dy), Image.BICUBIC)
        strength = pen.rng.uniform(0.4, 0.8)
        ink_layer.paste(ImageChops.lighter(sub, smear.point(lambda v: int(v * strength))), region)
    ink = Image.new('RGB', page_img.size, pen.ink)
    alpha = ink_layer.point(lambda v: int(v * pen.alpha))
    page_img.paste(ink, (0, 0), alpha)


def render_pages(exam):
    doc = fitz.open(os.path.join(ROOT, exam['pdf']))
    pages = []
    for i, p in enumerate(doc):
        pix = p.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), alpha=False)
        img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        d = ImageDraw.Draw(img)
        for (pn, x0, y0, x1, y1) in exam['blank']:
            if pn == i:
                d.rectangle([x0 * ZOOM, y0 * ZOOM, x1 * ZOOM, y1 * ZOOM], fill='white')
        pages.append(img)
    return pages


def photograph(page, rng, far):
    """Sayfayı masada telefonla çekilmiş gibi yapar."""
    w, h = page.size
    # hafif perspektif: köşeler birkaç yüzde oynar
    k = L['persp'][1] if far else L['persp'][0]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    dst = [(x + rng.uniform(-k, k) * w, y + rng.uniform(-k, k) * h) for x, y in src]
    if L['rot']:  # kâğıt karede eğik durur
        a = math.radians(rng.uniform(-L['rot'], L['rot']))
        dst = [(w / 2 + (x - w / 2) * math.cos(a) - (y - h / 2) * math.sin(a),
                h / 2 + (x - w / 2) * math.sin(a) + (y - h / 2) * math.cos(a)) for x, y in dst]
    if far:
        frame_w, frame_h = int(w * 1.75), int(h * 1.55)  # sayfa karenin ~%35'i
        ox, oy = rng.uniform(0.2, 0.55) * w, rng.uniform(0.15, 0.4) * h
    else:
        frame_w, frame_h = int(w * 1.08), int(h * 1.07)
        ox, oy = 0.04 * w, 0.035 * h
    dst = [(x + ox, y + oy) for x, y in dst]
    # masa: kahverengi, dokulu
    desk_col = np.array(rng.choice([(92, 70, 50), (120, 96, 70), (70, 62, 58), (150, 140, 128)]), dtype=np.float32)
    nprng = np.random.default_rng(rng.randrange(1 << 30))
    desk = desk_col + nprng.normal(0, 9, (frame_h, frame_w, 1)).astype(np.float32)
    grain = np.linspace(0, 6 * math.pi, frame_w)[None, :, None]
    desk += 6 * np.sin(grain + nprng.normal(0, 0.4, (frame_h, 1, 1)))
    frame = Image.fromarray(np.clip(desk, 0, 255).astype(np.uint8))
    coeffs = perspective_coeffs(dst, src)
    warped = page.transform((frame_w, frame_h), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=(0, 0, 0))
    mask = Image.new('L', page.size, 255).transform((frame_w, frame_h), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=0)
    frame.paste(warped, (0, 0), mask)
    arr = np.asarray(frame).astype(np.float32)
    # aydınlatma: bir yandan diğerine düşen ışık ve yumuşak bir gölge
    yy, xx = np.mgrid[0:frame_h, 0:frame_w].astype(np.float32)
    ang = rng.uniform(0, 2 * math.pi)
    grad = (np.cos(ang) * xx / frame_w + np.sin(ang) * yy / frame_h)
    grad = (grad - grad.min()) / max(1e-6, grad.max() - grad.min())
    light = 1.04 - rng.uniform(*L['light']) * grad
    chance, lo, hi = L['shadow']
    if rng.random() < chance:  # telefonun / elin gölgesi
        cx, cy = rng.uniform(0.2, 0.8) * frame_w, rng.uniform(0.2, 0.8) * frame_h
        r = rng.uniform(0.18, 0.35) * max(frame_w, frame_h)
        light *= 1 - rng.uniform(lo, hi) * np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)))
    arr *= light[..., None]
    if L['glare'] and rng.random() < L['glare']:  # flaş ya da lamba yansıması yazıyı eritir
        cx, cy = rng.uniform(0.25, 0.75) * frame_w, rng.uniform(0.2, 0.8) * frame_h
        rx, ry = rng.uniform(0.06, 0.14) * frame_w, rng.uniform(0.04, 0.1) * frame_h
        arr += rng.uniform(70, 130) * np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2))[..., None]
    arr += nprng.normal(0, rng.uniform(*L['noise']), arr.shape)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    if L['motion'] and rng.random() < L['motion']:  # el titredi: tek yönde çizgi çizgi bulanıklık
        line = rng.choice([[1 if r == 2 else 0 for r in range(5) for c in range(5)],   # yatay
                           [1 if c == 2 else 0 for r in range(5) for c in range(5)],   # dikey
                           [1 if r == c else 0 for r in range(5) for c in range(5)]])  # çapraz
        img = img.filter(ImageFilter.Kernel((5, 5), line, scale=5))
    img = img.filter(ImageFilter.GaussianBlur(rng.uniform(*L['blur'])))
    return img


def perspective_coeffs(dst, src):
    """PIL PERSPECTIVE katsayıları: hedef noktasından kaynak noktasına."""
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    a = np.array(m, dtype=np.float64)
    b = np.array([c for p in src for c in p], dtype=np.float64)
    return np.linalg.solve(a, b).tolist()


def pick_students(students, count):
    """Senaryoları (tag) olabildiğince çeşitli kapsayan öğrenciler: açgözlü seçim."""
    if count >= len(students):
        return students
    chosen, covered = [], set()
    pool = list(students)
    while len(chosen) < count and pool:
        best = max(pool, key=lambda s: (len({t for e in s['expected'] for t in e['tags']} - covered), -students.index(s)))
        chosen.append(best)
        covered |= {t for e in best['expected'] for t in e['tags']}
        pool.remove(best)
    return sorted(chosen, key=lambda s: s['id'])


def name_variant(rng, full):
    """Arka sayfaya yazılan isim: bazen "Ad: ...", bazen yalnız isim, bazen kısaltılmış."""
    parts = full.split()
    short = f"{parts[0][0]}. {' '.join(parts[1:])}" if len(parts) > 1 else full
    return rng.choice([f'Ad: {full}', full, short, f'Adı: {full}', short])


def name_variant_full(rng, full):
    """--names-everywhere: ad hep tam yazılır (kısaltma yok), yalnız ön ek değişir."""
    return rng.choice([f'Ad: {full}', full, f'Adı: {full}', full])


def name_plan_all(students):
    """--names-everywhere: herkes bütün sayfalara (ön yüzdeki alana ve 2-4. sayfaların
    üst kenarına) adını yazar; öğretmen sayfaları isimden eşleyebilsin."""
    return {s['id']: {'front': True, 'back': [2, 3, 4]} for s in students}


def name_plan(students):
    """--names-on-all-pages için kimin hangi sayfaya isim yazdığı: ilk iki öğrenci
    arka sayfalara yazmaz, üçüncüsü 1. sayfadaki isim alanını boş bırakıp 2. sayfaya
    yazar, diğerleri her sayfaya yazar."""
    plan = {}
    for i, s in enumerate(students):
        if i < 2:
            plan[s['id']] = {'front': True, 'back': []}
        elif i == 2:
            plan[s['id']] = {'front': False, 'back': [2]}
        else:
            plan[s['id']] = {'front': True, 'back': [2, 3, 4]}
    return plan


def upload_orders(students):
    """Öğretmenin yükleme sırası: öğrenci öğrenci, ya da deste deste (önce bütün
    1. sayfalar, sonra bütün 2. sayfalar ...)."""
    seq = [f for s in students for f in s['pages']]
    most = max((len(s['pages']) for s in students), default=0)
    shuffled = [s['pages'][i] for i in range(most) for s in students if i < len(s['pages'])]
    return {'sequential': seq, 'shuffled': shuffled}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--exam', choices=list(EXAMS), action='append')
    ap.add_argument('--count', type=int, default=10)
    ap.add_argument('--students', help='virgülle öğrenci kimlikleri (ör. t01,t02)')
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--names-on-all-pages', action='store_true',
                    help='öğrenci adını 2-4. sayfaların üst kenarına da yazar (bkz. name_plan)')
    ap.add_argument('--names-everywhere', action='store_true',
                    help='her öğrenci her sayfaya tam adını yazar; isimler cevaplardan daha okunaklıdır (bkz. name_plan_all)')
    ap.add_argument('--out', help='çıktı klasörü (varsayılan eval/data/meb-elyazisi)')
    ap.add_argument('--difficulty', choices=list(LEVELS), default='normal',
                    help='yazı ve fotoğraf bozukluğu (bkz. LEVELS)')
    args = ap.parse_args()
    global L
    L = LEVELS[args.difficulty]
    out_root = os.path.join(ROOT, args.out) if args.out else OUT
    ensure_fonts()
    fonts = list(FONTS)
    for name in args.exam or list(EXAMS):
        exam = EXAMS[name]
        students = []
        for part in ('A', 'B'):
            path = os.path.join(ROOT, 'eval', 'klasik', 'meb', f'{name}-students-{part}.json')
            students += json.load(open(path, encoding='utf-8'))['students']
        if args.students:
            want = set(args.students.split(','))
            students = [s for s in students if s['id'] in want]
        else:
            students = pick_students(students, args.count)
        blank_pages = render_pages(exam)
        out_dir = os.path.join(out_root, name)
        plan = name_plan_all(students) if args.names_everywhere else name_plan(students) if args.names_on_all_pages else {}
        os.makedirs(out_dir, exist_ok=True)
        manifest_path = os.path.join(out_dir, 'manifest.json')
        manifest = {'exam': name, 'rubric': exam['rubric'], 'students': []}
        if os.path.exists(manifest_path):
            manifest = json.load(open(manifest_path, encoding='utf-8'))
        by_id = {s['id']: s for s in manifest['students']}
        for idx, s in enumerate(students):
            rng = random.Random(f"{args.seed}-{s['id']}")
            far = rng.random() < L['far']      # normalde dörtte biri uzaktan çekilmiş
            tiny = rng.random() < L['tiny']    # normalde beşte biri çok küçük yazar
            size = (rng.uniform(*L['tiny_size']) if tiny else rng.uniform(*L['size'])) * ZOOM
            pen = Pen(rng, rng.choice(fonts), size)
            pages = [p.copy() for p in blank_pages]
            # isim alanı
            first = pages[0]
            names = plan.get(s['id'], {'front': True, 'back': []})
            back_names = {}
            # --names-everywhere: isimler öğrencinin cevaplarından daha özenli yazılır
            with level('normal' if args.names_everywhere else args.difficulty):
                name_pen = Pen(rng, pen.font_name, 20 * ZOOM)
                name_pen.ink = pen.ink
                name_pen.slant = max(-6, min(6, pen.slant)) if args.names_everywhere else pen.slant
                if names['front']:
                    write_answer(first, name_pen, [s['name']], (NAME_AT[0], NAME_AT[1] - 13, 420, NAME_AT[1] + 6), ZOOM)
                for pn in names['back']:
                    if pn <= len(pages):
                        back_names[pn] = (name_variant_full if args.names_everywhere else name_variant)(rng, s['name'])
                        write_answer(pages[pn - 1], name_pen, [back_names[pn]], TOP_NAME, ZOOM)
                write_answer(first, name_pen, [name[-1] + rng.choice(['-A', '/B', 'C', '-D', '/E'])], (CLASS_AT[0], CLASS_AT[1] - 13, 330, CLASS_AT[1] + 6), ZOOM)
                write_answer(first, name_pen, [str(rng.randint(100, 999))], (NUMBER_AT[0], NUMBER_AT[1] - 13, 330, NUMBER_AT[1] + 6), ZOOM)
            for a in s['answers']:
                if not a['lines']:
                    continue
                pn, *box = exam['areas'][a['q']]
                write_answer(pages[pn], pen, a['lines'], box, ZOOM)
            files = []
            for i, pg in enumerate(pages):
                photo = photograph(pg, rng, far)
                fname = f"{s['id']}-p{i + 1}.jpg"
                photo.save(os.path.join(out_dir, fname), quality=rng.randint(*L['quality']))
                files.append(fname)
            by_id[s['id']] = {
                'id': s['id'], 'name': s['name'], 'persona': s.get('persona'), 'pages': files,
                'style': {'font': pen.font_name, 'size': round(size / ZOOM, 1), 'leading': round(pen.leading, 2),
                          'slant': round(pen.slant, 1), 'far': far, 'tiny': tiny,
                          'difficulty': args.difficulty, 'pencil': pen.ink in PENCILS, 'ink': round(pen.alpha, 2)},
                'answers': s['answers'], 'expected': s['expected'],
                'names': {'front': names['front'], 'back': {str(k): v for k, v in back_names.items()}},
            }
            print(f"{name} {s['id']} {pen.font_name} boyut {size / ZOOM:.0f}{' uzak' if far else ''}{' küçük' if tiny else ''}")
        manifest['students'] = sorted(by_id.values(), key=lambda x: x['id'])
        manifest['uploadOrder'] = upload_orders(manifest['students'])
        json.dump(manifest, open(manifest_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f'{name}: {len(manifest["students"])} öğrenci → {out_dir}')


if __name__ == '__main__':
    main()
