export type MockStudent = {
  id: string;
  fullName: string;
  email?: string;
};

export type StudentProgressStatus = "empty" | "partial" | "complete";

export type MockRubricLevel = {
  id: string;
  label: string;
  score: number;
  feedbackText: string;
};

export type MockRubricCriteria = {
  id: string;
  title: string;
  levels: MockRubricLevel[];
};
