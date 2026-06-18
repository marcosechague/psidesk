import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { StorageDriver } from "./types";

// Cloudflare R2 es compatible con la API de S3.
function client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error("Falta R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

function bucket() {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error("Falta R2_BUCKET");
  return b;
}

export function r2Driver(): StorageDriver {
  return {
    name: "r2",
    async put(key, body, contentType) {
      await client().send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },
    async getBytes(key) {
      const res = await client().send(
        new GetObjectCommand({ Bucket: bucket(), Key: key }),
      );
      const arr = await res.Body!.transformToByteArray();
      return Buffer.from(arr);
    },
    async delete(key) {
      await client().send(
        new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
      );
    },
  };
}
