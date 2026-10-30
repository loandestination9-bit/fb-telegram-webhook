
require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

// ==========================================
// CONFIGURATION
// ==========================================

const PORT = process.env.PORT || 5000;
const FACEBOOK_API_VERSION = "v25.0";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Support one or multiple Education Loan forms
const EDUCATION_FORM_IDS = (
  process.env.EDUCATION_FORM_IDS ||
  process.env.EDUCATION_FORM_ID ||
  ""
)
  .split(",")
  .map(id => id.trim())
  .filter(Boolean);

// Home Loan form
const HOME_LOAN_FORM_ID = String(
  process.env.HOME_LOAN_FORM_ID || ""
).trim();

// Education Telegram credentials
const EDU_BOT_TOKEN =
  process.env.EDU_TELEGRAM_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN;

const EDU_CHAT_ID =
  process.env.EDU_TELEGRAM_CHAT_ID ||
  process.env.TELEGRAM_CHAT_ID;

// Home Loan Telegram credentials
const HOME_BOT_TOKEN =
  process.env.HOME_TELEGRAM_BOT_TOKEN;

const HOME_CHAT_ID =
  process.env.HOME_TELEGRAM_CHAT_ID;

// ==========================================
// ROOT ROUTE
// ==========================================

app.get("/", (req, res) => {
  res.send("Facebook Lead Webhook Server Running 🚀");
});

// ==========================================
// WEBHOOK VERIFICATION
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
    console.log("✅ Facebook Webhook Verified");

    return res.status(200).send(challenge);
  }

  console.log("❌ Webhook Verification Failed");

  return res.sendStatus(403);
});

// ==========================================
// TELEGRAM MESSAGE SENDER
// ==========================================

async function sendTelegramMessage(
  botToken,
  chatId,
  message,
  leadType
) {
  if (!botToken || !chatId) {
    throw new Error(
      `${leadType}: Telegram Bot Token or Chat ID missing`
    );
  }

  const telegramURL =
    `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await axios.post(telegramURL, {
    chat_id: chatId,
    text: message
  });

  if (!response.data.ok) {
    throw new Error(
      `${leadType}: Telegram message sending failed`
    );
  }

  console.log(`✅ ${leadType} Telegram Message Sent`);
  console.log("Telegram Message ID:", response.data.result.message_id);

  return response.data;
}

// ==========================================
// EXTRACT FACEBOOK LEAD FIELDS
// ==========================================

function extractLeadFields(leadData) {
  const fields = {};

  if (Array.isArray(leadData.field_data)) {
    leadData.field_data.forEach(field => {
      fields[field.name] = Array.isArray(field.values)
        ? field.values.join(", ")
        : "";
    });
  }

  return fields;
}

// ==========================================
// NORMALIZE FIELD NAMES
// ==========================================

function normalizeFieldName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// ==========================================
// GET FIELD VALUE
// ==========================================

function getField(fields, possibleNames) {
  const normalizedFields = {};

  Object.entries(fields).forEach(([key, value]) => {
    normalizedFields[normalizeFieldName(key)] = value;
  });

  for (const name of possibleNames) {
    const value =
      normalizedFields[normalizeFieldName(name)];

    if (value !== undefined && value !== "") {
      return value;
    }
  }

  return "N/A";
}

// ==========================================
// FORMAT FIELD LABEL
// ==========================================

function formatFieldName(name) {
  return String(name)
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

👤 Name: ${getField(fields, ["full_name", "name"])}

📧 Email: ${getField(fields, ["email"])}

📱 Phone: ${getField(fields, ["phone_number", "phone"])}

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
  const name = getField(fields, [
    "full_name",
    "name"
  ]);

  const phone = getField(fields, [
    "phone_number",
    "phone"
  ]);

  const email = getField(fields, [
    "email"
  ]);

  const city = getField(fields, [
    "city"
  ]);

  const loanType = getField(fields, [
    "which_loan_do_you_need",
    "which_loan_do_you_need?",
    "loan_type"
  ]);

  const loanAmount = getField(fields, [
    "loan_amount_required",
    "loan_amount",
    "what_is_your_loan_amount",
    "loan_amount_required?"
  ]);

  const employmentType = getField(fields, [
    "employment_type",
    "employment_type?",
    "what_is_your_employment_type"
  ]);

  let message = `
🏠 NEW HOME LOAN LEAD
━━━━━━━━━━━━━━━━━━━━

👤 Full Name: ${name}

📱 Phone Number: ${phone}

📧 Email: ${email}

🏙️ City: ${city}

🏦 Loan Type: ${loanType}

💰 Loan Amount Required:
${loanAmount}

💼 Employment Type:
${employmentType}

━━━━━━━━━━━━━━━━━━━━
📋 ADDITIONAL FORM DETAILS
━━━━━━━━━━━━━━━━━━━━
`;

  // Add all additional Facebook form answers.
  // This also supports newly added custom questions.

  const excludedFields = [
    "full_name",
    "name",
    "phone_number",
    "phone",
    "email",
    "city",
    "which_loan_do_you_need",
    "which_loan_do_you_need?",
    "loan_type",
    "loan_amount_required",
    "loan_amount",
    "what_is_your_loan_amount",
    "loan_amount_required?",
    "employment_type",
    "employment_type?",
    "what_is_your_employment_type"
  ].map(normalizeFieldName);

  Object.entries(fields).forEach(([key, value]) => {
    if (!excludedFields.includes(normalizeFieldName(key))) {
      message += `\n📌 ${formatFieldName(key)}: ${value || "N/A"}\n`;
    }
  });

  message += `
━━━━━━━━━━━━━━━━━━━━

🆔 Lead ID: ${leadId}

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

  if (!leadId) {
    console.log("⚠️ Lead ID missing");
    return;
  }

  console.log("\n========================================");
  console.log("🚀 NEW FACEBOOK LEAD RECEIVED");
  console.log("Lead ID:", leadId);
  console.log("========================================");

  if (!PAGE_ACCESS_TOKEN) {
    throw new Error("PAGE_ACCESS_TOKEN is missing");
  }

  // ========================================
  // FETCH LEAD DETAILS
  // ========================================

  const response = await axios.get(
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${leadId}`,
    {
      params: {
        fields: "id,created_time,form_id,field_data",
        access_token: PAGE_ACCESS_TOKEN
      }
    }
  );

  const leadData = response.data;

  const fields = extractLeadFields(leadData);

  const formId = String(
    leadData.form_id ||
    change.value.form_id ||
    ""
  ).trim();

  console.log("Facebook Form ID:", formId);

  // ========================================
  // FORM ROUTING DEBUG
  // ========================================

  const isEducationLead =
    EDUCATION_FORM_IDS.includes(formId);

  const isHomeLoanLead =
    formId === HOME_LOAN_FORM_ID;

  console.log("\n========== FORM ROUTING DEBUG ==========");

  console.log("Received Form ID:", formId);

  console.log(
    "Education Form IDs:",
    EDUCATION_FORM_IDS
  );

  console.log(
    "Home Loan Form ID:",
    HOME_LOAN_FORM_ID || "NOT CONFIGURED"
  );

  console.log("Is Education:", isEducationLead);

  console.log("Is Home Loan:", isHomeLoanLead);

  console.log("========================================");

  // ========================================
  // ROUTING 1: HOME LOAN
  // ========================================

  if (isHomeLoanLead) {
    console.log("🏠 HOME / CONSTRUCTION / SHOP LEAD DETECTED");

    const message = buildHomeLoanMessage(
      fields,
      leadId
    );

    await sendTelegramMessage(
      HOME_BOT_TOKEN,
      HOME_CHAT_ID,
      message,
      "HOME LOAN"
    );

    return;
  }

  // ========================================
  // ROUTING 2: EDUCATION LOAN
  // ========================================

  if (isEducationLead) {
    console.log("🎓 EDUCATION LOAN LEAD DETECTED");

    const message = buildEducationMessage(
      fields,
      leadId
    );

    await sendTelegramMessage(
      EDU_BOT_TOKEN,
      EDU_CHAT_ID,
      message,
      "EDUCATION LOAN"
    );

    return;
  }

  // ========================================
  // UNKNOWN FACEBOOK FORM
  // ========================================

  console.log("⚠️ UNKNOWN FACEBOOK FORM ID");

  console.log("Form ID:", formId);

  console.log("Lead was not sent to either Telegram bot.");
}

// ==========================================
// RECEIVE FACEBOOK WEBHOOK
// ==========================================

app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object !== "page") {
    return res.sendStatus(404);
  }

  // Acknowledge Facebook immediately.
  res.sendStatus(200);

  // Process every lead event.
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      processLead(change).catch(error => {
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

console.log("\n========== ENVIRONMENT CHECK ==========");

console.log(
  "VERIFY_TOKEN:",
  process.env.VERIFY_TOKEN ? "FOUND" : "MISSING"
);

console.log(
  "PAGE_ACCESS_TOKEN:",
  PAGE_ACCESS_TOKEN ? "FOUND" : "MISSING"
);

console.log(
  "EDUCATION TELEGRAM BOT:",
  EDU_BOT_TOKEN ? "FOUND" : "MISSING"
);

console.log(
  "EDUCATION TELEGRAM CHAT:",
  EDU_CHAT_ID ? "FOUND" : "MISSING"
);

console.log(
  "HOME TELEGRAM BOT:",
  HOME_BOT_TOKEN ? "FOUND" : "MISSING"
);

console.log(
  "HOME TELEGRAM CHAT:",
  HOME_CHAT_ID ? "FOUND" : "MISSING"
);

console.log(
  "EDUCATION FORM IDS:",
  EDUCATION_FORM_IDS.length
    ? EDUCATION_FORM_IDS.join(", ")
    : "MISSING"
);

console.log(
  "HOME LOAN FORM ID:",
  HOME_LOAN_FORM_ID || "MISSING"
);

console.log("========================================");

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(
    `🚀 Facebook Lead Webhook Running on Port ${PORT}`
  );
});
