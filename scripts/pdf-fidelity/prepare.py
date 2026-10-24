"""Builds the static folder the fidelity harness is served from.
Usage: python3 prepare.py <repoRoot> <googleFontsCheckout> <jspdfUmdMin> <serveRoot>
The font folder is a checkout of github.com/google/fonts (ofl/...) — the same
font files Google Fonts serves to the site."""
import base64, io, json, os, shutil, sys
from PIL import Image, ImageDraw

repo, gfonts, jspdf, root = sys.argv[1:5]
os.makedirs(root + "/fonts", exist_ok=True)
for f in ["harness.html"]:
    shutil.copy(os.path.join(repo, "scripts/pdf-fidelity", f), root)
shutil.copy(os.path.join(repo, "src/pageRender.js"), root)
shutil.copy(jspdf, root + "/jspdf.umd.min.js")
shutil.copytree(os.path.join(repo, "public/stickers"), root + "/stickers", dirs_exist_ok=True)
shutil.copytree(os.path.join(repo, "public/books"), root + "/books", dirs_exist_ok=True)

# Local stand-in for fonts.googleapis.com: same font files, same @font-face shape.
faces = [
    ("Quicksand", "ofl/quicksand/Quicksand[wght].ttf", "300 700", "normal"),
    ("Noto Sans Arabic", "ofl/notosansarabic/NotoSansArabic[wdth,wght].ttf", "100 900", "normal"),
    ("Pacifico", "ofl/pacifico/Pacifico-Regular.ttf", "400", "normal"),
    ("Londrina Solid", "ofl/londrinasolid/LondrinaSolid-Regular.ttf", "400", "normal"),
    ("Londrina Solid", "ofl/londrinasolid/LondrinaSolid-Black.ttf", "900", "normal"),
    ("Playfair Display", "ofl/playfairdisplay/PlayfairDisplay[wght].ttf", "400 900", "normal"),
    ("Playfair Display", "ofl/playfairdisplay/PlayfairDisplay-Italic[wght].ttf", "400 900", "italic"),
]
css = []
for fam, src, wght, style in faces:
    name = os.path.basename(src).replace("[", "_").replace("]", "_").replace(",", "_")
    shutil.copy(os.path.join(gfonts, src), root + "/fonts/" + name)
    css.append(f"@font-face {{\n  font-family: '{fam}';\n  font-style: {style};\n  font-weight: {wght};\n  src: url(/fonts/{name}) format('truetype');\n}}")
open(root + "/fonts.css", "w").write("\n".join(css))

def photo(w, h, hue):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(0, h, 4):
        d.rectangle([0, y, w, y + 4], fill=((hue + y // 7) % 256, (y * 3) % 256, (255 - y // 5) % 256))
    for x in range(0, w, 80):
        d.line([x, 0, x, h], fill=(255, 255, 255), width=3)
    d.ellipse([w * .3, h * .3, w * .7, h * .7], outline=(0, 0, 0), width=12)
    d.text((40, 40), "TOP-LEFT", fill=(0, 0, 0))
    b = io.BytesIO(); im.save(b, "JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()

land, port = photo(1600, 1000, 30), photo(900, 1600, 140)
pages = [
    {"background": "#fdf0ff", "elements": [
        {"id": "a", "type": "image", "src": land, "x": 10, "y": 10, "w": 380, "h": 250, "rotation": 0},
        {"id": "b", "type": "image", "src": port, "x": 30, "y": 230, "w": 170, "h": 260, "rotation": -4},
        {"id": "c", "type": "text", "content": "Our Wedding\nForever & Always", "x": 200, "y": 290, "w": 190, "h": 110, "font": "Pacifico", "fontSize": 24, "color": "#8040b0", "bold": True, "italic": False, "rotation": 6},
        {"id": "d", "type": "text", "content": "زفافنا السعيد ٢٠٢٦", "x": 200, "y": 400, "w": 190, "h": 60, "font": "Noto Sans Arabic", "fontSize": 22, "color": "#4A3068", "bold": False, "italic": False, "rotation": 0},
        {"id": "e", "type": "sticker", "src": "/stickers/sticker-petra_treasury_flat.png", "x": 300, "y": 440, "w": 90, "h": 90, "rotation": 15},
        {"id": "f", "type": "sticker", "content": "★", "x": 15, "y": 470, "w": 50, "h": 50, "rotation": -20},
    ]},
    {"background": "#ffffff", "elements": [
        {"id": "g", "type": "image", "src": "/books/book-jordan_petra.jpg", "x": 0, "y": 0, "w": 400, "h": 520, "rotation": 0},
        {"id": "h", "type": "text", "content": "رحلة الأردن Jordan Trip!", "x": 20, "y": 30, "w": 360, "h": 80, "font": "Quicksand", "fontSize": 30, "color": "#ffffff", "bold": True, "italic": False, "rotation": 0},
        {"id": "i", "type": "text", "content": "A long caption that has to wrap across several lines exactly like the editor wraps it", "x": 40, "y": 380, "w": 220, "h": 120, "font": "Playfair Display", "fontSize": 17, "color": "#1a1a5e", "bold": False, "italic": True, "rotation": -3},
        {"id": "j", "type": "text", "content": "MIORA", "x": 280, "y": 470, "w": 160, "h": 70, "font": "Londrina Solid", "fontSize": 40, "color": "#D4A853", "bold": True, "italic": False, "rotation": 0},
    ]},
]
json.dump(pages, open(root + "/pages.json", "w"))
print("prepared", root)
