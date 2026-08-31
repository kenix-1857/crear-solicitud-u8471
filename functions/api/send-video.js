export async function onRequestPost(context) {
  const { request, env } = context;
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
