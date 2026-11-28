#!/usr/bin/env python3
import datetime as dt
import html
import json
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import quote

import bleach
import markdown


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
OUTPUT = ROOT / "_site"
BASE_URL = "https://garanggati.web.id"
WELLBEING_APK_URL = "https://github.com/husnulirdoq/wellbeing-flet2/releases/download/build-36/wellbeing-tracker.apk"
GA4_MEASUREMENT_ID = "G-9XYG7QZPFV"
SITE_NAME = "Ruang"
SITE_DESCRIPTION = "Catatan tentang filsafat, bahasa, teknologi, dan cara belajar."
ALLOWED_TAGS = {
    "a", "blockquote", "br", "code", "em", "h2", "h3", "h4", "hr", "li",
    "ol", "p", "pre", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul",
}
ALLOWED_ATTRIBUTES = {"a": ["href", "title"], "th": ["align"], "td": ["align"]}
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FRONT_MATTER_KEYS = {"title", "date", "category", "excerpt", "published"}


def escape(value):
    return html.escape(str(value), quote=True)


def parse_front_matter(path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"{path}: front matter harus diawali ---")
    try:
        _, metadata_text, body = text.split("---", 2)
    except ValueError as error:
        raise ValueError(f"{path}: front matter tidak ditutup dengan ---") from error

    metadata = {}
    for line_number, line in enumerate(metadata_text.strip().splitlines(), start=2):
        if not line.strip():
            continue
        key, separator, value = line.partition(":")
        if not separator or key not in FRONT_MATTER_KEYS:
            raise ValueError(f"{path}:{line_number}: metadata tidak dikenal")
        value = value.strip()
        if value.startswith('"'):
            try:
                value = json.loads(value)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{line_number}: teks metadata bukan string JSON valid") from error
        metadata[key] = value

    missing = FRONT_MATTER_KEYS - metadata.keys()
    if missing:
        raise ValueError(f"{path}: metadata wajib belum diisi: {', '.join(sorted(missing))}")
    if not isinstance(metadata["published"], bool):
        if metadata["published"] not in ("true", "false"):
            raise ValueError(f"{path}: published harus true atau false")
        metadata["published"] = metadata["published"] == "true"
    if not isinstance(metadata["title"], str) or not metadata["title"].strip():
        raise ValueError(f"{path}: title tidak boleh kosong")
    if not isinstance(metadata["category"], str) or not metadata["category"].strip():
        raise ValueError(f"{path}: category tidak boleh kosong")
    if not isinstance(metadata["excerpt"], str) or not metadata["excerpt"].strip():
        raise ValueError(f"{path}: excerpt tidak boleh kosong")
    try:
        published_date = dt.date.fromisoformat(metadata["date"])
    except (TypeError, ValueError) as error:
        raise ValueError(f"{path}: date harus berformat YYYY-MM-DD") from error

    slug = path.stem
    if not SLUG_PATTERN.fullmatch(slug):
        raise ValueError(f"{path}: nama file harus berupa slug huruf kecil, angka, dan tanda hubung")
    if not body.strip():
        raise ValueError(f"{path}: isi artikel tidak boleh kosong")
    return {
        "slug": slug,
        "title": metadata["title"].strip(),
        "date": published_date,
        "category": metadata["category"].strip(),
        "excerpt": metadata["excerpt"].strip(),
        "published": metadata["published"],
        "body": body.strip(),
    }


def render_markdown(text):
    rendered = markdown.markdown(text, extensions=["extra", "sane_lists"])
    return bleach.clean(
        rendered,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols={"http", "https", "mailto"},
        strip=True,
    )


def category_slug(category):
    return re.sub(r"[^a-z0-9]+", "-", category.lower()).strip("-")


def post_url(post):
    return f"/posts/{quote(post['slug'])}/"


def format_date(value, include_year=True):
    months = (
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    )
    date_text = f"{value.day} {months[value.month - 1]}"
    return f"{date_text} {value.year}" if include_year else f"{value.day:02d} {months[value.month - 1][:3]} {value.year}"


def category_options(posts):
    categories = sorted({post["category"] for post in posts}, key=str.casefold)
    return "\n".join(
        f'<button class="filter-chip" type="button" data-category="{escape(category)}">'
        f"{escape(category)}</button>"
        for category in categories
    )


def post_card(post):
    return f"""
      <article class="post-card" data-category="{escape(post['category'])}" data-search="{escape((post['title'] + ' ' + post['excerpt'] + ' ' + post['category']).casefold())}">
        <div class="post-meta">
          <span class="category-pill category-{escape(category_slug(post['category']))}">{escape(post['category'])}</span>
          <time datetime="{post['date'].isoformat()}">{format_date(post['date'], include_year=False)}</time>
        </div>
        <h2><a href="{post_url(post)}">{escape(post['title'])}</a></h2>
        <p>{escape(post['excerpt'])}</p>
        <a class="read-link" href="{post_url(post)}">Baca tulisan <span aria-hidden="true">→</span></a>
      </article>
    """


def social_links():
    return """
      <nav class="social-links" aria-label="Ikuti kami di media sosial">
        <a href="https://x.com/husnulirdoq" target="_blank" rel="noopener noreferrer" aria-label="X">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.83L0 1.154h7.594l5.243 6.931zm-1.29 19.49h2.039L6.486 3.24H4.298z"/></svg>
        </a>
        <a href="https://www.facebook.com/husnulirdoq" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8.2h2.8l.42-3.2H13.5V7.56c0-.93.26-1.56 1.6-1.56h1.71V3.14A22.4 22.4 0 0 0 14.32 3C11.86 3 10.18 4.5 10.18 7.26V9.6H7.4v3.2h2.78V21z"/></svg>
        </a>
        <a href="https://www.instagram.com/husnulirdoq/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2m0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4zm9.75 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/></svg>
        </a>
        <a href="https://www.reddit.com/user/husnulirdoq/" target="_blank" rel="noopener noreferrer" aria-label="Reddit">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="18.5" cy="5.5" r="2" fill="currentColor"/>
            <path d="M18.5 7.5V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <ellipse cx="12" cy="13" rx="7" ry="5" fill="currentColor"/>
            <circle cx="9.5" cy="12" r="1" fill="#f7f6f2"/>
            <circle cx="14.5" cy="12" r="1" fill="#f7f6f2"/>
            <path d="M9 15c1.8 1.1 4.2 1.1 6 0" fill="none" stroke="#f7f6f2" stroke-width="1" stroke-linecap="round"/>
          </svg>
        </a>
        <a href="https://wa.me/628175404449" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp Business">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.47 15.03L2 22l5.1-1.53A9.9 9.9 0 1 0 12.04 2m0 1.9a8 8 0 0 1 0 16 7.9 7.9 0 0 1-4.1-1.14l-.3-.18-3.02.9.92-2.94-.2-.32A8 8 0 0 1 12.04 3.9m-3.4 3.4c-.2 0-.52.07-.8.38-.27.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.09 3.34 5.16 4.55 2.55 1 3.07.8 3.63.75.55-.05 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.08-.13-.28-.2-.6-.36-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.17.2-.35.22-.65.07-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.47.13-.62.13-.13.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.67-1.62-.92-2.22-.24-.57-.49-.5-.67-.5z"/></svg>
        </a>
        <a href="https://www.youtube.com/@husnulirdoq" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.55 3.6 12 3.6 12 3.6s-7.55 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.85.5 9.4.5 9.4.5s7.55 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8M9.6 15.6V8.4l6.3 3.6z"/></svg>
        </a>
        <a href="https://www.linkedin.com/in/husnul-aqib-st-85002454/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.53v16.94c0 .85.69 1.53 1.55 1.53h16.9c.86 0 1.55-.68 1.55-1.53V3.53c0-.85-.69-1.53-1.55-1.53M7.93 18.9H4.98V9.4h2.95zM6.45 8.1a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42M19 18.9h-2.94v-4.62c0-1.1-.02-2.52-1.54-2.52-1.55 0-1.79 1.2-1.79 2.44v4.7H9.8V9.4h2.82v1.3h.04c.39-.74 1.35-1.52 2.77-1.52 2.97 0 3.52 1.95 3.52 4.48z"/></svg>
        </a>
        <a href="https://t.me/husnulirdoq" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.94 2.48a1.1 1.1 0 0 0-1.13-.18L2.56 9.62a1.06 1.06 0 0 0 .08 2l4.7 1.48 1.82 5.58a1.1 1.1 0 0 0 1.03.74h.04a1.1 1.1 0 0 0 1-.64l1.88-3.55 4.62 3.4a1.1 1.1 0 0 0 1.73-.72l2.62-14.15a1.1 1.1 0 0 0-.14-.28M8.75 12.38l-4.02-1.27 14.1-5.78-10.08 7.05m2.24 4.88-1.08-3.29 2.15 1.58z"/></svg>
        </a>
        <a href="https://line.me/ti/p/wPdQ66uy2q" target="_blank" rel="noopener noreferrer" aria-label="Line">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.36 10.2c0-3.99-4-7.24-8.92-7.24S1.52 6.21 1.52 10.2c0 3.58 3.17 6.57 7.45 7.14.29.06.68.19.78.44.09.23.06.58.03.81l-.13.76c-.04.23-.18.89.78.49.96-.41 5.17-3.04 7.05-5.21a6.1 6.1 0 0 0 1.88-4.43M7.3 12.25H5.66a.41.41 0 0 1-.41-.41V8.94a.41.41 0 0 1 .82 0v2.49H7.3a.41.41 0 1 1 0 .82m1.18-.41a.41.41 0 0 1-.82 0V8.94a.41.41 0 1 1 .82 0zm4.2 0a.41.41 0 0 1-.41.41h-1.64a.41.41 0 0 1-.41-.41V8.94a.41.41 0 0 1 .82 0v2.49h1.23a.41.41 0 0 1 .41.41m2.82-2.49a.41.41 0 1 1-.82 0v.62l-1.3-1.76a.41.41 0 0 0-.73.27v2.9a.41.41 0 1 0 .82 0v-.62l1.3 1.76a.41.41 0 0 0 .73-.27z"/></svg>
        </a>
        <a href="https://weixin.qq.com/" target="_blank" rel="noopener noreferrer" aria-label="WeChat" title="WeChat: husnulirdoq">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.2 8.12c.22 0 .44.01.65.03a7.2 7.2 0 0 0-6.86-5.05C6.7 3.1 3 6.16 3 9.93c0 2.17 1.23 4.12 3.16 5.38l-.79 2.36 2.76-1.38c1.05.29 2.08.43 3.03.43.25 0 .49-.01.73-.03a5.05 5.05 0 0 1-.06-.68c0-3.8 3.05-6.89 6.81-6.89zm-7.14-.43a.88.88 0 1 1 0-1.76.88.88 0 0 1 0 1.76m-3.45 0a.88.88 0 1 1 0-1.76.88.88 0 0 1 0 1.76M21.9 14.86c0-3.12-3.07-5.65-6.86-5.65s-6.86 2.53-6.86 5.65 3.07 5.65 6.86 5.65c.79 0 1.55-.11 2.25-.31l2.18 1.09-.62-1.86c1.82-1.05 3.05-2.67 3.05-4.57zm-9.1-1.04a.73.73 0 1 1 0-1.46.73.73 0 0 1 0 1.46m4.48 0a.73.73 0 1 1 0-1.46.73.73 0 0 1 0 1.46"/></svg>
        </a>
      </nav>
    """


def shell(title, description, body, canonical, extra_head="", og_type="website"):
    return f"""<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#f7f6f2">
    <meta name="description" content="{escape(description)}">
    <meta property="og:type" content="{escape(og_type)}">
    <meta property="og:site_name" content="{SITE_NAME}">
    <meta property="og:title" content="{escape(title)}">
    <meta property="og:description" content="{escape(description)}">
    <meta property="og:url" content="{escape(canonical)}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="{escape(title)}">
    <meta name="twitter:description" content="{escape(description)}">
    <link rel="canonical" href="{escape(canonical)}">
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" href="/icon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/styles.css?v=10">
    <title>{escape(title)}</title>
    <script async src="https://www.googletagmanager.com/gtag/js?id={GA4_MEASUREMENT_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){{dataLayer.push(arguments);}}
      gtag('js', new Date());
      gtag('config', '{GA4_MEASUREMENT_ID}');
    </script>
    {extra_head}
    <script type="module" src='https://static.cloudflareinsights.com/beacon.min.js'
                data-cf-beacon='{{"token": "a0750f23d3b14db6b2c31206ad818787"}}'></script>
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="/" aria-label="Garanggati, halaman utama">
        <span class="brand-mark" aria-hidden="true">✳</span>
        <span>Garanggati</span>
      </a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-navigation" aria-label="Buka menu navigasi">
        <span></span><span></span><span></span>
      </button>
      <nav class="site-nav" id="main-navigation" aria-label="Navigasi utama">
        <a href="/#tulisan">Tulisan</a>
        <a href="/#news-feed">Berita</a>
        <a href="/shop/">Shop</a>
        <a href="/#buku-tamu">Buku tamu</a>
        <a href="/#topik">Topik</a>
        <a class="admin-login-link" href="/admin/">Login admin</a>
      </nav>
    </header>
    {body}
    <footer class="site-footer">
      <a class="footer-brand" href="/">Garanggati</a>
      <span>Ruang kecil untuk pikiran besar.</span>
      <div class="footer-socials">
        {social_links()}
        <a class="footer-email" href="mailto:info@garanggati.web.id">info@garanggati.web.id</a>
      </div>
      <a href="/admin/">Login admin <span aria-hidden="true">↗</span></a>
    </footer>
    <script type="module" src="/blog.js?v=13"></script>
  </body>
</html>
"""


def build_home(posts):
    categories = category_options(posts)
    cards = "\n".join(post_card(post) for post in posts)
    body = f"""
    <main>
      <section class="hero">
        <p class="eyebrow">CATATAN TENTANG HAL-HAL YANG MENARIK</p>
        <h1>Gagasan layak<br> diberi <span>ruang.</span></h1>
        <p class="hero-copy">Tulisan tentang filsafat, bahasa, teknologi, dan cara kita belajar—dikumpulkan sambil terus berpikir.</p>
        <div class="hero-actions">
          <a class="hero-link" href="#tulisan">Baca tulisan <span aria-hidden="true">↓</span></a>
          <a class="hero-admin-link" href="#news-feed">Berita terpilih <span aria-hidden="true">↓</span></a>
          <a class="hero-admin-link" href="{WELLBEING_APK_URL}" target="_blank" rel="noopener noreferrer">Unduh Wellbeing Tracker <span aria-hidden="true">↗</span></a>
          <a class="hero-admin-link" href="/admin/">Login admin <span aria-hidden="true">↗</span></a>
        </div>
        <span class="hero-decoration" aria-hidden="true">✳</span>
      </section>
      <section class="posts-section" id="tulisan">
        <div class="section-heading">
          <div>
            <p class="eyebrow">PERPUSTAKAAN IDE</p>
            <h2>Tulisan terbaru<span class="brand-period">.</span></h2>
          </div>
          <label class="search-box">
            <span class="search-icon" aria-hidden="true">⌕</span>
            <input id="search-input" type="search" placeholder="Cari tulisan..." autocomplete="off">
            <kbd>/</kbd>
          </label>
        </div>
        <nav class="topic-filters" id="topik" aria-label="Filter topik">
          <button class="filter-chip active" type="button" data-category="">Semua tulisan</button>
          {categories}
        </nav>
        <p class="site-status" id="site-status" role="status" aria-live="polite" hidden></p>
        <p class="result-count" id="result-count" aria-live="polite"></p>
        <div class="posts-grid" id="posts-grid">
          {cards}
        </div>
        <p class="no-results" id="no-results" hidden>Tidak ada tulisan yang cocok. Coba kata kunci atau topik lain.</p>
      </section>
      <div class="news-feed" id="news-feed">
        <div class="news-toolbar">
          <p class="news-last-updated" id="news-last-updated" role="status" aria-live="polite">Cointelegraph RSS · siap dimuat</p>
          <button class="news-refresh-button" id="news-refresh" type="button">Muat ulang feed</button>
        </div>
        <section class="news-section" id="news-bitcoin" data-news-category="bitcoin" aria-labelledby="news-bitcoin-heading">
          <div class="news-heading">
            <div><p class="eyebrow">BITCOIN & KRIPTO · COINTELEGRAPH</p><h2 id="news-bitcoin-heading">Bitcoin<span class="brand-period">.</span></h2></div>
            <p>Bitcoin, ETF, pasar kripto, dan sentimen makro.</p>
          </div>
          <p class="news-status" id="news-status-bitcoin" role="status" aria-live="polite">Memuat feed RSS Cointelegraph...</p>
          <div class="news-grid" id="news-grid-bitcoin"></div>
        </section>
        <section class="news-section" id="news-keuangan" data-news-category="keuangan" aria-labelledby="news-keuangan-heading">
          <div class="news-heading">
            <div><p class="eyebrow">KEUANGAN & BISNIS · COINTELEGRAPH</p><h2 id="news-keuangan-heading">Keuangan<span class="brand-period">.</span></h2></div>
            <p>Inflasi, suku bunga, bisnis, pasar, dan ekonomi global.</p>
          </div>
          <p class="news-status" id="news-status-keuangan" role="status" aria-live="polite">Memuat feed RSS Cointelegraph...</p>
          <div class="news-grid" id="news-grid-keuangan"></div>
        </section>
        <section class="news-section" id="news-teknologi" data-news-category="teknologi" aria-labelledby="news-teknologi-heading">
          <div class="news-heading">
            <div><p class="eyebrow">AI & TEKNOLOGI · COINTELEGRAPH</p><h2 id="news-teknologi-heading">Teknologi<span class="brand-period">.</span></h2></div>
            <p>AI, LLM, teknologi konsumen, dan perkembangan digital.</p>
          </div>
          <p class="news-status" id="news-status-teknologi" role="status" aria-live="polite">Memuat feed RSS Cointelegraph...</p>
          <div class="news-grid" id="news-grid-teknologi"></div>
        </section>
        <p class="news-disclaimer">Headline dan tautan bersumber dari feed RSS publik Cointelegraph melalui proxy CORS stateless. Hak cipta dan isi artikel sepenuhnya milik Cointelegraph; informasi ini bukan saran investasi atau keuangan.</p>
      </div>
      <section class="btc-section" id="btc-live" aria-labelledby="btc-heading">
        <div class="btc-heading">
          <div>
            <p class="eyebrow">PASAR KRIPTO · COINPAPRIKA</p>
            <h2 id="btc-heading">Bitcoin / USD<span class="brand-period">.</span></h2>
          </div>
          <p>Grafik bergerak dari harga agregat CoinPaprika; data gratis diperbarui rata-rata tiap lima menit.</p>
        </div>
        <div class="btc-card">
          <div class="btc-summary">
            <div>
              <p class="btc-label">BTC / USD</p>
              <p class="btc-price" id="btc-price" aria-live="polite">Memuat harga...</p>
            </div>
            <div class="btc-change-wrap">
              <span class="btc-change" id="btc-change">--</span>
              <span class="btc-period-label">24 jam</span>
            </div>
          </div>
          <div class="btc-chart-wrap">
            <svg class="btc-chart" viewBox="0 0 760 240" role="img" aria-labelledby="btc-chart-title btc-chart-description" preserveAspectRatio="none">
              <title id="btc-chart-title">Grafik harga Bitcoin terhadap dolar AS</title>
              <desc id="btc-chart-description">Grafik harga BTC/USD CoinPaprika selama maksimal 24 jam terakhir.</desc>
              <line class="btc-gridline" x1="0" y1="20" x2="760" y2="20"></line>
              <line class="btc-gridline" x1="0" y1="120" x2="760" y2="120"></line>
              <line class="btc-gridline" x1="0" y1="220" x2="760" y2="220"></line>
              <text class="btc-axis-label" id="btc-axis-high" x="750" y="15" text-anchor="end"></text>
              <text class="btc-axis-label" id="btc-axis-mid" x="750" y="115" text-anchor="end"></text>
              <text class="btc-axis-label" id="btc-axis-low" x="750" y="215" text-anchor="end"></text>
              <path class="btc-chart-area" id="btc-chart-area"></path>
              <polyline class="btc-chart-line" id="btc-chart-line" points=""></polyline>
              <circle class="btc-chart-point" id="btc-chart-point" r="4" cx="0" cy="0"></circle>
            </svg>
          </div>
          <div class="btc-chart-axis"><span id="btc-axis-start">Mulai dipantau</span><span>Sekarang</span></div>
          <p class="btc-status" id="btc-status" role="status" aria-live="polite">Memuat harga dari CoinPaprika...</p>
          <p class="btc-disclaimer">Harga pasar BTC/USD untuk informasi saja, bukan saran investasi.</p>
        </div>
      </section>
      <section class="web3-section" id="donasi-web3" aria-labelledby="web3-heading">
        <div class="web3-heading">
          <div>
            <p class="eyebrow">DONASI WEB3 · BASE MAINNET</p>
            <h2 id="web3-heading">Donasi USDC<span class="brand-period">.</span></h2>
          </div>
          <p>Transaksi memakai USDC sungguhan dan tidak dapat dibatalkan. Periksa detail di wallet sebelum menyetujui.</p>
        </div>
        <div class="web3-panel">
          <div class="web3-network">
            <span class="web3-badge">8453</span>
            <div>
              <strong>Base Mainnet · USDC</strong>
              <p>Wallet memerlukan ETH di Base untuk membayar gas.</p>
            </div>
          </div>
          <button class="web3-connect" id="web3-connect" type="button">Hubungkan wallet</button>
          <p class="web3-wallet" id="web3-wallet" role="status" aria-live="polite">Wallet belum terhubung.</p>
          <p class="web3-recipient">Penerima: <code id="web3-recipient-display"></code></p>
          <form class="web3-form" id="web3-form">
            <label for="web3-amount">Jumlah USDC</label>
            <input id="web3-amount" name="amount" type="number" inputmode="decimal" min="0.000001" step="0.000001" placeholder="Contoh: 1.00" required>
            <button class="web3-submit" id="web3-submit" type="submit" disabled>Kirim donasi USDC</button>
          </form>
          <p class="web3-status" id="web3-status" role="status" aria-live="polite"></p>
        </div>
      </section>
      <section class="guestbook-section" id="buku-tamu" aria-labelledby="guestbook-heading">
        <div class="guestbook-heading">
          <div>
            <p class="eyebrow">BUKU TAMU</p>
            <h2 id="guestbook-heading">Tinggalkan jejak<span class="brand-period">.</span></h2>
          </div>
          <p>Sampaikan salam, pemikiran, atau pengalaman singkatmu.</p>
        </div>
        <div class="guestbook-layout">
          <form class="guestbook-form" id="guestbook-form">
            <label for="guestbook-name">Nama</label>
            <input id="guestbook-name" name="name" type="text" maxlength="50" autocomplete="name" placeholder="Nama atau nama panggilan" required>
            <label for="guestbook-message">Pesan</label>
            <textarea id="guestbook-message" name="message" rows="5" maxlength="500" placeholder="Tulis pesan singkat..." required></textarea>
            <div class="guestbook-form-footer">
              <span id="guestbook-count">0/500</span>
              <button class="guestbook-submit" type="submit">Kirim pesan</button>
            </div>
            <p class="guestbook-status" id="guestbook-status" role="status" aria-live="polite"></p>
          </form>
          <div class="guestbook-messages">
            <div class="guestbook-messages-heading">
              <h3>Pesan terbaru</h3>
              <span id="guestbook-total">Memuat...</span>
            </div>
            <div id="guestbook-list" class="guestbook-list">
              <p class="guestbook-empty">Pesan pembaca akan muncul di sini.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    """
    return shell(
        SITE_NAME + " — Catatan pengetahuan",
        SITE_DESCRIPTION,
        body,
        BASE_URL + "/",
    )


def build_post(post, recent_posts):
    article_html = render_markdown(post["body"])
    recent = "\n".join(
        f'<li><a href="{post_url(item)}">{escape(item["title"])}</a></li>'
        for item in recent_posts if item["slug"] != post["slug"]
    )
    body = f"""
    <main class="article-layout">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Beranda</a><span aria-hidden="true">/</span><a href="/#tulisan">Tulisan</a><span aria-hidden="true">/</span><span>{escape(post['category'])}</span>
      </nav>
      <article class="article">
        <header class="article-header">
          <span class="category-pill category-{escape(category_slug(post['category']))}">{escape(post['category'])}</span>
          <h1>{escape(post['title'])}</h1>
          <p class="article-excerpt">{escape(post['excerpt'])}</p>
          <time datetime="{post['date'].isoformat()}">{format_date(post['date'])}</time>
          <div class="article-share">
            <button class="article-share-button" type="button" data-share-article
              data-share-url="{escape(BASE_URL + post_url(post) + '?utm_source=article_share&utm_medium=social&utm_campaign=article_share')}"
              data-share-title="{escape(post['title'])}">Bagikan artikel</button>
            <span class="article-share-status" data-share-status role="status" aria-live="polite"></span>
          </div>
        </header>
        <div class="article-body">{article_html}</div>
        <footer class="article-end">
          <span class="end-mark" aria-hidden="true">✳</span>
          <p>Terima kasih sudah membaca.</p>
          <a href="/">← Kembali ke semua tulisan</a>
        </footer>
      </article>
      <aside class="article-aside">
        <p class="eyebrow">LANJUTKAN MEMBACA</p>
        <ul>{recent}</ul>
        <a class="aside-all" href="/#tulisan">Semua tulisan →</a>
      </aside>
    </main>
    """
    canonical = BASE_URL + post_url(post)
    structured_data = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": post["title"],
            "description": post["excerpt"],
            "datePublished": post["date"].isoformat(),
            "inLanguage": "id",
            "articleSection": post["category"],
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": canonical,
            },
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ).replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e")
    extra_head = (
        f'<meta property="article:published_time" content="{post["date"].isoformat()}">'
        f'<script type="application/ld+json">{structured_data}</script>'
    )
    return shell(
        post["title"] + " — " + SITE_NAME,
        post["excerpt"],
        body,
        canonical,
        extra_head,
        og_type="article",
    )


def build_shop():
    body = """
    <main class="shop-main">
      <section class="shop-hero">
        <p class="eyebrow">GARANGGATI SHOP</p>
        <h1>Belanja pilihan<br><span>kami.</span></h1>
        <p class="shop-copy">Temukan produk Garanggati melalui marketplace pilihanmu.</p>
      </section>
      <section class="shop-section" aria-labelledby="shop-heading">
        <div class="section-heading">
          <div>
            <p class="eyebrow">PILIH MARKETPLACE</p>
            <h2 id="shop-heading">Jelajahi toko kami<span class="brand-period">.</span></h2>
          </div>
        </div>
        <div class="shop-grid">
          <article class="post-card shop-card">
            <div class="post-meta">
              <span class="category-pill">Marketplace</span>
              <span class="shop-platform">Shopee</span>
            </div>
            <h2>Shopee</h2>
            <p>Lihat katalog produk Garanggati dan belanja langsung di toko Shopee kami.</p>
            <a class="read-link" href="https://shopee.co.id/garanggatishop#product_list" target="_blank" rel="noopener noreferrer">
              Lihat toko di Shopee <span aria-hidden="true">↗</span>
            </a>
          </article>
          <article class="post-card shop-card">
            <div class="post-meta">
              <span class="category-pill">Marketplace</span>
              <span class="shop-platform">TikTok Shop</span>
            </div>
            <h2>TikTok Shop</h2>
            <p>Kunjungi toko Garanggati di TikTok Shop untuk melihat produk yang tersedia.</p>
            <a class="read-link" href="https://vt.tiktok.com/ZSpbfegqy/" target="_blank" rel="noopener noreferrer">
              Lihat toko di TikTok <span aria-hidden="true">↗</span>
            </a>
          </article>
          <article class="post-card shop-card">
            <div class="post-meta">
              <span class="category-pill">Marketplace</span>
              <span class="shop-platform">Blibli</span>
            </div>
            <h2>Blibli</h2>
            <p>Temukan produk Garanggati melalui toko kami di Blibli.</p>
            <a class="read-link" href="https://blibli.onelink.me/GNtk/hav3xy4g" target="_blank" rel="noopener noreferrer">
              Lihat toko di Blibli <span aria-hidden="true">↗</span>
            </a>
          </article>
          <article class="post-card shop-card">
            <div class="post-meta">
              <span class="category-pill">Marketplace</span>
              <span class="shop-platform">Lazada</span>
            </div>
            <h2>Lazada</h2>
            <p>Temukan produk Garanggati melalui toko kami di Lazada.</p>
            <a class="read-link" href="https://www.lazada.co.id/shop/garanggati-shop/" target="_blank" rel="noopener noreferrer">
              Lihat toko di Lazada <span aria-hidden="true">↗</span>
            </a>
          </article>
        </div>
      </section>
    </main>
    """
    return shell(
        "Shop Garanggati — " + SITE_NAME,
        "Jelajahi toko Garanggati di Shopee, TikTok Shop, Blibli, dan Lazada.",
        body,
        BASE_URL + "/shop/",
    )


def build_not_found():
    body = """
    <main class="not-found">
      <p class="eyebrow">HALAMAN TIDAK DITEMUKAN</p>
      <h1>Ruang ini kosong<span class="brand-period">.</span></h1>
      <p>Mungkin tulisannya pindah, atau alamatnya kurang tepat.</p>
      <a href="/">Kembali ke halaman utama →</a>
    </main>
    """
    return shell("Halaman tidak ditemukan — " + SITE_NAME, SITE_DESCRIPTION, body, BASE_URL + "/404.html")


def build():
    if not POSTS_DIR.is_dir():
        raise FileNotFoundError(f"Folder artikel tidak ditemukan: {POSTS_DIR}")
    posts = [parse_front_matter(path) for path in sorted(POSTS_DIR.glob("*.md"))]
    posts = sorted((post for post in posts if post["published"]), key=lambda item: item["date"], reverse=True)

    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    (OUTPUT / "posts").mkdir()
    (OUTPUT / "admin").mkdir()
    (OUTPUT / "shop").mkdir()
    (OUTPUT / "index.html").write_text(build_home(posts), encoding="utf-8")
    (OUTPUT / "404.html").write_text(build_not_found(), encoding="utf-8")
    (OUTPUT / "shop" / "index.html").write_text(build_shop(), encoding="utf-8")

    for post in posts:
        post_dir = OUTPUT / "posts" / post["slug"]
        post_dir.mkdir(parents=True)
        (post_dir / "index.html").write_text(
            build_post(post, posts[:4]), encoding="utf-8"
        )

    (OUTPUT / "admin" / "index.html").write_text(
        (ROOT / "admin.html").read_text(encoding="utf-8"), encoding="utf-8"
    )
    (OUTPUT / "posts.json").write_text(
        json.dumps(
            [
                {
                    "slug": post["slug"],
                    "title": post["title"],
                    "date": post["date"].isoformat(),
                    "category": post["category"],
                    "excerpt": post["excerpt"],
                    "body": post["body"],
                    "published": post["published"],
                }
                for post in posts
            ],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    shutil.copytree(ROOT / "dist", OUTPUT, dirs_exist_ok=True)
    for filename in ("styles.css", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png", "sw.js"):
        shutil.copy2(ROOT / filename, OUTPUT / filename)
    service_worker = OUTPUT / "sw.js"
    worker_source = service_worker.read_text(encoding="utf-8")
    chunks = sorted((OUTPUT / "chunks").glob("*.js"))
    chunk_urls = ", ".join(json.dumps(f"/chunks/{chunk.name}") for chunk in chunks)
    worker_source = worker_source.replace(
        "const BUILD_CHUNKS = [];",
        f"const BUILD_CHUNKS = [{chunk_urls}];",
    )
    service_worker.write_text(worker_source, encoding="utf-8")
    shutil.copy2(ROOT / "CNAME", OUTPUT / "CNAME")

    sitemap = ET.Element("urlset", {"xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9"})
    for path in ("/", "/shop/", *(post_url(post) for post in posts)):
        url_element = ET.SubElement(sitemap, "{http://www.sitemaps.org/schemas/sitemap/0.9}url")
        ET.SubElement(url_element, "{http://www.sitemaps.org/schemas/sitemap/0.9}loc").text = BASE_URL + path
    ET.indent(sitemap, space="  ")
    (OUTPUT / "sitemap.xml").write_bytes(
        ET.tostring(sitemap, encoding="utf-8", xml_declaration=True)
    )
    (OUTPUT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: {BASE_URL}/sitemap.xml\n",
        encoding="utf-8",
    )
    print(f"Built {len(posts)} published articles into {OUTPUT}")


if __name__ == "__main__":
    build()
