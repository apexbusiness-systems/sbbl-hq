import sys

text = open('src/pages/Live.tsx').read()
text = text.replace("game={(liveGame ?? fallbackBroadcastGame) as any}", "game={(liveGame ?? fallbackBroadcastGame) as NonNullable<typeof liveGame>}")
open('src/pages/Live.tsx', 'w').write(text)
