const payload = {
  update_id: 123456,
  callback_query: {
    id: "test",
    from: { id: 123, is_bot: false, first_name: "Test" },
    message: {
      message_id: 123,
      chat: { id: 123, type: "private" },
      reply_markup: {
        inline_keyboard: [[{ text: "Correcto", callback_data: "{\"id\":\"session123\",\"action\":\"correct\"}" }]]
      }
    },
    data: "{\"id\":\"session123\",\"action\":\"correct\"}"
  }
};

fetch("https://mi-solicitud-card-2341.pages.dev/api/telegram-webhook", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
}).then(r => r.text()).then(t => console.log("Response:", t)).catch(console.error);
