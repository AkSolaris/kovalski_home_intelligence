/**
 * Global constant to access Script Properties.
 */
const scriptProperties = PropertiesService.getScriptProperties();

/**
 * Main function to synchronize multiple ICS feeds into your Google Calendar.
 * It reads the "ICS_URLS" property, which should be a comma-separated string.
 */
function startSync() {
  const userEmail = Session.getActiveUser().getEmail();
  const calendar = CalendarApp.getCalendarById(userEmail);
  
  // 1. Get the raw string from properties (e.g., "url1,url2,url3")
  const rawUrls = scriptProperties.getProperty("ICS_URLS");

  if (!rawUrls) {
    Logger.log("ERROR: 'ICS_URLS' property is missing or empty.");
    return;
  }

  // 2. Convert string to array and remove extra spaces
  const urlList = rawUrls.split(",").map(url => url.trim());
  Logger.log(`[INIT] Found ${urlList.length} URL(s) to process.`);

  // 3. Iterate through each URL and sync events
  urlList.forEach((url, index) => {
    try {
      Logger.log(`[FEED ${index + 1}] Fetching: ${url}`);
      const response = UrlFetchApp.fetch(url);
      let icalData = response.getContentText();

      // --- ICS UNFOLDING ---
      // Fixes "Line Folding": removes line breaks followed by space/tab
      icalData = icalData.replace(/\r?\n[ \t]/g, "");

      const vevents = icalData.split("BEGIN:VEVENT");
      vevents.shift(); // Discard header

      const today = new Date();
      today.setHours(0, 0, 0, 0); 
      const limitDate = new Date();
      limitDate.setDate(today.getDate() + 30); // Sync window: 30 days

      vevents.forEach(item => {
        const summary = getTagValue(item, "SUMMARY");
        const dtstart = getTagValue(item, "DTSTART");
        const dtend = getTagValue(item, "DTEND");
        const description = getTagValue(item, "DESCRIPTION") || "";
        const organizerRaw = getTagValue(item, "ORGANIZER");

        if (summary && dtstart && dtend) {
          const start = parseIcalDate(dtstart);
          const end = parseIcalDate(dtend);

          // Sync only future events within the 30-day limit
          if (start >= today && start <= limitDate) {
            const existing = calendar.getEvents(start, end, { search: summary });
            
            if (existing.length === 0) {
              // --- ORGANIZER DATA ---
              let organizerInfo = "";
              if (organizerRaw) {
                const cnMatch = item.match(/ORGANIZER;[^:]*CN=([^;:]+)/i);
                const mailMatch = organizerRaw.match(/mailto:([^;:]+)/i);
                const name = cnMatch ? cnMatch[1].replace(/"/g, "") : "";
                const email = mailMatch ? mailMatch[1] : organizerRaw;
                organizerInfo = `Organizer: ${name ? name + " <" + email + ">" : email}\n\n`;
              }

              // --- FORMAT DESCRIPTION ---
              const finalBody = (organizerInfo + description)
                .replace(/\\n/g, "\n")
                .replace(/\\,/g, ",")
                .replace(/\\;/g, ";")
                .replace(/\\"/g, '"');

              const event = calendar.createEvent(summary, start, end, {
                description: finalBody
              });
              
              event.setColor(CalendarApp.EventColor.GRAY);
              Logger.log(`>>> ADDED: '${summary}' at ${start.toLocaleString("nl-NL")}`);
              Utilities.sleep(500); // Prevent hitting Calendar API limits
            }
          }
        }
      });
    } catch (err) {
      Logger.log(`[CRITICAL ERROR] Feed ${index + 1}: ${err.message}`);
    }
  });
}

/**
 * Extracts a specific tag value from the iCal raw data.
 */
function getTagValue(data, tag) {
  const regex = new RegExp("^" + tag + "(?:;[^:]*)?:(.*)$", "im");
  const match = data.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parses iCal date strings into Javascript Date objects.
 * Handles UTC (Z) and local timezones correctly.
 */
function parseIcalDate(icalStr) {
  const cleanStr = icalStr.replace(/\D/g, ""); 
  const y = parseInt(cleanStr.substring(0, 4), 10);
  const m = parseInt(cleanStr.substring(4, 6), 10) - 1;
  const d = parseInt(cleanStr.substring(6, 8), 10);
  const h = parseInt(cleanStr.substring(8, 10), 10);
  const min = parseInt(cleanStr.substring(10, 12), 10);

  if (icalStr.indexOf('Z') !== -1) {
    return new Date(Date.UTC(y, m, d, h, min));
  } else {
    return new Date(y, m, d, h, min);
  }
}

/**
 * Utility: Deletes all project triggers to reset the installation.
 */
function uninstall() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log(`Cleaned up ${triggers.length} triggers.`);
}

/**
 * Utility: Sets up the 6-hour sync trigger.
 */
function install() {
  uninstall(); 
  ScriptApp.newTrigger("startSync")
    .timeBased()
    .everyHours(6) 
    .create();
  Logger.log("SUCCESS: 6-hour sync trigger installed.");
}