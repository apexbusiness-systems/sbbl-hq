import pytesseract
from PIL import Image, ImageEnhance
import pandas as pd

def extract_data(filename):
    img = Image.open(filename).convert('L')
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)

    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)

    words = []
    for i in range(len(data['text'])):
        text = data['text'][i].strip()
        if text:
            words.append({
                'text': text,
                'left': data['left'][i],
                'top': data['top'][i],
                'width': data['width'][i],
                'height': data['height'][i]
            })

    df = pd.DataFrame(words)
    # Sort by top (y) then left (x)
    df = df.sort_values(by=['top', 'left'])

    print(f"--- {filename} ---")
    current_y = -1
    line = []
    for _, row in df.iterrows():
        if current_y == -1 or abs(row['top'] - current_y) < 15:
            line.append(row['text'])
            if current_y == -1:
                current_y = row['top']
            else:
                current_y = (current_y + row['top']) / 2
        else:
            print(" ".join(line))
            line = [row['text']]
            current_y = row['top']
    if line:
        print(" ".join(line))

extract_data('TGIF STANDINGS (1).jpg')
