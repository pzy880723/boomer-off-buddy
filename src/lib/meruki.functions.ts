import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  decryptPassword,
  encryptPassword,
  fetchInProgressOrders,
  loginMeruki,
} from "./meruki.server";
import { computeCompleteness } from "./japan-parcel.helpers";

type AccountRow = Record<string, unknown> & {
  id: string;
  username: string;
  display_name: string | null;
  last_login_status: string | null;
  last_login_at: string | null;
  last_error: string | null;
  has_cookie: boolean;
};

function sanitizeAccount(row: Record<string, unknown>): AccountRow {
  const { password_encrypted: _p, session_cookie: _c, ...rest } = row;
  return { ...(rest as AccountRow), has_cookie: !!_c };
}

export const listMerukiAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("meruki_accounts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { rows: (data ?? []).map(sanitizeAccount) };
});

export const createMerukiAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        username: z.string().min(1),
        password: z.string().min(1).optional(),
        cookie: z.string().optional(),
        display_name: z.string().optional(),
      })
      .refine((v) => v.password || v.cookie, { message: "需要密码或 Cookie" })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const password_encrypted = data.password
      ? await encryptPassword(data.password)
      : "x:";
    let session_cookie: string | null = data.cookie ?? null;
    let last_login_status: string | null = null;
    let last_error: string | null = null;
    let last_login_at: string | null = null;

    if (data.password && !session_cookie) {
      const r = await loginMeruki(data.username, data.password);
      if (r.ok && r.cookie) {
        session_cookie = r.cookie;
        last_login_status = "ok";
        last_login_at = new Date().toISOString();
      } else {
        last_login_status = r.needsCaptcha ? "captcha" : "failed";
        last_error = r.reason ?? null;
      }
    } else if (session_cookie) {
      last_login_status = "ok";
      last_login_at = new Date().toISOString();
    }

    const { data: row, error } = await supabaseAdmin
      .from("meruki_accounts")
      .insert({
        username: data.username,
        password_encrypted,
        display_name: data.display_name ?? null,
        session_cookie,
        last_login_status,
        last_login_at,
        last_error,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row: sanitizeAccount(row), warning: last_error };
  });

export const updateMerukiAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        password: z.string().optional(),
        cookie: z.string().optional(),
        display_name: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const patch: {
      password_encrypted?: string;
      session_cookie?: string | null;
      display_name?: string | null;
    } = {};
    if (data.password) patch.password_encrypted = await encryptPassword(data.password);
    if (data.cookie !== undefined) patch.session_cookie = data.cookie || null;
    if (data.display_name !== undefined) patch.display_name = data.display_name;
    const { data: row, error } = await supabaseAdmin
      .from("meruki_accounts")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row: sanitizeAccount(row) };
  });

export const deleteMerukiAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("meruki_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testMerukiLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: acc, error } = await supabaseAdmin
      .from("meruki_accounts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const password = await decryptPassword(acc.password_encrypted);
    const r = await loginMeruki(acc.username, password);
    await supabaseAdmin
      .from("meruki_accounts")
      .update({
        last_login_status: r.ok ? "ok" : r.needsCaptcha ? "captcha" : "failed",
        last_login_at: r.ok ? new Date().toISOString() : acc.last_login_at,
        last_error: r.reason ?? null,
        session_cookie: r.cookie ?? acc.session_cookie,
      })
      .eq("id", data.id);
    return { ok: r.ok, reason: r.reason };
  });

export const syncMerukiOrders = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: acc, error } = await supabaseAdmin
      .from("meruki_accounts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const { data: run } = await supabaseAdmin
      .from("meruki_sync_runs")
      .insert({ account_id: data.id, status: "running" })
      .select()
      .single();

    let cookie = acc.session_cookie as string | null;
    try {
      // re-login if no cookie
      if (!cookie && acc.password_encrypted) {
        const password = await decryptPassword(acc.password_encrypted);
        const r = await loginMeruki(acc.username, password);
        if (!r.ok || !r.cookie)
          throw new Error(r.reason ?? "无法登录 meruki，请先在账号管理中粘贴 Cookie");
        cookie = r.cookie;
        await supabaseAdmin
          .from("meruki_accounts")
          .update({ session_cookie: cookie, last_login_at: new Date().toISOString(), last_login_status: "ok" })
          .eq("id", data.id);
      }
      if (!cookie) throw new Error("账号无可用 Cookie，请先粘贴 Cookie 或填写正确密码");

      const orders = await fetchInProgressOrders(cookie);
      let inserted = 0;
      let updated = 0;
      for (const o of orders) {
        const completeness = computeCompleteness(o);
        const { data: existing } = await supabaseAdmin
          .from("japan_parcels")
          .select("id")
          .eq("account_id", data.id)
          .eq("source_order_no", o.source_order_no)
          .maybeSingle();
        if (existing?.id) {
          await supabaseAdmin
            .from("japan_parcels")
            .update({ ...o, completeness })
            .eq("id", existing.id);
          updated++;
        } else {
          await supabaseAdmin
            .from("japan_parcels")
            .insert({ ...o, account_id: data.id, completeness });
          inserted++;
        }
      }
      await supabaseAdmin
        .from("meruki_sync_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          fetched_count: orders.length,
          inserted_count: inserted,
          updated_count: updated,
        })
        .eq("id", run!.id);
      return { ok: true, fetched: orders.length, inserted, updated };
    } catch (e) {
      const msg = (e as Error).message;
      await supabaseAdmin
        .from("meruki_sync_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), message: msg })
        .eq("id", run!.id);
      return { ok: false, reason: msg };
    }
  });

export const listSyncRuns = createServerFn({ method: "GET" })
  .inputValidator((input: { account_id: string }) =>
    z.object({ account_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("meruki_sync_runs")
      .select("*")
      .eq("account_id", data.account_id)
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
