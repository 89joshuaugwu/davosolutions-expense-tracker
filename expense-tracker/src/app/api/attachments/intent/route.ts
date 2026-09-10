import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth/session";
import { createUploadIntent, getCloudinaryConfigurationStatus } from "../../../../lib/cloudinary/server";

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== process.env.APP_URL) {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.status !== "active") {
      return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
    }

    const status = getCloudinaryConfigurationStatus();
    if (!status.configured) {
      return NextResponse.json({ error: "Attachments are not configured." }, { status: 503 });
    }

    const intent = createUploadIntent();
    
    return NextResponse.json(intent);
  } catch (error) {
    console.error("Upload intent error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
