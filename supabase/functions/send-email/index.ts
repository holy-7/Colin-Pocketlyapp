// ============================================================
// Send Email Hook — Supabase Auth Hook（官方标准实现）
// 参考: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
// 使用 Resend API 发送邮件，standardwebhooks 验证签名
// ============================================================

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Colin记账 <noreply@send.colin7.me>";

const resend = new Resend(RESEND_API_KEY);

interface EmailPayload {
  user: {
    email: string;
    new_email?: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

// 构建重置密码链接：优先用客户端 redirect_to，回退则用 siteUrl 的 origin
function getSafeRedirectUrl(redirect_to: string, siteUrl: string): string {
  if (redirect_to) {
    try {
      const parsed = new URL(redirect_to);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return redirect_to;
      }
    } catch { /* ignore */ }
    if (redirect_to.startsWith('/')) {
      return siteUrl.replace(/\/+$/, '') + redirect_to;
    }
  }
  // 回退：用 siteUrl 的 origin 拼接 /#/login
  try {
    const parsed = new URL(siteUrl);
    return `${parsed.origin}/#/login`;
  } catch {
    return siteUrl;
  }
}

// HTML 属性转义（防止 <a href> 属性注入）
function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 邮件模板
function buildEmail(email_data: EmailPayload["email_data"]) {
  const actionType = email_data.email_action_type;
  const token = email_data.token;
  const siteUrl = email_data.site_url;
  const redirectTo = getSafeRedirectUrl(email_data.redirect_to, siteUrl);

  console.log('send-email hook:', JSON.stringify({
    actionType,
    redirect_to: email_data.redirect_to,
    siteUrl,
    redirectTo,
  }));

  // 构建密码重置链接（redirectTo 可能不带 hash 路由，统一补上 #/login）
  const recoveryBase = redirectTo.replace(/\/+$/, '');
  const resetLink = `${recoveryBase}/#/login?token_hash=${email_data.token_hash}&type=recovery`;
  const safeLink = escapeAttr(resetLink);

  switch (actionType) {
    case "signup":
      return {
        subject: "Colin记账 - 邮箱验证码",
        html: `<div style="max-width:480px;margin:0 auto;padding:32px;font-family:Arial,sans-serif">
          <h2 style="color:#333;margin-bottom:16px">验证你的邮箱</h2>
          <p style="color:#666;font-size:15px">感谢注册 Colin记账！请使用以下验证码完成注册：</p>
          <div style="background:#FFF8E1;border-radius:8px;padding:20px;text-align:center;margin:24px 0">
            <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#333">${token}</span>
          </div>
          <p style="color:#999;font-size:13px">验证码 24 小时内有效，请勿泄露给他人。</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#bbb;font-size:12px;text-align:center">Colin记账 · 你的智能记账助手</p>
        </div>`,
      };

    case "recovery":
      return {
        subject: "Colin记账 - 重置密码",
        html: `<div style="max-width:480px;margin:0 auto;padding:32px;font-family:Arial,sans-serif">
          <h2 style="color:#333;margin-bottom:16px">重置你的密码</h2>
          <p style="color:#666;font-size:15px">点击下方按钮设置新密码：</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${safeLink}" style="display:inline-block;background:#FFD93D;color:#333;padding:12px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold">重置密码</a>
          </div>
          <p style="color:#999;font-size:13px">如果你没有请求重置密码，请忽略此邮件。</p>
        </div>`,
      };

    default:
      return {
        subject: `Colin记账 - 验证码`,
        html: `<p>你的验证码是：<strong>${token}</strong></p>`,
      };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. 验证 webhook 签名（确保请求来自 Supabase Auth）
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    const wh = new Webhook(HOOK_SECRET.replace("v1,whsec_", ""));
    const { user, email_data } = wh.verify(payload, headers) as EmailPayload;

    // 2. 构建邮件内容
    const { subject, html } = buildEmail(email_data);

    // 3. 通过 Resend 发送
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [user.email],
      subject,
      html,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send email hook error:", err);
    return new Response(
      JSON.stringify({
        error: {
          http_code: err instanceof Error ? 500 : 401,
          message: err instanceof Error ? err.message : "Unauthorized",
        },
      }),
      {
        status: err instanceof Error ? 500 : 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
