#!/usr/bin/env node

/**
 * Script para configurar GOOGLE_APPLICATION_CREDENTIALS_JSON en .env.local
 * 
 * Uso:
 *   node scripts/setup-google-credentials.js /ruta/al/archivo.json
 * 
 * O si el archivo está en Downloads:
 *   node scripts/setup-google-credentials.js ~/Downloads/compramelafoto-auth-*.json
 */

const fs = require('fs');
const path = require('path');

const jsonPath = process.argv[2];

if (!jsonPath) {
  console.error('❌ Error: Debes proporcionar la ruta al archivo JSON');
  console.log('\nUso:');
  console.log('  node scripts/setup-google-credentials.js /ruta/al/archivo.json');
  console.log('\nEjemplo:');
  console.log('  node scripts/setup-google-credentials.js ~/Downloads/compramelafoto-auth-xxxxx.json');
  process.exit(1);
}

const fullPath = path.resolve(jsonPath);

if (!fs.existsSync(fullPath)) {
  console.error(`❌ Error: El archivo no existe: ${fullPath}`);
  process.exit(1);
}

try {
  // Leer el archivo JSON
  const jsonContent = fs.readFileSync(fullPath, 'utf8');
  
  // Validar que sea JSON válido
  const parsed = JSON.parse(jsonContent);
  
  // Verificar campos requeridos
  const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
  const missing = requiredFields.filter(field => !parsed[field]);
  
  if (missing.length > 0) {
    console.error(`❌ Error: El JSON no tiene los campos requeridos: ${missing.join(', ')}`);
    process.exit(1);
  }
  
  // Convertir a string en una sola línea (escapando comillas)
  const jsonString = JSON.stringify(parsed);
  
  // Leer .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  let envContent = fs.existsSync(envPath) 
    ? fs.readFileSync(envPath, 'utf8')
    : '';
  
  // Buscar si ya existe GOOGLE_APPLICATION_CREDENTIALS_JSON
  const lines = envContent.split('\n');
  let found = false;
  const newLines = lines.map(line => {
    if (line.startsWith('GOOGLE_APPLICATION_CREDENTIALS_JSON=')) {
      found = true;
      return `GOOGLE_APPLICATION_CREDENTIALS_JSON=${jsonString}`;
    }
    return line;
  });
  
  // Si no existe, agregarlo al final
  if (!found) {
    if (!envContent.endsWith('\n') && envContent.length > 0) {
      newLines.push('');
    }
    newLines.push('# ================================');
    newLines.push('# Google Vision API (OCR)');
    newLines.push('# ================================');
    newLines.push(`GOOGLE_APPLICATION_CREDENTIALS_JSON=${jsonString}`);
  }
  
  // Escribir de vuelta
  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
  
  console.log('✅ JSON de Google Cloud configurado correctamente en .env.local');
  console.log(`   Archivo: ${envPath}`);
  console.log(`   Proyecto: ${parsed.project_id}`);
  console.log(`   Email: ${parsed.client_email}`);
  
} catch (err) {
  console.error('❌ Error procesando el archivo JSON:', err.message);
  process.exit(1);
}
