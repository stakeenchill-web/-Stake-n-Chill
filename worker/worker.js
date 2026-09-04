const cors = origin => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Vary": "Origin"
});

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" }
  });
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function github(path, env, options = {}) {
  return fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`,
    {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Stake-n-Chill-Admin",
        ...(options.headers || {})
      }
    }
  );
}

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://stake-n-chill.onrender.com";
    const headers = cors(requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin);
    const path = new URL(request.url).pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (path !== "/publish" && path !== "/auth") {
      return new Response("Not found", { status: 404, headers });
    }

    if (request.method !== "POST") {
      return json({ error: "POST required" }, 405, headers);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, headers);
    }

    if (path === "/auth") {
      if (body.password !== env.ADMIN_PASSWORD) {
        return json({ error: "Unauthorized" }, 401, headers);
      }
      return json({ ok: true }, 200, headers);
    }

    if (request.headers.get("Authorization") !== `Bearer ${env.ADMIN_PASSWORD}`) {
      return json({ error: "Unauthorized" }, 401, headers);
    }

    if (!body.data || !Array.isArray(body.data.days)) {
      return json({ error: "Invalid tips data" }, 400, headers);
    }

    const current = await github("tips.json", env);
    if (!current.ok) {
      return json({ error: "GitHub read failed" }, 502, headers);
    }

    const oldFile = await current.json();
    const content = JSON.stringify(body.data, null, 2) + "\n";
    const updated = await github("tips.json", env, {
      method: "PUT",
      body: JSON.stringify({
        message: "Update tips via Stake-n-Chill Admin",
        content: encodeBase64(content),
        sha: oldFile.sha,
        branch: env.GITHUB_BRANCH || "main"
      })
    });
    const result = await updated.json();

    if (!updated.ok) {
      return json({ error: result.message || "GitHub update failed" }, 502, headers);
    }

    return json({ ok: true }, 200, headers);
  }
};
