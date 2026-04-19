export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const APP_URL = process.env.APP_URL || "https://teledrive-wine.vercel.app";
  const BOT_USERNAME = process.env.BOT_USERNAME || "Syleax_bot";

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(200).send("ok");
  }

  const message = body?.message;
  if (!message || !message.chat) {
    return res.status(200).send("ok");
  }

  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const text = (message.text || "").trim();
  const firstName = message.from?.first_name || "বন্ধু";

  try {
    if (chatType === "group" || chatType === "supergroup") {
      const isCommand = text.startsWith("/");
      const isMentioned = text.toLowerCase().includes("@" + BOT_USERNAME.toLowerCase());
      
      if (!isCommand && !isMentioned) {
        return res.status(200).send("ok");
      }
      
      let cleanText = text;
      if (isMentioned) {
        cleanText = text.replace(new RegExp("@" + BOT_USERNAME, "gi"), "").trim();
        if (cleanText === "" && !isCommand) {
          cleanText = "হ্যালো";
        }
      }
      
      await processMessage(BOT_TOKEN, GEMINI_API_KEY, APP_URL, chatId, cleanText, firstName);
      return res.status(200).send("ok");
    }

    await processMessage(BOT_TOKEN, GEMINI_API_KEY, APP_URL, chatId, text, firstName);
    return res.status(200).send("ok");
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(200).send("ok");
  }
}

async function processMessage(token, apiKey, appUrl, chatId, text, firstName) {
  if (!text) return;

  if (text === "/start") {
    await sendMessage(token, chatId, "✈️ TeleDrive Bot-এ স্বাগতম, " + firstName + "!\n\nআমি তোমার AI assistant।\n\n📁 /drive — TeleDrive app\n❓ /help — সব commands\n💬 যেকোনো প্রশ্ন করো!");
    return;
  }

  if (text === "/drive") {
    await sendMessage(token, chatId, "🔗 TeleDrive: " + appUrl);
    return;
  }

  if (text === "/help") {
    await sendMessage(token, chatId, "📋 Commands:\n\n/start — শুরু করো\n/drive — App link\n/help — এই list\n\n💬 যেকোনো কিছু লিখলে AI উত্তর দেবে!\n👥 Group-এ @syleax_bot mention করো");
    return;
  }

  await sendChatAction(token, chatId, "typing");
  
  const reply = await getGeminiReply(apiKey, text, firstName);
  await sendMessage(token, chatId, reply);
}

async function getGeminiReply(apiKey, userMessage, firstName) {
  if (!apiKey) {
    return "🔑 API key সেট করা নেই।";
  }

  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" + apiKey;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: "তুমি একজন সহায়ক AI। ইউজারের নাম " + firstName + "। বাংলায় উত্তর দাও। প্রশ্ন: " + userMessage
            }
          ]
        }
      ]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (reply && reply.trim()) {
      return reply.trim();
    } else {
      return "দুঃখিত " + firstName + ", উত্তর দিতে পারলাম না।";
    }
  } catch (error) {
    return "❌ সার্ভারে সমস্যা। একটু পরে চেষ্টা করো।";
  }
}

async function sendMessage(token, chatId, text) {
  try {
    await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });
  } catch (error) {
    console.error("Send message error:", error);
  }
}

async function sendChatAction(token, chatId, action) {
  try {
    await fetch("https://api.telegram.org/bot" + token + "/sendChatAction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: action })
    });
  } catch (error) {
    console.error("Chat action error:", error);
  }
}
