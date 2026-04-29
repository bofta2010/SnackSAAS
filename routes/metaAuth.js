const express = require("express");

module.exports = function (supabase) {
  const router = express.Router();

  // ================= OAUTH START =================
  router.get("/auth/meta/:businessId", (req, res) => {
    const businessId = req.params.businessId;

    const url =
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${process.env.META_APP_ID}` +
      `&redirect_uri=${process.env.META_REDIRECT_URI}` +
      `&scope=whatsapp_business_messaging,whatsapp_business_management` +
      `&state=${businessId}`;

    res.redirect(url);
  });

  // ================= OAUTH CALLBACK =================
  router.get("/meta/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      const businessId = state;

      // 1. exchange code → token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?` +
          `client_id=${process.env.META_APP_ID}` +
          `&client_secret=${process.env.META_APP_SECRET}` +
          `&redirect_uri=${process.env.META_REDIRECT_URI}` +
          `&code=${code}`
      );

      const tokenData = await tokenRes.json();
      const access_token = tokenData.access_token;

      // 2. get WABA
      const wabaRes = await fetch(
        `https://graph.facebook.com/v19.0/me/whatsapp_business_accounts`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      const wabaData = await wabaRes.json();
      const waba_id = wabaData.data?.[0]?.id;

      // 3. get phone number
      const phoneRes = await fetch(
        `https://graph.facebook.com/v19.0/${waba_id}/phone_numbers`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      const phoneData = await phoneRes.json();
      const phone_number_id = phoneData.data?.[0]?.id;

      // 4. save DB
      await supabase
        .from("businesses")
        .update({
          whatsapp_access_token: access_token,
          whatsapp_phone_number_id: phone_number_id,
          waba_id,
          step: "active",
        })
        .eq("id", businessId);

      res.send("✅ WhatsApp connecté avec succès !");
    } catch (err) {
      console.error(err);
      res.send("❌ Erreur connexion WhatsApp");
    }
  });

  return router;
};
