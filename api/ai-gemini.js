export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GEMINI_API_KEY not set' }); return; }

  const { prompt } = req.body;
  if (!prompt) { res.status(400).json({ error: 'missing prompt' }); return; }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt + '\n\n請只回覆 JSON，不要加 markdown 標記。' }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
      })
    });

    if (!r.ok) {
      const err = await r.text();
      res.status(r.status).json({ error: err });
      return;
    }

    const data = await r.json();
    const text = data.candidates[0].content.parts[0].text;
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
