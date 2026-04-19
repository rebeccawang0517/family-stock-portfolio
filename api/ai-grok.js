export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GROK_API_KEY not set' }); return; }

  const { prompt } = req.body;
  if (!prompt) { res.status(400).json({ error: 'missing prompt' }); return; }

  try {
    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-reasoning',
        messages: [{ role: 'user', content: prompt + '\n\n請只回覆 JSON，不要加 markdown 標記。' }],
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    if (!r.ok) {
      const err = await r.text();
      res.status(r.status).json({ error: err });
      return;
    }

    const data = await r.json();
    const text = data.choices[0].message.content;
    try {
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const result = JSON.parse(cleaned);
      res.status(200).json({ result });
    } catch {
      res.status(200).json({ result: { raw: text } });
    }
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
