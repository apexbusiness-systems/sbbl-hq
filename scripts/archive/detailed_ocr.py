import pytesseract
from PIL import Image, ImageEnhance

def get_text(img_path):
    print(f"\nProcessing {img_path}...")
    img = Image.open(img_path).convert('L')
    img = ImageEnhance.Contrast(img).enhance(2.0)

    # Try different PSMs
    for psm in [4, 6, 11, 12]:
        print(f"\n--- PSM {psm} ---")
        text = pytesseract.image_to_string(img, config=f'--psm {psm}')
        for line in text.split('\n'):
            if line.strip():
                print(line.strip())

get_text('TGIF STANDINGS (1).jpg')
get_text('image.png')
