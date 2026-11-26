const enabled = () => !!process.env.OPENAI_API_KEY;

async function chatJSON(messages, temperature = 0.4) {
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed (${res.status})`);
  return JSON.parse((await res.json()).choices[0].message.content);
}

module.exports = { enabled, chatJSON };
