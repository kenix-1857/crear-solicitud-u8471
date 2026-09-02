export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const update = await request.json();
    if (!update.callback_query) return new Response('No callback query', { status: 200 });

    const callbackQuery = update.callback_query;
    const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
    const BIN_ID = env.JSONBIN_BIN_ID;
    const API_KEY = env.JSONBIN_API_KEY;

    if (!BOT_TOKEN) return new Response('Missing bot token', { status: 200 });

    let sessionId = 'unknown';
    let action = 'unknown';
    let buttonLabel = 'Acción registrada';

    try {
      const data = JSON.parse(callbackQuery.data);
      sessionId = data.id || sessionId;
      action = data.action || callbackQuery.data;
      buttonLabel = action;
    } catch (e) {
      action = callbackQuery.data;
      buttonLabel = action;
    }

    try {
      if (callbackQuery.message && callbackQuery.message.reply_markup && callbackQuery.message.reply_markup.inline_keyboard) {
        const keyboard = callbackQuery.message.reply_markup.inline_keyboard;
        for (const row of keyboard) {
          for (const btn of row) {
            let btnAction = btn.callback_data;
            try {
              let parsed = JSON.parse(btn.callback_data);
              btnAction = parsed.action || parsed.id;
            } catch (ex) {}
            if (btnAction === action || btn.callback_data === callbackQuery.data) {
              buttonLabel = btn.text;
            }
          }
        }
      }
    } catch (e) { }

    if (BIN_ID && API_KEY && sessionId !== 'unknown') {
      context.waitUntil((async () => {
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
      })());
    }

    if (callbackQuery.message) {
      const messageId = callbackQuery.message.message_id;
      const chatId = callbackQuery.message.chat.id;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
      });
    }

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQuery.id, text: 'Selección registrada: ' + buttonLabel })
    });

    return new Response('OK', { status: 200 });
  } catch (e) {
    return new Response('OK', { status: 200 });
  }
}
