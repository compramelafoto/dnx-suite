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

const envName = String(process.env.VERCEL_ENV || process.env.NODE_ENV || "").toLowerCase();
const dbUrl = String(process.env.DATABASE_URL || "");
const looksSharedOrProdDb = /(staging|prod|production)/i.test(dbUrl);

if (envName === "production" || envName === "preview" || looksSharedOrProdDb) {
  console.error("❌ Script bloqueado para staging/prod o base compartida.");
  console.error("   Política DNX Suite: en staging/prod usar solo:");
  console.error("   pnpm --filter @repo/db run db:migrate:deploy");
  process.exit(1);
}

// Verificar que DATABASE_URL esté configurado
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL no está configurado en .env.local');
  process.exit(1);
}

console.log('📋 DATABASE_URL configurado');
console.log(`   Host: ${process.env.DATABASE_URL.match(/@([^/]+)/)?.[1] || 'N/A'}\n`);

try {
  // SOLO LOCAL/DEV CONTROLADO: usa db push para recuperar drift en entornos de desarrollo.
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
  console.error('\n💡 Alternativa segura para staging/prod:');
  console.error('   pnpm --filter @repo/db run db:migrate:deploy');
  process.exit(1);
}
