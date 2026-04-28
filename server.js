const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// ENV
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "mon_token_secret_123";
const BASE_URL = process.env.BASE_URL;

// SUPABASE
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// TEST
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// MENU
app.get("/menu", async (req, res) => {
  const { data, error } = await supabase.from("menus").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ORDER
app.post("/order", async (req, res) => {
  const { snack_id, client_phone, items, total_price } = req.body;

  const { data, error } = await supabase
    .from("orders")
    .insert([{ snack_id, client_phone, items, total_price, status: "new" }])
    .select();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: "Order created", data });
});

// AI ORDER
app.post("/ai-order", async (req, res) => {
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

  res.json({ message: "AI order created", data });
});

// META WHATSAPP VERIFY
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// WHATSAPP RECEIVE MESSAGE
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    const msg =
      body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (msg) {
      const from = msg.from;
      const text = msg.text?.body;

      console.log("Message:", text);

      await fetch(`${BASE_URL}/ai-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          client_phone: from,
          business_id: "test",
        }),
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
