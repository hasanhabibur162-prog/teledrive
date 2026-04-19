export default async function handler(req, res) {
  // শুধু POST request গ্রহণ করবে
  if (req.method !== "POST") {
    return res.status(200).send("TeleDrive Bot OK");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
  const APP_URL = process.env.APP_URL || "https://teledrive-wine.vercel.app";
  const BOT_USERNAME = process.env.BOT_USERNAME || "syleax_bot";

  // বডি পার্স করা
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (error) {
    console.log("JSON parse error:", error.message);
    return res.status(200).send("ok");
  }

  // মেসেজ চেক করা
  const message = body?.message;
  if (!message || !message.chat) {
    return res.status(200).send("ok");
  }

  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const text = (message.text || "").trim();
  const firstName = message.from?.first_name || "বন্ধু";
  const userId = message.from?.id;

  console.log(`📩 Received: chatType=${chatType}, text="${text}", chatId=${chatId}`);

  // গ্রুপের জন্য হ্যান্ডলিং
  if (chatType === "group" || chatType === "supergroup") {
    const isCommand = text.startsWith("/");
    const isMentioned = text.toLowerCase().includes(`@${BOT_USERNAME.toLowerCase()}`);
    
    // কমান্ড না এবং mention না থাকলে রিটার্ন
    if (!isCommand && !isMentioned) {
      console.log("⏭️ Skipping - not a command or mention");
      return res.status(200).send("ok");
    }
    
    // mention থেকে বটের নাম বাদ দেওয়া
    let cleanText = text;
    if (isMentioned) {
      cleanText = text.replace(new RegExp(`@${BOT_USERNAME}`, "gi"), "").trim();
      // শুধু mention থাকলে ডিফল্ট মেসেজ
      if (!cleanText && isCommand === false) {
        cleanText = "হ্যালো";
      }
    }
    
    console.log(`✅ Processing group message: "${cleanText}"`);
    await processMessage(BOT_TOKEN, OPENROUTER_KEY, APP_URL, chatId, cleanText, firstName, userId);
    return res.status(200).send("ok");
  }

  // প্রাইভেট চ্যাটের জন্য
  console.log(`✅ Processing private message: "${text}"`);
  await processMessage(BOT_TOKEN, OPENROUTER_KEY, APP_URL, chatId, text, firstName, userId);
  return res.status(200).send("ok");
}

// মেসেজ প্রসেস করার ফাংশন
async function processMessage(BOT_TOKEN, OPENROUTER_KEY, APP_URL, chatId, text, firstName, userId) {
  if (!text || text === "") return;

  console.log(`🤖 Processing: text="${text}", userId=${userId}`);

  // কমান্ড হ্যান্ডলিং
  if (text === "/start") {
    await sendMessage(BOT_TOKEN, chatId,
      `✈️ TeleDrive Bot-এ স্বাগতম, ${firstName}! 🎉\n\nআমি তোমার AI assistant।\n\n📁 /drive — TeleDrive app\n❓ /help — সব commands\n💬 যেকোনো প্রশ্ন করো!\n\n👤 আপনার ID: ${userId}`
    );
    return;
  }

  if (text === "/drive") {
    await sendMessage(BOT_TOKEN, chatId, 
      `🔗 TeleDrive App: ${APP_URL}\n\n🚀 দ্রুত ব্যবহার করুন!`
    );
    return;
  }

  if (text === "/help") {
    await sendMessage(BOT_TOKEN, chatId,
      `📋 *TeleDrive Bot Commands* 📋\n\n/start — বট চালু করুন\n/drive — TeleDrive App লিংক\n/help — এই হেল্প মেসেজ\n\n💬 *যেকোনো প্রশ্ন করলে AI উত্তর দেবে*\n👥 *গ্রুপে ব্যবহার করতে @${process.env.BOT_USERNAME || "syleax_bot"} mention করুন*`,
      "Markdown"
    );
    return;
  }

  // AI রিপ্লাই
  await sendChatAction(BOT_TOKEN, chatId, "typing");
  
  try {
    const aiReply = await askAI(OPENROUTER_KEY, text, firstName);
    
    // রিপ্লাই太长 হলে স্প্লিট করা
    if (aiReply.length > 4000) {
      const parts = splitMessage(aiReply);
      for (const part of parts) {
        await sendMessage(BOT_TOKEN, chatId, part);
      }
    } else {
      await sendMessage(BOT_TOKEN, chatId, aiReply);
    }
  } catch (error) {
    console.error("AI Error:", error.message);
    await sendMessage(BOT_TOKEN, chatId, 
      "❌ দুঃখিত, AI এখন ব্যস্ত আছে। একটু পরে আবার চেষ্টা করুন। 🙏"
    );
  }
}

// টেলিগ্রামে মেসেজ সেন্ড করা
async function sendMessage(token, chatId, text, parseMode = null) {
  try {
    const payload = { chat_id: chatId, text };
    if (parseMode) payload.parse_mode = parseMode;
    
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Telegram API Error:", error);
    }
  } catch (error) {
    console.error("Send Message Error:", error.message);
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
    console.error("Chat Action Error:", error.message);
  }
}

// AI থেকে উত্তর আনা
async function askAI(apiKey, userMessage, firstName) {
  const models = [
    "meta-llama/llama-3.1-8b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "deepseek/deepseek-r1:free",
    "google/gemini-2.0-flash-exp:free"
  ];

  const systemPrompt = `তুমি একজন হেল্পফুল AI অ্যাসিস্ট্যান্ট। ইউজারের নাম ${firstName}। 
উত্তর দাও ইউজার যে ভাষায় প্রশ্ন করবে (বাংলা বা ইংরেজি)।
উত্তর সংক্ষিপ্ত, সঠিক এবং কাজের রাখো।`;

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`🔄 Trying model: ${model}`);
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://teledrive-wine.vercel.app",
          "X-Title": "TeleDrive Bot",
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 500,
          temperature: 0.7,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ Model ${model} failed: ${response.status} - ${errorText}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (content && content.trim()) {
        console.log(`✅ Success with model: ${model}`);
        return content.trim();
      }
    } catch (error) {
      lastError = error;
      console.warn(`❌ Model ${model} error:`, error.message);
      continue;
    }
  }

  throw new Error(lastError?.message || "সব মডেল ব্যর্থ হয়েছে");
}

// লং মেসেজ স্প্লিট করার ফাংশন
function splitMessage(text, maxLength = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += maxLength) {
    parts.push(text.substring(i, i + maxLength));
  }
  return parts;
}
