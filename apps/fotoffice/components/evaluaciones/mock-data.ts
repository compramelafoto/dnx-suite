import type { MockRubricCriteria, MockStudent } from "./types";

export const mockStudents: MockStudent[] = [
  { id: "stu_1", fullName: "Ana Martínez", email: "ana@example.com" },
  { id: "stu_2", fullName: "Bruno Pérez", email: "bruno@example.com" },
  { id: "stu_3", fullName: "Camila Gómez", email: "camila@example.com" },
  { id: "stu_4", fullName: "Diego Ruiz", email: "diego@example.com" },
  { id: "stu_5", fullName: "Elena Torres", email: "elena@example.com" },
];

export const mockCriteria: MockRubricCriteria[] = [
  {
    id: "cri_1",
    title: "Composición",
    levels: [
      { id: "cri_1_lvl_1", label: "Excelente", score: 10, feedbackText: "Composición muy sólida y bien resuelta." },
      { id: "cri_1_lvl_2", label: "Bien", score: 8, feedbackText: "Composición correcta, con pequeños puntos a mejorar." },
      { id: "cri_1_lvl_3", label: "Regular", score: 6, feedbackText: "Composición básica; necesita más intención visual." },
      { id: "cri_1_lvl_4", label: "Insuficiente", score: 3, feedbackText: "La composición no cumple los criterios mínimos." },
    ],
  },
  {
    id: "cri_2",
    title: "Iluminación",
    levels: [
      { id: "cri_2_lvl_1", label: "Excelente", score: 10, feedbackText: "Control de luz preciso y coherente con la consigna." },
      { id: "cri_2_lvl_2", label: "Bien", score: 8, feedbackText: "Buena iluminación, con margen de mejora técnica." },
      { id: "cri_2_lvl_3", label: "Regular", score: 6, feedbackText: "Iluminación aceptable pero con inconsistencias." },
      { id: "cri_2_lvl_4", label: "Insuficiente", score: 3, feedbackText: "La iluminación afecta negativamente el resultado." },
    ],
  },
  {
    id: "cri_3",
    title: "Edición final",
    levels: [
      { id: "cri_3_lvl_1", label: "Excelente", score: 10, feedbackText: "Edición final prolija y alineada con el objetivo." },
      { id: "cri_3_lvl_2", label: "Bien", score: 8, feedbackText: "Edición correcta con detalles menores por ajustar." },
      { id: "cri_3_lvl_3", label: "Regular", score: 6, feedbackText: "Edición funcional, pero con falta de consistencia." },
      { id: "cri_3_lvl_4", label: "Insuficiente", score: 3, feedbackText: "Edición incompleta o con errores relevantes." },
    ],
  },
];
