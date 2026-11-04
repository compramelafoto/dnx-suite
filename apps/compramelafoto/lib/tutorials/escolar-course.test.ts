import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ESCOLAR_COURSE_BLOCKS,
  ESCOLAR_COURSE_LESSON_COUNT,
  formatLessonDuration,
  parseEscolarCourseVideos,
  validateEscolarCourseVideos,
} from "./escolar-course";
import { ESCOLAR_COURSE_DETAILS } from "./escolar-course-details";
import { TUTORIAL_COURSES, getTutorialCourse } from "./courses";

describe("escolar-course", () => {
  it("numera las 23 clases de corrido", () => {
    const numbers = ESCOLAR_COURSE_BLOCKS.flatMap((block) => block.lessons.map((l) => l.number));
    assert.equal(ESCOLAR_COURSE_LESSON_COUNT, 23);
    assert.deepEqual(numbers, Array.from({ length: 23 }, (_, i) => i + 1));
  });

  it("acepta links de YouTube y descarta los vacíos", () => {
    const result = validateEscolarCourseVideos({ "1": " https://youtu.be/abc123XYZ ", "2": "" });
    assert.deepEqual(result, { videos: { 1: "https://youtu.be/abc123XYZ" } });
  });

  it("rechaza clases inexistentes y links que no son de YouTube", () => {
    assert.deepEqual(validateEscolarCourseVideos({ "24": "https://youtu.be/abc123XYZ" }), {
      error: "La clase 24 no existe",
    });
    assert.deepEqual(validateEscolarCourseVideos({ "3": "https://vimeo.com/123" }), {
      error: "La clase 3 debe tener un link de YouTube válido",
    });
  });

  it("lee el ajuste guardado sin romperse con datos viejos", () => {
    assert.deepEqual(parseEscolarCourseVideos(null), {});
    assert.deepEqual(parseEscolarCourseVideos("no es json"), {});
    assert.deepEqual(
      parseEscolarCourseVideos(JSON.stringify({ videos: { "2": "https://www.youtube.com/watch?v=abc123XYZ", "99": "x" } })),
      { 2: "https://www.youtube.com/watch?v=abc123XYZ" }
    );
  });

  it("tiene descripción, duración y capítulos ordenados para cada clase", () => {
    for (let n = 1; n <= ESCOLAR_COURSE_LESSON_COUNT; n += 1) {
      const detail = ESCOLAR_COURSE_DETAILS[n];
      assert.ok(detail, `falta el detalle de la clase ${n}`);
      assert.ok(detail.description.length > 0);
      assert.ok(!/librito/i.test(detail.description), `la clase ${n} dice librito`);
      const ats = detail.chapters.map((c) => c.at);
      assert.deepEqual(ats, [...ats].sort((a, b) => a - b));
      assert.ok(ats.every((at) => at < detail.durationSeconds));
    }
  });

  it("formatea la duración en minutos y segundos", () => {
    assert.equal(formatLessonDuration(144), "2:24");
    assert.equal(formatLessonDuration(36), "0:36");
  });
});

describe("cursos de tutoriales", () => {
  it("cada curso numera sus clases de corrido y su detalle es coherente", () => {
    for (const course of TUTORIAL_COURSES) {
      const numbers = course.blocks.flatMap((block) => block.lessons.map((l) => l.number));
      assert.deepEqual(numbers, Array.from({ length: course.lessonCount }, (_, i) => i + 1), course.slug);
      for (const [key, detail] of Object.entries(course.details)) {
        const n = Number(key);
        assert.ok(n >= 1 && n <= course.lessonCount, `${course.slug}: la clase ${n} no existe`);
        assert.ok(!/librito/i.test(detail.description), `${course.slug} ${n} dice librito`);
        assert.ok(detail.chapters.every((c) => c.at < detail.durationSeconds));
      }
    }
  });

  it("los slugs y los ajustes no se repiten", () => {
    const slugs = TUTORIAL_COURSES.map((c) => c.slug);
    const keys = TUTORIAL_COURSES.map((c) => c.settingsKey);
    assert.equal(new Set(slugs).size, slugs.length);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(getTutorialCourse("turismo")?.lessonCount, 12);
    assert.equal(getTutorialCourse("nada"), null);
  });
});
