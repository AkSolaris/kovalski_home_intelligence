# 🏠 Life Automation

## Script Email to Calendar & HA

Sistema de extração de agendamentos via Gmail usando Gemini 2.5 Flash e integração com Home Assistant.

### 🛠️ Tech Stack
- **Engine:** Google Apps Script (V8)
- **AI:** Gemini 2.5 Flash API
- **Smart Home:** Home Assistant (Webhooks + Notifications)

### ⚙️ Variáveis de Ambiente (Script Properties)
Para o script funcionar, configure no Google Apps Script:
- `API_KEY`: Chave do Google AI Studio
- `WEBHOOK_URL`: URL do Webhook do Home Assistant
- `EVEN_DAYS` / `ODD_DAYS`: Escala de escritório (ex: 1,3,4)

### 🚀 Fluxo de Dados
1. Gmail (Trigger por tempo) -> 2. Gemini (Extração) -> 3. Home Assistant (Notificação) -> 4. Google Calendar (Confirmação)