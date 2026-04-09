import pytesseract
from PIL import Image, ImageEnhance

img = Image.open('TGIF STANDINGS (1).jpg').convert('L')
enhancer = ImageEnhance.Contrast(img)
img = enhancer.enhance(2.0)

width, height = img.size
rows, cols = 3, 3

for r in range(rows):
    for c in range(cols):
        left = c * (width // cols)
        right = (c + 1) * (width // cols)
        top = r * (height // rows)
        bottom = (r + 1) * (height // rows)

        piece = img.crop((left, top, right, bottom))
        text = pytesseract.image_to_string(piece, config='--psm 6')
        print(f"\n--- Col {c}, Row {r} ---")
        print(text.strip())
