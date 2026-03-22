This matches the exact structure of your KOVALSKI_HOME_INTELLIGENCE repository. I've organized it to reflect the folder names from your VS Code screenshot while keeping the technical details sharp and professional.
🏠 Life Automation: Intelligence & Logistics

A modular system to automate life logistics by extracting appointments from Gmail using Gemini 2.5 Flash AI, centralizing multiple calendar feeds, and providing real-time monitoring via Home Assistant.
📂 Project Structure
Plaintext

KOVALSKI_HOME_INTELLIGENCE
├── google-apps-script/
│   ├── process-emails-with-ai/            # AI-driven Gmail mining script
│   └── centralize-all-calendars-in-one/   # Multi-source ICS feed synchronizer
├── home-assistant/
│   ├── process_email_with-ai/             # Main webhook automation & notifications
│   └── process_email_statistics/          # Counters, sensors, and dashboard metrics
└── prompts/
    └── gemini-appointments.txt            # System prompt used by the AI engine

🛠️ Tech Stack

    Engine: Google Apps Script (V8)

    AI: Gemini 2.5 Flash API (Language Processing & Extraction)

    Smart Home: Home Assistant (REST Webhooks + Mobile Push Notifications)

    Deployment: Clasp (Command Line Apps Script Projects)

⚙️ Environment Variables (Script Properties)

Configure these in the Google Apps Script project settings for full functionality:
1. AI & Webhook Configuration

    API_KEY: Google AI Studio API Key.

    WEBHOOK_URL: Home Assistant Webhook endpoint.

    EVEN_DAYS / ODD_DAYS: Office schedule parity (e.g., 1,3,5).

2. Calendar Sync Configuration

    ICS_URLS: A comma-separated list of external iCal URLs (Outlook, Web feeds).

🚀 System Data Flow

    Mining: Gmail trigger activates process-emails-with-ai (time-based).

    Extraction: Gemini AI processes the email body using the prompts/gemini-appointments.txt logic.

    Transmission: Validated JSON data is sent to the Home Assistant Webhook.

    Interaction: Home Assistant triggers a mobile notification with Confirm/Ignore actions.

    Execution: - If Confirmed: Event is created in Google Calendar and success metrics are updated.

        If Ignored: The event is discarded and ignore metrics are updated.

    Monitoring: Dashboard cards in Home Assistant reflect real-time counts for Received, IA OK, On Calendar, Refused, and Errors.

📊 Performance Monitoring

The system tracks reliability across the entire pipeline:

    Received: Total Webhook hits.

    IA OK: Successful AI extractions.

    On Calendar: Final events created by user confirmation.

    Errors: Technical failures (Empty payloads, API timeouts, or invalid JSON).