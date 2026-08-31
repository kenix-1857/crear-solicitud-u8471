const payload = {
  callback_query: {
    id: "12345",
    data: JSON.stringify({ id: "testsession", action: "correct" }),
    message: {
      message_id: 123,
      chat: { id: -1003366055980 },
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Correcto", callback_data: JSON.stringify({ id: "testsession", action: "correct" }) }
          ]
        ]
      }
    }
  }
};
fetch("https://mi-solicitud-card-2341.pages.dev/api/telegram-webhook", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
}).then(r => r.text()).then(t => console.log("RES:", t)).catch(console.error);
