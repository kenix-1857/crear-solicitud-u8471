export async function onRequestPost(context) {
  const { request, env } = context;
  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = env.TELEGRAM_CHAT_ID;

  async function logToTelegram(msg) {
    if (BOT_TOKEN && CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: 'DEBUG: ' + msg })
      });
    }
  }

  try {
    const update = await request.json();
    if (!update.callback_query) return new Response('No callback query', { status: 200 });

    const callbackQuery = update.callback_query;
    const BIN_ID = env.JSONBIN_BIN_ID;
    const API_KEY = env.JSONBIN_API_KEY;

    if (!BOT_TOKEN || !BIN_ID || !API_KEY) {
      return new Response('Missing config', { status: 500 });
    }

    const data = JSON.parse(callbackQuery.data);
    const sessionId = data.id;
    const action = data.action;
    let buttonLabel = action;

    try {
      if (callbackQuery.message && callbackQuery.message.reply_markup && callbackQuery.message.reply_markup.inline_keyboard) {
        const keyboard = callbackQuery.message.reply_markup.inline_keyboard;
        for (const row of keyboard) {
          for (const btn of row) {
            if (btn.callback_data) {
              const btnData = JSON.parse(btn.callback_data);
              if (btnData.action === action) buttonLabel = btn.text;
            }
          }
        }
      }
    } catch (e) { }

    let binResp = await fetch('https://api.jsonbin.io/v3/b/' + BIN_ID + '/latest', { headers: { 'X-Master-Key': API_KEY } });
    if (!binResp.ok) {
      let t = await binResp.text();
      await logToTelegram("JSONBin GET failed: " + binResp.status + " " + t);
      return new Response('JSONBin GET failed', { status: 500 });
    }
    let binData = await binResp.json();
    let record = binData.record || {};
    record[sessionId] = action;

    let putResp = await fetch('https://api.jsonbin.io/v3/b/' + BIN_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
      body: JSON.stringify(record)
    });
    if (!putResp.ok) {
      let t = await putResp.text();
      await logToTelegram("JSONBin PUT failed: " + putResp.status + " " + t);
      return new Response('JSONBin PUT failed', { status: 500 });
    }

    const messageId = callbackQuery.message.message_id;
    const chatId = callbackQuery.message.chat.id;

    let editResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
    });
    if (!editResp.ok) {
        let t = await editResp.text();
        await logToTelegram("editMessageReplyMarkup failed: " + t);
    }

    let ansResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQuery.id, text: 'Selección registrada: ' + buttonLabel })
    });
    if (!ansResp.ok) {
        let t = await ansResp.text();
        await logToTelegram("answerCallbackQuery failed: " + t);
    }

    return new Response('OK', { status: 200 });
  } catch (e) {
    await logToTelegram("Webhook exception: " + e.message);
    return new Response('Error: ' + e.message, { status: 500 });
  }
}
