export async function onRequestPost(context) {
  const { request, env } = context;
  const clonedRequest = request.clone();
  const response = new Response('OK', { status: 200 });
  context.waitUntil(processWebhook(clonedRequest, env));
  return response;
}

async function processWebhook(request, env) {
  try {
    const update = await request.json();
    if (!update.callback_query) return;

    const callbackQuery = update.callback_query;
    const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
    const BIN_ID = env.JSONBIN_BIN_ID;
    const API_KEY = env.JSONBIN_API_KEY;
    if (!BOT_TOKEN || !BIN_ID || !API_KEY) return;

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
    let binData = await binResp.json();
    let record = binData.record || {};
    record[sessionId] = action;

    await fetch('https://api.jsonbin.io/v3/b/' + BIN_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
      body: JSON.stringify(record)
    });

    const messageId = callbackQuery.message.message_id;
    const chatId = callbackQuery.message.chat.id;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
    });

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQuery.id, text: 'Selección registrada: ' + buttonLabel })
    });
  } catch (e) { }
}

