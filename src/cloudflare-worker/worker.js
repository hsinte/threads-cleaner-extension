/**
 * Threads Cleaner 的意見回饋後端。
 *
 * 部署方式:
 * 1. Cloudflare Dashboard → Workers & Pages → 建立一個 Worker,
 *    把這個檔案的內容整個貼進線上編輯器,儲存並部署。
 * 2. 到這個 Worker 的 Settings → Variables and Secrets,新增以下三個:
 *      MAILGUN_API_KEY (Secret) — Mailgun 帳號設定裡的 Private API Key
 *      MAILGUN_DOMAIN  (純文字即可) — 例如 sandbox76ea6ec567504dd48dfa6a7723ec36a4.mailgun.org
 *      NOTIFY_EMAIL    (純文字即可) — 你在 Mailgun 設定的 Authorized Recipient,
 *                                    也就是實際收信的信箱
 *
 * 這三個值都不會出現在擴充功能的程式碼裡,只存在 Cloudflare 後台。
 */

const VALID_TYPES = ["提供名單", "問題回報", "意見回饋"];
const TYPE_WITHOUT_REQUIRED_DESCRIPTION = "提供名單";

//
// 跟 popup 端的 MAX_ATTACHMENT_BASE64_LENGTH 對齊,伺服器端也要擋一次,
// 不能只靠前端擋(前端的檢查繞得過去)
//
const MAX_ATTACHMENT_BASE64_LENGTH = 4_000_000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function buildEmailBody({ type, description, email }) {
  const lines = [`類型:${type}`, "", "描述:", description || "(未填寫)"];

  if (email) {
    lines.push("", `聯絡信箱:${email}`);
  }

  return lines.join("\n");
}

async function sendViaMailgun(env, { type, description, email, attachment }) {
  const form = new FormData();

  form.append("from", `Threads Cleaner <postmaster@${env.MAILGUN_DOMAIN}>`);
  form.append("to", env.NOTIFY_EMAIL);
  form.append("subject", `[Threads Cleaner] ${type}`);
  form.append("text", buildEmailBody({ type, description, email }));

  if (attachment) {
    const bytes = base64ToBytes(attachment.base64);
    const filename =
      typeof attachment.filename === "string" && attachment.filename
        ? attachment.filename
        : "attachment";
    const mimeType =
      typeof attachment.mimeType === "string"
        ? attachment.mimeType
        : "application/octet-stream";

    form.append("attachment", new File([bytes], filename, { type: mimeType }));
  }

  return fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
    },
    body: form,
  });
}

function validatePayload(payload) {
  const type = typeof payload.type === "string" ? payload.type : "";
  const description =
    typeof payload.description === "string" ? payload.description.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const attachment =
    payload.attachment && typeof payload.attachment === "object"
      ? payload.attachment
      : null;

  if (!VALID_TYPES.includes(type)) {
    return { error: "類型不正確" };
  }

  if (type !== TYPE_WITHOUT_REQUIRED_DESCRIPTION && description.length === 0) {
    return { error: "描述為必填" };
  }

  if (
    attachment &&
    typeof attachment.base64 === "string" &&
    attachment.base64.length > MAX_ATTACHMENT_BASE64_LENGTH
  ) {
    return { error: "附件過大" };
  }

  return { data: { type, description, email, attachment } };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method Not Allowed" }, 405);
    }

    let payload;

    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "無效的請求內容" }, 400);
    }

    const { data, error } = validatePayload(payload);

    if (error) {
      return jsonResponse({ ok: false, error }, 400);
    }

    let mailgunResponse;

    try {
      mailgunResponse = await sendViaMailgun(env, data);
    } catch {
      return jsonResponse({ ok: false, error: "寄送失敗,請稍後再試" }, 502);
    }

    if (!mailgunResponse.ok) {
      return jsonResponse({ ok: false, error: "寄送失敗,請稍後再試" }, 502);
    }

    return jsonResponse({ ok: true });
  },
};
