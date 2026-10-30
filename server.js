
require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

// ==========================================
// ROOT ROUTE
// ==========================================

app.get("/", (req, res) => {
  res.send("Facebook Lead Webhook Server Running 🚀");
});

// ==========================================
// FACEBOOK WEBHOOK VERIFICATION
// ==========================================

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Facebook Webhook Verification Request");

  if (
    mode === "subscribe" &&
    token === process.env.VERIFY_TOKEN
  ) {
    console.log("✅ Webhook Verified Successfully");
    return res.status(200).send(challenge);
  }

  console.log("❌ Webhook Verification Failed");
  return res.sendStatus(403);
});

// ==========================================
// SEND TELEGRAM MESSAGE
// ==========================================

async function sendTelegramMessage(
  botToken,
  chatId,
  message
) {
  if (!botToken || !chatId) {
    throw new Error("Telegram Bot Token or Chat ID missing");
  }

  const telegramURL =
    `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await axios.post(telegramURL, {
    chat_id: chatId,
    text: message
  });

  if (!response.data.ok) {
    throw new Error("Telegram message sending failed");
  }

  console.log("✅ Telegram Message Sent Successfully");
}

// ==========================================
// EXTRACT FACEBOOK LEAD FIELDS
// ==========================================

function extractLeadFields(leadData) {
  const fields = {};

  if (Array.isArray(leadData.field_data)) {
    leadData.field_data.forEach((field) => {
      fields[field.name] = Array.isArray(field.values)
        ? field.values.join(", ")
        : "";
    });
  }

  return fields;
}

// ==========================================
// GET FIELD VALUE
// ==========================================

function getField(fields, possibleNames) {
  for (const name of possibleNames) {
    if (
      fields[name] !== undefined &&
      fields[name] !== ""
    ) {
      return fields[name];
    }
  }

  return "N/A";
}

// ==========================================
// FORMAT FIELD LABEL
// ==========================================

function formatFieldName(name) {
  return name
    .replace(/_/g, " ")
    .replace(/\?/g, "")
    .replace(/\b\w/g, char => char.toUpperCase());
}

// ==========================================
// EDUCATION LOAN MESSAGE
// ==========================================

function buildEducationMessage(fields, leadId) {

  return `
🎓 NEW EDUCATION LOAN LEAD
━━━━━━━━━━━━━━━━━━━━

👤 Name: ${getField(fields, ["full_name"])}
📧 Email: ${getField(fields, ["email"])}
📱 Phone: ${getField(fields, ["phone_number"])}
🏙️ City: ${getField(fields, ["city"])}

🌍 Country:
${getField(fields, [
  "pick_your_destination_to_study_abroad"
])}

🎓 University:
${getField(fields, [
  "you_preferred_university",
  "you_preferred_university?"
])}

📅 Intake:
${getField(fields, [
  "which_intake_are_you_planning",
  "which_intake_are_you_planning?"
])}

💰 Loan Amount:
${getField(fields, [
  "what's_the_loan_amount_youre_looking_for",
  "what's_the_loan_amount_you're_looking_for?",
  "whats_the_loan_amount_youre_looking_for"
])}

🏦 Loan Type:
${getField(fields, [
  "which_type_of_loan_do_you_want",
  "which_type_of_loan_do_you_want?"
])}

🆔 Lead ID: ${leadId}

━━━━━━━━━━━━━━━━━━━━
📌 Loan Destination
`;
}

// ==========================================
// HOME LOAN MESSAGE
// ==========================================

function buildHomeLoanMessage(fields, leadId) {

  const loanType = getField(fields, [
    "which_loan_do_you_need",
    "which_loan_do_you_need?",
    "loan_type"
  ]);

  const loanAmount = getField(fields, [
    "loan_amount_required",
    "loan_amount",
    "what_is_your_loan_amount"
  ]);

  const employmentType = getField(fields, [
    "employment_type",
    "what_is_your_employment_type"
  ]);

  const name = getField(fields, [
    "full_name"
  ]);

  const phone = getField(fields, [
    "phone_number"
  ]);

  const email = getField(fields, [
    "email"
  ]);

  const city = getField(fields, [
    "city"
  ]);

  let message = `
🏠 NEW HOME LOAN LEAD
━━━━━━━━━━━━━━━━━━━━

👤 Name: ${name}
📱 Phone: ${phone}
📧 Email: ${email}
🏙️ City: ${city}

🏦 Loan Type: ${loanType}

💰 Loan Amount Required:
${loanAmount}

💼 Employment Type:
${employmentType}

━━━━━━━━━━━━━━━━━━━━
📋 OTHER FORM DETAILS
━━━━━━━━━━━━━━━━━━━━
`;

  // Include all additional Facebook form answers.
  Object.entries(fields).forEach(([key, value]) => {

    const excludedFields = [
      "full_name",
      "phone_number",
      "email",
      "city",
      "which_loan_do_you_need",
      "which_loan_do_you_need?",
      "loan_type",
      "loan_amount_required",
      "loan_amount",
      "what_is_your_loan_amount",
      "employment_type",
      "what_is_your_employment_type"
    ];

    if (!excludedFields.includes(key)) {
      message += `\n📌 ${formatFieldName(key)}: ${value || "N/A"}`;
    }
  });

  message += `

🆔 Lead ID: ${leadId}

━━━━━━━━━━━━━━━━━━━━
📌 Loan Destination
`;

  return message;
}

// ==========================================
// PROCESS FACEBOOK LEAD
// ==========================================

async function processLead(change) {

  if (change.field !== "leadgen") {
    return;
  }

  const leadId = change.value.leadgen_id;

  console.log("\n================================");
  console.log("🚀 NEW FACEBOOK LEAD RECEIVED");
  console.log("Lead ID:", leadId);
  console.log("================================");

  // ========================================
  // FETCH LEAD DETAILS FROM FACEBOOK
  // ========================================

  const response = await axios.get(
    `https://graph.facebook.com/v25.0/${leadId}`,
    {
      params: {
        fields: "id,created_time,form_id,field_data",
        access_token: process.env.PAGE_ACCESS_TOKEN
      }
    }
  );

  const leadData = response.data;

  const fields = extractLeadFields(leadData);

  const formId = String(
    leadData.form_id || change.value.form_id || ""
  );

  console.log("Facebook Form ID:", formId);
  console.log("Lead Fields:", fields);

  // ========================================
  // FORM IDS
  // ========================================

  const educationFormId = String(
    process.env.EDUCATION_FORM_ID || ""
  );

  const homeLoanFormId = String(
    process.env.HOME_LOAN_FORM_ID || ""
  );

  // ========================================
  // EDUCATION LOAN ROUTING
  // ========================================

  if (
    educationFormId &&
    formId === educationFormId
  ) {

    console.log("🎓 EDUCATION LOAN LEAD DETECTED");

    const message = buildEducationMessage(
      fields,
      leadId
    );

    await sendTelegramMessage(
      process.env.EDU_TELEGRAM_BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN,

      process.env.EDU_TELEGRAM_CHAT_ID ||
      process.env.TELEGRAM_CHAT_ID,

      message
    );

  }

  // ========================================
  // HOME LOAN ROUTING
  // ========================================

  else if (
    homeLoanFormId &&
    formId === homeLoanFormId
  ) {

    console.log("🏠 HOME LOAN LEAD DETECTED");

    const message = buildHomeLoanMessage(
      fields,
      leadId
    );

    await sendTelegramMessage(
      process.env.HOME_TELEGRAM_BOT_TOKEN,
      process.env.HOME_TELEGRAM_CHAT_ID,
      message
    );

  }

  // ========================================
  // UNKNOWN FORM
  // ========================================

  else {

    console.log("⚠️ UNKNOWN FACEBOOK FORM");
    console.log("Form ID:", formId);
    console.log("Please configure the correct Form ID in .env");
  }
}

// ==========================================
// RECEIVE FACEBOOK WEBHOOK
// ==========================================

app.post("/webhook", (req, res) => {

  const body = req.body;

  if (body.object !== "page") {
    return res.sendStatus(404);
  }

  // Respond immediately to Facebook.
  res.sendStatus(200);

  // Process webhook events.
  for (const entry of body.entry || []) {

    for (const change of entry.changes || []) {

      processLead(change).catch((error) => {

        console.error("\n❌ LEAD PROCESSING ERROR");

        console.error(
          error.response?.data || error.message
        );

      });

    }
  }
});

// ==========================================
// ENVIRONMENT CHECK
// ==========================================

console.log("\n========== ENV CHECK ==========");

console.log(
  "VERIFY_TOKEN:",
  process.env.VERIFY_TOKEN ? "FOUND" : "NOT FOUND"
);

console.log(
  "PAGE_ACCESS_TOKEN:",
  process.env.PAGE_ACCESS_TOKEN ? "FOUND" : "NOT FOUND"
);

console.log(
  "EDUCATION BOT:",
  process.env.EDU_TELEGRAM_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN
    ? "FOUND"
    : "NOT FOUND"
);

console.log(
  "EDUCATION CHAT ID:",
  process.env.EDU_TELEGRAM_CHAT_ID ||
  process.env.TELEGRAM_CHAT_ID
    ? "FOUND"
    : "NOT FOUND"
);

console.log(
  "HOME BOT:",
  process.env.HOME_TELEGRAM_BOT_TOKEN
    ? "FOUND"
    : "NOT FOUND"
);

console.log(
  "HOME CHAT ID:",
  process.env.HOME_TELEGRAM_CHAT_ID
    ? "FOUND"
    : "NOT FOUND"
);

console.log(
  "EDUCATION FORM ID:",
  process.env.EDUCATION_FORM_ID || "NOT FOUND"
);

console.log(
  "HOME FORM ID:",
  process.env.HOME_LOAN_FORM_ID || "NOT FOUND"
);

console.log("================================");

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT}`
  );
});
