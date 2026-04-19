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
    
    // কমান্ড না এবং mention না থাকলে কিছু করবে না
    if (!isCommand && !isMentioned) {
      return res.status(200).send("ok");
    }
    
    // mention থেকে বটের নাম বাদ দেওয়া
    let cleanText = text;
    if (isMentioned) {
      cleanText = text.replace(new RegExp(`@${BOT_USERNAME}`, "gi"), "").trim();
      if (!cleanText && !isCommand) {
        cleanText = "হ্যালো";
      }
    }
    
    // AI উত্তর পাঠানো
    await sendAIResponse(BOT_TOKEN, GEMINI_API_KEY, chatId, cleanText, firstName);
    return res.status(200).send("ok");
  }

  // প্রাইভেট চ্যাট
  await sendAIResponse(BOT_TOKEN, GEMINI_API_KEY, chatId, text, firstName);
  return res.status(200).send("ok");
}

// AI রেসপন্স পাঠানোর ফাংশন
async function sendAIResponse(BOT_TOKEN, GEMINI_API_KEY, chatId, messageText, firstName) {
  // কমান্ড চেক করা
  if (messageText === "/start") {
    await sendMessage(BOT_TOKEN, chatId, `✈️ TeleDrive Bot-এ স্বাগতম, ${firstName}!\n\nআমি তোমার AI assistant।\n\n📁 /drive — TeleDrive app\n❓ /help — সব commands\n💬 যেকোনো প্রশ্ন করো!`);
    return;
  }

  if (messageText === "/drive") {
    await sendMessage(BOT_TOKEN, chatId, `🔗 TeleDrive App: ${process.env.APP_URL || "https://teledrive-wine.vercel.app"}`);
    return;
  }

  if (messageText === "/help") {
    await sendMessage(BOT_TOKEN, chatId, `📋 Commands:\n\n/start — শুরু করো\n/drive — App link\n/help — এই list\n\n💬 যেকোনো কিছু লিখলে AI উত্তর দেবে!\n👥 Group-এ @${process.env.BOT_USERNAME || "syleax_bot"} mention করো`);
    return;
  }

  // টাইপিং ইন্ডিকেটর দেখানো
  await sendChatAction(BOT_TOKEN, chatId, "typing");
  
  // Gemini থেকে উত্তর আনা
  const aiReply = await getGeminiReply(GEMINI_API_KEY, messageText, firstName);
  await sendMessage(BOT_TOKEN, chatId, aiReply);
}

// Gemini API কল করার ফাংশন
async function getGeminiReply(apiKey, userMessage, firstName) {
  // API key চেক
  if (!apiKey) {
    return "🔑 API key সেট করা নেই। অ্যাডমিনকে জানান।";
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `তুমি একজন বন্ধুসুলভ AI সহায়ক। ইউজারের নাম ${firstName}। ইউজার বাংলাতে কথা বলে। তুমিও বাংলাতে উত্তর দাও। উত্তর ছোট ও সাহায্যকারী হও।
              
ইউজারের প্রশ্ন: ${userMessage}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    // উত্তর বের করা
    let reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (reply && reply.trim()) {
      return reply.trim();
    } else {
      // Fallback উত্তর
      return `🙏 দুঃখিত, ${firstName}। আমি এখন উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন।`;
    }
    
  } catch (error) {
    console.error("Gemini error:", error);
    return "❌ সার্ভারে সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।";
  }
}

// টেলিগ্রামে মেসেজ পাঠানো
async function sendMessage(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: text,
        parse_mode: "HTML"
      }),
    });
  } catch (error) {
    console.error("Send message error:", error);
  }
}

// টাইপিং ইন্ডিকেটর
async function sendChatAction(token, chatId, action) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (error) {
    console.error("Chat action error:", error);
  }
}
