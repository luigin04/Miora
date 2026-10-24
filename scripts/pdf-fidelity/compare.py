"""Compares, for every page:
  screen-N.png  — the browser's own render of the page at print scale
                  (exactly what the editor shows, zoomed 6x)
  raster-N.png  — the PDF pipeline's raster before compression
  the image embedded in album.pdf (extracted losslessly with pdfimages)
Also checks the PDF page size. Usage: python3 compare.py <outDir>"""
import glob, re, subprocess, sys
import numpy as np
from PIL import Image

out = sys.argv[1]
for f in glob.glob(f"{out}/emb-*"):
    __import__("os").remove(f)
subprocess.run(["pdfimages", "-j", f"{out}/album.pdf", f"{out}/emb"], check=True)
info = subprocess.run(["pdfinfo", f"{out}/album.pdf"], capture_output=True, text=True).stdout
size = re.search(r"Page size:\s+([\d.]+) x ([\d.]+) pts", info)
w_mm, h_mm = float(size.group(1)) * 25.4 / 72, float(size.group(2)) * 25.4 / 72
print(f"PDF page size: {w_mm:.1f} x {h_mm:.1f} mm (design ratio 400:520 -> expected 210.0 x 273.0)")
ok = abs(w_mm - 210) < 0.2 and abs(h_mm - 273) < 0.2

embedded = sorted(glob.glob(f"{out}/emb-*.jpg"))
screens = sorted(glob.glob(f"{out}/screen-*.png"))
if len(embedded) != len(screens):
    print(f"page count mismatch: {len(embedded)} in PDF vs {len(screens)} designed"); ok = False
for i, screen_path in enumerate(screens):
    s = np.asarray(Image.open(screen_path).convert("RGB")).astype(int)
    for label, p, limit in [("pipeline raster", f"{out}/raster-{i}.png", 0.05), ("PDF image", embedded[i], 0.5)]:
        im = np.asarray(Image.open(p).convert("RGB")).astype(int)
        if im.shape != s.shape:
            print(f"page {i+1} {label}: size {im.shape} != {s.shape}"); ok = False; continue
        d = np.abs(im - s)
        big = (d.max(axis=2) > 32).mean() * 100
        print(f"page {i+1} vs {label:15s}: {s.shape[1]}x{s.shape[0]}px  mean diff {d.mean():.3f}/255  "
              f"pixels visibly different (>32/255): {big:.4f}%  [limit {limit}%]")
        Image.fromarray(np.clip(d * 4, 0, 255).astype("uint8")).save(f"{out}/diff-{i}-{label.split()[0]}.png")
        if big > limit: ok = False
print("RESULT:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
