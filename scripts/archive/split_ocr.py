import pytesseract
from PIL import Image

def process():
    img = Image.open('TGIF STANDINGS (1).jpg')
    width, height = img.size

    # split into 4 pieces
    tiles = [
        img.crop((0, 0, width//2, height//2)),
        img.crop((width//2, 0, width, height//2)),
        img.crop((0, height//2, width//2, height)),
        img.crop((width//2, height//2, width, height))
    ]

    for i, t in enumerate(tiles):
        print(f"\n--- Tile {i} ---")
        print(pytesseract.image_to_string(t, config='--psm 6'))

process()
