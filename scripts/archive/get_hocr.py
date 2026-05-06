import pytesseract
from PIL import Image

def process():
    img = Image.open('TGIF STANDINGS (1).jpg').convert('L')
    # Use config that tries to assume a uniform block of text
    data = pytesseract.image_to_data(img, config='--psm 11', output_type=pytesseract.Output.DICT)

    words = []
    for i in range(len(data['text'])):
        if int(data['conf'][i]) > 10 and data['text'][i].strip() != '':
            words.append((data['top'][i], data['left'][i], data['text'][i]))

    # sort by top (Y) then left (X)
    words.sort(key=lambda x: (x[0] // 20, x[1]))

    current_y = -1
    line = []
    for w in words:
        if current_y == -1 or abs(w[0] - current_y) < 20:
            line.append(w[2])
            current_y = w[0]
        else:
            print(" ".join(line))
            line = [w[2]]
            current_y = w[0]
    print(" ".join(line))

process()
