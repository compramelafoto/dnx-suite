/**
 * Script de prueba para verificar la configuración de Cloudflare R2
 * 
 * Ejecutar con: npx tsx scripts/test-r2.ts
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

// Colores para la consola
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message: string) {
  log(`❌ ${message}`, "red");
}

function success(message: string) {
  log(`✅ ${message}`, "green");
}

function info(message: string) {
  log(`ℹ️  ${message}`, "blue");
}

function warning(message: string) {
  log(`⚠️  ${message}`, "yellow");
}

async function testR2Connection() {
  log("\n🔍 Iniciando prueba de conexión con Cloudflare R2...\n", "cyan");

  // 1. Verificar variables de entorno
  log("1️⃣ Verificando variables de entorno...", "cyan");
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  // Acepta tanto R2_BUCKET_NAME como R2_BUCKET para compatibilidad
  const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  const requiredVars = {
    R2_ACCOUNT_ID: accountId,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_ENDPOINT: endpoint,
    "R2_BUCKET_NAME o R2_BUCKET": bucketName,
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    error(`Faltan variables de entorno requeridas: ${missingVars.join(", ")}`);
    info("\nConfigura estas variables en tu archivo .env.local:");
    missingVars.forEach((varName) => {
      if (varName.includes(" o ")) {
        info(`  ${varName}=tu_valor_aqui`);
      } else {
        info(`  ${varName}=tu_valor_aqui`);
      }
    });
    process.exit(1);
  }

  success("Todas las variables de entorno están configuradas");

  if (publicUrl) {
    info(`R2_PUBLIC_URL: ${publicUrl}`);
  } else if (publicBaseUrl) {
    info(`R2_PUBLIC_BASE_URL: ${publicBaseUrl}`);
  } else {
    warning("No hay URL pública configurada. Las URLs se construirán desde R2_ENDPOINT");
  }

  // 2. Crear cliente S3
  log("\n2️⃣ Creando cliente S3...", "cyan");
  let s3Client: S3Client;
  try {
    s3Client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    });
    success("Cliente S3 creado correctamente");
  } catch (err: any) {
    error(`Error creando cliente S3: ${err.message}`);
    process.exit(1);
  }

  // 3. Generar archivo de prueba
  log("\n3️⃣ Generando archivo de prueba...", "cyan");
  const testContent = `Archivo de prueba generado el ${new Date().toISOString()}\nBucket: ${bucketName}\nEndpoint: ${endpoint}`;
  const testBuffer = Buffer.from(testContent, "utf-8");
  const testKey = `test/${crypto.randomUUID()}-test.txt`;
  success(`Archivo de prueba generado: ${testKey}`);

  // 4. Subir archivo a R2
  log("\n4️⃣ Subiendo archivo a R2...", "cyan");
  try {
    const putCommand = new PutObjectCommand({
      Bucket: bucketName!,
      Key: testKey,
      Body: testBuffer,
      ContentType: "text/plain",
      Metadata: {
        test: "true",
        timestamp: new Date().toISOString(),
      },
    });

    await s3Client.send(putCommand);
    success(`Archivo subido correctamente: ${testKey}`);
  } catch (err: any) {
    error(`Error subiendo archivo: ${err.message}`);
    if (err.name === "AccessDenied") {
      warning("Verifica que las credenciales tengan permisos de escritura en el bucket");
    }
    process.exit(1);
  }

  // 5. Verificar que el archivo existe
  log("\n5️⃣ Verificando que el archivo existe...", "cyan");
  try {
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName!,
      Key: testKey,
    });

    const headResponse = await s3Client.send(headCommand);
    success(`Archivo existe en R2`);
    info(`Tamaño: ${headResponse.ContentLength} bytes`);
    info(`Content-Type: ${headResponse.ContentType}`);
    if (headResponse.Metadata) {
      info(`Metadata: ${JSON.stringify(headResponse.Metadata)}`);
    }
  } catch (err: any) {
    error(`Error verificando archivo: ${err.message}`);
    process.exit(1);
  }

  // 6. Leer el archivo desde R2
  log("\n6️⃣ Leyendo archivo desde R2...", "cyan");
  try {
    const getCommand = new GetObjectCommand({
      Bucket: bucketName!,
      Key: testKey,
    });

    const getResponse = await s3Client.send(getCommand);
    if (!getResponse.Body) {
      throw new Error("El archivo está vacío");
    }

    const chunks: Uint8Array[] = [];
    const stream = getResponse.Body as any;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const downloadedBuffer = Buffer.concat(chunks);
    const downloadedContent = downloadedBuffer.toString("utf-8");

    if (downloadedContent === testContent) {
      success("Contenido del archivo verificado correctamente");
    } else {
      warning("El contenido del archivo no coincide (pero se leyó correctamente)");
    }
  } catch (err: any) {
    error(`Error leyendo archivo: ${err.message}`);
    process.exit(1);
  }

  // 7. Generar URL firmada (signed URL)
  log("\n7️⃣ Generando URL firmada...", "cyan");
  try {
    const getCommand = new GetObjectCommand({
      Bucket: bucketName!,
      Key: testKey,
    });

    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
    success("URL firmada generada correctamente");
    info(`URL (válida por 1 hora): ${signedUrl}`);
  } catch (err: any) {
    error(`Error generando URL firmada: ${err.message}`);
    process.exit(1);
  }

  // 8. Construir URL pública (si está configurada)
  log("\n8️⃣ Construyendo URL pública...", "cyan");
  let publicUrlFinal: string | null = null;
  if (publicUrl) {
    publicUrlFinal = `${publicUrl.replace(/\/$/, "")}/${testKey}`;
  } else if (publicBaseUrl) {
    publicUrlFinal = `${publicBaseUrl.replace(/\/$/, "")}/${testKey}`;
  } else if (endpoint && bucketName) {
    publicUrlFinal = `${endpoint}/${bucketName}/${testKey}`;
  }

  if (publicUrlFinal) {
    success(`URL pública: ${publicUrlFinal}`);
    info("Nota: Esta URL solo funcionará si el bucket tiene acceso público habilitado");
  } else {
    warning("No se pudo construir URL pública (configura R2_PUBLIC_URL o R2_PUBLIC_BASE_URL)");
  }

  // 9. Resumen final
  log("\n" + "=".repeat(60), "cyan");
  success("✅ Todas las pruebas pasaron correctamente!");
  log("=".repeat(60) + "\n", "cyan");

  info("Resumen:");
  info(`  • Bucket: ${bucketName}`);
  info(`  • Archivo de prueba: ${testKey}`);
  info(`  • Tamaño: ${testBuffer.length} bytes`);
  if (publicUrlFinal) {
    info(`  • URL pública: ${publicUrlFinal}`);
  }

  log("\n💡 Próximos pasos:", "yellow");
  log("  1. Verifica que puedes acceder a la URL pública (si está configurada)");
  log("  2. Prueba subir una imagen real usando POST /api/uploads");
  log("  3. Verifica que las imágenes se procesen y suban correctamente\n");

  // Limpiar archivo de prueba (opcional)
  log("¿Deseas eliminar el archivo de prueba? (s/n)", "yellow");
  // Nota: En un script interactivo podrías usar readline, pero por simplicidad lo dejamos
  info("Para eliminarlo manualmente, usa el dashboard de Cloudflare R2 o la CLI");
}

// Ejecutar la prueba
testR2Connection().catch((err) => {
  error(`Error fatal: ${err.message}`);
  console.error(err);
  process.exit(1);
});
