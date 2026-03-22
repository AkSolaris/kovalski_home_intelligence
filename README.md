# 🏠 Life Automation: Intelligence & Logistics

A modular home intelligence system designed to automate logistics by mining emails via **Gemini 2.5 Flash AI**, synchronizing external calendars, and providing real-time monitoring through **Home Assistant**.

## 📂 Project Structure

```text
KOVALSKI_HOME_INTELLIGENCE
├── google-apps-script/
│   ├── process-emails-with-ai/            # AI-driven Gmail mining engine
│   └── centralize-all-calendars-in-one/   # Multi-source ICS feed synchronizer
├── home-assistant/
│   ├── process_email_with-ai/             # Webhook logic & mobile notifications
│   └── process_email_statistics/          # Metrics, counters, and dashboard UI
└── prompts/
    └── gemini-appointments.txt            # Master prompt for the AI extraction
```

---

## 🛠️ Tech Stack
- **Runtime:** Google Apps Script (V8)
- **Intelligence:** Gemini 2.5 Flash API (LLM for data extraction)
- **Smart Home:** Home Assistant (REST Webhooks + Mobile Push Notifications)
- **DevOps:** [clasp](https://github.com/google/clasp) (Apps Script Management)

---

## ⚙️ Configuration (Script Properties)

For the system to function, the following properties must be configured in the Google Apps Script project settings:

### 1. Email & AI Engine
| Property | Description |
| :--- | :--- |
| `API_KEY` | Google AI Studio (Gemini) API Key |
| `WEBHOOK_URL` | Home Assistant Webhook Endpoint |
| `EVEN_DAYS` | Office days for even weeks (e.g., `1,3,5`) |
| `ODD_DAYS` | Office days for odd weeks (e.g., `2,4`) |

### 2. Calendar Synchronization
| Property | Description |
| :--- | :--- |
| `ICS_URLS` | Comma-separated list of external iCal URLs (Outlook/Web) |

---

## 🚀 System Logic & Data Flow

### 1. The Mining Phase
- A time-based trigger runs `process-emails-with-ai` every 30 minutes.
- The script searches for unread appointment-related emails.
- Gemini AI extracts structured JSON (Subject, Date, Time, Location, Sender) using the prompt in `/prompts`.

### 2. The Integration Phase
- JSON data is posted to the Home Assistant Webhook.
- Home Assistant processes the data and increments the **Received** and **IA OK** counters.
- A mobile notification is sent to the user with **Action Buttons** (Confirm/Ignore).

### 3. The Execution Phase
- **Confirm:** Triggers `google.create_event` in the primary calendar and increments the **Success** counter.
- **Ignore:** Dismisses the notification and increments the **Ignored** counter.
- **Failures:** Any malformed JSON or API timeout increments the **Errors** counter and logs the reason.

---

## 📊 Monitoring Dashboard

The Home Assistant UI provides a real-time status of the pipeline:

- **Received:** Total webhooks successfully reached.
- **IA OK:** Emails correctly parsed by the AI.
- **On Calendar:** Total events you manually approved.
- **Refused:** Events you chose to skip.
- **Errors:** Technical failures (Empty payloads or script errors).

---

## 📝 Maintenance & Logs
- **GAS Logs:** Detailed execution logs are available in the Google Apps Script console.
- **HA Logs:** High-level automation failures are written to the Home Assistant `system_log`.