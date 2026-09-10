import "server-only";
import { createHash } from "node:crypto";
import { cloudinaryConfigSchema, type CloudinaryConfig } from "./config";

/** Lazy load: missing attachment config must not break login, previews or builds. */
export function getCloudinaryConfig(): CloudinaryConfig {
  const parsed = cloudinaryConfigSchema.safeParse(process.env);
  if (!parsed.success) throw new Error("Cloudinary attachment storage is not configured correctly.");
  return parsed.data;
}

export function getCloudinaryConfigurationStatus(): { configured: boolean; missing: string[] } {
  const parsed = cloudinaryConfigSchema.safeParse(process.env);
  return parsed.success ? { configured: true, missing: [] } : {
    configured: false,
    missing: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))],
  };
}

export function createUploadIntent() {
  const config = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  const params: Record<string, string> = {
    timestamp,
    upload_preset: config.CLOUDINARY_UPLOAD_PRESET,
    type: "authenticated",
  };

  const keys = Object.keys(params).sort();
  const stringToSign = keys.map((k) => `${k}=${params[k]}`).join("&") + config.CLOUDINARY_API_SECRET;
  const signature = createHash("sha1").update(stringToSign).digest("hex");

  return {
    cloudName: config.CLOUDINARY_CLOUD_NAME,
    apiKey: config.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    uploadPreset: config.CLOUDINARY_UPLOAD_PRESET,
    type: "authenticated",
  };
}

export function verifyUploadResult(publicId: string, version: number | string, signature: string): boolean {
  const config = getCloudinaryConfig();
  const stringToSign = `public_id=${publicId}&version=${version}${config.CLOUDINARY_API_SECRET}`;
  const expectedSignature = createHash("sha1").update(stringToSign).digest("hex");
  return signature === expectedSignature;
}

export async function getProxiedAttachmentStream(publicId: string, resourceType: "image" | "raw", version: number | string, format?: string) {
  const config = getCloudinaryConfig();
  
  // Use Cloudinary Admin API to get the secure url which we can then fetch and stream
  const endpoint = `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/resources/${resourceType}/upload/${encodeURIComponent(publicId)}`;
  const auth = Buffer.from(`${config.CLOUDINARY_API_KEY}:${config.CLOUDINARY_API_SECRET}`).toString("base64");
  
  const adminRes = await fetch(endpoint, {
    headers: { Authorization: `Basic ${auth}` },
    next: { revalidate: 0 },
  });

  if (!adminRes.ok) {
    if (adminRes.status === 404) return null;
    throw new Error(`Cloudinary Admin API error: ${adminRes.status}`);
  }

  // Cloudinary securely serves this URL on demand via proxyURL?
  // Let's actually just fetch it with basic auth from the Admin API? 
  // No, the Cloudinary REST Admin API doesn't return file content. 
  // Wait, let's use the standard signed URL generation since we need the stream.
  
  // Actually, Cloudinary's signed delivery URL requires `s--<hash>--`
  const path = `${resourceType}/authenticated/${publicId}${format ? `.${format}` : ""}`;
  const hashString = path + config.CLOUDINARY_API_SECRET;
  const deliverySignature = createHash("sha1").update(hashString).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").substring(0, 8);
  
  const signedUrl = `https://res.cloudinary.com/${config.CLOUDINARY_CLOUD_NAME}/${resourceType}/authenticated/s--${deliverySignature}--/v${version}/${publicId}${format ? `.${format}` : ""}`;
  
  const fileRes = await fetch(signedUrl, { next: { revalidate: 0 } });
  if (!fileRes.ok) {
    if (fileRes.status === 404) return null;
    throw new Error(`Cloudinary Download error: ${fileRes.status}`);
  }

  return {
    stream: fileRes.body,
    contentType: fileRes.headers.get("Content-Type") || "application/octet-stream",
    contentLength: fileRes.headers.get("Content-Length"),
  };
}
