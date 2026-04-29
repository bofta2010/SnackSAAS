const express = require("express");

module.exports = function (supabase) {
  const router = express.Router();

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
        <body style="font-family:Arial;text-align:center;padding:60px;">
          <h1>Connexion WhatsApp</h1>
          <p><b>${business.name}</b></p>
          <p>Connectez votre numéro WhatsApp Business</p>

          <a href="/auth/meta/${business.id}"
             style="
               background:#25D366;
               color:white;
               padding:16px 28px;
               text-decoration:none;
               border-radius:10px;
               font-size:18px;
             ">
             Connecter WhatsApp
          </a>
        </body>
      </html>
    `);
  });

  return router;
};
