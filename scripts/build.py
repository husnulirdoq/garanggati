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
    return f"/?post={quote(post['slug'])}"


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
    <link rel="canonical" href="{escape(canonical)}">
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" href="/icon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/styles.css">
    <title>{escape(title)}</title>
    {extra_head}
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="/" aria-label="Ruang, halaman utama">
        <span class="brand-mark" aria-hidden="true">r.</span>
        <span>ruang<span class="brand-period">.</span></span>
      </a>
      <nav class="site-nav" aria-label="Navigasi utama">
        <a href="/#tulisan">Tulisan</a>
        <a href="/#topik">Topik</a>
        <a href="/admin/">Admin</a>
      </nav>
    </header>
    {body}
    <footer class="site-footer">
      <a class="footer-brand" href="/">ruang<span class="brand-period">.</span></a>
      <span>Ruang kecil untuk pikiran besar.</span>
      <a href="/admin/">Kelola tulisan <span aria-hidden="true">↗</span></a>
    </footer>
    <script type="module" src="/blog.js"></script>
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
        <a class="hero-link" href="#tulisan">Jelajahi tulisan <span aria-hidden="true">↓</span></a>
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
    extra_head = f'<meta property="article:published_time" content="{post["date"].isoformat()}">'
    return shell(
        post["title"] + " — " + SITE_NAME,
        post["excerpt"],
        body,
        BASE_URL + post_url(post),
        extra_head,
        og_type="article",
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
    (OUTPUT / "index.html").write_text(build_home(posts), encoding="utf-8")
    (OUTPUT / "404.html").write_text(build_not_found(), encoding="utf-8")

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
    url_element = ET.SubElement(sitemap, "{http://www.sitemaps.org/schemas/sitemap/0.9}url")
    ET.SubElement(url_element, "{http://www.sitemaps.org/schemas/sitemap/0.9}loc").text = BASE_URL + "/"
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
