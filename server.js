// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const campaignRoutes = require("./routes/campaigns");
const flwRoutes = require("./routes/flutterwave");

const app = express();
app.use(cors());
app.use(express.json());

// connect db
connectDB(process.env.MONGO_URI);

// routes
app.use("/api/auth", authRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/flutterwave", flwRoutes);

// health
app.get("/", (req, res) => res.send("UZ Driveway Backend up"));

// start
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server listening on ${port}`));
