// 雙 AI 交易訊號 proxy
// POST /api/ai-signal
// Body: { ai: "claude" | "grok", context: { symbol, price, bars, indicators, position, balance } }
// Return: { action, lots, stopLoss, takeProfit, reason, model, latencyMs }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { ai, context } = body || {};
  if (!ai || !context) return res.status(400).json({ error: 'ai and context required' });

  const prompt = buildPrompt(context);
  const started = Date.now();
  try {
    let raw, model;
    if (ai === 'claude') {
      ({ raw, model } = await callClaude(prompt));
    } else if (ai === 'grok') {
      ({ raw, model } = await callGrok(prompt));
    } else {
      return res.status(400).json({ error: 'unknown ai' });
    }
    const parsed = parseSignal(raw);
    res.status(200).json({ ...parsed, model, latencyMs: Date.now() - started, raw });
  } catch (e) {
    res.status(500).json({ error: e.message, ai, latencyMs: Date.now() - started });
  }
}

function buildPrompt(ctx) {
  const { symbol, price, bars = [], indicators = {}, position = null, balance = 0 } = ctx;
  const recent = bars.slice(-20).map(b => `${formatTime(b.time)}: O=${r(b.open)} H=${r(b.high)} L=${r(b.low)} C=${r(b.close)} V=${b.volume || 0}`).join('\n');
  const ind = Object.entries(indicators).map(([k, v]) => `${k}=${r(v)}`).join(', ');
  const pos = position
    ? `目前持倉：${position.side === 'long' ? '多單' : '空單'} ${position.lots} 口 @ ${r(position.entryPrice)}，未實現 ${r(position.unrealizedPnl)} 元`
    : '目前無持倉';

  return `你是台指期當沖交易員，根據以下資料決定下一步動作。必須只輸出 JSON 格式，不要任何額外文字。

商品：${symbol}（台指期近一，1 點 = 200 元）
當前價格：${r(price)}
帳戶餘額：${r(balance)} 元
${pos}

最近 20 根 5 分 K：
${recent}

技術指標：${ind}

請回覆 JSON：
{
  "action": "long" | "short" | "close" | "hold",
  "lots": 1-5 口（開倉時；close 時忽略；hold 時忽略）,
  "stopLoss": 停損點數（相對進場價，如 80）,
  "takeProfit": 停利點數（相對進場價，如 120）,
  "reason": "中文 40 字以內說明原因"
}

規則：
- 若已有持倉只能回 close 或 hold
- 若無持倉只能回 long / short / hold
- 風險管理：單筆虧損不超過餘額 5%
- 沒有明確訊號時選 hold
- 只輸出 JSON，前後不要加任何文字或 markdown`;
}

async function callClaude(prompt) {
  const key = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('CLAUDE_API_KEY missing');
  const model = 'claude-sonnet-4-6';
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Claude ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const json = await resp.json();
  const raw = json.content?.[0]?.text || '';
  return { raw, model };
}

async function callGrok(prompt) {
  const key = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!key) throw new Error('GROK_API_KEY missing');

  // 先撈這支 key 能用的模型清單
  let models = [];
  try {
    const mr = await fetch('https://api.x.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (mr.ok) {
      const mj = await mr.json();
      models = (mj.data || []).map(m => m.id).filter(Boolean);
    }
  } catch {}

  // 依偏好排序，沒撈到就用預設清單
  const preferred = ['grok-4-fast-reasoning', 'grok-4-fast-non-reasoning', 'grok-4', 'grok-3-mini-fast', 'grok-3-mini', 'grok-3-fast', 'grok-3', 'grok-2-1212', 'grok-beta'];
  const ordered = models.length
    ? [...preferred.filter(m => models.includes(m)), ...models.filter(m => !preferred.includes(m))]
    : preferred;

  let lastErr = '';
  for (const model of ordered) {
    const resp = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });
    if (resp.ok) {
      const json = await resp.json();
      const raw = json.choices?.[0]?.message?.content || '';
      return { raw, model };
    }
    const txt = await resp.text();
    lastErr = `${resp.status} (${model}): ${txt.slice(0, 200)}`;
    if (resp.status === 401) break; // key 無效，不用再試
  }
  throw new Error(`Grok all models failed. Tried: ${ordered.slice(0,5).join(',')}. Last: ${lastErr}`);
}

function parseSignal(raw) {
  const text = String(raw).trim();
  // try direct JSON parse
  let j;
  try { j = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI did not return JSON: ' + text.slice(0, 120));
    j = JSON.parse(m[0]);
  }
  const action = String(j.action || 'hold').toLowerCase();
  const lots = Math.max(1, Math.min(5, parseInt(j.lots) || 1));
  const stopLoss = Math.max(10, Math.min(500, parseFloat(j.stopLoss) || 80));
  const takeProfit = Math.max(10, Math.min(1000, parseFloat(j.takeProfit) || 120));
  const reason = String(j.reason || '').slice(0, 80);
  if (!['long', 'short', 'close', 'hold'].includes(action)) {
    return { action: 'hold', lots, stopLoss, takeProfit, reason: `未知動作 ${action}` };
  }
  return { action, lots, stopLoss, takeProfit, reason };
}

function r(n) {
  const v = parseFloat(n);
  if (!Number.isFinite(v)) return 'null';
  return Math.round(v * 100) / 100;
}

function formatTime(ts) {
  const d = new Date(ts * 1000);
  return `${d.getUTCHours() + 8}:${String(d.getUTCMinutes()).padStart(2, '0')}`.replace(/^(\d):/, '0$1:');
}
