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
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ================= SUPABASE =================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= HOME =================
app.get("/", (req, res) => {
  res.send("🚀 Server running");
});

// ================= SEND WHATSAPP =================
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
    console.error("WhatsApp error:", err);
  }
}

// ================= AGENT =================
async function agent(from, text) {
  text = text?.trim().toLowerCase();

  // ================= GET CONVERSATION =================
  let { data: convData } = await supabase
    .from("conversations")
    .select("*")
    .eq("phone", from)
    .limit(1);

  let conversation = convData?.[0];

  if (!conversation) {
    await supabase.from("conversations").insert([
      {
        phone: from,
        step: "idle",
        context: {},
      },
    ]);

    conversation = { step: "idle" };
  }

  // ================= GET BUSINESS =================
  const { data: bizData } = await supabase
    .from("businesses")
    .select("*")
    .eq("phone", from)
    .limit(1);

  const business = bizData?.[0];

  // ================= INSCRIPTION =================
  if (text === "inscription") {
    await supabase
      .from("conversations")
      .update({ step: "ask_name" })
      .eq("phone", from);

    return `🌟 Bienvenue chez AI Assistant

🏪 Quel est le nom de votre commerce ?`;
  }

  // ================= NO BUSINESS =================
  if (!business && conversation.step === "idle") {
    return "Écrivez INSCRIPTION pour commencer 👋";
  }

  // ================= STEP: NAME =================
  if (conversation.step === "ask_name") {
    await supabase.from("businesses").insert([
      {
        phone: from,
        name: text,
        status: "pending",
      },
    ]);

    await supabase
      .from("conversations")
      .update({ step: "ask_category" })
      .eq("phone", from);

    return "📌 Quelle est la catégorie de votre commerce ?";
  }

  // ================= STEP: CATEGORY =================
  if (conversation.step === "ask_category") {
    await supabase
      .from("businesses")
      .update({
        category: text,
        status: "active",
      })
      .eq("phone", from);

    await supabase
      .from("conversations")
      .update({ step: "active" })
      .eq("phone", from);

    return `🎉 Compte activé !

Vous pouvez maintenant ajouter vos produits.`;
  }

  return "Je n'ai pas compris 🤔";
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
    const msg =
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body;

    console.log("Message:", text);

    const reply = await agent(from, text);

    await sendWhatsAppMessage(from, reply);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
