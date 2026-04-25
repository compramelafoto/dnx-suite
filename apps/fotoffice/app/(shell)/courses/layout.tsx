import { requireCoursesSalesContext } from "@/lib/workspace";

export default async function CoursesModuleLayout({ children }: { children: React.ReactNode }) {
  await requireCoursesSalesContext();
  return <div className="space-y-8">{children}</div>;
}
