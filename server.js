require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURATION
// ==========================================

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

const GRAPH_API_VERSION = "v25.0";

// Home Loan form ID
const HOME_LOAN_FORM_ID = process.env.HOME_LOAN_FORM_ID;

// Education Loan form IDs (comma-separated)
const EDUCATION_FORM_IDS = (
  process.env.EDUCATION_FORM_IDS ||
  process.env.EDUCATION_FORM_ID ||
  ""
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// Education Telegram configuration
const EDUCATION_BOT_TOKEN =
  process.env.EDU_TELEGRAM_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN;

const EDUCATION_CHAT_ID =
  process.env.EDU_TELEGRAM_CHAT_ID ||
  process.env.TELEGRAM_CHAT_ID;

// Home Telegram configuration
const HOME_BOT_TOKEN = process.env.HOME_TELEGRAM_BOT_TOKEN;

const HOME_CHAT_ID = process.env.HOME_TELEGRAM_CHAT_ID;

// ==========================================
// ENVIRONMENT VALIDATION
// ==========================================

console.log("========== SERVER CONFIGURATION ==========");

console.log("VERIFY_TOKEN:", VERIFY_TOKEN ? "Configured" : "Missing");
console.log("PAGE_ACCESS_TOKEN:", PAGE_ACCESS_TOKEN ? "Configured" : "Missing");

console.log("HOME_LOAN_FORM_ID:", HOME_LOAN_FORM_ID || "Missing");

console.log("EDUCATION_FORM_IDS:", EDUCATION_FORM_IDS);

console.log(
  "EDUCATION_BOT_TOKEN:",
  EDUCATION_BOT_TOKEN ? "Configured" : "Missing"
);

console.log(
  "EDUCATION_CHAT_ID:",
  EDUCATION_CHAT_ID || "Missing"
);

console.log(
  "HOME_BOT_TOKEN:",
  HOME_BOT_TOKEN ? "Configured" : "Missing"
);

console.log(
  "HOME_CHAT_ID:",
  HOME_CHAT_ID || "Missing"
);

console.log("==========================================");

// ==========================================
// ROOT ROUTE
// ==========================================

app.get("/", (req, res) => {
  res.status(200).send("Loan Destination Facebook Telegram Webhook is Running!");
});

// ==========================================
// FACEBOOK WEBHOOK VERIFICATION
// ==========================================

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Facebook webhook verified successfully.");

    return res.status(200).send(challenge);
  }

  console.log("Facebook webhook verification failed.");

  return res.sendStatus(403);
});

// ==========================================
// FIELD HELPERS
// ==========================================

function normalizeFieldName(name = "") {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getLeadFields(fieldData = []) {
  const fields = {};

  fieldData.forEach((field) => {
    const key = normalizeFieldName(field.name);

    const value = Array.isArray(field.values)
      ? field.values[0]
      : "";

    fields[key] = value || "";
  });

  return fields;
}

function getField(fields, ...possibleNames) {
  for (const name of possibleNames) {
    const key = normalizeFieldName(name);

    if (fields[key] !== undefined && fields[key] !== "") {
      return fields[key];
    }
  }

  return "N/A";
}

function cleanValue(value) {
  if (!value || value === "") {
    return "N/A";
  }

  return String(value).trim();
}

// ==========================================
// LOAN TYPE DETECTION
// ==========================================

function detectLoanType(formId, fields) {
  const currentFormId = String(formId || "").trim();

  // FIRST PRIORITY: HOME LOAN FORM ID

  if (
    HOME_LOAN_FORM_ID &&
    currentFormId === HOME_LOAN_FORM_ID.trim()
  ) {
    return "home";
  }

  // SECOND PRIORITY: EDUCATION LOAN FORM ID

  if (EDUCATION_FORM_IDS.includes(currentFormId)) {
    return "education";
  }

  // THIRD PRIORITY: LOAN TYPE FIELD

  const loanValue = getField(
    fields,
    "which_loan_do_you_need?",
    "which_loan_do_you_need",
    "loan_type",
    "loan_type_required",
    "loan_category"
  );

  const loanType = String(loanValue).toLowerCase();

  if (
    loanType.includes("home") ||
    loanType.includes("house")
  ) {
    return "home";
  }

  if (
    loanType.includes("education") ||
    loanType.includes("student")
  ) {
    return "education";
  }

  // DO NOT GUESS UNKNOWN LOAN TYPES

  return null;
}

// ==========================================
// EDUCATION LOAN MESSAGE
// ==========================================

function createEducationMessage(fields, leadId) {
  const name = getField(fields, "full_name", "name");

  const email = getField(fields, "email", "email_address");

  const phone = getField(
    fields,
    "phone_number",
    "phone",
    "mobile_number"
  );

  const city = getField(fields, "city");

  const country = getField(
    fields,
    "country",
    "destination_country",
    "preferred_country"
  );

  const university = getField(
    fields,
    "university",
    "university_name",
    "preferred_university"
  );

  const intake = getField(
    fields,
    "intake",
    "preferred_intake",
    "study_intake"
  );

  const amount = getField(
    fields,
    "loan_amount_required",
    "loan_amount",
    "required_loan_amount"
  );

  const loanType = getField(
    fields,
    "which_loan_do_you_need?",
    "loan_type"
  );

  const appliedAbroad = getField(
    fields,
    "applied_abroad_university",
    "have_you_applied_to_university"
  );

  return `🚀 New Education Loan Lead

👤 Name: ${cleanValue(name)}
📧 Email: ${cleanValue(email)}
📱 Phone: ${cleanValue(phone)}
🏙️ City: ${cleanValue(city)}

🌍 Country: ${cleanValue(country)}

🎓 University: ${cleanValue(university)}

📅 Intake: ${cleanValue(intake)}

💰 Loan Amount: ${cleanValue(amount)}

🏦 Loan Type: ${cleanValue(loanType)}

✅ Applied Abroad University: ${cleanValue(appliedAbroad)}

🆔 Lead ID: ${leadId}`;
}

// ==========================================
// HOME LOAN MESSAGE
// ==========================================

function createHomeLoanMessage(fields, leadId) {
  const name = getField(fields, "full_name", "name");

  const email = getField(fields, "email", "email_address");

  const phone = getField(
    fields,
    "phone_number",
    "phone",
    "mobile_number"
  );

  const city = getField(fields, "city");

  const amount = getField(
    fields,
    "loan_amount_required",
    "loan_amount",
    "required_loan_amount"
  );

  const employment = getField(
    fields,
    "employment_type",
    "employment_status",
    "occupation"
  );

  const loanType = getField(
    fields,
    "which_loan_do_you_need?",
    "loan_type"
  );

  return `🏠 NEW HOME LOAN LEAD

👤 Name: ${cleanValue(name)}

📧 Email: ${cleanValue(email)}

📱 Phone: ${cleanValue(phone)}

🏙️ City: ${cleanValue(city)}

🏦 Loan Type: ${cleanValue(loanType)}

💰 Loan Amount: ${cleanValue(amount)}

💼 Employment Type: ${cleanValue(employment)}

🆔 Lead ID: ${leadId}`;
}

// ==========================================
// TELEGRAM MESSAGE SENDER
// ==========================================

async function sendTelegramMessage(loanType, message) {
  let botToken;
  let chatId;
  let groupName;

  if (loanType === "home") {
    botToken = HOME_BOT_TOKEN;
    chatId = HOME_CHAT_ID;
    groupName = "Home Loan Group";
  } else if (loanType === "education") {
    botToken = EDUCATION_BOT_TOKEN;
    chatId = EDUCATION_CHAT_ID;
    groupName = "Education Loan Group";
  } else {
    throw new Error("Invalid loan type for Telegram routing.");
  }

  if (!botToken || !chatId) {
    throw new Error(
      `${groupName} Telegram configuration is missing.`
    );
  }

  const telegramURL =
    `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await axios.post(telegramURL, {
    chat_id: chatId,
    text: message,
  });

  if (!response.data.ok) {
    throw new Error(
      response.data.description || "Telegram message failed."
    );
  }

  console.log(`Telegram message successfully sent to ${groupName}`);

  return response.data;
}

// ==========================================
// FETCH FACEBOOK LEAD DETAILS
// ==========================================

async function fetchFacebookLead(leadId) {
  const url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${leadId}`;

  const response = await axios.get(url, {
    params: {
      access_token: PAGE_ACCESS_TOKEN,
      fields: "id,created_time,form_id,field_data",
    },
  });

  return response.data;
}

// ==========================================
// PROCESS FACEBOOK LEAD
// ==========================================

async function processFacebookLead(leadId) {
  console.log("\n========== PROCESSING NEW LEAD ==========");

  console.log("Lead ID:", leadId);

  // Fetch lead details from Facebook

  const leadData = await fetchFacebookLead(leadId);

  console.log("Facebook Lead Data Received");

  const fields = getLeadFields(leadData.field_data);

  const formId = String(leadData.form_id || "");

  console.log("Form ID:", formId);

  console.log("Lead Fields:", fields);

  // Detect loan type

  const loanType = detectLoanType(formId, fields);

  console.log("Detected Loan Type:", loanType);

  if (!loanType) {
    console.error(
      "Unknown loan type. Lead was NOT sent to any Telegram group."
    );

    return;
  }

  // Create the correct message

  let message;

  if (loanType === "home") {
    message = createHomeLoanMessage(fields, leadId);
  } else {
    message = createEducationMessage(fields, leadId);
  }

  console.log("Telegram Destination:", loanType);

  console.log("Telegram Message:\n", message);

  // Send to the correct Telegram group

  await sendTelegramMessage(loanType, message);

  console.log("Lead processed successfully.");

  console.log("=========================================\n");
}

// ==========================================
// FACEBOOK WEBHOOK RECEIVER
// ==========================================

app.post("/webhook", async (req, res) => {
  try {
    console.log("\n========== NEW WEBHOOK RECEIVED ==========");

    const body = req.body;

    if (body.object !== "page") {
      console.log("Unsupported webhook object.");

      return res.sendStatus(404);
    }

    // Acknowledge Facebook webhook

    res.status(200).send("EVENT_RECEIVED");

    // Process all incoming lead events

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        console.log("Webhook Field:", change.field);

        if (change.field !== "leadgen") {
          continue;
        }

        const leadId = change.value?.leadgen_id;

        if (!leadId) {
          console.log("Lead ID not found.");
          continue;
        }

        try {
          await processFacebookLead(leadId);
        } catch (error) {
          console.error(
            "Lead Processing Error:",
            error.response?.data || error.message
          );
        }
      }
    }
  } catch (error) {
    console.error("Webhook Error:", error.message);

    if (!res.headersSent) {
      res.status(500).send("Webhook processing failed.");
    }
  }
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});