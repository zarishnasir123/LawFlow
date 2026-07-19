import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { useForm } from "react-hook-form";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordField from "./PasswordField";

function Harness({ error }: { error?: string } = {}) {
  const { register } = useForm<{ password: string }>();
  return (
    <PasswordField
      id="pw"
      label="Password"
      inputProps={register("password")}
      error={error}
    />
  );
}

describe("PasswordField", () => {
  it("hides the password by default and toggles visibility", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");

    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.type).toBe("password");
  });

  it("marks the field invalid and shows the error text", () => {
    render(<Harness error="Password is too short" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Password is too short")).toBeInTheDocument();
  });

  it("accepts typed input", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    await userEvent.type(input, "Secret1!");
    expect(input.value).toBe("Secret1!");
  });
});
