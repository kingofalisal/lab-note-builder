import { kv } from "@vercel/kv";

export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "visit") {
      await kv.incr("lab:visitors");
    } else if (action === "note") {
      await kv.incr("lab:notes");
    }

    const [visitors, notes] = await Promise.all([
      kv.get("lab:visitors"),
      kv.get("lab:notes"),
    ]);

    return new Response(
      JSON.stringify({ visitors: visitors || 0, notes: notes || 0 }),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    // If KV not configured yet, return zeros gracefully
    return new Response(
      JSON.stringify({ visitors: 0, notes: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
