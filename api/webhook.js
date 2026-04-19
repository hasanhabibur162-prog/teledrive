export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const APP_URL = process.env.APP_URL || "https://teledrive-wine.vercel.app";
  const BOT_USERNAME = process.env.BOT_USERNAME || "syleax_bot";

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

  // গ্রুপে মেসেজ হ্যান্ডলিং
  if (chatType === "group" || chatType === "supergroup") {
    const isCommand = text.startsWith("/");
    const isMentioned = text.toLowerCase().includes(`@${BOT_USERNAME.toLowerCase()}`);
    
    if (!isCommand && !isMentioned) {
      return res.status(200).send("ok");
    }
    
    let cleanText = text;
    if (isMentioned) {
      cleanText = text.replace(new RegExp(`@${BOT_USERNAME}`, "gi"), "").trim();
      if (!cleanText && !isCommand) cleanText = "হ্যালো";
    }
    
    await processMessage(BOT_TOKEN, GEMINI_API_KEY, APP_URL, chatId, cleanText, firstName, userId);
    return res.status(200).send("ok");
  }

  // প্রাইভেট চ্যাট
  await processMessage(BOT_TOKEN, GEMINI_API_KEY, APP_URL, chatId, text, firstName, userId);
  return res.status(200).send("ok");
}

async function processMessage(BOT_TOKEN, GEMINI_API_KEY, APP_URL, chatId, text, firstName, userId) {
  if (!text) return;

  if (text === "/start") {
    await sendMessage(BOT_TOKEN, chatId, `✈️ TeleDrive Bot-এ স্বাগতম, ${firstName}!\n\nআমি তোমার AI assistant।\n\n📁 /drive — TeleDrive app\n❓ /help — সব commands\n💬 যেকোনো প্রশ্ন করো!\n\nতোমার ID: ${userId}`);
    return;
  }

  if (text === "/drive") {
    await sendMessage(BOT_TOKEN, chatId, `🔗 TeleDrive: ${APP_URL}`);
    return;
  }

  if (text === "/help") {
    await sendMessage(BOT_TOKEN, chatId, `📋 Commands:\n\n/start — শুরু করো\n/drive — App link\n/help — এই list\n\n💬 যেকোনো কিছু লিখলে AI উত্তর দেবে!\n👥 Group-এ @syleax_bot mention করো`);
    return;
  }

  await sendChatAction(BOT_TOKEN, chatId, "typing");
  
  try {
    const aiReply = await askGemini(GEMINI_API_KEY, text, firstName);
    await sendMessage(BOT_TOKEN, chatId, aiReply);
  } catch (e) {
    console.error("AI Error:", e.message);
    await sendMessage(BOT_TOKEN, chatId, "❌ AI reply করতে পারেনি। একটু পরে try করো।");
  }
}

async function askGemini(apiKey, userMessage, firstName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `তুমি একজন সহায়ক AI। ইউজারের নাম ${firstName}। বাংলায় উত্তর দাও। প্রশ্ন: ${userMessage}` }]
      }]
    })
  });
  
  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!reply) throw new Error("No reply from Gemini");
  return reply.trim();
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
