import { recordInterimSnapshot } from "@/lib/reportSummary";

export async function GET() {
  await recordInterimSnapshot("17:00");
  return Response.json({ ok: true });
}
