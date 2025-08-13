// routes/flutterwave.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const Donation = require("../models/Donation");
const Campaign = require("../models/Campaign");

// webhook endpoint
router.post("/webhook", express.json({ type: "*/*" }), async (req, res) => {
  try {
    // Flutterwave can be configured with a "verif-hash" in dashboard.
    // The header 'verif-hash' should match our FLW_WEBHOOK_HASH.
    const incomingHash = (req.headers["verif-hash"] || "").toString();
    if (!process.env.FLW_WEBHOOK_HASH) {
      console.warn("FLW_WEBHOOK_HASH not set; skipping webhook hash check (not recommended in prod)");
    } else {
      if (!incomingHash || incomingHash !== process.env.FLW_WEBHOOK_HASH) {
        console.warn("Webhook hash mismatch", { incomingHash });
        return res.status(400).send("hash mismatch");
      }
    }

    const payload = req.body;
    // The structure contains data and event
    const event = payload.event || "";
    const data = payload.data || payload;

    // For successful payments the event is typically 'charge.completed' or data.status === 'successful'
    const tx_ref = data.tx_ref || data.reference || data.flw_ref;
    const flw_tx_id = data.id || data.transaction_id || data.flw_ref;
    const status = data.status || data.payment_status;

    // Only process successful transactions
    if ((status && String(status).toLowerCase() === "successful") || event === "charge.completed") {
      // find donation by tx_ref or donationId in meta
      let donation = null;
      if (tx_ref) donation = await Donation.findOne({ tx_ref });
      // fallback: use meta.donationId if present
      if (!donation && data.meta && data.meta.donationId) {
        donation = await Donation.findById(String(data.meta.donationId));
      }

      if (donation && donation.status !== "successful") {
        donation.status = "successful";
        donation.flw_tx_id = flw_tx_id;
        await donation.save();

        // increment campaign collected
        const campaign = await Campaign.findById(donation.campaign);
        if (campaign) {
          campaign.collected = (campaign.collected || 0) + Number(donation.amount);
          await campaign.save();
        }
      }

      // respond 200 quickly to webhook
      return res.json({ status: "ok" });
    }

    res.json({ status: "ignored" });
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).send("error");
  }
});

// Manual verify endpoint (optional) - verify by tx_ref
router.get("/verify/:tx_ref", async (req, res) => {
  try {
    const tx_ref = req.params.tx_ref;
    // verify via flutterwave verify by reference endpoint:
    const resp = await axios.get(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref)}`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
    });
    res.json(resp.data);
  } catch (err) {
    console.error("Manual verify error:", err?.response?.data || err.message);
    res.status(500).json({ message: "verify failed" });
  }
});

module.exports = router;
