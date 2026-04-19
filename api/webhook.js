export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("OK");

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
  const APP_URL = process.env.APP_URL || "https://teledrive-wine.vercel.app";

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(200).send("ok"); }

  const message = body?.message;
  if (!message || !message.chat) return res.status(200).send("ok");

  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const text = (message.text || "").trim();
  const firstName = message.from?.first_name || "বন্ধু";

  if (chatType === "group" || chatType === "supergroup") {
    const textLower = text.toLowerCase();
    const isCommand = text.startsWith("/");
    const isMentioned = textLower.includes("@syleax_bot") || textLower.includes("syleax");
    if (!isCommand && !isMentioned) return res.status(200).send("ok");
    const cleanText = text.replace(/@syleax_bot/gi, "").replace(/syleax/gi, "").trim() || "হ্যালো";
    await processMessage(BOT_TOKEN, OPENROUTER_KEY, APP_URL, chatId, cleanText, firstName);
    return res.status(200).send("ok");
  }

  await processMessage(BOT_TOKEN, OPENROUTER_KEY, APP_URL, chatId, text, firstName);
  return res.status(200).send("ok");
}

async function processMessage(token, apiKey, appUrl, chatId, text, firstName) {
  if (!text) return;

  if (text === "/start") {
    await sendMessage(token, chatId,
      `✈️ TeleDrive Bot-এ স্বাগতম, ${firstName}!\n\n` +
      `আমি তোমার AI assistant।\n\n` +
      `📁 /drive — TeleDrive app\n` +
      `❓ /help — সব commands\n` +
      `💬 যেকোনো প্রশ্ন করো!`
    );
    return;
  }

  if (text === "/drive") {
    await sendMessage(token, chatId, `🔗 TeleDrive: ${appUrl}`);
    return;
  }

  if (text === "/help") {
    await sendMessage(token, chatId,
      `📋 Commands:\n\n` +
      `/start — শুরু করো\n` +
      `/drive — App link\n` +
      `/help — এই list\n\n` +
      `💬 যেকোনো কিছু লিখলে AI উত্তর দেবে!\n` +
      `👥 Group-এ @Syleax_bot mention করো`
    );
    return;
  }

  await sendChatAction(token, chatId, "typing");
  const reply = await getAIReply(apiKey, text, firstName);
  await sendMessage(token, chatId, reply);
}

async function getAIReply(apiKey, userMessage, firstName) {
  if (!apiKey) return "🔑 OpenRouter API key সেট নেই।";

  const models = [
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-12b-it:free",
    "meta-llama/llama-3.2-3b-instruct:free",
  ];

  const systemPrompt = `তুমি একজন সহায়ক AI assistant। ইউজারের নাম ${firstName}। বাংলায় বা ইংরেজিতে উত্তর দাও (user যে ভাষায় লিখবে)। উত্তর সংক্ষিপ্ত ও কাজের রাখো।`;

  for (const model of models) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://teledrive-wine.vercel.app",
          "X-Title": "TeleDrive Bot",
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          temperature: 0.7,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (reply && reply.trim()) return reply.trim();
    } catch { continue; }
  }

  return `🙏 দুঃখিত ${firstName}, এখন AI ব্যস্ত আছে। একটু পরে চেষ্টা করো।`;
}

async function sendMessage(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) { console.error("sendMessage error:", e); }
}

async function sendChatAction(token, chatId, action) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (e) { console.error("chatAction error:", e); }
}
