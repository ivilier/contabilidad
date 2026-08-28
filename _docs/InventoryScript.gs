/**
 * InventoryScript.gs — Opción 1 (Pestañas separadas por Categoría - Batch Optimizado)
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Apps Script Web App — Libro de Inventario de ivilier Joyería
 *
 * ESTRUCTURA DEL LIBRO DE GOOGLE SHEETS
 *   Crea y gestiona automáticamente 10 pestañas dedicadas por categoría:
 *     1.  Aretes
 *     2.  Anillos
 *     3.  Bolsas
 *     4.  Dijes
 *     5.  Cadenas
 *     6.  Arracadas
 *     7.  Ear Cuff
 *     8.  Pulseras
 *     9.  Tobilleras
 *     10. Esmeraldas
 *
 * ENCABEZADOS POR PESTAÑA:
 *   Timestamp | Direction | Ref Code | Description | Price | Category | Quantity | Notes | Date
 *
 * CONFIGURACIÓN DE DESPLIEGUE EN APPS SCRIPT:
 *   Implementar → Nueva implementación → Tipo: Aplicación web
 *   Ejecutar como : Yo (tu cuenta de Google)
 *   Quién tiene acceso: Cualquier usuario (Anyone)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── MAPEADOR DE CATEGORÍAS Y NOMBRES DE PESTAÑAS ──────────────────────────────
var CATEGORY_TABS = {
  "aretes":     { name: "Aretes",     color: "#f43f5e" }, // Rose
  "anillos":    { name: "Anillos",    color: "#10b981" }, // Emerald
  "bolsas":     { name: "Bolsas",     color: "#8b5cf6" }, // Violet
  "dijes":      { name: "Dijes",      color: "#f59e0b" }, // Amber
  "cadenas":    { name: "Cadenas",    color: "#6366f1" }, // Indigo
  "arracadas":  { name: "Arracadas",  color: "#ec4899" }, // Pink
  "ear_cuff":   { name: "Ear Cuff",   color: "#14b8a6" }, // Teal
  "pulseras":   { name: "Pulseras",   color: "#06b6d4" }, // Cyan
  "tobilleras": { name: "Tobilleras", color: "#3b82f6" }, // Blue
  "esmeraldas": { name: "Esmeraldas", color: "#22c55e" }, // Green
};

var HEADERS = [
  "Timestamp", "Direction", "Ref Code", "Description",
  "Price", "Category", "Quantity", "Notes", "Date"
];

// ── TOKEN / PIN DE AUTENTICACIÓN ──────────────────────────────────────────────
var AUTH_TOKEN = PropertiesService.getScriptProperties().getProperty("AUTH_TOKEN");

/**
 * Valida el token o PIN enviado en la petición.
 */
function isAuthorized_(e, postData) {
  var provided = (e && e.parameter && e.parameter.auth) || (postData && postData.auth);
  return String(provided || "").trim() === String(AUTH_TOKEN).trim();
}

/**
 * Normaliza la clave de categoría para buscar su pestaña correspondiente.
 */
function getTabInfoForCategory_(rawCategory) {
  var key = String(rawCategory || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return CATEGORY_TABS[key] || { name: rawCategory || "General", color: "#475569" };
}


// ══ POST — Registrar movimiento en la pestaña de su categoría ═════════════════
function doPost(e) {
  try {
    var raw = e.postData && e.postData.contents;
    if (!raw) return jsonResponse({ status: "error", message: "Cuerpo de solicitud vacío" });

    var data = JSON.parse(raw);

    // ── Guard de autenticación ──────────────────────────────────────────────
    if (!isAuthorized_(e, data)) {
      return jsonResponse({ status: "unauthorized", message: "Acceso no autorizado" });
    }

    // ── Guard Honeypot contra bots ──────────────────────────────────────────
    if (data._hp && data._hp !== "") {
      return jsonResponse({ status: "ignored", message: "Honeypot detectado" });
    }

    var items = data.items && Array.isArray(data.items) ? data.items : [data];
    var grouped = {};

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      if (!item.direction || (item.direction !== "IN" && item.direction !== "OUT")) {
        return jsonResponse({ status: "error", message: "Dirección inválida (use IN o OUT)" });
      }
      if (!item.ref_code || !item.ref_code.trim()) {
        return jsonResponse({ status: "error", message: "Falta ref_code" });
      }
      var qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty < 1) {
        return jsonResponse({ status: "error", message: "Cantidad inválida" });
      }
      if (!item.date) {
        return jsonResponse({ status: "error", message: "Falta fecha" });
      }

      var tabInfo = getTabInfoForCategory_(item.category);
      var tabName = tabInfo.name;
      if (!grouped[tabName]) grouped[tabName] = { info: tabInfo, rows: [] };

      grouped[tabName].rows.push([
        new Date().toISOString(),
        item.direction,
        item.ref_code.trim().toUpperCase(),
        (item.description || "").trim(),
        (item.price       || "").trim(),
        (item.category    || "").trim(),
        qty,
        (item.notes || "").trim(),
        item.date,
      ]);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(grouped).forEach(function(tabName) {
      var g = grouped[tabName];
      var sheet = getOrCreateCategorySheet_(ss, tabName, g.info.color);
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, g.rows.length, HEADERS.length).setValues(g.rows);
    });

    return jsonResponse({
      status: "ok",
      message: "Registrado con éxito (" + items.length + " movimiento(s))"
    });

  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    return jsonResponse({ status: "error", message: err.toString() });
  }
}


// ══ GET — Leer movimientos y calcular stock consolidado por pestañas ══════════
function doGet(e) {
  try {
    // ── Guard de autenticación ──────────────────────────────────────────────
    if (!isAuthorized_(e, null)) {
      return jsonResponse({ status: "unauthorized", message: "Acceso no autorizado" });
    }

    var params    = (e && e.parameter) || {};
    var limit     = Math.min(parseInt(params.limit || "50", 10), 500);
    var refFilter = params.ref_code   || null;
    var dirFilter = params.direction  || null;
    var catFilter = params.category   || null;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetsToRead = [];

    if (catFilter) {
      var info = getTabInfoForCategory_(catFilter);
      var s = ss.getSheetByName(info.name);
      if (s) sheetsToRead.push(s);
    } else {
      Object.keys(CATEGORY_TABS).forEach(function(k) {
        var name = CATEGORY_TABS[k].name;
        var s = ss.getSheetByName(name);
        if (s) sheetsToRead.push(s);
      });

      // Incluir también la hoja InventoryLog si aún tiene registros pendientes
      var legacySheet = ss.getSheetByName("InventoryLog");
      if (legacySheet && sheetsToRead.indexOf(legacySheet) === -1) {
        sheetsToRead.push(legacySheet);
      }
    }

    var allRows = [];
    var stockSummary = {};

    sheetsToRead.forEach(function(sheet) {
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow <= 1 || lastCol < 1) return;

      var all = sheet.getRange(1, 1, lastRow, Math.max(lastCol, HEADERS.length)).getValues();
      var headers = all[0];

      for (var r = 1; r < all.length; r++) {
        var row = all[r];
        var obj = {};
        headers.forEach(function(h, i) { obj[h] = row[i]; });

        var code = String(obj["Ref Code"] || "").trim().toUpperCase();
        var qty  = parseInt(obj["Quantity"], 10) || 0;
        var dir  = String(obj["Direction"] || "").toUpperCase();

        if (code) {
          if (!stockSummary[code]) {
            stockSummary[code] = {
              ref_code:     code,
              description:  obj["Description"] || "",
              price:        obj["Price"] || "",
              category:     obj["Category"] || "",
              totalIn:      0,
              totalOut:     0,
              currentStock: 0
            };
          }
          if (dir === "IN") {
            stockSummary[code].totalIn += qty;
            stockSummary[code].currentStock += qty;
          } else if (dir === "OUT") {
            stockSummary[code].totalOut += qty;
            stockSummary[code].currentStock -= qty;
          }
        }

        allRows.push(obj);
      }
    });

    var filteredRows = allRows;

    if (refFilter) {
      filteredRows = filteredRows.filter(function(r) {
        return String(r["Ref Code"]).toUpperCase() === refFilter.toUpperCase();
      });
    }
    if (dirFilter === "IN" || dirFilter === "OUT") {
      filteredRows = filteredRows.filter(function(r) { return r["Direction"] === dirFilter; });
    }

    filteredRows.sort(function(a, b) {
      var tA = a.Timestamp ? new Date(a.Timestamp).getTime() : 0;
      var tB = b.Timestamp ? new Date(b.Timestamp).getTime() : 0;
      return tB - tA;
    });

    var recentRows = filteredRows.slice(0, limit);

    return jsonResponse({
      status: "ok",
      rows: recentRows,
      total: recentRows.length,
      stockSummary: stockSummary,
      totalMovements: allRows.length
    });

  } catch (err) {
    Logger.log("doGet error: " + err.toString());
    return jsonResponse({ status: "error", message: err.toString() });
  }
}


// ══ UTILIDADES Y MIGRACIÓN OPTIMIZADA POR LOTES ═══════════════════════════════

/**
 * Obtiene o crea la pestaña de la categoría indicada y le aplica diseño.
 */
function getOrCreateCategorySheet_(ss, tabName, colorHex) {
  var sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);

    if (colorHex) {
      try { sheet.setTabColor(colorHex); } catch (e) {}
    }

    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground(colorHex || "#1f2937");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(10);

    try {
      sheet.setColumnWidth(1, 200); // Timestamp
      sheet.setColumnWidth(2, 85);  // Direction
      sheet.setColumnWidth(3, 95);  // Ref Code
      sheet.setColumnWidth(4, 250); // Description
      sheet.setColumnWidth(5, 75);  // Price
      sheet.setColumnWidth(6, 95);  // Category
      sheet.setColumnWidth(7, 75);  // Quantity
      sheet.setColumnWidth(8, 200); // Notes
      sheet.setColumnWidth(9, 105); // Date
    } catch (e) {}
  }

  return sheet;
}

/**
 * Inicializa las 10 pestañas de categorías con diseño en un solo paso.
 */
function initializeAllCategoryTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(CATEGORY_TABS).forEach(function(key) {
    var tab = CATEGORY_TABS[key];
    getOrCreateCategorySheet_(ss, tab.name, tab.color);
  });
  Logger.log("✓ Las 10 pestañas de categorías han sido inicializadas correctamente.");
}

/**
 * Migra los registros existentes en 'InventoryLog' agrupándolos en memoria
 * e insertándolos por lotes (Batch) en menos de 1 segundo sin errores.
 */
function migrateExistingRowsToCategoryTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var legacy = ss.getSheetByName("InventoryLog");

  if (!legacy) {
    Logger.log("No se encontró la hoja 'InventoryLog'. Nada que migrar.");
    return;
  }

  var lastRow = legacy.getLastRow();
  var lastCol = legacy.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) {
    Logger.log("La hoja 'InventoryLog' no tiene filas de datos para migrar.");
    return;
  }

  var all = legacy.getRange(1, 1, lastRow, Math.max(lastCol, HEADERS.length)).getValues();
  var headers = all[0];
  var catColIdx = headers.indexOf("Category");
  if (catColIdx === -1) catColIdx = 5;

  // Agrupar filas por pestaña de categoría
  var grouped = {};
  for (var i = 1; i < all.length; i++) {
    var row = all[i];
    var rawCat = String(row[catColIdx] || "").trim();
    var tabInfo = getTabInfoForCategory_(rawCat);
    var tabName = tabInfo.name;

    if (!grouped[tabName]) {
      grouped[tabName] = { info: tabInfo, rows: [] };
    }
    grouped[tabName].rows.push(row);
  }

  // Escribir en lote en cada pestaña
  var totalMigrated = 0;
  Object.keys(grouped).forEach(function(tabName) {
    var g = grouped[tabName];
    if (!g.rows || g.rows.length === 0) return;

    var sheet = getOrCreateCategorySheet_(ss, tabName, g.info.color);
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, g.rows.length, HEADERS.length).setValues(g.rows);
    totalMigrated += g.rows.length;
    Logger.log("✓ " + tabName + ": " + g.rows.length + " filas migradas.");
  });

  Logger.log("✓ Migración completada con éxito. Total: " + totalMigrated + " registros distribuidos en sus pestañas.");
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
