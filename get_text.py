import pytesseract
from PIL import Image

def process(img_name):
    print(f"\n--- {img_name} ---")
    img = Image.open(img_name)
    # psm 12 usually gets a lot of sparse text
    print(pytesseract.image_to_string(img, config='--psm 11'))

process('image.png')
process('TGIF STANDINGS (1).jpg')
