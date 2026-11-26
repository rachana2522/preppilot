const { feedback: offlineFeedback } = require('../public/offline');
const llm = require('./llm');

async function feedback(input) {
  if (llm.enabled()) {
    try {
      const data = await llm.chatJSON([
        { role: 'system', content: 'You are a strict but encouraging interview coach. Evaluate the candidate answer. Respond ONLY with JSON: {"score":0-100,"strengths":[""],"improvements":[""],"betterAnswer":"a concise model answer"}.' },
        { role: 'user', content: `Company: ${input.company || 'n/a'}\nRole: ${input.role || 'n/a'}\nQuestion: ${input.question}\n\nCandidate answer:\n${input.answer.slice(0, 4000)}` },
      ]);
      return {
        mode: 'ai',
        score: Math.max(0, Math.min(100, +data.score || 0)),
        strengths: Array.isArray(data.strengths) ? data.strengths : [],
        improvements: Array.isArray(data.improvements) ? data.improvements : [],
        betterAnswer: typeof data.betterAnswer === 'string' ? data.betterAnswer : '',
      };
    } catch (e) {
      console.error('LLM feedback failed, using offline feedback:', e.message);
    }
  }
  return offlineFeedback(input);
}

module.exports = { feedback };
