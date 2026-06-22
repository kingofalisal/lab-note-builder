export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const { transcript, triggers } = await req.json();

  if (!transcript || !triggers) {
    return new Response(JSON.stringify({ error: "Missing transcript or triggers" }), { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500 });
  }

  const prompt = `You are a medical note assistant. A physician just spoke the following phrase:

"${transcript}"

Your job is to match this to exactly one item from the list of trigger phrases below, or return "none" if nothing is a reasonable match.

Trigger phrases:
${triggers}

Rules:
- Return ONLY the exact trigger phrase text from the list, with no punctuation changes, or the word "none"
- Match based on clinical meaning, not exact wording. For example "thyroid still low on medication" should match "TSH low on meds"
- If the physician's phrase could plausibly mean two different triggers, pick the most specific match
- Never invent a trigger that is not in the list
- Do not explain your answer, return only the matched phrase or "none"`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    return new Response(JSON.stringify({ error: `Anthropic API error: ${err}` }), { status: 500 });
  }

  const data = await response.json();
  const match = data.content?.[0]?.text?.trim() ?? "none";

  return new Response(JSON.stringify({ match }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
