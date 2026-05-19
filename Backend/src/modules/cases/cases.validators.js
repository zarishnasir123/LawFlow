import { body, param } from "express-validator";

function getField(payload, ...names) {
  for (const name of names) {
    if (payload[name] !== undefined) {
      return payload[name];
    }
  }
  return undefined;
}

function getTrimmedField(payload, ...names) {
  const value = getField(payload, ...names);
  return typeof value === "string" ? value.trim() : value;
}

function requireStringField(fieldNames, label, { max } = {}) {
  return body().custom((_, { req }) => {
    const value = getTrimmedField(req.body, ...fieldNames);

    if (!value) {
      throw new Error(`${label} is required`);
    }

    if (typeof value !== "string") {
      throw new Error(`${label} must be text`);
    }

    if (max && value.length > max) {
      throw new Error(`${label} must be ${max} characters or less`);
    }

    return true;
  });
}

function optionalStringField(fieldNames, label, { max } = {}) {
  return body().custom((_, { req }) => {
    const value = getTrimmedField(req.body, ...fieldNames);

    if (!value) {
      return true;
    }

    if (typeof value !== "string") {
      throw new Error(`${label} must be text`);
    }

    if (max && value.length > max) {
      throw new Error(`${label} must be ${max} characters or less`);
    }

    return true;
  });
}

const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

export const createCaseValidator = [
  body("caseTypeId").isUUID().withMessage("caseTypeId must be a valid UUID"),
  requireStringField(["title"], "Title", { max: 300 }),
  optionalStringField(["description"], "Description"),
  requireStringField(["clientName"], "Client name", { max: 200 }),
  optionalStringField(["clientEmail"], "Client email", { max: 200 }),
  optionalStringField(["clientPhone"], "Client phone", { max: 30 }),
  requireStringField(["oppositePartyName"], "Opposite party name", { max: 200 })
];

export const caseIdParamValidator = [uuidParam("caseId")];

export const updateCaseValidator = [
  uuidParam("caseId"),
  optionalStringField(["title"], "Title", { max: 300 }),
  optionalStringField(["description"], "Description"),
  optionalStringField(["clientName"], "Client name", { max: 200 }),
  optionalStringField(["clientEmail"], "Client email", { max: 200 }),
  optionalStringField(["clientPhone"], "Client phone", { max: 30 }),
  optionalStringField(["oppositePartyName"], "Opposite party name", { max: 200 })
];
