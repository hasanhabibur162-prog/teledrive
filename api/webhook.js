export default async function handler(req, res) {
  // Vercel compatible
  if (req.method !== "POST") {
    return res.status(200).send("TeleDrive Bot OK");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const OPENROUTER_KEY = process.env.OPENROUTER_KEY;

  const body = req.body;
  const message = body.message;
  if (!message) return res.status(200).send("ok");

  const chatId = message.chat.id;
  const text = message.text || "";
  const firstName = message.from?.first_name || "বন্ধু";
  const userId = message.from?.id;

  // Document/file upload
  if (message.document || message.photo || message.video || message.audio) {
    await sendMessage(BOT_TOKEN, chatId, `✅ File পেয়েছি! TeleDrive-এ save হয়ে গেছে।`);
    return res.status(200).send("ok");
  }

  // /start command
  if (text === "/start") {
    const welcome = `✈️ TeleDrive Bot-এ স্বাগতম, ${firstName}!\n\nআমি তোমার personal assistant। যা করতে পারি:\n\n📁 /drive — TeleDrive app খোলো\n❓ যেকোনো প্রশ্ন করো — AI দিয়ে উত্তর দেবো\n📤 File পাঠাও — Cloud-এ save হবে\n\nতোমার ID: ${userId}`;
    await sendMessage(BOT_TOKEN, chatId, welcome);
    return res.status(200).send("ok");
  }

  // /drive command
  if (text === "/drive") {
    await sendMessage(BOT_TOKEN, chatId,
      `🔗 তোমার TeleDrive: ${process.env.APP_URL || "https://teledrive-wine.vercel.app"}`
    );
    return res.status(200).send("ok");
  }

  // /help command
  if (text === "/help") {
    const help = `📋 Commands:\n\n/start — শুরু করো\n/drive — TeleDrive app link\n/help — এই list\n\n💬 যেকোনো কিছু লিখলে AI উত্তর দেবে!`;
    await sendMessage(BOT_TOKEN, chatId, help);
    return res.status(200).send("ok");
  }

  // AI reply
  if (text) {
    await sendChatAction(BOT_TOKEN, chatId, "typing");
    try {
      const aiReply = await askAI(OPENROUTER_KEY, text, firstName);
      await sendMessage(BOT_TOKEN, chatId, aiReply);
    } catch (e) {
      await sendMessage(BOT_TOKEN, chatId, "❌ AI reply করতে পারেনি। একটু পরে try করো।");
    }
  }

  return res.status(200).send("ok");
}

// ── Telegram helpers ──────────────────────────────────────────
async function sendMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendChatAction(token, chatId, action) {
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

// ── OpenRouter AI ─────────────────────────────────────────────
async function askAI(apiKey, userMessage, firstName) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://teledrive-wine.vercel.app",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-r1:free",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `তুমি একটি helpful Telegram bot assistant। User-এর নাম ${firstName}। বাংলায় বা ইংরেজিতে উত্তর দাও (user যে ভাষায় লিখবে)। উত্তর সংক্ষিপ্ত ও কাজের রাখো।`
        },
        { role: "user", content: userMessage }
      ],
    }),
  });

  const data = await res.json();
  if (!data.choices?.[0]?.message?.content) throw new Error("No response");
  return data.choices[0].message.content.trim();
}
