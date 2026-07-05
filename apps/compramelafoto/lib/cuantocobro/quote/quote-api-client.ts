import type {
  CreateCuantoCobroQuoteInput,
  CuantoCobroQuoteDetailDto,
  CuantoCobroQuoteListItemDto,
  CuantoCobroQuoteVersionDetailDto,
  ListQuotesResult,
} from "@/lib/cuantocobro/quote/types";

export type QuoteListParams = {
  cursor?: string | null;
  limit?: number;
  search?: string;
  status?: string;
  jobDateFrom?: string;
  jobDateTo?: string;
  hasConsulta?: string;
  amountMin?: string;
  amountMax?: string;
  includeArchived?: boolean;
};

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchQuotes(params: QuoteListParams = {}): Promise<ListQuotesResult> {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  if (params.jobDateFrom) query.set("jobDateFrom", params.jobDateFrom);
  if (params.jobDateTo) query.set("jobDateTo", params.jobDateTo);
  if (params.hasConsulta) query.set("hasConsulta", params.hasConsulta);
  if (params.amountMin) query.set("amountMin", params.amountMin);
  if (params.amountMax) query.set("amountMax", params.amountMax);
  if (params.includeArchived) query.set("includeArchived", "1");

  const res = await fetch(`/api/cuantocobro/quotes?${query.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("No se pudo cargar el listado de presupuestos");
  }

  return (await res.json()) as ListQuotesResult;
}

export async function fetchQuoteById(id: number): Promise<CuantoCobroQuoteDetailDto | null> {
  const res = await fetch(`/api/cuantocobro/quotes/${id}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("No se pudo cargar el presupuesto");

  const data = await parseJson<{ quote?: CuantoCobroQuoteDetailDto }>(res);
  return data?.quote ?? null;
}

export async function saveCuantoCobroQuote(
  input: CreateCuantoCobroQuoteInput,
): Promise<CuantoCobroQuoteListItemDto> {
  const res = await fetch("/api/cuantocobro/quotes", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await parseJson<{ quote?: CuantoCobroQuoteListItemDto; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data?.error || "No se pudo guardar el presupuesto");
  }
  if (!data?.quote) throw new Error("Respuesta inválida al guardar presupuesto");
  return data.quote;
}

export async function archiveQuote(id: number): Promise<void> {
  const res = await fetch(`/api/cuantocobro/quotes/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "archive" }),
  });

  if (!res.ok) {
    const data = await parseJson<{ error?: string }>(res);
    throw new Error(data?.error || "No se pudo archivar el presupuesto");
  }
}

export async function duplicateQuote(id: number): Promise<CuantoCobroQuoteDetailDto> {
  const res = await fetch(`/api/cuantocobro/quotes/${id}/duplicate`, {
    method: "POST",
    credentials: "include",
  });

  const data = await parseJson<{ quote?: CuantoCobroQuoteDetailDto; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data?.error || "No se pudo duplicar el presupuesto");
  }
  if (!data?.quote) throw new Error("Respuesta inválida al duplicar presupuesto");
  return data.quote;
}

export async function fetchQuoteVersionByNumber(
  quoteId: number,
  versionNumber: number,
): Promise<CuantoCobroQuoteVersionDetailDto | null> {
  const res = await fetch(`/api/cuantocobro/quotes/${quoteId}/versions/${versionNumber}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("No se pudo cargar la versión del presupuesto");

  const data = await parseJson<{ version?: CuantoCobroQuoteVersionDetailDto }>(res);
  return data?.version ?? null;
}

export async function downloadQuotePdf(
  quoteId: number,
  versionNumber: number,
  quoteNumber: string,
): Promise<void> {
  const res = await fetch(`/api/cuantocobro/quotes/${quoteId}/versions/${versionNumber}/pdf`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const data = await parseJson<{ error?: string }>(res);
    throw new Error(data?.error || "No se pudo descargar el PDF");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `presupuesto-${quoteNumber.replace(/[^\w.-]+/g, "_")}-v${versionNumber}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type SendQuoteToClientInput = {
  to: string;
  subject: string;
  message: string;
  includePdf: boolean;
  includeLink: boolean;
  confirmed: boolean;
};

export async function sendQuoteToClient(
  quoteId: number,
  versionNumber: number,
  input: SendQuoteToClientInput,
): Promise<{ sentAt: string; publicUrl: string | null }> {
  const res = await fetch(`/api/cuantocobro/quotes/${quoteId}/versions/${versionNumber}/send`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await parseJson<{ result?: { sentAt: string; publicUrl: string | null }; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data?.error || "No se pudo enviar el presupuesto");
  }
  if (!data?.result) throw new Error("Respuesta inválida al enviar presupuesto");
  return data.result;
}
