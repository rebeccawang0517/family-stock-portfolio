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
  const { symbol, price, bars = [], indicators = {}, position = null, balance = 0, session = {}, swing = {}, atr = null, distMa = {}, dailyPnl = null } = ctx;
  const recent = bars.slice(-20).map(b => `${formatTime(b.time)}: O=${r(b.open)} H=${r(b.high)} L=${r(b.low)} C=${r(b.close)} V=${b.volume || 0}`).join('\n');
  const ind = Object.entries(indicators).map(([k, v]) => `${k}=${r(v)}`).join(', ');
  const pos = position
    ? `目前持倉：${position.side === 'long' ? '多單' : '空單'} ${position.lots} 口 @ ${r(position.entryPrice)}，未實現 ${r(position.unrealizedPnl)} 元`
    : '目前無持倉';

  const sessionLine = `當日：開${r(session.open)} 高${r(session.high)} 低${r(session.low)} 振幅${r((session.high||0)-(session.low||0))}點`;
  const swingLine = `近 60 根 5 分 K 擺動高/低：${r(swing.high)} / ${r(swing.low)}`;
  const atrLine = atr != null ? `ATR(14) 5 分 K：${r(atr)} 點` : '';
  const distLine = `距 MA20：${r(distMa.ma20)} 點　距 MA60：${r(distMa.ma60)} 點`;
  const pnlLine = dailyPnl != null ? `今日已實現損益：${r(dailyPnl)} 元` : '';

  return `你是台指期當沖交易員，極度保守紀律嚴明。停損停利由系統固定（停損 150 點、停利 300 點），你只負責決定方向。必須只輸出 JSON。

商品：${symbol}（台指期近一，1 點 = 200 元）
當前價格：${r(price)}
帳戶餘額：${r(balance)} 元
${pnlLine}
${pos}

${sessionLine}
${swingLine}
${atrLine}
${distLine}

最近 20 根 5 分 K：
${recent}

技術指標：${ind}

請回覆 JSON：
{
  "action": "long" | "short" | "close" | "hold",
  "lots": 1-3 口（開倉時；close/hold 時忽略）,
  "confidence": 0-100（你對此判斷的信心）,
  "reason": "中文 40 字以內，明確說出觸發此判斷的具體訊號（哪個指標、哪個價位、哪個型態）"
}

決策規則（嚴格遵守）：
1. **預設 hold**。除非出現明確訊號（多項指標同向 / 突破前波高低 / 均線金叉死叉伴隨成交量放大）否則一律 hold
2. confidence 必須 ≥ 70 才可開倉，< 70 強制 hold
3. 已有持倉只能回 close 或 hold（不可加倉、不可反手）
4. 無持倉只能回 long / short / hold
5. 若價格在 MA20 ±20 點內震盪、ATR 偏小、無明顯趨勢 → 一律 hold
6. 若今日已實現損益 < -10000 元 → 一律 hold（當日停損）
7. 只輸出 JSON，前後不要加任何文字或 markdown`;
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

// 統一停損停利：由系統固定，不讓 AI 自由發揮
const FIXED_STOP_LOSS = 150;
const FIXED_TAKE_PROFIT = 300;
const MIN_CONFIDENCE = 70;

function parseSignal(raw) {
  const text = String(raw).trim();
  let j;
  try { j = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI did not return JSON: ' + text.slice(0, 120));
    j = JSON.parse(m[0]);
  }
  let action = String(j.action || 'hold').toLowerCase();
  const lots = Math.max(1, Math.min(3, parseInt(j.lots) || 1));
  const confidence = Math.max(0, Math.min(100, parseFloat(j.confidence) || 0));
  let reason = String(j.reason || '').slice(0, 80);

  if (!['long', 'short', 'close', 'hold'].includes(action)) {
    action = 'hold'; reason = `未知動作 ${action}`;
  }
  // 信心不足強制 hold
  if ((action === 'long' || action === 'short') && confidence < MIN_CONFIDENCE) {
    return { action: 'hold', lots, stopLoss: FIXED_STOP_LOSS, takeProfit: FIXED_TAKE_PROFIT, confidence, reason: `信心 ${confidence} < ${MIN_CONFIDENCE}：${reason}` };
  }
  return { action, lots, stopLoss: FIXED_STOP_LOSS, takeProfit: FIXED_TAKE_PROFIT, confidence, reason };
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
