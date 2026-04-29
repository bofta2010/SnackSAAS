const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");
const connectRoutes = require("./routes/connectRoutes");
const metaAuthRoutes = require("./routes/metaAuth");

const app = express();
app.use(express.json());

// ================= ENV =================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const BASE_URL = process.env.BASE_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
app.use("/", metaAuthRoutes(supabase));
app.use("/", connectRoutes(supabase));
console.log("SUPABASE KEY START:", SUPABASE_KEY.slice(0, 20));

// ================= TEST =================
app.get("/", (req, res) => {
  res.send("🚀 WhatsApp SaaS running");
});

// ================= SEND WHATSAPP =================
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

// ================= FIND BUSINESS (IMPORTANT FIX) =================
async function findBusiness(from, phone_number_id) {
  let business = null;

  // 1. try WhatsApp API routing
  if (phone_number_id) {
    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("whatsapp_phone_number_id", phone_number_id)
      .maybeSingle();

    if (data) return data;
  }

  // 2. fallback onboarding (phone-based)
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("phone", from)
    .maybeSingle();

  if (data) return data;

  return null;
}

// ================= AGENT =================
async function agent(from, text, business) {
  text = text?.trim();

  // ================= NO BUSINESS → START =================
  if (!business) {
  console.log("❌ BUSINESS NOT FOUND");

  const { data, error } = await supabase
    .from("businesses")
    .insert([
      {
        phone: from,
        step: "ask_name",
      },
    ])
    .select()
    .single();

  console.log("🟢 INSERT DATA:", data);
  console.log("🔴 INSERT ERROR:", error);

  if (error) {
    return `Erreur DB: ${error.message}`;
  }

  return "👋 Bienvenue ! Quel est le nom de votre commerce ?";
}

  // ================= STEP 1: NAME =================
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

  // ================= STEP 2: CATEGORY =================
  if (business.step === "ask_category") {
    await supabase
      .from("businesses")
      .update({
        category: text,
        step: "connect_whatsapp",
      })
      .eq("phone", from);

    return `🎉 Inscription terminée !

📲 Maintenant connectez votre WhatsApp ici:
${BASE_URL}/connect/${business.id}`;
  }

  // ================= CONNECT WHATSAPP =================
  if (business.step === "connect_whatsapp") {
    return "⚠️ Veuillez connecter votre WhatsApp pour activer votre assistant.";
  }

  // ================= ACTIVE =================
  if (business.step === "active") {
    if (text.toLowerCase().includes("menu")) {
      return "🍔 Menu: Burger 30dh, Pizza 50dh";
    }

    return "🤖 Assistant actif. Écrivez 'menu' pour voir les produits.";
  }

  return "Commande non comprise 🤔";
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

    console.log("📩 MESSAGE:", from, text);

    // ================= FIND BUSINESS =================
    const business = await findBusiness(from, phone_number_id);

    console.log("🏪 BUSINESS:", business);

    // ================= GET REPLY =================
    const reply = await agent(from, text, business);

    // ================= SEND RESPONSE =================
    await sendWhatsAppMessage(from, reply, phone_number_id);

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR:", err);
    res.sendStatus(500);
  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});
