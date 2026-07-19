import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StarRating from "./StarRating";

describe("StarRating", () => {
  it("renders 5 stars as a read-only display (no buttons)", () => {
    render(<StarRating value={3} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("becomes an interactive 1-5 input when onChange is passed", () => {
    render(<StarRating value={0} onChange={vi.fn()} />);
    const stars = screen.getAllByRole("button");
    expect(stars).toHaveLength(5);
    expect(stars[0]).toHaveAccessibleName("1 star");
    expect(stars[4]).toHaveAccessibleName("5 stars");
  });

  it("reports the clicked rating", async () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "4 stars" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("stays read-only when readOnly is set even with onChange", () => {
    render(<StarRating value={5} onChange={vi.fn()} readOnly />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
