import { z } from "zod";

/** Shared by setup diagnostics; parsed secret values must stay on the server. */
export const cloudinaryConfigSchema = z.object({
  ATTACHMENT_PROVIDER: z.literal("cloudinary"),
  CLOUDINARY_CLOUD_NAME: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/),
  CLOUDINARY_UPLOAD_PRESET: z.string().trim().min(1).max(255),
  CLOUDINARY_API_KEY: z.string().trim().regex(/^\d+$/),
  CLOUDINARY_API_SECRET: z.string().min(1).refine((value) => value === value.trim()),
});

export type CloudinaryConfig = z.infer<typeof cloudinaryConfigSchema>;
