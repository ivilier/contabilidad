/**
 * InventoryScript.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Apps Script Web App — Inventory Workbook
 *
 * PURPOSE
 *   Acts as a serverless API bridge between the static Jekyll site and a
 *   private Google Sheets workbook. Handles POST (append stock movement) and
 *   GET (read last N rows as JSON, optionally filtered by ref_code).
 *
 * DEPLOY SETTINGS
 *   New deployment → Web app
 *   Execute as   : Me  (uses the spreadsheet owner's credentials)
 *   Who can access: Anyone  (allows anonymous calls from the static site)
 *
 * SHEET STRUCTURE  (auto-created on first run)
 *   Sheet name : InventoryLog
 *   Columns    : Timestamp | Direction | Ref Code | Description |
 *                Price | Category | Quantity | Notes | Date
 * ─────────────────────────────────────────────────────────────────────────────
 */

var SHEET_NAME = "InventoryLog";
var HEADERS    = [
  "Timestamp", "Direction", "Ref Code", "Description",
  "Price", "Category", "Quantity", "Notes", "Date"
];


// ══ POST — Append a new inventory movement row ════════════════════════════════
function doPost(e) {
  try {
    // Parse JSON body sent by the client fetch()
    var raw = e.postData && e.postData.contents;
    if (!raw) return jsonResponse({ status: "error", message: "Empty request body" });

    var data = JSON.parse(raw);

    // ── Honeypot guard ──────────────────────────────────────────────────────
    if (data._hp && data._hp !== "") {
      return jsonResponse({ status: "ignored", message: "Honeypot triggered" });
    }

    // ── Required-field validation ───────────────────────────────────────────
    if (!data.direction || (data.direction !== "IN" && data.direction !== "OUT")) {
      return jsonResponse({ status: "error", message: "Invalid or missing direction" });
    }
    if (!data.ref_code || !data.ref_code.trim()) {
      return jsonResponse({ status: "error", message: "Missing ref_code" });
    }
    var qty = parseInt(data.quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return jsonResponse({ status: "error", message: "Invalid quantity" });
    }
    if (!data.date) {
      return jsonResponse({ status: "error", message: "Missing date" });
    }

    // ── Append row ──────────────────────────────────────────────────────────
    var sheet = getOrCreateSheet_();
    sheet.appendRow([
      new Date().toISOString(),         // Timestamp — server-side UTC
      data.direction,                    // "IN" or "OUT"
      data.ref_code.trim().toUpperCase(),// Normalized product ref code
      (data.description || "").trim(),   // Product description from catalog
      (data.price       || "").trim(),   // Price string (e.g. "$14")
      (data.category    || "").trim(),   // Category (aretes, dijes, etc.)
      qty,                               // Integer quantity
      (data.notes || "").trim(),         // Optional free-text notes
      data.date,                         // Client date string (YYYY-MM-DD)
    ]);

    return jsonResponse({ status: "ok", message: "Row appended successfully" });

  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    return jsonResponse({ status: "error", message: err.toString() });
  }
}


// ══ GET — Return the last N rows as JSON ══════════════════════════════════════
//
// Query parameters (all optional):
//   ?limit=50             — number of rows to return (default 50, max 500)
//   ?ref_code=E0001       — filter to a specific product
//   ?direction=OUT        — filter by movement direction: IN or OUT
//   ?category=aretes      — filter by product category
//
function doGet(e) {
  try {
    var params    = (e && e.parameter) || {};
    var limit     = Math.min(parseInt(params.limit || "50", 10), 500);
    var refFilter = params.ref_code   || null;
    var dirFilter = params.direction  || null;
    var catFilter = params.category   || null;

    var sheet = getOrCreateSheet_();
    var all   = sheet.getDataRange().getValues();

    if (all.length <= 1) {
      return jsonResponse({ status: "ok", rows: [], total: 0 });
    }

    var headers = all[0];
    var rows = all.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });

    // Apply optional filters
    if (refFilter) {
      rows = rows.filter(function(r) {
        return String(r["Ref Code"]).toUpperCase() === refFilter.toUpperCase();
      });
    }
    if (dirFilter === "IN" || dirFilter === "OUT") {
      rows = rows.filter(function(r) { return r["Direction"] === dirFilter; });
    }
    if (catFilter) {
      rows = rows.filter(function(r) {
        return String(r["Category"]).toLowerCase() === catFilter.toLowerCase();
      });
    }

    // Most recent first, capped at limit
    rows = rows.reverse().slice(0, limit);

    return jsonResponse({ status: "ok", rows: rows, total: rows.length });

  } catch (err) {
    Logger.log("doGet error: " + err.toString());
    return jsonResponse({ status: "error", message: err.toString() });
  }
}


// ══ PRIVATE HELPERS ═══════════════════════════════════════════════════════════

/**
 * Returns the InventoryLog sheet, creating and styling it if it doesn't exist.
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);

    // Style the header row
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground("#f43f5e");    // rose-500
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(11);

    // Column widths
    sheet.setColumnWidth(1, 220); // Timestamp
    sheet.setColumnWidth(2, 90);  // Direction
    sheet.setColumnWidth(3, 100); // Ref Code
    sheet.setColumnWidth(4, 260); // Description
    sheet.setColumnWidth(5, 80);  // Price
    sheet.setColumnWidth(6, 100); // Category
    sheet.setColumnWidth(7, 80);  // Quantity
    sheet.setColumnWidth(8, 220); // Notes
    sheet.setColumnWidth(9, 110); // Date
  }

  return sheet;
}

/**
 * Serializes an object to a JSON ContentService response.
 * @param  {Object} obj
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
