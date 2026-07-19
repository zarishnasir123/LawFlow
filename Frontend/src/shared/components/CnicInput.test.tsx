import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CnicInput from "./CnicInput";

// Controlled wrapper so the displayed value tracks what the user types.
function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CnicInput value={value} onChange={setValue} name="cnic" />
      <output data-testid="clean">{value}</output>
    </>
  );
}

describe("CnicInput", () => {
  it("emits the clean dashed CNIC as the user types digits", async () => {
    render(<Harness />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "3410412345671");
    expect(screen.getByTestId("clean")).toHaveTextContent("34104-1234567-1");
  });

  it("ignores typed non-digits", async () => {
    const onChange = vi.fn();
    render(<CnicInput value="" onChange={onChange} name="cnic" />);
    await userEvent.type(screen.getByRole("textbox"), "34a10");
    // Only the four digits survive → "34104"? no — a is dropped → "3410"
    expect(onChange).toHaveBeenLastCalledWith("3410");
  });

  it("renders a plain disabled input (no overlay) when disabled", () => {
    const { container } = render(
      <CnicInput value="34104-1234567-1" onChange={vi.fn()} name="cnic" disabled />
    );
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
    // The interactive version wraps the input in a relative div with an overlay;
    // the disabled version is a bare input.
    expect(container.querySelector(".relative")).toBeNull();
  });

  it("shows the current value as a filled skeleton", () => {
    render(<CnicInput value="34104-1234567-1" onChange={vi.fn()} name="cnic" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("34104-1234567-1");
  });
});
