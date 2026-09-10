import { NextResponse } from "next/server";
import { SettingsService } from "@/features/settings/service";
import { updateSettingsSchema } from "@/features/settings/schema";

const service = new SettingsService();

export async function GET() {
  try {
    const settings = await service.getSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    if (error.message === "Forbidden" || error.message === "Unauthorized") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const result = updateSettingsSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: "Invalid input", details: result.error.format() }, { status: 400 });
    }

    const settings = await service.updateSettings(result.data);
    return NextResponse.json(settings);
  } catch (error: any) {
    if (error.message === "Forbidden" || error.message === "Unauthorized") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
