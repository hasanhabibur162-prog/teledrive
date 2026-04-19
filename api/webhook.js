export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("TeleDrive Bot OK");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
  const APP_URL = process.env.APP_URL || "https://teledrive-wine.vercel.app";

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(200).send("ok");
  }

  const message = body?.message;
  if (!message || !message.chat) return res.status(200).send("ok");

  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const text = (message.text || "").trim();
  const firstName = message.from?.first_name || "বন্ধু";
  const userId = message.from?.id;

  if (chatType === "group" || chatType === "supergroup") {
    const isCommand = text.startsWith("/");
    const isMentioned = text.toLowerCase().includes("@syleax_bot");
    if (!isCommand && !isMentioned) return res.status(200).send("ok");
    const cleanText = text.replace(/@syleax_bot/gi, "").trim();
    await processMessage(BOT_TOKEN, OPENROUTER_KEY, APP_URL, chatId, cleanText, firstName, userId);
    return res.status(200).send("ok");
  }

  await processMessage(BOT_TOKEN, OPENROUTER_KEY, APP_URL, chatId, text, firstName, userId);
  return res.status(200).send("ok");
}

async function processMessage(BOT_TOKEN, OPENROUTER_KEY, APP_URL, chatId, text, firstName, userId) {
  if (!text) return;

  if (text === "/start") {
    await sendMessage(BOT_TOKEN, chatId,
      `✈️ TeleDrive Bot-এ স্বাগতম, ${firstName}!\n\nআমি তোমার AI assistant।\n\n📁 /drive — TeleDrive app\n❓ /help — সব commands\n💬 যেকোনো প্রশ্ন করো!\n\nতোমার ID: ${userId}`
    );
    return;
  }

  if (text === "/drive") {
    await sendMessage(BOT_TOKEN, chatId, `🔗 TeleDrive: ${APP_URL}`);
    return;
  }

  if (text === "/help") {
    await sendMessage(BOT_TOKEN, chatId,
      `📋 Commands:\n\n/start — শুরু করো\n/drive — App link\n/help — এই list\n\n💬 যেকোনো কিছু লিখলে AI উত্তর দেবে!\n👥 Group-এ @Syleax_bot mention করো`
    );
    return;
  }

  await sendChatAction(BOT_TOKEN, chatId, "typing");
  try {
    const aiReply = await askAI(OPENROUTER_KEY, text, firstName);
    await sendMessage(BOT_TOKEN, chatId, aiReply);
  } catch (e) {
    await sendMessage(BOT_TOKEN, chatId, "⚠️ AI ব্যস্ত আছে। একটু পরে try করো।\nError: " + e.message);
  }
}

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

async function askAI(apiKey, userMessage, firstName) {
  const models = [
    "meta-llama/llama-3.1-8b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "deepseek/deepseek-r1:free",
  ];

  const systemPrompt = `তুমি একটি helpful assistant। User-এর নাম ${firstName}। বাংলায় বা ইংরেজিতে উত্তর দাও (user যে ভাষায় লিখবে)। উত্তর সংক্ষিপ্ত ও কাজের রাখো।`;

  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://teledrive-wine.vercel.app",
          "X-Title": "TeleDrive Bot",
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content.trim();
    } catch {
      continue;
    }
  }
  throw new Error("সব model fail করেছে");
}
