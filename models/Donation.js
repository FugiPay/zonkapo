// models/Donation.js
const mongoose = require("mongoose");

const DonationSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
  name: { type: String },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["pending", "successful", "failed"], default: "pending" },
  flw_tx_id: { type: String },   // Flutterwave transaction id
  tx_ref: { type: String },      // our tx_ref (unique merchant ref)
}, { timestamps: true });

module.exports = mongoose.model("Donation", DonationSchema);
