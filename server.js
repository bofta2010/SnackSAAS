const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// Connexion Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 🔹 Route test (afficher menu)
app.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("menus")
    .select("*");

  if (error) {
    return res.send("Error: " + error.message);
  }

  res.json(data);
});

// 🔹 Route pour créer une commande
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
        status: "new"
      }
    ]);

  

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: "Order created", data });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

app.post("/ai-order", async (req, res) => {
  const { message, snack_id, client_phone } = req.body;

  // 🧠 mini "AI" simple (version MVP)
  let product = "Burger";
  let price = 30;

  if (message.toLowerCase().includes("coca")) {
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
        status: "new"
      }
    ]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    message: "AI order created",
    order: data
  });
});
