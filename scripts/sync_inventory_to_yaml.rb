#!/usr/bin/env ruby
# frozen_string_literal: true

# ─────────────────────────────────────────────────────────────────────────────
# sync_inventory_to_yaml.rb
# Sincroniza el inventario de Google Sheets con los archivos _data/*.yml
#
# - Agrega nuevos productos ingresados en Google Sheets.
# - Elimina productos que hayan sido borrados en Google Sheets.
# - Actualiza descripciones y precios modificados en Google Sheets.
# ─────────────────────────────────────────────────────────────────────────────

require 'net/http'
require 'uri'
require 'json'
require 'yaml'
require 'fileutils'

INVENTORY_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxMcTrTFtmxSw_IIET-ZX-uoZxFCJp-IixvyiBB0LUhgJ8IyCF5loQQZ6b77iWx0Z0g/exec?action=catalog'

CATEGORY_FILES = {
  'aretes'     => '_data/aretes.yml',
  'anillos'    => '_data/anillos.yml',
  'bolsas'     => '_data/bolsas.yml',
  'dijes'      => '_data/dijes.yml',
  'cadenas'    => '_data/cadenas.yml',
  'arracadas'  => '_data/arracadas.yml',
  'ear_cuff'   => '_data/ear_cuff.yml',
  'pulseras'   => '_data/pulseras.yml',
  'tobilleras' => '_data/tobilleras.yml',
  'esmeraldas' => '_data/esmeraldas.yml'
}.freeze

CATEGORY_ALIASES = {
  'arete' => 'aretes', 'aretes' => 'aretes', 'earring' => 'aretes', 'earrings' => 'aretes', 'topos' => 'aretes', 'broquel' => 'aretes',
  'dije' => 'dijes', 'dijes' => 'dijes', 'pendant' => 'dijes', 'pendants' => 'dijes',
  'anillo' => 'anillos', 'anillos' => 'anillos', 'ring' => 'anillos', 'rings' => 'anillos',
  'cadena' => 'cadenas', 'cadenas' => 'cadenas', 'collar' => 'cadenas', 'collares' => 'cadenas',
  'bolsa' => 'bolsas', 'bolsas' => 'bolsas', 'bolso' => 'bolsas', 'bolsos' => 'bolsas', 'carriel' => 'bolsas', 'wayuu' => 'bolsas',
  'arracada' => 'arracadas', 'arracadas' => 'arracadas', 'candonga' => 'arracadas',
  'ear_cuff' => 'ear_cuff', 'earcuff' => 'ear_cuff', 'ear-cuff' => 'ear_cuff', 'ear cuff' => 'ear_cuff', 'brazalete para oreja' => 'ear_cuff', 'brazalete oreja' => 'ear_cuff',
  'pulsera' => 'pulseras', 'pulseras' => 'pulseras', 'manilla' => 'pulseras',
  'tobillera' => 'tobilleras', 'tobilleras' => 'tobilleras',
  'esmeralda' => 'esmeraldas', 'esmeraldas' => 'esmeraldas', 'emerald' => 'esmeraldas'
}.freeze

def fetch_json(url_str, max_redirects = 5)
  raise 'Demasiadas redirecciones HTTP' if max_redirects <= 0

  uri = URI(url_str)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = (uri.scheme == 'https')
  http.open_timeout = 15
  http.read_timeout = 25

  req = Net::HTTP::Get.new(uri.request_uri, { 'User-Agent' => 'Mozilla/5.0 (contabilidad-sync)' })
  res = http.request(req)

  case res
  when Net::HTTPSuccess
    JSON.parse(res.body)
  when Net::HTTPRedirection
    location = res['location']
    fetch_json(location, max_redirects - 1)
  else
    raise "HTTP Error #{res.code}: #{res.message}"
  end
end

def normalize_category(raw)
  key = raw.to_s.strip.downcase.gsub(/[\s-]+/, '_')
  CATEGORY_ALIASES[key] || key
end

def sync_catalog!
  puts '==> Consultando inventario en Google Sheets...'
  data = fetch_json(INVENTORY_SCRIPT_URL)

  unless data && data['status'] == 'ok'
    puts "Error en respuesta de Google Sheets: #{data ? data['message'] : 'Respuesta vacía'}"
    exit 1
  end

  raw_products = data['products'] || []
  if raw_products.empty? && data['stockSummary']
    raw_products = data['stockSummary'].values
  end

  puts "==> #{raw_products.length} registros obtenidos de Google Sheets."

  # Agrupar productos únicos por categoría canónica
  grouped_by_cat = Hash.new { |h, k| h[k] = {} }

  raw_products.each do |p|
    code = (p['ref_code'] || p['Ref Code']).to_s.strip.upcase
    next if code.empty?

    cat = normalize_category(p['category'] || p['Category'] || 'aretes')
    next unless CATEGORY_FILES.key?(cat)

    price_raw = p['price'] || p['Price'] || '$0'
    price_str = price_raw.to_s.strip
    price_str = "$#{price_str}" unless price_str.empty? || price_str.start_with?('$')

    desc = (p['description'] || p['Description'] || code).to_s.strip

    grouped_by_cat[cat][code] = {
      'ref_code'    => code,
      'description' => desc,
      'price'       => price_str
    }
  end

  base_dir = File.expand_path('..', __dir__)
  data_dir = File.join(base_dir, '_data')
  FileUtils.mkdir_p(data_dir)

  total_synced = 0

  CATEGORY_FILES.each do |cat, rel_path|
    items_map = grouped_by_cat[cat] || {}
    # Ordenar por código de referencia
    sorted_items = items_map.values.sort_by { |item| item['ref_code'] }

    file_path = File.join(base_dir, rel_path)

    # Generar contenido YAML limpio
    yaml_lines = []
    yaml_lines << "# #{cat.capitalize} — Catálogo oficial sincronizado con Google Sheets"
    yaml_lines << "# Total items: #{sorted_items.length}"
    yaml_lines << ""

    sorted_items.each do |item|
      yaml_lines << "- ref_code: \"#{item['ref_code']}\""
      yaml_lines << "  description: \"#{item['description'].gsub('"', '\\"')}\""
      yaml_lines << "  price: \"#{item['price']}\""
    end
    yaml_lines << ""

    File.write(file_path, yaml_lines.join("\n"))
    puts "  ✓ [#{cat.ljust(11)}] #{sorted_items.length.to_s.rjust(3)} productos sincronizados -> #{rel_path}"
    total_synced += sorted_items.length
  end

  puts "\n==> ¡Sincronización completada con éxito!"
  puts "==> Total de productos en catálogo _data/*.yml: #{total_synced}"
end

if __FILE__ == $PROGRAM_NAME
  sync_catalog!
end
