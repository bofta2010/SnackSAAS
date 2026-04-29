const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// ================= ENV =================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= TEST =================
app.get("/", (req, res) => {
  res.send("🚀 WhatsApp SaaS running");
});


// ================= WHATSAPP SEND =================
async function sendWhatsAppMessage(to, text, phoneNumberId) {
  await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
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
}


// ================= AGENT =================
async function agent(from, text, business) {
  text = text?.toLowerCase();

  // INSCRIPTION FLOW
  if (!business) {
    const { data } = await supabase
      .from("businesses")
      .insert([{ phone: from, step: "ask_name" }])
      .select()
      .single();

    return "👋 Bienvenue ! Quel est le nom de votre commerce ?";
  }

  if (business.step === "ask_name") {
    await supabase
      .from("businesses")
      .update({ name: text, step: "ask_category" })
      .eq("phone", from);

    return "📌 Quelle est la catégorie de votre commerce ?";
  }

  if (business.step === "ask_category") {
    await supabase
      .from("businesses")
      .update({ category: text, step: "connect_whatsapp" })
      .eq("phone", from);

    return `🎉 Inscription terminée !

📲 Maintenant connectez votre WhatsApp ici :
https://ton-domaine.com/connect/${business.id}`;
  }

  // ACTIVE STATE
  if (business.step === "connect_whatsapp") {
    return "⚠️ Vous devez connecter votre WhatsApp pour activer le service.";
  }

  if (business.step === "active") {
    if (text.includes("menu")) {
      return "🍔 Menu: Burger 30dh, Pizza 50dh";
    }

    return "🤖 Je suis votre assistant. Tapez 'menu' pour voir les produits.";
  }

  return "Commande non reconnue.";
}


// ================= WEBHOOK VERIFY =================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});


// ================= WEBHOOK RECEIVE =================
app.post("/webhook", async (req, res) => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;

    const msg = value?.messages?.[0];
    const phone_number_id = value?.metadata?.phone_number_id;

    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body;

    // FIND BUSINESS BY PHONE NUMBER ID
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("whatsapp_phone_number_id", phone_number_id)
      .maybeSingle();

    // AGENT RESPONSE
    const reply = await agent(from, text, business);

    // SEND MESSAGE
    await sendWhatsAppMessage(from, reply, phone_number_id);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});


// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});
