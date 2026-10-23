import { expect, test } from "bun:test";
import { spanishRecruiter } from "../../../client/legacy-web/recruiter-spanish.ts";
import { localizePractice } from "../../../client/legacy-web/practice-spanish.ts";
import { problems } from "../../../client/legacy-web/practice-data.ts";
import { createCompatibilityState } from "../../../client/legacy-web/local.ts";
import { runPracticeTests } from "../../../client/legacy-web/practice.ts";

test("Spanish practice localizes all three problem statements without changing executable examples or expected results", () => {
  const original = structuredClone(problems);
  for (const [id, problem] of Object.entries(problems)) {
    const localized = localizePractice(problem, id, "es");
    expect(localized).not.toBe(problem);
    expect(localized.desc).not.toBe(problem.desc);
    expect(localized.codes).toEqual(problem.codes);
    expect(localized.tests).toEqual(problem.tests);
    expect(localized.input).toBe(problem.input);
    expect(localized.output).toBe(problem.output);
    expect(runPracticeTests(localized, id)).toEqual(
      runPracticeTests(problem, id),
    );
    expect(localizePractice(problem, id, "pt-BR")).toBe(problem);
  }
  expect(problems).toEqual(original);
});

test("Spanish static recruiter and STAR examples keep private profile, question and transcript text unchanged", () => {
  const state = createCompatibilityState({ getItem: () => null });
  state.profile.experience = "Private unmodified experience";
  state.profile.role = "Private role";
  state.profile.job = "Private job";
  state.customQuestion = "Private question";
  state.transcripts.recruiter = [
    { who: "Private speaker", time: "00:01", text: "Private statement" },
  ];
  const original = structuredClone(state);
  const copy = spanishRecruiter(state, true);
  expect(copy.assist.title).toBe("Explica cómo tomaste la decisión.");
  expect(copy.star.body).toContain("Situación —");
  expect(copy.star.notes[1]).toBe(state.profile.experience);
  expect(copy.custom.summary).toBe(state.customQuestion);
  expect(copy.custom.notes).toEqual([
    "Perfil: Private role",
    "Puesto: Private job",
  ]);
  expect(copy.recap.body).toBe("Private speaker: Private statement");
  expect(state).toEqual(original);
});
