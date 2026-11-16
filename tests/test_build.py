import json
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build


class BlogBuildTests(unittest.TestCase):
    def test_build_publishes_article_pages_and_excludes_drafts(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary_path = Path(temporary_directory)
            posts_directory = temporary_path / "posts"
            output_directory = temporary_path / "site"
            posts_directory.mkdir()
            (posts_directory / "public-post.md").write_text(
                '---\ntitle: "Tulisan publik"\ndate: 2026-01-02\n'
                'category: "Filsafat"\nexcerpt: "Ringkasan publik."\npublished: true\n'
                '---\n\nIsi tulisan publik.',
                encoding="utf-8",
            )
            (posts_directory / "draft-post.md").write_text(
                '---\ntitle: "Tulisan draf"\ndate: 2026-01-03\n'
                'category: "Filsafat"\nexcerpt: "Ringkasan draf."\npublished: false\n'
                '---\n\nIsi tulisan draf.',
                encoding="utf-8",
            )

            with patch.object(build, "POSTS_DIR", posts_directory), patch.object(
                build, "OUTPUT", output_directory
            ):
                build.build()

            home = (output_directory / "index.html").read_text(encoding="utf-8")
            self.assertIn("G-9XYG7QZPFV", home)
            self.assertIn("https://www.googletagmanager.com/gtag/js?id=G-9XYG7QZPFV", home)
            self.assertIn("Tulisan publik", home)
            self.assertNotIn("Tulisan draf", home)
            self.assertIn("Baca tulisan", home)
            self.assertIn("Login admin", home)
            self.assertIn('aria-label="Garanggati, halaman utama"', home)
            self.assertIn('<span class="brand-mark" aria-hidden="true">✳</span>', home)
            self.assertIn("<span>Garanggati</span>", home)
            self.assertIn('<a class="footer-brand" href="/">Garanggati</a>', home)
            self.assertNotIn("Catatan baru", home)
            for social_url in (
                "https://x.com/husnulirdoq",
                "https://www.facebook.com/husnulirdoq",
                "https://www.instagram.com/husnulirdoq/",
                "https://wa.me/628175404449",
                "https://www.youtube.com/@husnulirdoq",
                "https://www.linkedin.com/in/husnul-aqib-st-85002454/",
            ):
                self.assertIn(social_url, home)
            for social_label in ("X", "Facebook", "Instagram", "WhatsApp Business", "YouTube", "LinkedIn"):
                self.assertIn(f'aria-label="{social_label}"', home)
            self.assertIn('href="mailto:info@garanggati.web.id"', home)
            self.assertIn(">info@garanggati.web.id</a>", home)
            self.assertTrue((output_directory / "posts/public-post/index.html").is_file())
            self.assertFalse((output_directory / "posts/draft-post/index.html").exists())
            article_html = (output_directory / "posts/public-post/index.html").read_text(encoding="utf-8")
            self.assertIn('data-share-article', article_html)
            self.assertIn(
                'data-share-url="https://garanggati.web.id/?post=public-post'
                '&amp;utm_source=article_share&amp;utm_medium=social'
                '&amp;utm_campaign=article_share"',
                article_html,
            )
            self.assertIn('data-share-status role="status" aria-live="polite"', article_html)
            posts = json.loads((output_directory / "posts.json").read_text(encoding="utf-8"))
            self.assertEqual([post["slug"] for post in posts], ["public-post"])
            admin_page = output_directory / "admin/index.html"
            self.assertTrue(admin_page.is_file())
            admin_html = admin_page.read_text(encoding="utf-8")
            self.assertNotIn("G-9XYG7QZPFV", admin_html)
            self.assertIn('aria-label="Garanggati, halaman utama"', admin_html)
            self.assertIn('<span class="brand-mark" aria-hidden="true">✳</span>', admin_html)
            self.assertIn('<a class="footer-brand" href="/">Garanggati</a>', admin_html)
            self.assertIn("Masuk admin", admin_html)
            self.assertIn("Firebase Authentication", admin_html)
            self.assertIn("Pratinjau", admin_html)
            sitemap = ET.parse(output_directory / "sitemap.xml")
            self.assertEqual(len(sitemap.findall(".//{*}loc")), 1)

    def test_markdown_content_is_sanitized(self):
        result = build.render_markdown(
            '<script>alert(1)</script>\n\n<a href="javascript:alert(1)">tautan</a>'
        )
        self.assertNotIn("<script", result)
        self.assertNotIn("javascript:", result)
        self.assertIn("tautan", result)


if __name__ == "__main__":
    unittest.main()
