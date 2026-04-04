import pytesseract
from PIL import Image

img = Image.open('TGIF STANDINGS (1).jpg')
width, height = img.size

# Cut into 3 columns, 2 rows
for r in range(2):
    for c in range(3):
        left = c * (width // 3)
        right = (c + 1) * (width // 3)
        top = r * (height // 2)
        bottom = (r + 1) * (height // 2)

        piece = img.crop((left, top, right, bottom))
        text = pytesseract.image_to_string(piece, config='--psm 6')
        print(f"\n--- Col {c}, Row {r} ---")
        print(text.strip())
