import { describe, it, expect, vi, beforeAll } from "vitest";
import * as schema from "~/db/schema";
import { LessonProgressStatus } from "~/db/schema";
import { markdown } from "~/lib/text";
import { seedBaseData } from "~/test/setup";
import { flattenCourseLessons, getCourseWithDetails } from "../course.server";
import {
  getLessonProgress,
  markLessonComplete,
  markLessonInProgress,
} from "../progress.server";
import { calculateGrade, getQuizById } from "../quiz.server";
import { getLessonThread, renderThread } from "../thread.server";

// The module reads the global db; give it an in-memory one instead of data.db.
vi.mock("~/db", async () => {
  const { createTestDb } = await import("~/test/setup");
  return { db: createTestDb() };
});

const { db } = (await import("~/db")) as unknown as {
  db: Parameters<typeof seedBaseData>[0];
};

let base: ReturnType<typeof seedBaseData>;
let lessonId: number;

beforeAll(() => {
  base = seedBaseData(db);
  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Hello", position: 1 })
    .returning()
    .get().id;
});

describe("course", () => {
  it("returns the course with its modules and lessons", () => {
    const course = getCourseWithDetails(base.course.id);
    expect(course?.modules.map((m) => m.lessons.map((l) => l.id))).toEqual([
      [lessonId],
    ]);
  });

  it("returns null for a course that does not exist", () => {
    expect(getCourseWithDetails(9999)).toBeNull();
  });

  it("flattens lessons in module order, tagged with their module", () => {
    expect(
      flattenCourseLessons({
        modules: [
          {
            id: 1,
            title: "A",
            lessons: [{ id: 10, title: "a1", moduleId: 1 }],
          },
          {
            id: 2,
            title: "B",
            lessons: [{ id: 20, title: "b1", moduleId: 2 }],
          },
        ],
      })
    ).toEqual([
      { id: 10, title: "a1", moduleId: 1, moduleTitle: "A" },
      { id: 20, title: "b1", moduleId: 2, moduleTitle: "B" },
    ]);
  });
});

describe("progress", () => {
  it("keeps a completed lesson completed when it is opened again", () => {
    markLessonInProgress(base.user.id, lessonId);
    expect(getLessonProgress(base.user.id, lessonId)?.status).toBe(
      LessonProgressStatus.InProgress
    );

    markLessonComplete(base.user.id, lessonId);
    markLessonInProgress(base.user.id, lessonId);
    expect(getLessonProgress(base.user.id, lessonId)?.status).toBe(
      LessonProgressStatus.Completed
    );
  });
});

describe("quiz", () => {
  it.each([
    [0.9, "A"],
    [0.89, "B"],
    [0.7, "C"],
    [0.6, "D"],
    [0.59, "F"],
  ])("grades a score of %s as %s", (score, grade) => {
    expect(calculateGrade(score)).toBe(grade);
  });

  it("finds no quiz that does not exist", () => {
    expect(getQuizById(9999)).toBeUndefined();
  });
});

describe("thread", () => {
  it("has no thread for a lesson that does not exist", () => {
    expect(getLessonThread(9999)).toEqual([]);
  });

  it("renders no body for a deleted comment", async () => {
    const author = {
      id: 1,
      name: "A",
      avatarUrl: null,
      isInstructor: false,
      isPlatformAdmin: false,
    };
    const [rendered] = await renderThread([
      {
        id: 1,
        body: markdown("gone"),
        createdAt: "2026-11-17T10:00:00Z",
        editedAt: null,
        deleted: true,
        author,
        replies: [],
      },
    ]);
    expect(rendered.bodyHtml).toBe("");
  });
});
