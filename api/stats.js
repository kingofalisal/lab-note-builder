export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!kvUrl || !kvToken) {
    return new Response(
      JSON.stringify({ visitors: 0, notes: 0, error: "KV not configured" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  async function kvCmd(command) {
    const res = await fetch(`${kvUrl}/${command}`, {
      headers: { Authorization: `Bearer ${kvToken}` }
    });
    const data = await res.json();
    return data.result;
  }

  try {
    if (action === "visit") await kvCmd("incr/lab:visitors");
    else if (action === "note") await kvCmd("incr/lab:notes");

    const [visitors, notes] = await Promise.all([
      kvCmd("get/lab:visitors"),
      kvCmd("get/lab:notes"),
    ]);

    return new Response(
      JSON.stringify({ visitors: visitors || 0, notes: notes || 0 }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ visitors: 0, notes: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
