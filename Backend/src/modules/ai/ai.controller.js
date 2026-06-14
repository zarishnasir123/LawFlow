import { askLegalGuidance } from "./ai.service.js";

// POST /api/ai/guidance — lawyer asks the grounded legal assistant a question.
// The validated body carries { prompt, history? }. We return the reply text plus
// up to three suggested follow-up questions; the frontend wraps the reply into a
// chat message and renders the suggestions as clickable chips.
export async function postLegalGuidance(req, res) {
  const { reply, suggestions } = await askLegalGuidance({
    prompt: req.body.prompt,
    history: req.body.history
  });

  return res.status(200).json({ reply, suggestions });
}
