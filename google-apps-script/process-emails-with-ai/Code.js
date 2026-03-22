/**
 * Processes unread emails using Gemini API to extract appointments.
 * Includes heavy logging for traceability and system health monitoring.
 */
function processEmailsWithAI() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // 1. CONFIGURATION LOADING
  const evenDays = scriptProperties.getProperty('EVEN_DAYS').split(',').map(Number);
  const oddDays = scriptProperties.getProperty('ODD_DAYS').split(',').map(Number);
  const apiKey = scriptProperties.getProperty("API_KEY")?.trim();
  const webhookUrl = scriptProperties.getProperty("WEBHOOK_URL");
  const geminiBaseUrl = scriptProperties.getProperty("GEMINI_API_URL");
  const timezone = scriptProperties.getProperty('TIMEZONE') || "Europe/Amsterdam";

  if (!apiKey || !webhookUrl || !geminiBaseUrl) {
    console.error("[CRITICAL] Missing essential Script Properties (API_KEY, WEBHOOK_URL, or GEMINI_API_URL)");
    return;
  }

  // 2. GMAIL SEARCH
  const query = `is:unread newer_than:7d 
                (subject:(appointment OR afspraak OR consulta OR reserva OR "confirmation of" OR lesplanning) 
                OR "your appointment" OR "afspraak bevestigd" OR "bevestiging van") 
                -"unsubscribe" -"newsletter" -"promo" -"marketing"`;

  const threads = GmailApp.search(query, 0, 2);
  console.log(`[INIT] Search query executed. Found ${threads.length} threads to process.`);

  const calendar = CalendarApp.getDefaultCalendar();

  for (const thread of threads) {
    const message = thread.getMessages()[0];
    const subject = message.getSubject();
    const sender = message.getFrom();
    const body = message.getPlainBody();
    
    console.log(`[PROCESSING] Thread: "${subject}" | From: ${sender}`);

    // API URL Construction with Template Literal
    const apiUrl = `${geminiBaseUrl}${apiKey}`;
    
    const prompt = `Analise o e-mail abaixo e extraia TODOS os agendamentos confirmados. 
    Traduza os valores para Português do Brasil.
    Responda APENAS um JSON no formato de lista: 
    [{"date": "DD-MM-YYYY", "time": "HH:MM", "subject": "título curto", "location": "onde"}] 
    Se não encontrar nada, responda []. \n
    E-mail: ${body}`;

    try {
      console.log(`[AI REQUEST] Sending data to Gemini...`);
      const response = UrlFetchApp.fetch(apiUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ 
          "contents": [{ "parts": [{ "text": prompt }] }],
          "generationConfig": { "response_mime_type": "application/json" }
        })
      });

      const responseText = response.getContentText();
      const aiParsedResponse = JSON.parse(responseText);
      const rawOutput = aiParsedResponse.candidates[0].content.parts[0].text;
      
      console.log(`[AI RESPONSE] Raw extracted text: ${rawOutput.trim()}`);

      const eventList = JSON.parse(rawOutput);
      console.log(`[PARSING] AI identified ${eventList.length} potential events.`);

      eventList.forEach((event, index) => {
        try {
          console.log(`[EVENT ${index + 1}] Processing: "${event.subject}" at ${event.date} ${event.time}`);
          
          const dP = event.date.split('-'); 
          const tP = event.time.split(':');
          const startDate = new Date(dP[2], dP[1] - 1, dP[0], tP[0], tP[1], 0);
          const endDate = new Date(startDate.getTime() + (60 * 60 * 1000)); 

          event.sender = sender;

          /** * WEEK PARITY LOGIC
           * Calculates ISO week to determine office schedule.
           */
          const tempDate = new Date(startDate.valueOf());
          const dayNumber = (startDate.getDay() + 6) % 7; 
          tempDate.setDate(tempDate.getDate() - dayNumber + 3); 
          const firstThursday = tempDate.valueOf();
          tempDate.setMonth(0, 1);
          if (tempDate.getDay() !== 4) tempDate.setMonth(0, 1 + ((4 - tempDate.getDay()) + 7) % 7);
          const weekNumber = 1 + Math.ceil((firstThursday - tempDate) / 604800000);
          
          const isEvenWeek = (weekNumber % 2 === 0);
          const weekdayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
          const currentDay = startDate.getDay();
          const schedule = isEvenWeek ? evenDays : oddDays;
          
          event.is_office_day = schedule.includes(currentDay);
          event.weekday_name = weekdayNames[currentDay];
          
          console.log(`[LOGIC] Week: ${weekNumber} (${isEvenWeek ? 'EVEN' : 'ODD'}) | Office Day: ${event.is_office_day}`);

          /**
           * CONFLICT VERIFICATION
           */
          const bufferStart = new Date(startDate.getTime() - 3600000);
          const bufferEnd = new Date(endDate.getTime() + 3600000);
          const collisions = calendar.getEvents(bufferStart, bufferEnd);
          
          event.has_conflict = collisions.length > 0;
          if (event.has_conflict) {
            event.conflict_details = collisions.map(e => e.getTitle()).join(", ");
            console.log(`[CONFLICT] Found: ${event.conflict_details}`);
          }

          event.iso_start = Utilities.formatDate(startDate, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
          event.iso_end = Utilities.formatDate(endDate, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");

          // 3. WEBHOOK DISPATCH
          console.log(`[WEBHOOK] Sending payload to Home Assistant...`);
          const webhookRes = UrlFetchApp.fetch(webhookUrl, {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(event),
            muteHttpExceptions: true
          });

          console.log(`[WEBHOOK] Status Code: ${webhookRes.getResponseCode()}`);

        } catch (err) { 
          console.error(`[ITEM ERROR] Failed to process individual event index ${index}: ${err.message}`); 
        }
      });

      thread.markRead();
      console.log(`[SUCCESS] Thread marked as read. Sleeping to respect API limits...`);
      Utilities.sleep(120000); 
      
    } catch (critical) { 
      console.error(`[CRITICAL ERROR] Thread "${subject}": ${critical.toString()}`); 
      UrlFetchApp.fetch(webhookUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ 
          "error": true, 
          "reason": critical.toString(),
          "subject": subject || "Erro na busca"
        })
      });
    }
  }
  console.log("[FINISH] Script execution completed.");
}

/**
 * Mock function to test the Home Assistant integration with the new English keys.
 * Run this from the Apps Script editor to verify your YAML automation.
 */
function testHAWebhook() {
  const webhookUrl = scriptProperties.getProperty("WEBHOOK_URL");
  
  const mockPayload = {
    "subject": "Aula de Direção (TESTE)",
    "date": "25-03-2026",
    "time": "10:00",
    "weekday_name": "Quarta-feira",
    "location": "Station Weert",
    "sender": "Instrutor Hans <hans@rijschool.nl>",
    "has_conflict": true,
    "conflict_details": "Reunião de Arquitetura, Almoço com Equipe",
    "is_office_day": true,
    "iso_start": "2026-03-25T10:00:00+01:00",
    "iso_end": "2026-03-25T11:00:00+01:00"
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(mockPayload),
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch(webhookUrl, options);
    console.log(`[TEST] Status: ${response.getResponseCode()}`);
    
    if (response.getResponseCode() == 200) {
      console.log("✅ Webhook triggered successfully! Check your phone.");
    } else {
      console.error(`❌ Webhook error ${response.getResponseCode()}: ${response.getContentText()}`);
    }
  } catch (e) {
    console.error("❌ Connection error: " + e.toString());
  }
}