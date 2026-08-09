// Phase 7 AI Assistant. Deliberately a separate API key/backend from the
// public website's landing-page chatbot (see the website PRD) — this one
// touches real student data behind auth, that one never does and never
// should share infrastructure with this.
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function callGroq({ systemPrompt, userPrompt, maxTokens = 300 }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error('AI assistant is not configured yet.');
    err.statusCode = 503;
    throw err;
  }

  let res;
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    });
  } catch (err) {
    const wrapped = new Error('Network error reaching the AI service.');
    wrapped.statusCode = 502;
    throw wrapped;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('Groq API error:', data);
    const err = new Error('AI service request failed.');
    err.statusCode = 502;
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const err = new Error('AI service returned an empty response.');
    err.statusCode = 502;
    throw err;
  }
  return text;
}
