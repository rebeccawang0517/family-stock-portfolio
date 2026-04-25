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

  // 支援前端傳 customPrompt 直接覆蓋（用於非交易訊號的分析請求，例如策略推薦）
  const prompt = (context && typeof context.customPrompt === 'string' && context.customPrompt)
    ? context.customPrompt
    : buildPrompt(context);
  const started = Date.now();
  let raw, model;
  try {
    if (ai === 'claude') {
      ({ raw, model } = await callClaude(prompt));
    } else if (ai === 'grok') {
      ({ raw, model } = await callGrok(prompt));
    } else if (ai === 'gemini') {
      ({ raw, model } = await callGemini(prompt));
    } else {
      return res.status(400).json({ error: 'unknown ai' });
    }
  } catch (e) {
    console.error(`[${ai}] api call failed:`, e);
    return res.status(500).json({ error: `API: ${e.message}`, ai, stage: 'api', latencyMs: Date.now() - started });
  }

  // 自訂 prompt 模式：不解析交易訊號 schema，直接回 raw
  if (context && context.customPrompt) {
    return res.status(200).json({ raw, model, latencyMs: Date.now() - started });
  }

  try {
    const parsed = parseSignal(raw);
    res.status(200).json({ ...parsed, model, latencyMs: Date.now() - started, raw });
  } catch (e) {
    console.error(`[${ai}] parse failed. raw=`, raw, 'err=', e);
    res.status(500).json({
      error: `PARSE: ${e.message}`,
      ai, stage: 'parse', model,
      rawPreview: String(raw || '').slice(0, 300),
      latencyMs: Date.now() - started
    });
  }
}

function buildPrompt(ctx) {
  const { symbol, price, bars = [], indicators = {}, position = null, balance = 0, session = {}, swing = {}, atr = null, distMa = {}, dailyPnl = null, triggerEvent = null, learnedRules = null, recentOwnTrades = null } = ctx;
  const recent = bars.slice(-20).map(b => `${formatTime(b.time)}: O=${r(b.open)} H=${r(b.high)} L=${r(b.low)} C=${r(b.close)}`).join('\n');
  const ind = Object.entries(indicators).map(([k, v]) => `${k}=${r(v)}`).join(', ');
  const pos = position
    ? `持倉：${position.side === 'long' ? '多' : '空'} ${position.lots} 口 @ ${r(position.entryPrice)}，未實現 ${r(position.unrealizedPnl)} 元`
    : '無持倉';

  const payload = {
    symbol, price: r(price), balance: r(balance), dailyPnl: r(dailyPnl),
    position: pos,
    session: `開${r(session.open)} 高${r(session.high)} 低${r(session.low)}`,
    swing60: `高${r(swing.high)} 低${r(swing.low)}`,
    atr14_5m: r(atr),
    distMa: `MA20 ${r(distMa.ma20)}, MA60 ${r(distMa.ma60)}`,
    indicators: ind,
    triggerEvent: triggerEvent || 'none',
    bars5m_last20: recent
  };

  const rulesBlock = learnedRules
    ? `\n本帳戶歷史交易勝率分析（可作為參考，不強制遵守）：\n${learnedRules}\n`
    : '';

  const recentBlock = recentOwnTrades
    ? `\n你最近 10 筆自己的交易（永久記憶，請從中學習成功與失敗的模式）：\n${recentOwnTrades}\n`
    : '';

  return `台指期近一（1 點 = 200 元）。以下是即時市場資料，自由判斷要不要交易。
${rulesBlock}${recentBlock}
${Object.entries(payload).map(([k,v]) => `${k}: ${v}`).join('\n')}

回覆 JSON（只回 JSON，不要 markdown）：
{
  "action": "long" | "short" | "close" | "hold",
  "lots": 數字,
  "stopLoss": 點數或 null,
  "takeProfit": 點數或 null,
  "reason": "中文簡短說明"
}`;
}

async function callClaude(prompt) {
  const key = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('CLAUDE_API_KEY missing');
  const model = 'claude-opus-4-7';
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
  const preferred = ['grok-4', 'grok-4-fast-reasoning', 'grok-4-fast-non-reasoning', 'grok-3-mini-fast', 'grok-3-mini', 'grok-3-fast', 'grok-3', 'grok-2-1212', 'grok-beta'];
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

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');

  // 先列可用模型
  let available = [];
  try {
    const mr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (mr.ok) {
      const mj = await mr.json();
      available = (mj.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => (m.name || '').replace(/^models\//, ''))
        .filter(Boolean);
    }
  } catch {}

  // 偏好順序：2.5 pro → 2.5 flash → 2.0 flash → flash-latest → 其他
  const preferred = [
    'gemini-2.5-pro', 'gemini-2.5-pro-latest', 'gemini-2.5-pro-preview-05-06',
    'gemini-2.5-flash', 'gemini-2.5-flash-latest', 'gemini-2.5-flash-preview-05-20',
    'gemini-flash-latest', 'gemini-pro-latest',
    'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-exp',
    'gemini-1.5-pro', 'gemini-1.5-pro-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'
  ];
  const ordered = available.length
    ? [...preferred.filter(m => available.includes(m)), ...available.filter(m => !preferred.includes(m) && !m.includes('embedding') && !m.includes('vision') && !m.includes('tts') && !m.includes('imagen'))]
    : preferred;

  if (!ordered.length) throw new Error('Gemini: 沒有可用模型（ListModels 也空）');

  let lastErr = '';
  for (const model of ordered) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 400,
          temperature: 0.7
        }
      })
    });
    if (resp.ok) {
      const json = await resp.json();
      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { raw, model };
    }
    const txt = await resp.text();
    lastErr = `${resp.status} (${model}): ${txt.slice(0, 150)}`;
    if (resp.status === 401 || resp.status === 403) break; // key 權限問題，不用再試
  }
  throw new Error(`Gemini all models failed. Tried: ${ordered.slice(0,5).join(',')}. Last: ${lastErr}`);
}

function parseSignal(raw) {
  const text = String(raw).trim();
  let j;
  try { j = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI did not return JSON: ' + text.slice(0, 120));
    j = JSON.parse(m[0]);
  }
  let action = String(j.action || 'hold').toLowerCase();
  if (!['long', 'short', 'close', 'hold'].includes(action)) action = 'hold';
  const lots = Math.max(1, Math.min(50, parseInt(j.lots) || 1)); // 50 口安全上限，前端再依實際保證金截
  const sl = parseFloat(j.stopLoss);
  const tp = parseFloat(j.takeProfit);
  const stopLoss = Number.isFinite(sl) && sl > 0 ? sl : null;
  const takeProfit = Number.isFinite(tp) && tp > 0 ? tp : null;
  const reason = String(j.reason || '').slice(0, 80);
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
