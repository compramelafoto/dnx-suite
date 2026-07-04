#!/usr/bin/env node

/**
 * Script para formatear el JSON de Google Cloud descargado manualmente
 * y actualizar .env.local
 * 
 * Uso:
 *   node scripts/format-google-json.js /ruta/al/archivo-descargado.json
 * 
 * Ejemplo:
 *   node scripts/format-google-json.js ~/Downloads/compramelafoto-auth-xxxxx.json
 */

const fs = require('fs');
const path = require('path');

const jsonPath = process.argv[2];

if (!jsonPath) {
  console.error('❌ Error: Debes proporcionar la ruta al archivo JSON descargado');
  console.log('\n📋 Opciones:');
  console.log('\n1️⃣  Si descargaste el JSON manualmente desde Google Cloud:');
  console.log('   node scripts/format-google-json.js ~/Downloads/tu-archivo.json');
  console.log('\n2️⃣  Si tienes gcloud CLI instalado:');
  console.log('   bash scripts/get-google-credentials.sh');
  console.log('\n3️⃣  Desde Google Cloud Console:');
  console.log('   - Ve a: IAM & Admin > Service Accounts');
  console.log('   - Selecciona: compramelafoto-vision');
  console.log('   - Pestaña "Claves" > "Agregar clave" > "Crear nueva clave" > JSON');
  console.log('   - Descarga el archivo y ejecuta este script con la ruta');
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
  
  // Verificar que el private_key esté completo (no tenga "...")
  if (parsed.private_key && parsed.private_key.includes('...')) {
    console.error('\n❌ Error: El private_key está incompleto (contiene "...")');
    console.error('   Asegúrate de descargar el JSON completo desde Google Cloud Console');
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
  let foundIndex = -1;
  
  const newLines = lines.map((line, index) => {
    if (line.startsWith('GOOGLE_APPLICATION_CREDENTIALS_JSON=')) {
      found = true;
      foundIndex = index;
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
  
  // Crear backup
  if (fs.existsSync(envPath)) {
    const backupPath = `${envPath}.backup.${Date.now()}`;
    fs.copyFileSync(envPath, backupPath);
    console.log(`\n💾 Backup creado: ${backupPath}`);
  }
  
  // Escribir de vuelta
  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
  
  console.log('\n✅ JSON de Google Cloud configurado correctamente en .env.local');
  console.log(`   Archivo: ${envPath}`);
  
  if (found) {
    console.log(`   ✅ Variable actualizada en línea ${foundIndex + 1}`);
  } else {
    console.log(`   ✅ Variable agregada al final del archivo`);
  }
  
  console.log('\n📋 Próximos pasos:');
  console.log('   1. Verifica que .env.local tenga el JSON completo');
  console.log('   2. Ejecuta: node scripts/test-facial-recognition.js');
  console.log('   3. Si todo está bien, reinicia tu servidor de desarrollo');
  
} catch (err) {
  console.error('\n❌ Error procesando el archivo JSON:', err.message);
  
  if (err.message.includes('JSON')) {
    console.error('\n💡 El archivo podría no ser un JSON válido.');
    console.error('   Asegúrate de descargar el archivo completo desde Google Cloud Console.');
  }
  
  process.exit(1);
}
