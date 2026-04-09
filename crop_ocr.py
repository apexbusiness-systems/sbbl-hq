import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

def process_image(image_path):
    img = Image.open(image_path)

    # Convert to grayscale
    img = img.convert('L')

    # Enhance contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2)

    # Apply a threshold
    img = img.point(lambda x: 0 if x < 140 else 255)

    # img.save('debug_' + image_path)

    text = pytesseract.image_to_string(img, config='--psm 6')
    print(text)

print("=== TGIF ===")
process_image('TGIF STANDINGS (1).jpg')
