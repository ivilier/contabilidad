/**
 * InventoryScript.gs — Sistema de Inventario Multicategoría y Catálogo Dinámico
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Apps Script Web App — ivilier Joyería
 *
 * ESTRUCTURA DEL LIBRO DE GOOGLE SHEETS:
 *   10 pestañas dedicadas por categoría con colores:
 *     1. Aretes     2. Anillos     3. Bolsas     4. Dijes       5. Cadenas
 *     6. Arracadas  7. Ear Cuff    8. Pulseras   9. Tobilleras  10. Esmeraldas
 *
 * ENCABEZADOS POR PESTAÑA:
 *   Timestamp | Direction | Ref Code | Description | Price | Category | Quantity | Notes | Date | Foto
 *
 * SINCRONIZACIÓN AUTOMÁTICA CON LA WEB:
 *   - Cualquier producto nuevo agregado en Google Sheets con su código de referencia
 *     se sincroniza automáticamente con el catálogo de la tienda web.
 *   - La imagen se vincula automáticamente a:
 *     /images/{categoria}/{REF_CODE}.jpg
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

var CATEGORY_ALIASES = {
  "arete": "aretes", "aretes": "aretes", "earring": "aretes", "earrings": "aretes", "topos": "aretes", "broquel": "aretes",
  "dije": "dijes", "dijes": "dijes", "pendant": "dijes", "pendants": "dijes",
  "anillo": "anillos", "anillos": "anillos", "ring": "anillos", "rings": "anillos",
  "cadena": "cadenas", "cadenas": "cadenas", "collar": "cadenas", "collares": "cadenas",
  "bolsa": "bolsas", "bolsas": "bolsas", "bolso": "bolsas", "bolsos": "bolsas", "carriel": "bolsas", "wayuu": "bolsas",
  "arracada": "arracadas", "arracadas": "arracadas", "candonga": "arracadas",
  "ear_cuff": "ear_cuff", "earcuff": "ear_cuff", "ear-cuff": "ear_cuff", "ear cuff": "ear_cuff", "brazalete para oreja": "ear_cuff", "brazalete oreja": "ear_cuff",
  "pulsera": "pulseras", "pulseras": "pulseras", "manilla": "pulseras",
  "tobillera": "tobilleras", "tobilleras": "tobilleras",
  "esmeralda": "esmeraldas", "esmeraldas": "esmeraldas", "emerald": "esmeraldas"
};

var HEADERS = [
  "Timestamp", "Direction", "Ref Code", "Description",
  "Price", "Category", "Quantity", "Notes", "Date", "Foto"
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
  var canonicalKey = CATEGORY_ALIASES[key] || key;
  return CATEGORY_TABS[canonicalKey] || { name: rawCategory || "General", color: "#475569" };
}

/**
 * Extrae o genera la URL de la imagen.
 */
function normalizeImageUrl_(val, formula, category, refCode) {
  var str = String(val || "").trim();
  var form = String(formula || "").trim();

  // Si hay una fórmula =IMAGE("URL")
  if (form && form.toUpperCase().indexOf("IMAGE(") !== -1) {
    var match = form.match(/IMAGE\(\s*["']([^"']+)["']/i);
    if (match && match[1]) return match[1];
  }

  // Si es un enlace de Google Drive
  if (str.indexOf("drive.google.com") !== -1) {
    var idMatch = str.match(/\/d\/([a-zA-Z0-9_-]+)/) || str.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      return "https://lh3.googleusercontent.com/d/" + idMatch[1];
    }
  }

  if (str && (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("/"))) {
    return str;
  }

  // Ruta por defecto en el repositorio
  var catKey = String(category || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  var code = String(refCode || "").trim().toUpperCase();
  return "/images/" + catKey + "/" + code + ".jpg";
}


// ══ POST — Registrar movimiento de inventario en la pestaña de su categoría ═══
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

      var catKey = String(item.category || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      var code = item.ref_code.trim().toUpperCase();

      // Fórmula de imagen para la celda de Google Sheets
      var imageField = item.image || item.image_url || "";
      if (!imageField) {
        imageField = '=IMAGE("https://raw.githubusercontent.com/ivilier/contabilidad/main/images/' + catKey + '/' + code + '.jpg")';
      }

      grouped[tabName].rows.push([
        new Date().toISOString(),
        item.direction,
        code,
        (item.description || "").trim(),
        (item.price       || "").trim(),
        (item.category    || "").trim(),
        qty,
        (item.notes || "").trim(),
        item.date,
        imageField
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


// ══ GET — Leer movimientos, stock y catálogo dinámico ═════════════════════════
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var isCatalogRequest = params.action === "catalog" || params.action === "public";

    // Si no es consulta pública de catálogo, validar PIN
    if (!isCatalogRequest && !isAuthorized_(e, null)) {
      return jsonResponse({ status: "unauthorized", message: "Acceso no autorizado" });
    }

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

      var legacySheet = ss.getSheetByName("InventoryLog");
      if (legacySheet && sheetsToRead.indexOf(legacySheet) === -1) {
        sheetsToRead.push(legacySheet);
      }
    }

    var allRows = [];
    var stockSummary = {};
    var dynamicCatalog = {};

    sheetsToRead.forEach(function(sheet) {
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow <= 1 || lastCol < 1) return;

      var numCols = Math.max(lastCol, HEADERS.length);
      var allValues = sheet.getRange(1, 1, lastRow, numCols).getValues();
      var allFormulas = sheet.getRange(1, 1, lastRow, numCols).getFormulas();
      var headers = allValues[0];

      var codeIdx = headers.indexOf("Ref Code");
      var descIdx = headers.indexOf("Description");
      var priceIdx = headers.indexOf("Price");
      var catIdx = headers.indexOf("Category");
      var qtyIdx = headers.indexOf("Quantity");
      var dirIdx = headers.indexOf("Direction");
      var imgIdx = headers.indexOf("Foto");
      if (imgIdx === -1) imgIdx = headers.indexOf("Image");

      for (var r = 1; r < allValues.length; r++) {
        var row = allValues[r];
        var formulas = allFormulas[r];
        var obj = {};
        headers.forEach(function(h, i) { obj[h] = row[i]; });

        var code = String(codeIdx !== -1 ? row[codeIdx] : obj["Ref Code"] || "").trim().toUpperCase();
        var desc = String(descIdx !== -1 ? row[descIdx] : obj["Description"] || "").trim();
        var price = String(priceIdx !== -1 ? row[priceIdx] : obj["Price"] || "").trim();
        var cat = String(catIdx !== -1 ? row[catIdx] : obj["Category"] || "").trim().toLowerCase();
        var qty = parseInt(qtyIdx !== -1 ? row[qtyIdx] : obj["Quantity"], 10) || 0;
        var dir = String(dirIdx !== -1 ? row[dirIdx] : obj["Direction"] || "").toUpperCase();

        var rawImgVal = imgIdx !== -1 ? row[imgIdx] : (obj["Foto"] || obj["Image"] || "");
        var rawImgForm = imgIdx !== -1 ? formulas[imgIdx] : "";
        var imgUrl = normalizeImageUrl_(rawImgVal, rawImgForm, cat, code);
        obj["ImageUrl"] = imgUrl;

        if (code) {
          if (!stockSummary[code]) {
            stockSummary[code] = {
              ref_code:     code,
              description:  desc,
              price:        price,
              category:     cat,
              image:        imgUrl,
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

          // Construcción del catálogo dinámico
          if (!dynamicCatalog[code]) {
            dynamicCatalog[code] = {
              ref_code:     code,
              description:  desc,
              price:        price ? (price.startsWith("$") ? price : "$" + price) : "$0",
              category:     cat,
              image:        imgUrl,
              currentStock: stockSummary[code].currentStock
            };
          } else {
            dynamicCatalog[code].currentStock = stockSummary[code].currentStock;
            if (desc && !dynamicCatalog[code].description) dynamicCatalog[code].description = desc;
            if (price && (!dynamicCatalog[code].price || dynamicCatalog[code].price === "$0")) dynamicCatalog[code].price = price.startsWith("$") ? price : "$" + price;
            if (imgUrl && !dynamicCatalog[code].image) dynamicCatalog[code].image = imgUrl;
          }
        }

        allRows.push(obj);
      }
    });

    var productsArray = Object.keys(dynamicCatalog).map(function(k) {
      return dynamicCatalog[k];
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
      products: productsArray,
      total: recentRows.length,
      stockSummary: stockSummary,
      totalMovements: allRows.length
    });

  } catch (err) {
    Logger.log("doGet error: " + err.toString());
    return jsonResponse({ status: "error", message: err.toString() });
  }
}


// ══ UTILIDADES Y MIGRACIÓN EN LOTE (BATCH) ════════════════════════════════════

/**
 * Obtiene o crea la pestaña de la categoría indicada con diseño y ancho de columnas.
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
      sheet.setColumnWidth(10, 180);// Foto
    } catch (e) {}
  } else {
    var lastCol = sheet.getLastColumn();
    if (lastCol < HEADERS.length) {
      sheet.getRange(1, HEADERS.length).setValue("Foto");
      try { sheet.setColumnWidth(HEADERS.length, 180); } catch (e) {}
    }
  }

  return sheet;
}

/**
 * Inicializa las 10 pestañas de categorías en el libro de cálculo.
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
 * e insertándolos por lotes (Batch) con su fórmula de imagen.
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

  var allValues = legacy.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = allValues[0];
  var catColIdx = headers.indexOf("Category");
  if (catColIdx === -1) catColIdx = 5;

  var grouped = {};
  for (var i = 1; i < allValues.length; i++) {
    var row = allValues[i];
    var rawCat = String(row[catColIdx] || "").trim();
    var tabInfo = getTabInfoForCategory_(rawCat);
    var tabName = tabInfo.name;

    var paddedRow = [];
    for (var c = 0; c < HEADERS.length; c++) {
      paddedRow.push(c < row.length ? row[c] : "");
    }

    // Si falta la fórmula de foto, generarla
    if (!paddedRow[9]) {
      var catKey = String(rawCat || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      var refCode = String(paddedRow[2] || "").trim().toUpperCase();
      paddedRow[9] = '=IMAGE("https://raw.githubusercontent.com/ivilier/contabilidad/main/images/' + catKey + '/' + refCode + '.jpg")';
    }

    if (!grouped[tabName]) {
      grouped[tabName] = { info: tabInfo, rows: [] };
    }
    grouped[tabName].rows.push(paddedRow);
  }

  var totalMigrated = 0;
  Object.keys(grouped).forEach(function(tabName) {
    var g = grouped[tabName];
    if (!g.rows || g.rows.length === 0) return;

    var sheet = getOrCreateCategorySheet_(ss, tabName, g.info.color);
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, g.rows.length, HEADERS.length).setValues(g.rows);
    totalMigrated += g.rows.length;
    Logger.log("✓ " + tabName + ": " + g.rows.length + " filas migradas con foto.");
  });

  Logger.log("✓ Migración completada con éxito. Total: " + totalMigrated + " registros distribuidos.");
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
