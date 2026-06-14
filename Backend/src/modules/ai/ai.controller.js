import { askLegalGuidance } from "./ai.service.js";

// POST /api/ai/guidance — lawyer asks the grounded legal assistant a question.
// The validated body carries { prompt, history? }. We return only the reply
// text; the frontend wraps it into a chat message (id/timestamp) for display.
export async function postLegalGuidance(req, res) {
  const reply = await askLegalGuidance({
    prompt: req.body.prompt,
    history: req.body.history
  });

  return res.status(200).json({ reply });
}
