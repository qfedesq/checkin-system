import "server-only";
import { put } from "@vercel/blob";

export async function uploadBlob(kind: string, file: Blob | Buffer, filename: string, contentType?: string) {
  const key = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;
  const res = await put(key, file, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return res.url;
}
