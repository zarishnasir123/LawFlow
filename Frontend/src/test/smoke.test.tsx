import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

describe("test environment", () => {
  it("renders React components in the simulated browser", () => {
    render(<h1>LawFlow Frontend tests are alive</h1>);
    expect(
      screen.getByRole("heading", { name: "LawFlow Frontend tests are alive" })
    ).toBeInTheDocument();
  });

  it("provides working browser storage", () => {
    localStorage.setItem("smoke", "ok");
    expect(localStorage.getItem("smoke")).toBe("ok");
  });
});
