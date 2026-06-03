require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();

app.use(bodyParser.json());

/*
==================================
ROOT ROUTE
==================================
*/
app.get("/", (req, res) => {
  res.send("Facebook Lead Webhook Server Running 🚀");
});

/*
==================================
WEBHOOK VERIFICATION
==================================
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
==================================
RECEIVE FACEBOOK WEBHOOK
==================================
*/
app.post("/webhook", async (req, res) => {
  try {
    console.log(
      "================ NEW WEBHOOK RECEIVED ================"
    );

    console.log(JSON.stringify(req.body, null, 2));

    const body = req.body;

    if (body.object === "page") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          console.log("Field:", change.field);

          if (change.field === "leadgen") {
            const leadgen_id = change.value.leadgen_id;

            console.log("Leadgen ID:", leadgen_id);

            /*
            ==================================
            FETCH LEAD DETAILS
            ==================================
            */
            const response = await axios.get(
              `https://graph.facebook.com/v25.0/${leadgen_id}`,
              {
                params: {
                  access_token: process.env.PAGE_ACCESS_TOKEN,
                },
              }
            );

            const leadData = response.data;

            console.log("Lead Data:");
            console.log(JSON.stringify(leadData, null, 2));

            /*
            ==================================
            MAP ALL FACEBOOK FIELDS
            ==================================
            */
            let leadFields = {};

            if (leadData.field_data) {
              leadData.field_data.forEach((field) => {
                leadFields[field.name] = field.values
                  ? field.values.join(", ")
                  : "";
              });
            }

            /*
            ==================================
            BUILD TELEGRAM MESSAGE
            ==================================
            */

            const message = `
🚀 New Education Loan Lead

👤 Name: ${leadFields.full_name || "N/A"}
📧 Email: ${leadFields.email || "N/A"}
📱 Phone: ${leadFields.phone_number || "N/A"}
🏙️ City: ${leadFields.city || "N/A"}

🌍 Country: ${
  leadFields.pick_your_destination_to_study_abroad ||
  "N/A"
}

🎓 University: ${
  leadFields.you_preferred_university ||
  leadFields["you_preferred_university?"] ||
  "N/A"
}

📅 Intake: ${
  leadFields.which_intake_are_you_planning ||
  leadFields["which_intake_are_you_planning?"] ||
  "N/A"
}

💰 Loan Amount: ${
  leadFields["what's_the_loan_amount_you're_looking_for?"] ||
  leadFields.whats_the_loan_amount_youre_looking_for ||
  "N/A"
}

🏦 Loan Type: ${
  leadFields.which_type_of_loan_do_you_want ||
  leadFields["which_type_of_loan_do_you_want?"] ||
  "N/A"
}

✅ Applied Abroad University: ${
  leadFields.have_you_already_applied_to_a_university_abroad ||
  leadFields["have_you_already_applied_to_a_university_abroad?"] ||
  "N/A"
}

🆔 Lead ID: ${leadgen_id}
`;

            console.log("Telegram Message:");
            console.log(message);

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

            console.log("Telegram Response:");
            console.log(telegramResponse.data);

            console.log(
              "✅ Telegram message sent successfully"
            );
          }
        }
      }

      return res.sendStatus(200);
    }

    return res.sendStatus(404);
  } catch (error) {
    console.log("=========== ERROR ===========");

    if (error.response) {
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }

    return res.sendStatus(500);
  }
});

/*
==================================
ENV CHECK
==================================
*/
console.log("===== ENV CHECK =====");

console.log(
  "VERIFY_TOKEN:",
  process.env.VERIFY_TOKEN || "NOT FOUND"
);

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

console.log(
  "TELEGRAM_CHAT_ID:",
  process.env.TELEGRAM_CHAT_ID || "NOT FOUND"
);

console.log("=====================");

/*
==================================
START SERVER
==================================
*/
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});