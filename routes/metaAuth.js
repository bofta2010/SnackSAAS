const express = require("express");
const fetch = require("node-fetch");

module.exports = function (supabase) {
  const router = express.Router();

  router.get("/auth/meta/:businessId", (req, res) => {
    const businessId = req.params.businessId;

    const url =
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${process.env.META_APP_ID}` +
      `&redirect_uri=${process.env.META_REDIRECT_URI}` +
      `&scope=whatsapp_business_management,whatsapp_business_messaging` +
      `&state=${businessId}`;

    res.redirect(url);
  });

  router.get("/meta/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code) {
        return res.send("Code OAuth manquant");
      }

      const tokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `client_id=${process.env.META_APP_ID}` +
        `&client_secret=${process.env.META_APP_SECRET}` +
        `&redirect_uri=${process.env.META_REDIRECT_URI}` +
        `&code=${code}`
      );

      const tokenData = await tokenRes.json();

      console.log("TOKEN DATA:", tokenData);

      const access_token = tokenData.access_token;

      if (!access_token) {
        return res.send("Token introuvable");
      }

      const wabaRes = await fetch(
        `https://graph.facebook.com/v19.0/me/whatsapp_business_accounts`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        }
      );

      const wabaData = await wabaRes.json();

      console.log("WABA DATA:", wabaData);

      const waba_id = wabaData.data?.[0]?.id;

      const phoneRes = await fetch(
        `https://graph.facebook.com/v19.0/${waba_id}/phone_numbers`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        }
      );

      const phoneData = await phoneRes.json();

      console.log("PHONE DATA:", phoneData);

      const phone_number_id = phoneData.data?.[0]?.id;

      await supabase
        .from("businesses")
        .update({
          whatsapp_access_token: access_token,
          whatsapp_phone_number_id: phone_number_id,
          waba_id,
          step: "active"
        })
        .eq("id", state);

      res.send("✅ WhatsApp connecté avec succès");
    } catch (err) {
      console.error("META AUTH ERROR:", err);
      res.send("❌ Erreur OAuth");
    }
  });

  return router;
};
