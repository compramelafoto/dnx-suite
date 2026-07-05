/**
 * Intenta emparejar curso/división del padrón con una fila de SchoolCourse del colegio.
 */
export function matchSchoolCourseId(
  courses: Array<{ id: number; name: string; division: string | null }>,
  courseName: string,
  division: string
): number | null {
  const cn = courseName.trim();
  const div = division.trim();
  for (const c of courses) {
    if (c.name.trim() !== cn) continue;
    const cd = (c.division ?? "").trim();
    if (cd === div) return c.id;
  }
  return null;
}
