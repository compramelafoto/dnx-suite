#!/usr/bin/env node

/**
 * Script para obtener el JSON de Google Cloud formateado para copiar en Vercel
 * 
 * Uso:
 *   node scripts/get-google-json-for-vercel.js /ruta/al/archivo-descargado.json
 * 
 * Ejemplo:
 *   node scripts/get-google-json-for-vercel.js ~/Downloads/compramelafoto-auth-xxxxx.json
 */

const fs = require('fs');
const path = require('path');

const jsonPath = process.argv[2];

if (!jsonPath) {
  console.error('❌ Error: Debes proporcionar la ruta al archivo JSON descargado');
  console.log('\n📋 Pasos:');
  console.log('\n1️⃣  Descargar el JSON desde Google Cloud Console:');
  console.log('   - Ve a: https://console.cloud.google.com/');
  console.log('   - IAM & Admin > Service Accounts');
  console.log('   - Selecciona tu Service Account');
  console.log('   - Pestaña "Keys" > "Add Key" > "Create new key" > JSON');
  console.log('   - Descarga el archivo');
  console.log('\n2️⃣  Ejecuta este script:');
  console.log('   node scripts/get-google-json-for-vercel.js ~/Downloads/tu-archivo.json');
  console.log('\n3️⃣  Copia el JSON que se muestra y pégalo en Vercel:');
  console.log('   - Ve a: https://vercel.com/dashboard');
  console.log('   - Tu proyecto > Settings > Environment Variables');
  console.log('   - Busca o crea: GOOGLE_APPLICATION_CREDENTIALS_JSON');
  console.log('   - Pega el JSON completo');
  process.exit(1);
}

const fullPath = path.resolve(jsonPath);

if (!fs.existsSync(fullPath)) {
  console.error(`❌ Error: El archivo no existe: ${fullPath}`);
  process.exit(1);
}

try {
  console.log(`📖 Leyendo archivo: ${fullPath}\n`);
  
  // Leer el archivo JSON
  const jsonContent = fs.readFileSync(fullPath, 'utf8');
  
  // Validar que sea JSON válido
  const parsed = JSON.parse(jsonContent);
  
  console.log('✅ JSON válido');
  console.log(`   Tipo: ${parsed.type}`);
  console.log(`   Proyecto: ${parsed.project_id}`);
  console.log(`   Email: ${parsed.client_email}`);
  console.log(`   Key ID: ${parsed.private_key_id}`);
  
  // Verificar campos requeridos
  const requiredFields = ['type', 'project_id', 'private_key', 'client_email', 'private_key_id'];
  const missing = requiredFields.filter(field => !parsed[field]);
  
  if (missing.length > 0) {
    console.error(`\n❌ Error: El JSON no tiene los campos requeridos: ${missing.join(', ')}`);
    process.exit(1);
  }
  
  // Verificar que el private_key esté completo
  if (parsed.private_key && parsed.private_key.includes('...')) {
    console.error('\n❌ Error: El private_key está incompleto (contiene "...")');
    console.error('   Asegúrate de descargar el JSON completo desde Google Cloud Console');
    process.exit(1);
  }
  
  // Convertir a string en una sola línea (escapando comillas correctamente)
  // Esto es lo que necesita Vercel
  const jsonString = JSON.stringify(parsed);
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 COPIA ESTE JSON Y PÉGALO EN VERCEL:');
  console.log('='.repeat(80));
  console.log('\n' + jsonString);
  console.log('\n' + '='.repeat(80));
  
  console.log('\n📋 Próximos pasos:');
  console.log('   1. Copia el JSON de arriba (todo desde { hasta })');
  console.log('   2. Ve a Vercel Dashboard: https://vercel.com/dashboard');
  console.log('   3. Selecciona tu proyecto > Settings > Environment Variables');
  console.log('   4. Busca o crea: GOOGLE_APPLICATION_CREDENTIALS_JSON');
  console.log('   5. Pega el JSON completo en el campo "Value"');
  console.log('   6. Guarda y redeploya tu aplicación');
  console.log('\n✅ El JSON ya está formateado correctamente para Vercel');
  
} catch (err) {
  console.error('\n❌ Error procesando el archivo JSON:', err.message);
  
  if (err.message.includes('JSON')) {
    console.error('\n💡 El archivo podría no ser un JSON válido.');
    console.error('   Asegúrate de descargar el archivo completo desde Google Cloud Console.');
  }
  
  process.exit(1);
}
