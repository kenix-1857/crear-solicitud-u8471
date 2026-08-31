export async function onRequestPost(context) {
  const { request, env } = context;
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
