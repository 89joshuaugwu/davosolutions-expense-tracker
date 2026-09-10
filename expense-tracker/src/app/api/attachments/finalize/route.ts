import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth/session";
import { verifyUploadResult } from "../../../../lib/cloudinary/server";
import { createAttachment } from "../../../../lib/server/repositories/attachments";
import { z } from "zod";

const finalizeSchema = z.object({
  public_id: z.string().min(1),
  version: z.union([z.string(), z.number()]),
  signature: z.string().min(1),
  resource_type: z.enum(["image", "raw", "video", "auto"]),
  bytes: z.number().int().positive(),
  original_filename: z.string(),
  format: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== process.env.APP_URL) {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const user = await getSessionUser();
    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = finalizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { public_id, version, signature, resource_type, bytes, original_filename, format } = parsed.data;

    // Verify Cloudinary signature
    if (!verifyUploadResult(public_id, version, signature)) {
      return NextResponse.json({ error: "Invalid upload signature." }, { status: 400 });
    }

    // Generate random UUID for internal metadata
    const id = crypto.randomUUID();

    let fileName = original_filename;
    if (format && !fileName.toLowerCase().endsWith(`.${format.toLowerCase()}`)) {
      fileName = `${fileName}.${format}`;
    }

    const attachment = await createAttachment({
      id,
      storageKey: public_id,
      provider: "cloudinary",
      fileName,
      contentType: resource_type, // Cloudinary uses "image", "raw", etc. For raw it could be anything, but we'll use this.
      sizeBytes: bytes,
      uploadedBy: user.uid,
    });

    return NextResponse.json({ attachmentId: attachment.id });
  } catch (error) {
    console.error("Upload finalize error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
