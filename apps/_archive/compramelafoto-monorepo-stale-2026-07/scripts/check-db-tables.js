#!/usr/bin/env node

/**
 * Script para verificar que las tablas de reconocimiento facial existan
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Verificando conexión a la base de datos...\n');
    
    // Verificar conexión básica
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos exitosa\n');
    
    // Verificar tablas usando raw query
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('Photo', 'PhotoAnalysisJob', 'FaceDetection', 'OcrToken')
      ORDER BY table_name;
    `;
    
    console.log('📋 Tablas encontradas:');
    if (tables.length === 0) {
      console.log('  ❌ No se encontraron las tablas necesarias');
    } else {
      tables.forEach(t => console.log(`  ✅ ${t.table_name}`));
    }
    
    // Verificar si hay fotos
    try {
      const photoCount = await prisma.photo.count();
      console.log(`\n📸 Total de fotos en la BD: ${photoCount}`);
    } catch (e) {
      console.log(`\n❌ Error contando fotos: ${e.message}`);
    }
    
    // Verificar si hay jobs
    try {
      const jobCount = await prisma.photoAnalysisJob.count();
      console.log(`📋 Total de jobs de análisis: ${jobCount}`);
    } catch (e) {
      console.log(`❌ Error contando jobs: ${e.message}`);
    }
    
    // Verificar si hay detecciones de rostros
    try {
      const faceCount = await prisma.faceDetection.count();
      console.log(`👤 Total de rostros detectados: ${faceCount}`);
    } catch (e) {
      console.log(`❌ Error contando rostros: ${e.message}`);
    }
    
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('certificate')) {
      console.error('\n💡 Problema con certificado TLS. Verifica DATABASE_URL en .env.local');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
