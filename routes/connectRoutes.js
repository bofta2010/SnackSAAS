const express = require("express");

module.exports = function (supabase) {
  const router = express.Router();

  // ================= PAGE CONNECT =================
  router.get("/connect/:businessId", async (req, res) => {
    const { businessId } = req.params;

    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (!business) {
      return res.send("Commerce introuvable");
    }

    res.send(`
      <html>
        <head>
          <title>Connexion WhatsApp</title>
          <style>
            body {
              font-family: Arial;
              text-align: center;
              padding: 60px;
              background: #f8f9fa;
            }

            .box {
              background: white;
              padding: 30px;
              border-radius: 12px;
              max-width: 500px;
              margin: auto;
              box-shadow: 0 0 20px rgba(0,0,0,0.08);
            }

            a {
              display: inline-block;
              margin-top: 20px;
              padding: 14px 24px;
              background: #25D366;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
            }
          </style>
        </head>

        <body>
          <div class="box">
            <h1>Connexion WhatsApp</h1>
            <p>Commerce : <b>${business.name || "Non défini"}</b></p>
            <p>Activez votre assistant</p>

            <a href="/activate/${business.id}">
              Activer mon assistant
            </a>
          </div>
        </body>
      </html>
    `);
  });

  // ================= ACTIVATE =================
  router.get("/activate/:businessId", async (req, res) => {
    const { businessId } = req.params;

    await supabase
      .from("businesses")
      .update({
        step: "active"
      })
      .eq("id", businessId);

    res.send("✅ Assistant activé");
  });

  return router;
};
