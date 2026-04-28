const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// ================= ENV =================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const BASE_URL = process.env.BASE_URL;

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ================= SUPABASE =================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= TEST =================
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// ================= WHATSAPP SEND =================
async function sendWhatsAppMessage(to, text) {
  try {
    await fetch(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          text: { body: text },
        }),
      }
    );
  } catch (err) {
    console.error("WhatsApp send error:", err);
  }
}

// ================= AGENT LOGIC =================
async function agent(from, text) {
  text = text?.toLowerCase();

  // 🔥 1. INSCRIPTION START
  if (text === "inscription") {
    await supabase.from("businesses").insert([
      {
        phone: from,
        step: "ask_name",
        status: "pending",
      },
    ]);

    return `🌟 Bienvenue chez AI Business Assistant

🏪 Quel est le nom de votre commerce ?`;
  }

  // 🔥 2. GET BUSINESS
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("phone", from)
    .single();

  if (!business) {
    return "Écrivez INSCRIPTION pour commencer 👋";
  }

  // 🔥 3. STEP: ASK NAME
  if (business.step === "ask_name") {
    await supabase
      .from("businesses")
      .update({
        name: text,
        step: "ask_category",
      })
      .eq("phone", from);

    return "📌 Quelle est la catégorie de votre commerce ?";
  }

  // 🔥 4. STEP: ASK CATEGORY
  if (business.step === "ask_category") {
    await supabase
      .from("businesses")
      .update({
        category: text,
        step: "active",
        status: "active",
      })
      .eq("phone", from);

    return `🎉 Votre espace est activé !

Vous pouvez maintenant :
• Ajouter des produits
• Recevoir des commandes

👉 Écrivez "ajouter produit"`;
  }

  // 🔥 5. CLIENT DEFAULT
  if (text === "menu") {
    return "🍔 Menu en cours de configuration...";
  }

  return "Je n'ai pas compris 🤔";
}

// ================= WEBHOOK VERIFY =================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ================= WEBHOOK RECEIVE =================
app.post("/webhook", async (req, res) => {
  try {
    const msg =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (msg) {
      const from = msg.from;
      const text = msg.text?.body;

      console.log("Message:", text);

      // 🤖 AGENT RESPONSE
      const reply = await agent(from, text);

      // 📤 SEND RESPONSE
      await sendWhatsAppMessage(from, reply);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
