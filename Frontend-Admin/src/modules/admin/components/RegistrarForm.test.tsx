import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegistrarForm from "./RegistrarForm";

// The form is self-contained (plain useState, no router/query), so a bare
// render is enough. onSubmit is the seam we assert against.
function setup(props: Partial<React.ComponentProps<typeof RegistrarForm>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <RegistrarForm
      title="Create Registrar"
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitText="Create Registrar"
      {...props}
    />
  );
  return { onSubmit, onCancel };
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Muhammad"), "Sana");
  await user.type(screen.getByPlaceholderText("Asif"), "Iqbal");
  await user.type(
    screen.getByPlaceholderText("asif.registrar@lawflow.pk"),
    "sana@lawflow.pk"
  );
  await user.type(screen.getByPlaceholderText("+92 300 1234567"), "+92-300-1234567");
  const cnic = document.getElementById("registrar-cnic") as HTMLInputElement;
  await user.type(cnic, "3410312345671");
}

describe("RegistrarForm", () => {
  it("submits the entered values when everything is valid", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Create Registrar" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      firstName: "Sana",
      lastName: "Iqbal",
      email: "sana@lawflow.pk",
      cnic: "34103-1234567-1",
    });
  });

  it("requires the core fields", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Create Registrar" }));
    expect(await screen.findByText("First name is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a non-Gujranwala CNIC", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(screen.getByPlaceholderText("Muhammad"), "Sana");
    await user.type(screen.getByPlaceholderText("Asif"), "Iqbal");
    await user.type(
      screen.getByPlaceholderText("asif.registrar@lawflow.pk"),
      "sana@lawflow.pk"
    );
    await user.type(screen.getByPlaceholderText("+92 300 1234567"), "+92-300-1234567");
    const cnic = document.getElementById("registrar-cnic") as HTMLInputElement;
    await user.type(cnic, "3520212345671");
    await user.click(screen.getByRole("button", { name: "Create Registrar" }));

    expect(await screen.findByText(/only to Gujranwala residents/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a malformed phone number", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(screen.getByPlaceholderText("Muhammad"), "Sana");
    await user.type(screen.getByPlaceholderText("Asif"), "Iqbal");
    await user.type(
      screen.getByPlaceholderText("asif.registrar@lawflow.pk"),
      "sana@lawflow.pk"
    );
    await user.type(screen.getByPlaceholderText("+92 300 1234567"), "0300");
    await user.click(screen.getByRole("button", { name: "Create Registrar" }));

    expect(await screen.findByText(/valid Pakistani phone number/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("locks email and CNIC in edit mode (identity cannot change)", () => {
    setup({
      editMode: true,
      submitText: "Save Changes",
      initialValues: {
        firstName: "Sana",
        lastName: "Iqbal",
        email: "sana@lawflow.pk",
        phone: "+92-300-1234567",
        cnic: "34103-1234567-1",
        role: "Registrar",
        assignedCourt: "",
        assignedTehsil: "",
      },
    });

    const email = screen.getByPlaceholderText("asif.registrar@lawflow.pk") as HTMLInputElement;
    const cnic = document.getElementById("registrar-cnic") as HTMLInputElement;
    expect(email).toHaveAttribute("readonly");
    expect(cnic).toHaveAttribute("readonly");
  });
});
