import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoleSelector from "./RoleSelector";
import type { RegisterRole } from "../types";

function Harness({ onChange }: { onChange?: (v: RegisterRole) => void } = {}) {
  const [value, setValue] = useState<RegisterRole>("client");
  return (
    <RoleSelector
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

// The trigger's accessible name comes from its <label> ("Select role").
const trigger = () => screen.getByRole("button", { name: "Select role" });

describe("RoleSelector", () => {
  it("shows the current selection and is collapsed by default", () => {
    render(<Harness />);
    expect(trigger()).toHaveTextContent("Client");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens the option list on click", async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Lawyer/ })).toBeInTheDocument();
  });

  it("selects a new role and closes the list", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("option", { name: /Lawyer/ }));
    expect(onChange).toHaveBeenCalledWith("lawyer");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not open when disabled", async () => {
    render(<RoleSelector value="client" onChange={vi.fn()} disabled />);
    await userEvent.click(trigger());
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
