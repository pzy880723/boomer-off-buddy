// Server-only helpers for meruki login + scraping. Do NOT import from client code.
import { parseHTML } from "linkedom";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeCompleteness, type ParcelInput } from "./japan-parcel.helpers";

const MERUKI_BASE = "https://www.meruki.cn";

// --- Password encryption (pgcrypto via SQL functions) ---
export async function encryptPassword(plain: string): Promise<string> {
  const key = process.env.MERUKI_ENC_KEY;
  if (!key) throw new Error("MERUKI_ENC_KEY not configured");
  // Use pgcrypto by inserting into a tmp expression — call via RPC-like raw SQL
  const { data, error } = await supabaseAdmin
    .rpc("encrypt_meruki_password" as never, { plain, key } as never);
  if (!error && data) return data as string;
  // Fallback: simple xor+base64 (keeps the secret out of plaintext storage even if pgcrypto wrapper missing)
  return "x:" + Buffer.from(xor(plain, key)).toString("base64");
}

export async function decryptPassword(stored: string): Promise<string> {
  const key = process.env.MERUKI_ENC_KEY;
  if (!key) throw new Error("MERUKI_ENC_KEY not configured");
  if (stored.startsWith("x:")) {
    return xor(Buffer.from(stored.slice(2), "base64").toString("binary"), key);
  }
  const { data, error } = await supabaseAdmin
    .rpc("decrypt_meruki_password" as never, { ciphertext: stored, key } as never);
  if (error) throw error;
  return data as string;
}

function xor(s: string, key: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += String.fromCharCode(s.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

// --- meruki HTTP ---
const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

export interface LoginResult {
  ok: boolean;
  cookie?: string;
  reason?: string;
  needsCaptcha?: boolean;
}

export async function loginMeruki(username: string, password: string): Promise<LoginResult> {
  // NOTE: meruki's exact login endpoint requires browser session reverse-engineering.
  // We attempt a generic form POST and surface a friendly error if the site requires
  // captcha / a JS-signed token. Users can fall back to pasting a cookie manually.
  try {
    const body = new URLSearchParams({ username, password, account: username, pwd: password });
    const res = await fetch(`${MERUKI_BASE}/personal/login`, {
      method: "POST",
      headers: {
        ...COMMON_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${MERUKI_BASE}/personal/login`,
      },
      body,
      redirect: "manual",
    });

    const setCookie = res.headers.get("set-cookie") ?? "";
    if (setCookie && /sessionid|JSESSIONID|PHPSESSID|token/i.test(setCookie)) {
      const cookie = parseSetCookie(setCookie);
      return { ok: true, cookie };
    }

    const text = await res.text().catch(() => "");
    if (/captcha|验证码|滑动|geetest/i.test(text)) {
      return { ok: false, reason: "站点要求验证码，请改用 Cookie 方式", needsCaptcha: true };
    }
    return {
      ok: false,
      reason: `登录未返回 session（HTTP ${res.status}）。建议手动粘贴 Cookie。`,
    };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

function parseSetCookie(raw: string): string {
  return raw
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

export interface ScrapedParcel extends ParcelInput {
  source_order_no: string;
}

export async function fetchInProgressOrders(cookie: string): Promise<ScrapedParcel[]> {
  const res = await fetch(`${MERUKI_BASE}/personal/order/inProgress`, {
    method: "GET",
    headers: { ...COMMON_HEADERS, Cookie: cookie, Referer: `${MERUKI_BASE}/personal/index` },
  });
  if (!res.ok) throw new Error(`meruki HTTP ${res.status}`);
  const html = await res.text();
  return parseInProgressHtml(html);
}

export function parseInProgressHtml(html: string): ScrapedParcel[] {
  const { document } = parseHTML(html);
  const out: ScrapedParcel[] = [];

  // Heuristic selectors — adapt to actual meruki DOM after first capture.
  const cards = document.querySelectorAll(
    ".order-item, .order-list .item, [class*='order'][class*='item']",
  );
  cards.forEach((card, idx) => {
    const text = (sel: string) => card.querySelector(sel)?.textContent?.trim() ?? "";
    const attr = (sel: string, a: string) =>
      (card.querySelector(sel) as HTMLElement | null)?.getAttribute(a) ?? "";

    const orderNo =
      text("[class*='order-no']") ||
      text("[class*='orderNo']") ||
      text(".order-id") ||
      `meruki-${Date.now()}-${idx}`;

    const title = text(".title, [class*='title'], .goods-name");
    const image = attr("img", "src");
    const seller = text("[class*='seller'], [class*='shop']");
    const priceText = text("[class*='price']");
    const price = parseFloat(priceText.replace(/[^\d.]/g, "")) || null;
    const status = text("[class*='status']");
    const warehouse = text("[class*='warehouse'], [class*='location']");

    const parcel: ScrapedParcel = {
      source: "meruki",
      source_order_no: orderNo,
      item_title: title || null,
      item_image_url: image || null,
      seller: seller || null,
      price_jpy: price,
      total_jpy: price,
      warehouse_location: warehouse || null,
      status: mapMerukiStatus(status),
      notes: status || null,
    };
    out.push(parcel);
  });

  return out;
}

function mapMerukiStatus(raw: string): string {
  if (!raw) return "paid";
  if (/竞拍|出价/.test(raw)) return "bidding";
  if (/付款|已支付/.test(raw)) return "paid";
  if (/入库|仓库/.test(raw)) return "warehouse_jp";
  if (/国际|发货/.test(raw)) return "shipping_intl";
  if (/清关/.test(raw)) return "customs";
  if (/派送|国内/.test(raw)) return "shipping_cn";
  if (/签收|完成/.test(raw)) return "delivered";
  return "paid";
}

export function withCompleteness<T extends ParcelInput>(p: T): T & { completeness: number } {
  return { ...p, completeness: computeCompleteness(p) };
}
