import {
  RekognitionClient,
  DescribeCollectionCommand,
  CreateCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
  DetectFacesCommand,
} from "@aws-sdk/client-rekognition";

type FaceIndexResult = {
  rekognitionFaceId: string;
  confidence?: number | null;
  bbox: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
  };
};

type FaceSearchMatch = {
  rekognitionFaceId: string;
  similarity?: number | null;
};

let client: RekognitionClient | null = null;
let collectionReady = false;

function getRekognitionClient(): RekognitionClient {
  if (client) return client;
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error("AWS_REGION no está configurado");
  }
  client = new RekognitionClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
  return client;
}

function getCollectionId(): string {
  const id = process.env.REKOGNITION_COLLECTION_ID;
  if (!id) {
    throw new Error("REKOGNITION_COLLECTION_ID no está configurado");
  }
  return id;
}

export async function ensureCollectionExists(): Promise<void> {
  if (collectionReady) return;
  const rekognition = getRekognitionClient();
  const collectionId = getCollectionId();

  try {
    await rekognition.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
    collectionReady = true;
  } catch (err: any) {
    const name = String(err?.name || "");
    if (name.includes("ResourceNotFoundException")) {
      await rekognition.send(new CreateCollectionCommand({ CollectionId: collectionId }));
      collectionReady = true;
      return;
    }
    throw err;
  }
}

export async function indexFaces(params: {
  imageBytes: Uint8Array;
  externalImageId?: string;
}): Promise<FaceIndexResult[]> {
  const rekognition = getRekognitionClient();
  const collectionId = getCollectionId();
  await ensureCollectionExists();

  const response = await rekognition.send(
    new IndexFacesCommand({
      CollectionId: collectionId,
      ExternalImageId: params.externalImageId,
      Image: { Bytes: params.imageBytes },
      DetectionAttributes: [],
      QualityFilter: "AUTO",
    })
  );

  const records = response.FaceRecords || [];
  return records.flatMap((record) => {
    const face = record.Face;
    if (!face?.FaceId) return [];
    return [
      {
        rekognitionFaceId: face.FaceId,
        confidence: face.Confidence ?? null,
        bbox: {
          left: face.BoundingBox?.Left,
          top: face.BoundingBox?.Top,
          width: face.BoundingBox?.Width,
          height: face.BoundingBox?.Height,
        },
      },
    ];
  });
}

/**
 * Cuenta cuántas caras hay en la imagen (sin usar colección).
 * Útil para validar selfie: 0 = NO_FACE, >1 = MULTIPLE_FACES, 1 = OK.
 */
export async function detectFaceCount(imageBytes: Uint8Array): Promise<number> {
  const rekognition = getRekognitionClient();
  const response = await rekognition.send(
    new DetectFacesCommand({
      Image: { Bytes: imageBytes },
      Attributes: [],
    })
  );
  return response.FaceDetails?.length ?? 0;
}

export async function searchFacesByImage(imageBytes: Uint8Array): Promise<FaceSearchMatch[]> {
  const rekognition = getRekognitionClient();
  const collectionId = getCollectionId();
  await ensureCollectionExists();

  const response = await rekognition.send(
    new SearchFacesByImageCommand({
      CollectionId: collectionId,
      Image: { Bytes: imageBytes },
      FaceMatchThreshold: 70,
      MaxFaces: 20,
    })
  );

  const matches = response.FaceMatches || [];
  return matches.flatMap((match) => {
    const face = match.Face;
    if (!face?.FaceId) return [];
    return [
      {
        rekognitionFaceId: face.FaceId,
        similarity: match.Similarity ?? null,
      },
    ];
  });
}

/**
 * Elimina una cara de la colección de Rekognition
 */
export async function deleteFace(faceId: string): Promise<boolean> {
  const rekognition = getRekognitionClient();
  const collectionId = getCollectionId();
  await ensureCollectionExists();

  try {
    const response = await rekognition.send(
      new DeleteFacesCommand({
        CollectionId: collectionId,
        FaceIds: [faceId],
      })
    );

    const deletedFaces = response.DeletedFaces || [];
    return deletedFaces.includes(faceId);
  } catch (err: any) {
    console.error("Error eliminando cara de Rekognition:", err);
    throw err;
  }
}
