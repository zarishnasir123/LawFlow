import {
  createRegistrar,
  deleteRegistrar,
  getRegistrar,
  listRegistrars,
  resendRegistrarCredentials,
  setRegistrarStatus,
  updateRegistrar
} from "./registrar.service.js";

function getField(payload, ...names) {
  for (const name of names) {
    if (payload[name] !== undefined) {
      return payload[name];
    }
  }

  return undefined;
}

// Same response shape used by create + resend. Surfacing `emailDelivery`
// lets the admin UI distinguish "registrar created, email queued" from
// "registrar created but the SMTP server rejected the password email" —
// the latter requires manually re-issuing credentials.
function buildCredentialsResponse({ registrar, emailDelivery }, baseMessage) {
  const message = emailDelivery.emailSent
    ? `${baseMessage} Credentials have been emailed.`
    : `${baseMessage} Credentials email could not be delivered (${emailDelivery.deliveryReason ?? "SMTP unavailable"}). Re-send from the registrar list once email is configured.`;

  return {
    message,
    registrar,
    emailDelivery
  };
}

export async function createRegistrarHandler(req, res) {
  const result = await createRegistrar({
    firstName: getField(req.body, "firstName", "first_name"),
    lastName: getField(req.body, "lastName", "last_name"),
    email: req.body.email,
    phone: getField(req.body, "phone", "phoneNumber", "phone_number"),
    cnic: getField(req.body, "cnic", "CNIC"),
    assignedCourt: getField(req.body, "assignedCourt", "assigned_court"),
    assignedTehsil: getField(req.body, "assignedTehsil", "assigned_tehsil"),
    createdByAdminId: req.user.sub
  });

  return res
    .status(201)
    .json(buildCredentialsResponse(result, "Registrar account created."));
}

export async function listRegistrarsHandler(req, res) {
  const result = await listRegistrars({
    limit: req.query.limit,
    offset: req.query.offset
  });

  return res.status(200).json(result);
}

export async function getRegistrarHandler(req, res) {
  const registrar = await getRegistrar(req.params.registrarProfileId);
  return res.status(200).json({ registrar });
}

export async function updateRegistrarHandler(req, res) {
  const updated = await updateRegistrar({
    registrarProfileId: req.params.registrarProfileId,
    firstName: getField(req.body, "firstName", "first_name"),
    lastName: getField(req.body, "lastName", "last_name"),
    phone: getField(req.body, "phone", "phoneNumber", "phone_number"),
    assignedCourt: getField(req.body, "assignedCourt", "assigned_court"),
    assignedTehsil: getField(req.body, "assignedTehsil", "assigned_tehsil")
  });

  return res.status(200).json({
    message: "Registrar updated successfully",
    registrar: updated
  });
}

export async function setRegistrarStatusHandler(req, res) {
  const updated = await setRegistrarStatus({
    registrarProfileId: req.params.registrarProfileId,
    accountStatus: req.body.accountStatus
  });

  return res.status(200).json({
    message: `Registrar ${updated.accountStatus === "active" ? "activated" : "deactivated"} successfully`,
    registrar: updated
  });
}

export async function resendRegistrarCredentialsHandler(req, res) {
  const result = await resendRegistrarCredentials(req.params.registrarProfileId);

  return res
    .status(200)
    .json(
      buildCredentialsResponse(
        result,
        "Registrar temporary password has been rotated."
      )
    );
}

export async function deleteRegistrarHandler(req, res) {
  await deleteRegistrar(req.params.registrarProfileId);
  return res.status(200).json({ message: "Registrar deleted successfully" });
}
