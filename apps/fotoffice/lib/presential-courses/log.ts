export function logCourseEvent(event: string, payload: Record<string, unknown>) {
  console.info(`[fotoffice_courses] ${event}`, payload);
}
