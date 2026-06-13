import { listCasesForClient } from "./client.service.js";

// GET /api/clients/cases — the caller client's own linked cases, newest first.
// req.user.sub is the verified client user id from the access token; the
// service scopes the query to it in SQL so the client only ever sees their own
// cases.
export async function listMyCases(req, res) {
  const cases = await listCasesForClient({ clientUserId: req.user.sub });
  return res.status(200).json({ cases });
}
