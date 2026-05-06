require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();

app.use(bodyParser.json());

/*
 Webhook Verification
*/
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Webhook verification request received");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verification failed");
  return res.sendStatus(403);
});

/*
 Receive Facebook Lead Webhook
*/
app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook Data:", JSON.stringify(req.body, null, 2));

    const body = req.body;

    if (body.object === "page") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "leadgen") {
            const leadgen_id = change.value.leadgen_id;
            console.log("Leadgen ID:", leadgen_id);

            const response = await axios.get(
              `https://graph.facebook.com/v25.0/${leadgen_id}`,
              {
                params: {
                  access_token: process.env.PAGE_ACCESS_TOKEN,
                },
              }
            );

            const leadData = response.data;
            console.log("Lead Data:", JSON.stringify(leadData, null, 2));

            let name = "";
            let email = "";
            let phone = "";

            leadData.field_data.forEach((field) => {
              if (field.name === "full_name") {
                name = field.values[0];
              }
              if (field.name === "email") {
                email = field.values[0];
              }
              if (field.name === "phone_number") {
                phone = field.values[0];
              }
            });

            const message = `\n🚀 New Facebook Lead\n\n👤 Name: ${name}\n📧 Email: ${email}\n📱 Phone: ${phone}\n`;

            await axios.post(
              `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: message,
              }
            );

            console.log("Telegram message sent successfully");
          }
        }
      }

      return res.sendStatus(200);
    }

    res.sendStatus(404);
  } catch (error) {
    console.log("ERROR:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

/*
 Start Server
*/
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
