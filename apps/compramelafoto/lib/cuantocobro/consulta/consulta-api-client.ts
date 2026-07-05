import type {
  CuantoCobroConsultaDetailDto,
  CuantoCobroConsultaInput,
  CuantoCobroConsultaListItemDto,
  CuantoCobroConsultaNoteDto,
} from "@/lib/cuantocobro/consulta/types";

export type ConsultaListResponse = {
  items: CuantoCobroConsultaListItemDto[];
  nextCursor: string | null;
};

export type ConsultaListParams = {
  cursor?: string | null;
  limit?: number;
  search?: string;
  status?: string;
  pipelineStage?: string;
  includeArchived?: boolean;
};

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchConsultas(params: ConsultaListParams = {}): Promise<ConsultaListResponse> {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  if (params.pipelineStage) query.set("pipelineStage", params.pipelineStage);
  if (params.includeArchived) query.set("includeArchived", "1");

  const res = await fetch(`/api/cuantocobro/consultas?${query.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("No se pudo cargar el listado de consultas");
  }

  return (await res.json()) as ConsultaListResponse;
}

export async function fetchConsultaById(id: number): Promise<CuantoCobroConsultaDetailDto | null> {
  const res = await fetch(`/api/cuantocobro/consultas/${id}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("No se pudo cargar la consulta");

  const data = await parseJson<{ consulta: CuantoCobroConsultaDetailDto }>(res);
  return data?.consulta ?? null;
}

export async function createConsulta(
  consulta: Partial<CuantoCobroConsultaInput>,
): Promise<CuantoCobroConsultaDetailDto> {
  const res = await fetch("/api/cuantocobro/consultas", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consulta }),
  });

  const data = await parseJson<{ consulta?: CuantoCobroConsultaDetailDto; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data?.error || "No se pudo crear la consulta");
  }
  if (!data?.consulta) throw new Error("Respuesta inválida al crear consulta");
  return data.consulta;
}

export async function updateConsulta(
  id: number,
  consulta: Partial<CuantoCobroConsultaInput>,
): Promise<CuantoCobroConsultaDetailDto> {
  const res = await fetch(`/api/cuantocobro/consultas/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consulta }),
  });

  const data = await parseJson<{ consulta?: CuantoCobroConsultaDetailDto; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data?.error || "No se pudo guardar la consulta");
  }
  if (!data?.consulta) throw new Error("Respuesta inválida al guardar consulta");
  return data.consulta;
}

export async function deleteConsulta(id: number): Promise<void> {
  const res = await fetch(`/api/cuantocobro/consultas/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const data = await parseJson<{ error?: string }>(res);
    throw new Error(data?.error || "No se pudo eliminar la consulta");
  }
}

export async function addConsultaNote(id: number, body: string): Promise<CuantoCobroConsultaNoteDto> {
  const res = await fetch(`/api/cuantocobro/consultas/${id}/notes`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });

  const data = await parseJson<{ note?: CuantoCobroConsultaNoteDto; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data?.error || "No se pudo agregar la nota");
  }
  if (!data?.note) throw new Error("Respuesta inválida al agregar nota");
  return data.note;
}
