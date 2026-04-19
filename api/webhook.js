# এই command টা browser-এ বা terminal-এ run করো
# [TOKEN] এর জায়গায় তোমার Bot Token দাও
# [YOUR_SITE] এর জায়গায় তোমার Netlify site URL দাও

curl -X POST "https://api.telegram.org/bot[TOKEN]/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://[YOUR_SITE].netlify.app/webhook"}'

# অথবা browser-এ এই URL খোলো:
# https://api.telegram.org/bot[TOKEN]/setWebhook?url=https://[YOUR_SITE].netlify.app/webhook
