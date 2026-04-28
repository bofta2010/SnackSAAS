const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// =====================
// 🔐 ENV VARIABLES
// =====================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "mon_token_secret_123";

// =====================
// 🔗 SUPABASE CLIENT
// =====================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =====================
// 🧪 TEST ROUTE
// =====================
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// =====================
// 📦 GET MENU
// =====================
app.get("/menu", async (req, res) => {
  const { data, error } = await supabase.from("menus").select("*");

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

// =====================
// 🛒 CREATE ORDER MANUAL
// =====================
app.post("/order", async (req, res) => {
  const { snack_id, client_phone, items, total_price } = req.body;

  const { data, error } = await supabase
    .from("orders")
    .insert([
      {
        snack_id,
        client_phone,
        items,
        total_price,
        status: "new",
      },
    ])
    .select();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: "Order created", data });
});

// =====================
// 🤖 AI ORDER SYSTEM
// =====================
app.post("/ai-order", async (req, res) => {
  try {
    const { message, business_id, client_phone } = req.body;

    let product = "Burger";
    let price = 30;

    if (message?.toLowerCase().includes("coca")) {
      product = "Burger + Coca";
      price = 40;
    }

    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          business_id,
          client_phone,
          items: { product, quantity: 1 },
          total_price: price,
          status: "new",
        },
      ])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      message: "AI order created",
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// 📡 WHATSAPP WEBHOOK (VERIFY)
// =====================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// =====================
// 📩 WHATSAPP MESSAGES RECEIVER
// =====================
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (body.object === "whatsapp_business_account") {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const messages = changes?.value?.messages;

      if (messages) {
        const msg = messages[0];

        const from = msg.from;
        const text = msg.text?.body;

        console.log("📩 Message reçu:", text);

        // 🔁 Send to AI order system
        await fetch(`${process.env.BASE_URL}/ai-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            client_phone: from,
            business_id: "test",
          }),
        });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// =====================
// 🚀 START SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
