import { recordInterimSnapshot } from "@/lib/reportSummary";

export async function GET() {
  await recordInterimSnapshot("14:00");
  return Response.json({ ok: true });
}
