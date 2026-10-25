import { KVNamespace, R2Bucket, PagesFunction } from "@cloudflare/workers-types";
import { isAllowedOrigin } from "./share";

interface Env {
  ORBAT_SCENARIO_BUCKET: R2Bucket;
  LIMITER_KV: KVNamespace;
  UPLOAD_SECRET: string;
}

/** Audio types a narration may be stored as (browser recordings and common uploads). */
const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const HOURLY_LIMIT = 60;
const KEY_PATTERN = /^narration\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/;

/**
 * Event narration clips, kept in the share bucket under `narration/`.
 *
 * POST an audio body (same origin and secret checks as /share) to get back
 * `{ id, url }`; GET `/media?id=<id>` serves it, with byte ranges for Safari.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const origin = request.headers.get("Origin");
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : "https://orbat-mapper.app";

  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range, X-ORBAT-SECRET",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if ((request.method === "GET" || request.method === "HEAD") && id) {
    if (!KEY_PATTERN.test(id)) return json({ error: "Not Found" }, 404);
    const object = await env.ORBAT_SCENARIO_BUCKET.get(id, { range: request.headers });
    if (!object) return json({ error: "Not Found" }, 404);

    const headers = new Headers(corsHeaders);
    object.writeHttpMetadata(headers as any);
    headers.set("ETag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    const range = object.range as { offset?: number; length?: number; suffix?: number };
    let status = 200;
    if (request.headers.has("Range") && range) {
      const offset =
        range.suffix !== undefined ? object.size - range.suffix : (range.offset ?? 0);
      const length = range.suffix ?? range.length ?? object.size - offset;
      headers.set(
        "Content-Range",
        `bytes ${offset}-${offset + length - 1}/${object.size}`,
      );
      headers.set("Content-Length", String(length));
      status = 206;
    } else {
      headers.set("Content-Length", String(object.size));
    }
    const body = request.method === "HEAD" ? null : (object as any).body;
    return new Response(body, { status, headers });
  }

  if (request.method === "POST") {
    if (!isAllowedOrigin(origin)) {
      return new Response("Forbidden: Invalid Origin", { status: 403 });
    }
    if (request.headers.get("X-ORBAT-SECRET") !== env.UPLOAD_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim();
    const ext = AUDIO_TYPES[contentType];
    if (!ext) return json({ error: "Unsupported audio type." }, 415);

    const ratelimitKey = `media-limit:${ip}`;
    const usage = parseInt((await env.LIMITER_KV.get(ratelimitKey)) || "0");
    if (usage >= HOURLY_LIMIT) {
      return json({ error: "Hourly upload limit reached." }, 429);
    }

    const contentLength = parseInt(request.headers.get("content-length") || "0");
    if (contentLength > MAX_SIZE) return json({ error: "Audio is too large." }, 413);
    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_SIZE) return json({ error: "Audio is too large." }, 413);
    if (body.byteLength === 0) return json({ error: "Empty upload." }, 400);

    const key = `narration/${crypto.randomUUID()}.${ext}`;
    await env.ORBAT_SCENARIO_BUCKET.put(key, body, {
      httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
    });
    await env.LIMITER_KV.put(ratelimitKey, (usage + 1).toString(), {
      expirationTtl: 3600,
    });
    return json({ id: key, url: `${url.origin}/media?id=${key}` });
  }

  return new Response("Method not allowed", { status: 405 });
};
