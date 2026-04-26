with open('/app/index.html', 'r') as f:
    content = f.read()

content = content.replace('<link rel="icon" type="image/png" href="/app-icon.png" sizes="any" />', '<link rel="icon" type="image/png" href="/icons/app-icon.png" sizes="any" />')
content = content.replace('<link rel="apple-touch-icon" href="/app-icon.png" />', '<link rel="apple-touch-icon" href="/icons/ios-app-icon-180.png" />')

content = content.replace('<meta property="og:image" content="/app-icon.png" />', '<meta property="og:image" content="/icons/app-icon.png" />')
content = content.replace('<meta name="twitter:image" content="/app-icon.png" />', '<meta name="twitter:image" content="/icons/app-icon.png" />')

with open('/app/index.html', 'w') as f:
    f.write(content)
