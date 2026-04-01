import pytesseract
from PIL import Image

def process(img_name):
    print(f"\n--- {img_name} ---")
    try:
        img = Image.open(img_name)
        text = pytesseract.image_to_string(img, config='--psm 11')
        print("PSM 11:")
        print(text[:500])

        text4 = pytesseract.image_to_string(img, config='--psm 4')
        print("PSM 4:")
        print(text4[:500])
    except Exception as e:
        print("Error:", e)

process('image.png')
process('TGIF STANDINGS (1).jpg')
