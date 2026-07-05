#!/usr/bin/env node

/**
 * Script para aplicar la migración de análisis de fotos
 * Fuerza el uso de .env.local para evitar problemas de certificado TLS
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Aplicando migración de análisis de fotos...\n');

// Verificar que DATABASE_URL esté configurado
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL no está configurado en .env.local');
  process.exit(1);
}

console.log('📋 DATABASE_URL configurado');
console.log(`   Host: ${process.env.DATABASE_URL.match(/@([^/]+)/)?.[1] || 'N/A'}\n`);

try {
  // Aplicar migración específica usando db push (más tolerante a diferencias)
  console.log('📝 Sincronizando schema con la base de datos...');
  console.log('   (Esto creará las tablas y columnas faltantes)\n');
  
  execSync('npx prisma db push --accept-data-loss --skip-generate', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
    cwd: path.join(__dirname, '..'),
  });
  
  console.log('\n✅ Migración aplicada exitosamente');
  console.log('\n📋 Próximos pasos:');
  console.log('   1. Ejecuta: node scripts/test-facial-recognition.js');
  console.log('   2. Deberías ver todas las tablas creadas');
  console.log('   3. Prueba subiendo una foto para activar el reconocimiento facial');
  
} catch (error) {
  console.error('\n❌ Error aplicando migración:', error.message);
  console.error('\n💡 Alternativa: Ejecuta manualmente:');
  console.error('   npx prisma migrate deploy');
  process.exit(1);
}
