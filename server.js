require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();

app.use(bodyParser.json());

/*
==================================
ENV CHECK
==================================
*/
console.log("===== ENV CHECK =====");

console.log("VERIFY_TOKEN:", process.env.VERIFY_TOKEN);

console.log(
  "PAGE_ACCESS_TOKEN:",
  process.env.PAGE_ACCESS_TOKEN
    ? process.env.PAGE_ACCESS_TOKEN.substring(0, 20) + "..."
    : "NOT FOUND"
);

console.log(
  "TELEGRAM_BOT_TOKEN:",
  process.env.TELEGRAM_BOT_TOKEN
    ? process.env.TELEGRAM_BOT_TOKEN.substring(0, 15) + "..."
    : "NOT FOUND"
);

console.log("TELEGRAM_CHAT_ID:", process.env.TELEGRAM_CHAT_ID);

console.log("=====================");

/*
==================================
ROOT
==================================
*/
app.get("/", (req, res) => {
  res.send("Facebook Lead Webhook Server Running 🚀");
});

/*
==================================
WEBHOOK VERIFY
==================================
*/
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Webhook verification request received");

  if (
    mode === "subscribe" &&
    token === process.env.VERIFY_TOKEN
  ) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verification failed");
  return res.sendStatus(403);
});

/*
==================================
RECEIVE LEAD
==================================
*/
app.post("/webhook", async (req, res) => {
  try {
    console.log(
      "\n================ NEW WEBHOOK RECEIVED ================\n"
    );

    console.log("Webhook Data:");
    console.log(JSON.stringify(req.body, null, 2));

    const body = req.body;

    if (body.object !== "page") {
      console.log("Unknown object");
      return res.sendStatus(404);
    }

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        console.log("Field:", change.field);

        if (change.field !== "leadgen") continue;

        const leadgen_id = change.value.leadgen_id;

        console.log("Leadgen ID:", leadgen_id);

        /*
        ==================================
        FETCH LEAD DATA
        ==================================
        */
        const leadResponse = await axios.get(
          `https://graph.facebook.com/v25.0/${leadgen_id}`,
          {
            params: {
              access_token:
                process.env.PAGE_ACCESS_TOKEN,
            },
          }
        );

        const leadData = leadResponse.data;

        console.log("\nLead Data:");
        console.log(JSON.stringify(leadData, null, 2));

        let name = "";
        let email = "";
        let phone = "";

        if (leadData.field_data) {
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
        }

        /*
        ==================================
        TELEGRAM MESSAGE
        ==================================
        */
        const message = `
🚀 New Facebook Lead

👤 Name: ${name}
📧 Email: ${email}
📱 Phone: ${phone}

🆔 Lead ID: ${leadgen_id}
`;

        console.log("\nSending Telegram Message...");
        console.log(message);

        console.log(
          "Bot Token Exists:",
          !!process.env.TELEGRAM_BOT_TOKEN
        );

        console.log(
          "Chat ID:",
          process.env.TELEGRAM_CHAT_ID
        );

        /*
        ==================================
        SEND TO TELEGRAM
        ==================================
        */
        const telegramResponse = await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: message,
          }
        );

        console.log(
          "\nTelegram Response:"
        );

        console.log(
          JSON.stringify(
            telegramResponse.data,
            null,
            2
          )
        );

        console.log(
          "Telegram message sent successfully ✅"
        );
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.log(
      "\n=========== ERROR ==========="
    );

    if (error.response) {
      console.log(
        "Status:",
        error.response.status
      );

      console.log(
        JSON.stringify(
          error.response.data,
          null,
          2
        )
      );
    } else {
      console.log(error.message);
    }

    return res.sendStatus(500);
  }
});

/*
==================================
START SERVER
==================================
*/
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});