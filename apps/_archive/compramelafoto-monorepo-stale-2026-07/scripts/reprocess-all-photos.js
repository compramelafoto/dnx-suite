#!/usr/bin/env node

/**
 * Script para REPROCESAR TODAS las fotos existentes (incluso las ya procesadas)
 * 
 * Este script:
 * 1. Crea jobs de análisis para todas las fotos (incluso las ya procesadas)
 * 2. Elimina los análisis anteriores (OCR y reconocimiento facial)
 * 3. Ejecuta el procesamiento en lotes
 * 
 * Uso:
 *   node scripts/reprocess-all-photos.js
 * 
 * O para producción (Vercel):
 *   curl -X POST "https://tu-dominio.com/api/internal/analysis/backfill?reprocessAll=1&limit=200&token=TU_CRON_SECRET"
 *   curl -X POST "https://tu-dominio.com/api/internal/analysis/run?token=TU_CRON_SECRET"
 *   (repetir el segundo comando hasta que processed=0)
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://compramelafoto.com';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ Error: CRON_SECRET no está configurado en .env.local');
  process.exit(1);
}

const BATCH_SIZE = 200; // Procesar 200 fotos por vez en backfill
const ANALYSIS_BATCH_SIZE = 10; // El endpoint de análisis procesa 10 por vez
const MAX_ITERATIONS = 10000; // Límite de seguridad
const DELAY_MS = 3000; // Esperar 3 segundos entre llamadas

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function backfillBatch(iteration) {
  const url = `${BASE_URL}/api/internal/analysis/backfill?reprocessAll=1&limit=${BATCH_SIZE}&token=${CRON_SECRET}`;
  
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
    console.error(`❌ Error en backfill iteración ${iteration}:`, error.message);
    throw error;
  }
}

async function processAnalysisBatch(iteration) {
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
    console.error(`❌ Error en análisis iteración ${iteration}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 REPROCESANDO TODAS las fotos existentes...\n');
  console.log(`📍 URL base: ${BASE_URL}`);
  console.log(`📦 Tamaño de lote backfill: ${BATCH_SIZE} fotos`);
  console.log(`📦 Tamaño de lote análisis: ${ANALYSIS_BATCH_SIZE} fotos\n`);
  console.log('='.repeat(60));

  // FASE 1: Crear jobs para todas las fotos (backfill)
  console.log('\n📋 FASE 1: Creando jobs de análisis para todas las fotos...\n');
  
  let totalReprocessed = 0;
  let backfillIteration = 0;

  while (backfillIteration < MAX_ITERATIONS) {
    backfillIteration++;
    
    console.log(`📋 Backfill iteración ${backfillIteration}...`);
    
    try {
      const result = await backfillBatch(backfillIteration);
      
      const reprocessed = result.reprocessed || 0;
      totalReprocessed += reprocessed;

      console.log(`   ✅ Fotos preparadas para reprocesamiento: ${reprocessed}`);
      
      // Si no se procesó nada, terminamos la fase 1
      if (reprocessed === 0) {
        console.log('\n✅ Fase 1 completada: Todas las fotos tienen jobs creados');
        break;
      }

      await sleep(DELAY_MS);
      
    } catch (error) {
      console.error(`\n❌ Error fatal en backfill iteración ${backfillIteration}:`, error.message);
      console.error('\n💡 Verifica que:');
      console.error('   1. El servidor esté corriendo');
      console.error('   2. CRON_SECRET esté configurado correctamente');
      console.error('   3. La URL base sea correcta');
      process.exit(1);
    }
  }

  console.log(`\n📊 Total de fotos preparadas: ${totalReprocessed}`);

  // FASE 2: Procesar los jobs
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 FASE 2: Procesando análisis (OCR y reconocimiento facial)...\n');

  let totalProcessed = 0;
  let totalBackfilled = 0;
  let analysisIteration = 0;
  const allErrors = [];

  while (analysisIteration < MAX_ITERATIONS) {
    analysisIteration++;
    
    console.log(`📋 Análisis iteración ${analysisIteration}...`);
    
    try {
      const result = await processAnalysisBatch(analysisIteration);
      
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

      // Esperar antes de la siguiente iteración
      if (processed > 0 || backfilled > 0) {
        await sleep(DELAY_MS);
      }
      
    } catch (error) {
      console.error(`\n❌ Error fatal en análisis iteración ${analysisIteration}:`, error.message);
      console.error('\n💡 Verifica que:');
      console.error('   1. El servidor esté corriendo');
      console.error('   2. CRON_SECRET esté configurado correctamente');
      console.error('   3. La URL base sea correcta');
      process.exit(1);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESUMEN FINAL:');
  console.log(`   Fotos preparadas para reprocesamiento: ${totalReprocessed}`);
  console.log(`   Total de iteraciones de análisis: ${analysisIteration}`);
  console.log(`   Fotos procesadas: ${totalProcessed}`);
  console.log(`   Jobs creados: ${totalBackfilled}`);
  console.log(`   Errores totales: ${allErrors.length}`);

  if (allErrors.length > 0) {
    console.log('\n⚠️  FOTOS CON ERRORES:');
    allErrors.forEach(e => {
      console.log(`   - Foto ${e.photoId} (Job ${e.jobId}): ${e.error}`);
    });
  }

  if (analysisIteration >= MAX_ITERATIONS) {
    console.log('\n⚠️  Se alcanzó el límite de iteraciones. Puede haber más fotos pendientes.');
    console.log('   Ejecuta el script nuevamente para continuar procesando.');
  }

  console.log('\n✅ Proceso completado\n');
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
