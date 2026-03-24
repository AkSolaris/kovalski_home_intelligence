// ==============================================================================
// GLOBAL CONFIGURATION (Loaded from Script Properties)
// ==============================================================================

const props = PropertiesService.getScriptProperties();
const API_KEY = props.getProperty("API_KEY"); 
const WEBHOOK_URL = props.getProperty("WEBHOOK_URL");
// Unificado para evitar ReferenceError
const GEMINI_API_URL = props.getProperty("GEMINI_API_URL");

/**
 * MAIN FUNCTION: Trigger-based email scanner
 */
function processTrackingEmails() {
  const startTime = new Date().getTime(); // Marca o início para o cálculo do sleep
  console.log("[EVENT] Starting email scan process...");
  
  const query = 'is:unread newer_than:3d ("tracking code" OR track OR PostNL OR DHL OR DPD OR order OR "out for delivery" OR "delivery" OR "entrega" OR "pakket" OR "onderweg" OR "parcel" OR "shipment") -unsubscribe -newsletter -marketing';
  const threads = GmailApp.search(query, 0, 5); 
  
  if (threads.length === 0) {
    console.log("[LOGIC] No new relevant unread emails found.");
    handleFinalSleep(startTime); // Dorme mesmo se não houver e-mails
    return;
  }

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(message => {
      if (message.isUnread()) {
        try {
          const subject = message.getSubject();
          console.log(`[PARSING] Analyzing email: "${subject}"`);
          const body = message.getPlainBody();
          
          const trackingData = extractDataWithGemini(body);
          
          // Ajustado para bater com a chave que a IA retorna (tracking_code)
          if (trackingData && trackingData.tracking_code && trackingData.tracking_code !== "null") {
            console.log(`[SUCCESS] Package found: ${trackingData.product_name} (${trackingData.tracking_code})`);
            
            const success = sendToHomeAssistant(trackingData);
            if (success) {
              message.markRead();
              console.log("[SUCCESS] Webhook accepted by HA. Email marked as read.");
            } else {
              console.error("[WEBHOOK] Failed to dispatch data to Home Assistant.");
            }
          } else {
            console.log("[CONFLICT] No valid tracking data identified by AI. Skipping.");
            message.markRead(); 
            // Sends an ignored "ping" to HA
            sendToHomeAssistant({ "type": "ignored" });
          }
        } catch (e) {
          console.error(`[ITEM ERROR] Failed to process message: ${e.message}`);
          reportErrorToHA(e.message, "[ITEM ERROR] Failed to process message");
        }
      }
    });
  });

  handleFinalSleep(startTime);
}

/**
 * HELPER: Ensures the script runs for a total of ~6 minutes (360s)
 */
function handleFinalSleep(startTime) {
  const targetDurationMs = 350000; // 5.8 minutos para segurança (limite do Google é 6min)
  const currentTime = new Date().getTime();
  const elapsed = currentTime - startTime;

  if (elapsed < targetDurationMs) {
    const sleepTime = targetDurationMs - elapsed;
    console.log(`[EVENT] Logic finished in ${elapsed/1000}s. Sleeping for ${sleepTime/1000}s to meet interval target.`);
    Utilities.sleep(sleepTime);
  }
  console.log("[EVENT] Execution finished.");
}

/**
 * AI EXTRACTION: Communication with Gemini 1.5 Flash
 */
function extractDataWithGemini(emailText) {
  const url = GEMINI_API_URL + API_KEY;
  
  const systemPrompt = `Você é um extrator de dados logísticos. Sua tarefa é extrair informações de rastreio de pacotes de e-mails.     
                        REGRAS:     
                        1. Retorne EXCLUSIVAMENTE um objeto JSON válido.     
                        2. Resuma o 'product_name' para no máximo 30 caracteres.     
                        3. Se não houver código de rastreio, retorne "null".     
                        JSON esperado: {"tracking_code": "string", "product_name": "string"}`;

  const payload = {
    "contents": [{
      "parts": [
        {"text": systemPrompt},
        {"text": "EMAIL para análise:\n" + emailText.substring(0, 4000)}
      ]
    }],
    "generationConfig": {
      "temperature": 0.1,
      "responseMimeType": "application/json"
    }
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const resText = response.getContentText();
    const json = JSON.parse(resText);
    
    if (json.candidates && json.candidates[0].content.parts[0].text) {
      const rawAiResponse = json.candidates[0].content.parts[0].text;
      console.log(`[AI RESPONSE] ${rawAiResponse}`);
      return JSON.parse(rawAiResponse);
    }
  } catch (e) {
    console.error(`[CRITICAL ERROR] Gemini API failure: ${e.message}`);
    reportErrorToHA(e.message, "[CRITICAL ERROR] Gemini API failure");
  }
  return null;
}

/**
 * DISPATCH: Sends JSON to Home Assistant Webhook
 */
function sendToHomeAssistant(trackingData) {
  if (!WEBHOOK_URL) {
    console.warn("[LOGIC] WEBHOOK_URL not configured. Running in Simulation Mode.");
    return true;
  }

  const haPayload = {
    "codigo_rastreio": trackingData.tracking_code,
    "nome_produto": trackingData.product_name
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(haPayload),
    'muteHttpExceptions': true
  };
  
  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    return (response.getResponseCode() >= 200 && response.getResponseCode() < 300);
  } catch (e) {
    reportErrorToHA(e.message, "[CRITICAL ERROR] Network failure connecting to HA");
    return false;
  }
}

/**
 * ERROR REPORTING: Sends script failures to Home Assistant
 */
function reportErrorToHA(errorMessage, context) {
  if (!WEBHOOK_URL) return;
  const errorPayload = {
    "type": "error",
    "message": errorMessage,
    "context": context,
    "timestamp": new Date().toISOString()
  };
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(errorPayload),
    'muteHttpExceptions': true
  };
  try {
    UrlFetchApp.fetch(WEBHOOK_URL, options);
  } catch (e) {
    console.error(`[LOGIC] Total blackout: ${e.message}`);
  }
}

function testMockAiPath() {
  console.log("[EVENT] Starting Mock AI Test...");
  const mockData = {
    "tracking_code": "ST0000183048NB",
    "product_name": "Prolo Ring - Rose Gold"
  };
  const success = sendToHomeAssistant(mockData);
  console.log(success ? "[SUCCESS] Webhook delivered!" : "[WEBHOOK] Delivery failed.");
}