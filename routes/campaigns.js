// routes/campaigns.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Campaign = require("../models/Campaign");
const Donation = require("../models/Donation");
const { v4: uuidv4 } = require("uuid");
const Flutterwave = require("flutterwave-node-v3");

const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

// GET /api/campaigns
router.get("/", async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/campaigns/:id
router.get("/:id", async (req, res) => {
  try {
    const c = await Campaign.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/campaigns (auth)
router.post("/", auth, async (req, res) => {
  const { title, shortDescription, description, goal } = req.body;
  try {
    const campaign = new Campaign({ title, shortDescription, description, goal, owner: req.user._id });
    await campaign.save();
    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/campaigns/:id/donate
// Creates a Flutterwave payment (Standard) and returns the payment link.
// Frontend should redirect the donor to the returned link.
router.post("/:id/donate", async (req, res) => {
  const { id } = req.params;
  const { name, amount, redirect_url } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "Invalid amount" });

  try {
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    // tx_ref should be unique per donation so we can verify later
    const tx_ref = `uzdrv_${id}_${uuidv4()}`;

    // Create a pending donation record (status: pending)
    const donation = new Donation({
      campaign: id,
      name,
      amount: Number(amount),
      status: "pending",
      tx_ref,
    });
    await donation.save();

    // Flutterwave standard payload - returns a payment link in response.data.link
    // Use Flutterwave SDK or direct axios call
    const payload = {
      tx_ref,
      amount: Number(amount),
      currency: "ZMW",       // use ZMW for Zambia
      redirect_url: redirect_url || `${process.env.APP_BASE_URL}/payment-complete?tx_ref=${tx_ref}`,
      customer: {
        name: name || "Anonymous Donor",
        email: req.body.email || "donor@example.com",
      },
      meta: {
        campaignId: id,
        donationId: donation._id.toString(),
      },
    };

    // Use the SDK's standardCreate method via direct HTTP to the v3 payments endpoint
    const result = await flw.Payment.create(payload);
    // result has data.link or result?.data?.link based on response
    const link = result?.data?.link || result?.link || null;
    if (!link) {
      console.warn("Flutterwave create response:", result);
      return res.status(500).json({ message: "Failed to create payment link" });
    }

    res.json({ link, tx_ref, donationId: donation._id });
  } catch (err) {
    console.error("Donate error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
