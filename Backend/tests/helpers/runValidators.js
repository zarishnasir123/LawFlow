import { validationResult } from "express-validator";

// Build a minimal Express-shaped request for running validator chains.
export function makeReq({ body = {}, query = {}, params = {}, files } = {}) {
  return { body, query, params, headers: {}, cookies: {}, files };
}

// Run every validator in a chain against the request and collect the result.
export async function runValidators(chain, req) {
  for (const validator of chain) {
    await validator.run(req);
  }
  return validationResult(req);
}

// The list of human-readable error messages a failed run produced.
export function messagesOf(result) {
  return result.array().map((e) => e.msg);
}
