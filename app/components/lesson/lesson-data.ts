import type { ComponentProps } from "react";
import type { DenialReason } from "~/modules/permissions/course-permissions.server";
import type { LessonNote } from "~/modules/note-editor/lesson-note";
import type { CommentThread } from "~/components/comment-thread";
import type { CurriculumSidebar } from "./curriculum-sidebar";
import type { QuizSection } from "./quiz-section";

// The lesson route's loader conforms to these; components never import a route.
type Sidebar = ComponentProps<typeof CurriculumSidebar>;
type Quiz = ComponentProps<typeof QuizSection>;
type LessonLink = { id: number; title: string };

type LessonShell = {
  course: Sidebar["course"];
  curriculum: Sidebar["curriculum"];
  module: { id: number; title: string };
  enrolled: boolean;
};

export type LockedLessonData = LessonShell & {
  view: "locked";
  lesson: LessonLink;
  lockedReason: DenialReason;
};

export type FullLessonData = LessonShell & {
  view: "full";
  lesson: LessonLink & {
    durationMinutes: number | null;
    githubRepoUrl: string | null;
    videoUrl: string | null;
  };
  contentHtml: string | null;
  lessonStatus: string | null;
  currentUserId: number | null;
  prevLesson: LessonLink | null;
  nextLesson: LessonLink | null;
  quiz: Quiz["quiz"] | null;
  bestAttempt: Quiz["bestAttempt"];
  lastWatchPosition: number;
  watchProgress: number;
  lessonProgressMap: Sidebar["lessonProgressMap"];
  comments: ComponentProps<typeof CommentThread>["comments"];
  canModerate: boolean;
  instructorName: string;
  bookmarked: boolean;
  note: ComponentProps<typeof LessonNote>["note"];
};
