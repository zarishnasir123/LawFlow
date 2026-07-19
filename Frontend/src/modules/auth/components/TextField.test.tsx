import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { useForm } from "react-hook-form";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TextField from "./TextField";
import { formatPkPhone } from "../../../shared/utils/pkFormat";

function Harness({
  error,
  format,
}: { error?: string; format?: (v: string) => string } = {}) {
  const { register } = useForm<{ phone: string }>();
  return (
    <TextField
      label="Phone"
      inputProps={register("phone")}
      error={error}
      format={format}
    />
  );
}

describe("TextField", () => {
  it("renders a labelled input", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
  });

  it("applies the optional format mask as the user types", async () => {
    render(<Harness format={formatPkPhone} />);
    const input = screen.getByLabelText("Phone") as HTMLInputElement;
    await userEvent.type(input, "3001234567");
    expect(input.value).toBe("+92-300-1234567");
  });

  it("marks the field invalid when an error is present", () => {
    render(<Harness error="Phone is required" />);
    expect(screen.getByLabelText("Phone")).toHaveAttribute("aria-invalid", "true");
  });

  it("is aria-valid when there is no error", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Phone")).toHaveAttribute("aria-invalid", "false");
  });
});
