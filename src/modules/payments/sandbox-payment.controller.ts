import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  SandboxProvider,
  type SandboxSession,
} from './gateways/sandbox.provider';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

/** Development-only payment page for SandboxProvider. 404 in production. */
@ApiExcludeController()
@Controller('payments/sandbox')
export class SandboxPaymentController {
  constructor(private readonly sandbox: SandboxProvider) {}

  @Get(':authority')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http: https:; base-uri 'none'; frame-ancestors 'none'",
  )
  page(@Param('authority') authority: string) {
    this.assertEnabled();
    return render(this.sandbox.getSession(authority));
  }

  @Post(':authority/pay')
  pay(@Param('authority') authority: string, @Res() res: Response) {
    this.assertEnabled();
    res.redirect(303, this.sandbox.decide(authority, 'paid'));
  }

  @Post(':authority/cancel')
  cancel(@Param('authority') authority: string, @Res() res: Response) {
    this.assertEnabled();
    res.redirect(303, this.sandbox.decide(authority, 'cancelled'));
  }

  private assertEnabled() {
    if (!this.sandbox.enabled) throw new NotFoundException();
  }
}

function render(session: SandboxSession) {
  const amount = session.amountToman.toLocaleString('fa-IR');
  const action = `/api/v1/payments/sandbox/${encodeURIComponent(session.authority)}`;
  const done = session.decision !== 'pending';
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>درگاه پرداخت آزمایشی</title>
<style>
  :root { color-scheme: light dark; --bg:#f5f5f7; --card:#fff; --fg:#1d1d1f; --muted:#6e6e73; --line:#e5e5ea; --brand:#7c3aed; --danger:#d70015; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111; --card:#1c1c1e; --fg:#f5f5f7; --muted:#a1a1a6; --line:#2c2c2e; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:var(--bg); color:var(--fg); font: 15px/1.6 system-ui, Tahoma, sans-serif; }
  main { width:100%; max-width:384px; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:20px; }
  .badge { display:inline-block; font-size:12px; padding:2px 8px; border-radius:999px; background:#fff4d6; color:#7a5200; }
  h1 { font-size:18px; margin:12px 0 4px; }
  p { margin:0; color:var(--muted); }
  dl { margin:16px 0; display:grid; grid-template-columns:auto 1fr; gap:8px 12px; }
  dt { color:var(--muted); } dd { margin:0; text-align:left; font-weight:600; overflow-wrap:anywhere; }
  form { margin:0; } .actions { display:grid; gap:8px; margin-top:16px; }
  button { width:100%; min-height:48px; border-radius:12px; border:0; font:inherit; font-weight:700; cursor:pointer; }
  .pay { background:var(--brand); color:#fff; } .cancel { background:transparent; color:var(--danger); border:1px solid var(--line); }
</style>
</head>
<body>
<main>
  <span class="badge">فقط محیط توسعه — پولی جابه‌جا نمی‌شود</span>
  <h1>درگاه پرداخت آزمایشی</h1>
  <p>${escapeHtml(session.description)}</p>
  <dl>
    <dt>مبلغ</dt><dd>${amount} تومان</dd>
    <dt>شناسه</dt><dd dir="ltr">${escapeHtml(session.authority)}</dd>
  </dl>
  ${
    done
      ? `<p>این پرداخت قبلاً ${session.decision === 'paid' ? 'تایید' : 'لغو'} شده است.</p>`
      : `<div class="actions">
    <form method="post" action="${action}/pay"><button class="pay" type="submit">پرداخت موفق</button></form>
    <form method="post" action="${action}/cancel"><button class="cancel" type="submit">انصراف از پرداخت</button></form>
  </div>`
  }
</main>
</body>
</html>`;
}
