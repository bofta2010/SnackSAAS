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
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const BASE_URL = process.env.BASE_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= ROUTES =================
app.use("/", connectRoutes(supabase));
app.use("/", metaAuthRoutes(supabase));

// ================= TEST =================
app.get("/", (req, res) => {
  res.send("🚀 WhatsApp SaaS running");
});

// ================= SEND =================
async function sendWhatsAppMessage(to, text, phoneNumberId) {
  const response = await fetch(
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

  const data = await response.json();
  console.log("META RESPONSE:", data);
}

// ================= FIND BUSINESS =================
async function findBusiness(phone_number_id) {
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("whatsapp_phone_number_id", phone_number_id)
    .maybeSingle();

  return data;
}

// ================= ONBOARDING =================
async function onboarding(from, text) {
  let { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("phone", from)
    .maybeSingle();

  if (!business) {
    const { data } = await supabase
      .from("businesses")
      .insert([
        {
          phone: from,
          step: "ask_name",
        },
      ])
      .select()
      .single();

    return "👋 Bienvenue ! Quel est le nom de votre commerce ?";
  }

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

  if (business.step === "ask_category") {
    await supabase
      .from("businesses")
      .update({
        category: text,
        step: "connect_whatsapp",
      })
      .eq("phone", from);

    return `🎉 Inscription terminée !

📲 Connectez votre WhatsApp ici :
${BASE_URL}/connect/${business.id}`;
  }

  if (business.step === "connect_whatsapp") {
    return `Connectez votre WhatsApp ici :
${BASE_URL}/connect/${business.id}`;
  }

  return "Votre compte est déjà actif ✅";
}

// ================= CLIENT AGENT =================
async function clientAgent(text, business) {
  if (text.toLowerCase().includes("menu")) {
    return `🍔 Menu de ${business.name}
Burger - 30dh
Pizza - 50dh`;
  }

  return `🤖 Bienvenue chez ${business.name}
Écrivez "menu"`;
}

// ================= WEBHOOK VERIFY =================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// ================= WEBHOOK RECEIVE =================
app.post("/webhook", async (req, res) => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;

    const msg = value?.messages?.[0];
    const phone_number_id = value?.metadata?.phone_number_id;

    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body || "";

    console.log("MESSAGE:", from, text);

    // Numéro master → onboarding commerçant
    if (phone_number_id === PHONE_NUMBER_ID) {
      const reply = await onboarding(from, text);
      await sendWhatsAppMessage(from, reply, phone_number_id);
      return res.sendStatus(200);
    }

    // Numéro commerçant
    const business = await findBusiness(phone_number_id);

    console.log("BUSINESS:", business);

    if (!business) {
      return res.sendStatus(200);
    }

    const reply = await clientAgent(text, business);

    await sendWhatsAppMessage(from, reply, phone_number_id);

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(500);
  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on", PORT);
});
