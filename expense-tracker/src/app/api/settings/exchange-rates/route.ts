import { NextResponse } from "next/server";
import { SettingsService } from "@/features/settings/service";
import { createExchangeRateSchema } from "@/features/settings/schema";

const service = new SettingsService();

export async function GET() {
  try {
    const rates = await service.getActiveRates();
    return NextResponse.json({ rates });
  } catch (error: any) {
    if (error.message === "Forbidden" || error.message === "Unauthorized") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = createExchangeRateSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: "Invalid input", details: result.error.format() }, { status: 400 });
    }

    const rate = await service.addNewExchangeRate(result.data);
    return NextResponse.json(rate, { status: 201 });
  } catch (error: any) {
    if (error.message === "Forbidden" || error.message === "Unauthorized") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
