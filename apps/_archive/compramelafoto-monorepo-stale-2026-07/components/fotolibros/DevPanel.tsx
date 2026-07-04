"use client";

import Card from "@/components/ui/Card";

type DevPanelProps = {
  json: unknown;
};

export default function DevPanel({ json }: DevPanelProps) {
  return (
    <Card className="p-4">
      <div className="text-sm font-medium text-[#1a1a1a] mb-2">Documento (debug)</div>
      <pre className="max-h-64 overflow-auto rounded-md bg-[#0f172a] p-3 text-xs text-[#e2e8f0]">
        {JSON.stringify(json, null, 2)}
      </pre>
    </Card>
  );
}
