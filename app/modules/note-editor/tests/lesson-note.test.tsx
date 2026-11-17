import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { LessonNote } from "../lesson-note";

function render(note: { body: string; updatedAt: string } | null) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <LessonNote note={note} /> },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={["/"]} />);
}

describe("LessonNote", () => {
  it("posts the draft as the save-note intent", () => {
    const html = render(null);
    expect(html).toContain('name="intent" value="save-note"');
    expect(html).toContain('name="body"');
  });

  it("starts from the saved note and counts its length", () => {
    const html = render({ body: "hello", updatedAt: "2026-11-17T10:00:00Z" });
    expect(html).toContain(">hello</textarea>");
    expect(html).toContain("5 / 2,000");
  });

  it("disables saving until the draft changes", () => {
    expect(render(null)).toMatch(/<button[^>]*disabled=""[^>]*>Save note/);
  });
});
