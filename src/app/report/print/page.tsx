import { Suspense } from "react";
import PrintReportView from "@/components/PrintReportView";

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 16 }}>読み込み中...</p>}>
      <PrintReportView />
    </Suspense>
  );
}
