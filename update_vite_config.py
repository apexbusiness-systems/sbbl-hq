import re

with open('/app/vite.config.ts', 'r') as f:
    content = f.read()

icons_replacement = """icons: [
            { src: "/icons/app-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/app-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: "/icons/google-play-icon-36.png", sizes: "36x36", type: "image/png" },
            { src: "/icons/google-play-icon-48.png", sizes: "48x48", type: "image/png" },
            { src: "/icons/google-play-icon-72.png", sizes: "72x72", type: "image/png" },
            { src: "/icons/google-play-icon-96.png", sizes: "96x96", type: "image/png" },
            { src: "/icons/google-play-icon-144.png", sizes: "144x144", type: "image/png" },
            { src: "/icons/google-play-icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/google-play-icon-512.png", sizes: "512x512", type: "image/png" }
          ]"""

content = re.sub(r'icons:\s*\[[\s\S]*?\]', icons_replacement, content)
content = content.replace('includeAssets: ["favicon.svg", "robots.txt", "icons/apple-touch-icon.svg"]', 'includeAssets: ["favicon.svg", "robots.txt", "icons/apple-touch-icon.svg", "icons/ios-app-icon-180.png"]')

with open('/app/vite.config.ts', 'w') as f:
    f.write(content)
