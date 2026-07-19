import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { useForm } from "react-hook-form";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CnicField from "./CnicField";

function Harness({ error }: { error?: string } = {}) {
  const { control } = useForm<{ cnic: string }>({ defaultValues: { cnic: "" } });
  return <CnicField control={control} name="cnic" label="CNIC" error={error} />;
}

describe("CnicField", () => {
  it("renders a labelled CNIC input", () => {
    render(<Harness />);
    expect(screen.getByLabelText("CNIC")).toBeInTheDocument();
  });

  it("feeds typed digits through the mask into the form value", async () => {
    render(<Harness />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await userEvent.type(input, "3410412345671");
    expect(input.value).toBe("34104-1234567-1");
  });

  it("shows the error text and wires aria-describedby", () => {
    render(<Harness error="Use the format 12345-1234567-1." />);
    expect(screen.getByText("Use the format 12345-1234567-1.")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });
});
