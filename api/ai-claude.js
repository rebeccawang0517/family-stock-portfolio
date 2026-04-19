export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'CLAUDE_API_KEY not set' }); return; }

  const { prompt } = req.body;
  if (!prompt) { res.status(400).json({ error: 'missing prompt' }); return; }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt + '\n\n請只回覆 JSON，不要加 markdown 標記。' }]
      })
    });

    if (!r.ok) {
      const err = await r.text();
      res.status(r.status).json({ error: err });
      return;
    }

    const data = await r.json();
    const text = data.content[0].text;
    try {
      const result = JSON.parse(text);
      res.status(200).json({ result });
    } catch {
      res.status(200).json({ result: { raw: text } });
    }
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
