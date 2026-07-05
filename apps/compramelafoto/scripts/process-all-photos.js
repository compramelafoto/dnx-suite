#!/usr/bin/env node

/**
 * Script para procesar TODAS las fotos pendientes de análisis
 * 
 * Uso:
 *   node scripts/process-all-photos.js
 * 
 * O para producción (Vercel):
 *   curl -X POST "https://tu-dominio.com/api/internal/analysis/run?token=TU_CRON_SECRET"
 *   (ejecutar múltiples veces hasta que processed=0)
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ Error: CRON_SECRET no está configurado en .env.local');
  process.exit(1);
}

const BATCH_SIZE = 10; // El endpoint procesa 10 fotos por vez
const MAX_ITERATIONS = 1000; // Límite de seguridad
const DELAY_MS = 2000; // Esperar 2 segundos entre llamadas

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processBatch(iteration) {
  const url = `${BASE_URL}/api/internal/analysis/run?token=${CRON_SECRET}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Error en iteración ${iteration}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Procesando todas las fotos pendientes de análisis...\n');
  console.log(`📍 URL base: ${BASE_URL}`);
  console.log(`📦 Tamaño de lote: ${BATCH_SIZE} fotos por iteración\n`);
  console.log('='.repeat(60));

  let totalProcessed = 0;
  let totalBackfilled = 0;
  let iteration = 0;
  const allErrors = [];

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    
    console.log(`\n📋 Iteración ${iteration}...`);
    
    try {
      const result = await processBatch(iteration);
      
      const processed = result.processed || 0;
      const backfilled = result.backfilled || 0;
      const errors = result.errors || [];

      totalProcessed += processed;
      totalBackfilled += backfilled;
      allErrors.push(...errors);

      console.log(`   ✅ Procesadas: ${processed}`);
      console.log(`   📝 Jobs creados: ${backfilled}`);
      
      if (errors.length > 0) {
        console.log(`   ⚠️  Errores: ${errors.length}`);
        errors.forEach(e => {
          console.log(`      - Foto ${e.photoId}: ${e.error}`);
        });
      }

      // Si no se procesó nada y no hay jobs nuevos, terminamos
      if (processed === 0 && backfilled === 0) {
        console.log('\n✅ ¡Todas las fotos han sido procesadas!');
        break;
      }

      // Esperar antes de la siguiente iteración (excepto en la última)
      if (processed > 0 || backfilled > 0) {
        await sleep(DELAY_MS);
      }
      
    } catch (error) {
      console.error(`\n❌ Error fatal en iteración ${iteration}:`, error.message);
      console.error('\n💡 Verifica que:');
      console.error('   1. El servidor esté corriendo');
      console.error('   2. CRON_SECRET esté configurado correctamente');
      console.error('   3. La URL base sea correcta');
      process.exit(1);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESUMEN FINAL:');
  console.log(`   Total de iteraciones: ${iteration}`);
  console.log(`   Fotos procesadas: ${totalProcessed}`);
  console.log(`   Jobs creados: ${totalBackfilled}`);
  console.log(`   Errores totales: ${allErrors.length}`);

  if (allErrors.length > 0) {
    console.log('\n⚠️  FOTOS CON ERRORES:');
    allErrors.forEach(e => {
      console.log(`   - Foto ${e.photoId} (Job ${e.jobId}): ${e.error}`);
    });
  }

  if (iteration >= MAX_ITERATIONS) {
    console.log('\n⚠️  Se alcanzó el límite de iteraciones. Puede haber más fotos pendientes.');
    console.log('   Ejecuta el script nuevamente para continuar procesando.');
  }

  console.log('\n✅ Proceso completado\n');
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
