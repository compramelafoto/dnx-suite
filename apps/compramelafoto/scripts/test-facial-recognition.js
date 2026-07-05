#!/usr/bin/env node

/**
 * Script de diagnóstico rápido para reconocimiento facial
 * 
 * Uso:
 *   node scripts/test-facial-recognition.js
 * 
 * Requiere que las variables de entorno estén cargadas (.env)
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function check(condition, message) {
  if (condition) {
    console.log(`${colors.green}✅${colors.reset} ${message}`);
    return true;
  } else {
    console.log(`${colors.red}❌${colors.reset} ${message}`);
    return false;
  }
}

function info(message) {
  console.log(`${colors.blue}ℹ️${colors.reset} ${message}`);
}

function warn(message) {
  console.log(`${colors.yellow}⚠️${colors.reset} ${message}`);
}

async function main() {
  console.log('\n🔍 DIAGNÓSTICO DE RECONOCIMIENTO FACIAL\n');
  console.log('='.repeat(50));

  let allOk = true;

  // 1. Verificar variables de entorno
  console.log('\n📋 PASO 1: Variables de entorno\n');
  
  const envVars = {
    'CRON_SECRET': process.env.CRON_SECRET,
    'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID,
    'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY ? '***configurado***' : null,
    'AWS_REGION': process.env.AWS_REGION,
    'REKOGNITION_COLLECTION_ID': process.env.REKOGNITION_COLLECTION_ID,
    'GOOGLE_APPLICATION_CREDENTIALS_JSON': process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? '***configurado***' : null,
    'R2_ENDPOINT': process.env.R2_ENDPOINT,
    'R2_BUCKET_NAME': process.env.R2_BUCKET_NAME,
    'R2_ACCOUNT_ID': process.env.R2_ACCOUNT_ID,
    'R2_ACCESS_KEY_ID': process.env.R2_ACCESS_KEY_ID,
    'R2_SECRET_ACCESS_KEY': process.env.R2_SECRET_ACCESS_KEY ? '***configurado***' : null,
  };

  for (const [key, value] of Object.entries(envVars)) {
    const ok = check(!!value, `${key}: ${value || 'NO CONFIGURADO'}`);
    if (!ok) allOk = false;
  }

  // 2. Verificar formato de JSON de Google
  console.log('\n📋 PASO 2: Validar formato JSON de Google Vision\n');
  
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      const json = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      const ok = check(json.type === 'service_account', 'Google JSON es cuenta de servicio válida');
      if (!ok) allOk = false;
    } catch (e) {
      const ok = check(false, `Google JSON inválido: ${e.message}`);
      if (!ok) allOk = false;
    }
  }

  // 3. Verificar AWS Rekognition
  console.log('\n📋 PASO 3: Conectar a AWS Rekognition\n');
  
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
    try {
      const { RekognitionClient, ListCollectionsCommand } = require('@aws-sdk/client-rekognition');
      
      const client = new RekognitionClient({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      const response = await client.send(new ListCollectionsCommand({}));
      check(true, `AWS Rekognition conectado. Colecciones: ${response.CollectionIds?.length || 0}`);
      
      if (process.env.REKOGNITION_COLLECTION_ID) {
        const exists = response.CollectionIds?.includes(process.env.REKOGNITION_COLLECTION_ID);
        if (exists) {
          check(true, `Colección "${process.env.REKOGNITION_COLLECTION_ID}" existe`);
        } else {
          warn(`Colección "${process.env.REKOGNITION_COLLECTION_ID}" no existe (se creará automáticamente)`);
        }
      }
    } catch (err) {
      const ok = check(false, `Error conectando a AWS: ${err.message}`);
      if (!ok) allOk = false;
    }
  } else {
    warn('No se puede probar AWS Rekognition (faltan credenciales)');
  }

  // 4. Verificar base de datos
  console.log('\n📋 PASO 4: Verificar base de datos\n');
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Verificar tablas
    const tables = ['Photo', 'PhotoAnalysisJob', 'FaceDetection', 'OcrToken'];
    for (const table of tables) {
      try {
        await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
        check(true, `Tabla "${table}" existe`);
      } catch (e) {
        const ok = check(false, `Tabla "${table}" no existe o no accesible`);
        if (!ok) allOk = false;
      }
    }

    // Estadísticas
    const photoStats = await prisma.photo.groupBy({
      by: ['analysisStatus'],
      _count: { _all: true },
      where: { isRemoved: false },
    });

    info('\nEstadísticas de fotos:');
    photoStats.forEach(stat => {
      console.log(`  - ${stat.analysisStatus}: ${stat._count._all}`);
    });

    const jobStats = await prisma.photoAnalysisJob.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    info('\nEstadísticas de jobs:');
    jobStats.forEach(stat => {
      console.log(`  - ${stat.status}: ${stat._count._all}`);
    });

    const faceCount = await prisma.faceDetection.count();
    info(`\nRostros detectados: ${faceCount}`);

    const missingJobs = await prisma.photo.count({
      where: { analysisJob: null, isRemoved: false },
    });
    
    if (missingJobs > 0) {
      warn(`${missingJobs} fotos sin job creado (se crearán automáticamente)`);
    }

    await prisma.$disconnect();
  } catch (err) {
    const ok = check(false, `Error conectando a BD: ${err.message}`);
    if (!ok) allOk = false;
  }

  // 5. Verificar endpoint de estado
  console.log('\n📋 PASO 5: Verificar endpoint de estado\n');
  
  if (process.env.CRON_SECRET) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/internal/analysis/status`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        check(true, 'Endpoint de estado responde correctamente');
        info(`  - Fotos: ${JSON.stringify(data.photos)}`);
        info(`  - Jobs: ${JSON.stringify(data.jobs)}`);
        info(`  - Fotos sin job: ${data.missingJobs}`);
      } else {
        const ok = check(false, `Endpoint responde con error ${response.status}`);
        if (!ok) allOk = false;
      }
    } catch (err) {
      warn(`No se pudo conectar al endpoint (¿está el servidor corriendo?): ${err.message}`);
    }
  } else {
    warn('No se puede probar endpoint (falta CRON_SECRET)');
  }

  // Resumen
  console.log('\n' + '='.repeat(50));
  if (allOk) {
    console.log(`\n${colors.green}✅ Todos los checks básicos pasaron${colors.reset}`);
    console.log('\nPróximos pasos:');
    console.log('  1. Ejecuta el análisis manualmente:');
    console.log(`     curl -X POST -H "Authorization: Bearer $CRON_SECRET" ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/internal/analysis/run`);
    console.log('  2. Revisa los logs del servidor');
    console.log('  3. Verifica que se creen registros en FaceDetection');
  } else {
    console.log(`\n${colors.red}❌ Hay problemas que necesitan ser resueltos${colors.reset}`);
    console.log('\nRevisa los errores arriba y consulta DIAGNOSTICO_RECONOCIMIENTO_FACIAL.md');
  }
  console.log('');
}

main().catch(err => {
  console.error(`${colors.red}Error fatal:${colors.reset}`, err);
  process.exit(1);
});
