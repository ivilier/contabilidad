/**
 * AccountingScript.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Apps Script Web App — Accounting Workbook
 *
 * PURPOSE
 *   Acts as a serverless API bridge between the static Jekyll site and a
 *   private Google Sheets workbook. Handles POST (append new entry) and
 *   GET (read last N rows as JSON).
 *
 * DEPLOY SETTINGS
 *   New deployment → Web app
 *   Execute as   : Me  (uses the spreadsheet owner's credentials)
 *   Who can access: Anyone  (allows anonymous calls from the static site)
 *
 * SHEET STRUCTURE  (auto-created on first run)
 *   Sheet name : CashFlow
 *   Columns    : Timestamp | Direction | Amount | Description | Date
 * ─────────────────────────────────────────────────────────────────────────────
 */

var SHEET_NAME = "CashFlow";
var HEADERS    = ["Timestamp", "Direction", "Amount", "Description", "Date"];

// ── AUTHENTICATION TOKEN ──────────────────────────────────────────────────────
// Se lee de forma segura desde las "Propiedades del Script" en Google Apps Script
// para que la clave real NUNCA quede expuesta en el repositorio público de GitHub.
var AUTH_TOKEN = PropertiesService.getScriptProperties().getProperty("AUTH_TOKEN");

/**
 * Validates the authentication token sent in GET query params or POST body.
 * @param  {Object} e
 * @param  {Object} postData
 * @return {boolean}
 */
function isAuthorized_(e, postData) {
  var provided = (e && e.parameter && e.parameter.auth) || (postData && postData.auth);
  return String(provided || "").trim() === String(AUTH_TOKEN).trim();
}


// ══ POST — Append a new cash flow row ═════════════════════════════════════════
function doPost(e) {
  try {
    // Parse JSON body sent by the client fetch()
    var raw  = e.postData && e.postData.contents;
    if (!raw) return jsonResponse({ status: "error", message: "Empty request body" });

    var data = JSON.parse(raw);

    // ── Authentication guard ────────────────────────────────────────────────
    if (!isAuthorized_(e, data)) {
      return jsonResponse({ status: "unauthorized", message: "Acceso no autorizado" });
    }

    // ── Honeypot guard ──────────────────────────────────────────────────────
    // Real users never fill the hidden _hp field; bots often do.
    if (data._hp && data._hp !== "") {
      return jsonResponse({ status: "ignored", message: "Honeypot triggered" });
    }

    // ── Required-field validation ───────────────────────────────────────────
    if (!data.direction || (data.direction !== "IN" && data.direction !== "OUT")) {
      return jsonResponse({ status: "error", message: "Invalid or missing direction" });
    }
    var amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return jsonResponse({ status: "error", message: "Invalid amount" });
    }
    if (!data.date) {
      return jsonResponse({ status: "error", message: "Missing date" });
    }

    // ── Append row ──────────────────────────────────────────────────────────
    var sheet = getOrCreateSheet_();
    sheet.appendRow([
      new Date().toISOString(),       // Timestamp — server-side UTC
      data.direction,                  // "IN" or "OUT"
      amount,                          // Numeric for spreadsheet calculations
      (data.description || "").trim(), // Optional free-text description
      data.date,                       // Client date string (YYYY-MM-DD)
    ]);

    return jsonResponse({ status: "ok", message: "Row appended successfully" });

  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    return jsonResponse({ status: "error", message: err.toString() });
  }
}


// ══ GET — Return the last N rows as JSON + cash summary ════════════════════════
//
// Query parameters:
//   ?auth=1234        — required authentication token
//   ?limit=50         — number of rows to return (default 50, max 500)
//   ?direction=IN     — filter by direction: IN or OUT
//
function doGet(e) {
  try {
    // ── Authentication guard ────────────────────────────────────────────────
    if (!isAuthorized_(e, null)) {
      return jsonResponse({ status: "unauthorized", message: "Acceso no autorizado" });
    }

    var params    = (e && e.parameter) || {};
    var limit     = Math.min(parseInt(params.limit || "50", 10), 500);
    var dirFilter = params.direction || null;

    var sheet = getOrCreateSheet_();
    var all   = sheet.getDataRange().getValues();

    // If there's only a header row (or empty), return empty array
    if (all.length <= 1) {
      return jsonResponse({
        status: "ok",
        rows: [],
        total: 0,
        summary: { totalIn: 0, totalOut: 0, balance: 0, totalCount: 0 }
      });
    }

    var headers = all[0];
    var totalIn = 0;
    var totalOut = 0;

    var allRows = all.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      var amt = parseFloat(obj["Amount"]) || 0;
      if (obj["Direction"] === "IN") {
        totalIn += amt;
      } else if (obj["Direction"] === "OUT") {
        totalOut += amt;
      }
      return obj;
    });

    var filteredRows = allRows;
    // Optional direction filter
    if (dirFilter === "IN" || dirFilter === "OUT") {
      filteredRows = filteredRows.filter(function(r) { return r["Direction"] === dirFilter; });
    }

    // Most recent rows first, capped at limit
    var recentRows = filteredRows.slice().reverse().slice(0, limit);

    return jsonResponse({
      status: "ok",
      rows: recentRows,
      total: recentRows.length,
      summary: {
        totalIn: Math.round(totalIn * 100) / 100,
        totalOut: Math.round(totalOut * 100) / 100,
        balance: Math.round((totalIn - totalOut) * 100) / 100,
        totalCount: allRows.length
      }
    });

  } catch (err) {
    Logger.log("doGet error: " + err.toString());
    return jsonResponse({ status: "error", message: err.toString() });
  }
}


// ══ PRIVATE HELPERS ═══════════════════════════════════════════════════════════

/**
 * Returns the CashFlow sheet, creating and styling it if it doesn't exist.
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);

    // Style the header row for easy reading
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground("#f43f5e");      // rose-500
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(11);

    // Set sensible column widths
    sheet.setColumnWidth(1, 220); // Timestamp
    sheet.setColumnWidth(2, 90);  // Direction
    sheet.setColumnWidth(3, 100); // Amount
    sheet.setColumnWidth(4, 300); // Description
    sheet.setColumnWidth(5, 110); // Date
  }

  return sheet;
}

/**
 * Serializes an object to a JSON ContentService response.
 * ContentService is the only CORS-compatible output method for Apps Script.
 * @param  {Object} obj
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
