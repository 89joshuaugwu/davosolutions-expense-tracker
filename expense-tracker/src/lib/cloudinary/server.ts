import "server-only";
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
