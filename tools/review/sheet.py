"""Contact sheet of rendered frames: python tools/review/sheet.py <frames_dir> <out.jpg> [cols] [thumb_w]"""
import sys, glob, os
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 480
files = sorted(glob.glob(os.path.join(src, 'f_*.png')))
if not files: sys.exit('no frames')
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
th = int(tw * h / w)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 20)), (18, 18, 18))
d = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * tw, (i // cols) * (th + 20)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 20))
    d.text((x + 6, y + 4), os.path.basename(f), fill=(230, 230, 230))
sheet.save(out, quality=88)
print(out, sheet.size)
