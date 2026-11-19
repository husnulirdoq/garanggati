import DOMPurify from "dompurify";
import { marked } from "marked";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase-client.js";

const searchInput = document.querySelector("#search-input");
const filters = [...document.querySelectorAll(".filter-chip")];
const resultCount = document.querySelector("#result-count");
const noResults = document.querySelector("#no-results");
const postsGrid = document.querySelector("#posts-grid");
const statusMessage = document.querySelector("#site-status");
let cards = [...document.querySelectorAll(".post-card")];
let selectedCategory = "";
let posts = [];

function showStatus(message) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.hidden = false;
}

function formatDate(value, long = false) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: long ? "long" : "short",
    year: "numeric",
  }).format(date);
}

function categoryClass(category) {
  return category.toLocaleLowerCase("id").normalize("NFD")
    .replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function postLink(slug) {
  return `/?post=${encodeURIComponent(slug)}`;
}

function postShareLink(slug) {
  const url = new URL(postLink(slug), "https://garanggati.web.id");
  url.searchParams.set("utm_source", "article_share");
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", "article_share");
  return url.toString();
}

function makeShareControls(post) {
  const controls = document.createElement("div");
  controls.className = "article-share";

  const button = document.createElement("button");
  button.className = "article-share-button";
  button.type = "button";
  button.dataset.shareArticle = "";
  button.dataset.shareUrl = postShareLink(post.slug);
  button.dataset.shareTitle = post.title;
  button.textContent = "Bagikan artikel";

  const status = document.createElement("span");
  status.className = "article-share-status";
  status.dataset.shareStatus = "";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  controls.append(button, status);
  return controls;
}

function makeCard(post) {
  const card = document.createElement("article");
  card.className = "post-card";
  card.dataset.category = post.category;
  card.dataset.search = `${post.title} ${post.excerpt} ${post.category}`.toLocaleLowerCase("id");

  const meta = document.createElement("div");
  meta.className = "post-meta";
  const category = document.createElement("span");
  category.className = `category-pill category-${categoryClass(post.category)}`;
  category.textContent = post.category;
  const date = document.createElement("time");
  date.dateTime = post.date;
  date.textContent = formatDate(post.date);
  meta.append(category, date);

  const title = document.createElement("h2");
  const titleLink = document.createElement("a");
  titleLink.href = postLink(post.slug);
  titleLink.textContent = post.title;
  title.append(titleLink);

  const excerpt = document.createElement("p");
  excerpt.textContent = post.excerpt;
  const readLink = document.createElement("a");
  readLink.className = "read-link";
  readLink.href = postLink(post.slug);
  readLink.append(document.createTextNode("Baca tulisan "));
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  readLink.append(arrow);
  card.append(meta, title, excerpt, readLink);
  return card;
}

function filterPosts() {
  const queryText = searchInput?.value.trim().toLocaleLowerCase("id") ?? "";
  let visibleCount = 0;
  for (const card of cards) {
    const matchesCategory = !selectedCategory || card.dataset.category === selectedCategory;
    const matchesQuery = !queryText || card.dataset.search.includes(queryText);
    const visible = matchesCategory && matchesQuery;
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  }
  if (resultCount) resultCount.textContent = `${visibleCount} tulisan`;
  if (noResults) noResults.hidden = visibleCount !== 0;
}

function renderCards(nextPosts) {
  posts = nextPosts;
  if (postsGrid) {
    postsGrid.replaceChildren(...posts.map(makeCard));
    cards = [...postsGrid.querySelectorAll(".post-card")];
    const categories = [...new Set(posts.map((post) => post.category))].sort((a, b) => a.localeCompare(b, "id"));
    const allFilter = filters.find((filter) => !filter.dataset.category);
    if (allFilter) {
      for (const filter of filters) {
        if (filter !== allFilter) filter.remove();
      }
      for (const category of categories) {
        const button = document.createElement("button");
        button.className = "filter-chip";
        button.type = "button";
        button.dataset.category = category;
        button.textContent = category;
        allFilter.after(button);
        filters.push(button);
      }
    }
    if (statusMessage) statusMessage.hidden = true;
  }
  filterPosts();
}

function setMeta(name, value) {
  const element = document.querySelector(`meta[name="${name}"]`);
  if (element) element.content = value;
}

function setProperty(property, value) {
  const element = document.querySelector(`meta[property="${property}"]`);
  if (element) element.content = value;
}

function renderArticle(post) {
  const main = document.createElement("main");
  main.className = "article-layout";
  const breadcrumbs = document.createElement("nav");
  breadcrumbs.className = "breadcrumbs";
  breadcrumbs.setAttribute("aria-label", "Breadcrumb");
  const homeLink = document.createElement("a");
  homeLink.href = "/";
  homeLink.textContent = "Beranda";
  const articlesLink = document.createElement("a");
  articlesLink.href = "/#tulisan";
  articlesLink.textContent = "Tulisan";
  const separator = () => {
    const item = document.createElement("span");
    item.setAttribute("aria-hidden", "true");
    item.textContent = "/";
    return item;
  };
  const categoryCrumb = document.createElement("span");
  categoryCrumb.textContent = post.category;
  breadcrumbs.append(homeLink, separator(), articlesLink, separator(), categoryCrumb);

  const article = document.createElement("article");
  article.className = "article";
  const header = document.createElement("header");
  header.className = "article-header";
  const category = document.createElement("span");
  category.className = `category-pill category-${categoryClass(post.category)}`;
  category.textContent = post.category;
  const title = document.createElement("h1");
  title.textContent = post.title;
  const excerpt = document.createElement("p");
  excerpt.className = "article-excerpt";
  excerpt.textContent = post.excerpt;
  const date = document.createElement("time");
  date.dateTime = post.date;
  date.textContent = formatDate(post.date, true);
  header.append(category, title, excerpt, date, makeShareControls(post));

  const content = document.createElement("div");
  content.className = "article-body";
  content.innerHTML = DOMPurify.sanitize(marked.parse(post.body), {
    ALLOWED_TAGS: ["a", "blockquote", "br", "code", "em", "h2", "h3", "h4", "hr", "li", "ol", "p", "pre", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul"],
    ALLOWED_ATTR: ["align", "href", "title"],
  });

  const footer = document.createElement("footer");
  footer.className = "article-end";
  const mark = document.createElement("span");
  mark.className = "end-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "✳";
  const thanks = document.createElement("p");
  thanks.textContent = "Terima kasih sudah membaca.";
  const backLink = document.createElement("a");
  backLink.href = "/";
  backLink.textContent = "← Kembali ke semua tulisan";
  footer.append(mark, thanks, backLink);
  article.append(header, content, footer);

  const aside = document.createElement("aside");
  aside.className = "article-aside";
  const asideHeading = document.createElement("p");
  asideHeading.className = "eyebrow";
  asideHeading.textContent = "LANJUTKAN MEMBACA";
  const list = document.createElement("ul");
  for (const otherPost of posts.filter((item) => item.slug !== post.slug).slice(0, 4)) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = postLink(otherPost.slug);
    link.textContent = otherPost.title;
    item.append(link);
    list.append(item);
  }
  const allLink = document.createElement("a");
  allLink.className = "aside-all";
  allLink.href = "/";
  allLink.textContent = "Semua tulisan →";
  aside.append(asideHeading, list, allLink);
  main.append(breadcrumbs, article, aside);

  document.querySelector("main")?.replaceWith(main);
  document.title = `${post.title} — Ruang`;
  const canonical = `https://garanggati.web.id${postLink(post.slug)}`;
  setMeta("description", post.excerpt);
  setProperty("og:type", "article");
  setProperty("og:title", document.title);
  setProperty("og:description", post.excerpt);
  setProperty("og:url", canonical);
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  if (canonicalLink) canonicalLink.href = canonical;
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-share-article]");
  if (!button) return;

  const status = button.parentElement.querySelector("[data-share-status]");
  button.disabled = true;
  window.gtag?.("event", "article_share_click", {
    article_title: button.dataset.shareTitle,
    article_url: button.dataset.shareUrl,
    share_method: navigator.share ? "native" : "copy_link",
  });
  try {
    if (navigator.share) {
      await navigator.share({
        title: button.dataset.shareTitle,
        text: button.dataset.shareTitle,
        url: button.dataset.shareUrl,
      });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(button.dataset.shareUrl);
      status.textContent = "Tautan artikel disalin.";
    } else {
      throw new Error("Fitur berbagi dan clipboard tidak tersedia.");
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error("Artikel gagal dibagikan.", error);
    status.textContent = "Gagal membagikan. Salin alamat halaman dari bilah alamat.";
  } finally {
    button.disabled = false;
  }
});

async function loadSeedPosts() {
  const response = await fetch("/posts.json");
  if (!response.ok) throw new Error(`Artikel awal gagal dimuat (HTTP ${response.status}).`);
  return response.json();
}

async function loadPosts() {
  if (!firebaseConfigured) {
    if (new URLSearchParams(location.search).has("post")) posts = await loadSeedPosts();
    return;
  }
  try {
    const snapshot = await getDocs(query(
      collection(db, "posts"),
      where("published", "==", true),
    ));
    const firestorePosts = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => b.date.localeCompare(a.date));
    const seedPosts = await loadSeedPosts();
    const mergedPosts = new Map(seedPosts.map((post) => [post.slug, post]));
    for (const post of firestorePosts) mergedPosts.set(post.slug, post);
    renderCards([...mergedPosts.values()].sort((a, b) => b.date.localeCompare(a.date)));
    if (!firestorePosts.length && seedPosts.length) {
      showStatus("Firestore belum memiliki tulisan terbit. Menampilkan tulisan dari Codespaces.");
    }
  } catch (error) {
    console.error("Artikel publik gagal dimuat dari Firestore.", error);
    showStatus("Tulisan terbaru belum dapat dimuat. Coba muat ulang halaman.");
    if (new URLSearchParams(location.search).has("post")) posts = await loadSeedPosts();
    return;
  }
}

function formatGuestbookDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function renderGuestbookEntries(entries) {
  const list = document.querySelector("#guestbook-list");
  const total = document.querySelector("#guestbook-total");
  if (!list) return;

  if (total) total.textContent = `${entries.length} pesan`;
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "guestbook-empty";
    empty.textContent = "Belum ada pesan. Jadilah yang pertama.";
    list.replaceChildren(empty);
    return;
  }

  list.replaceChildren(...entries.map((entry) => {
    const item = document.createElement("article");
    item.className = "guestbook-entry";
    const header = document.createElement("div");
    header.className = "guestbook-entry-header";
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const date = document.createElement("time");
    if (entry.createdAt?.toDate) date.dateTime = entry.createdAt.toDate().toISOString();
    date.textContent = formatGuestbookDate(entry.createdAt);
    header.append(name, date);
    const message = document.createElement("p");
    message.textContent = entry.message;
    item.append(header, message);
    return item;
  }));
}

function setGuestbookStatus(message, type = "") {
  const status = document.querySelector("#guestbook-status");
  if (!status) return;
  status.textContent = message;
  status.className = `guestbook-status ${type}`.trim();
}

function loadGuestbook() {
  if (!firebaseConfigured || !db) {
    setGuestbookStatus("Buku tamu sedang tidak terhubung.");
    return;
  }

  const guestbookQuery = query(
    collection(db, "guestbook"),
    orderBy("createdAt", "desc"),
    limit(30),
  );
  onSnapshot(guestbookQuery, (snapshot) => {
    const entries = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    renderGuestbookEntries(entries);
  }, (error) => {
    console.error("Buku tamu gagal dimuat.", error);
    setGuestbookStatus("Pesan terbaru belum dapat dimuat.", "error");
  });
}

const guestbookForm = document.querySelector("#guestbook-form");
const guestbookMessage = document.querySelector("#guestbook-message");
const guestbookCount = document.querySelector("#guestbook-count");

guestbookMessage?.addEventListener("input", () => {
  if (guestbookCount) guestbookCount.textContent = `${guestbookMessage.value.length}/500`;
});

guestbookForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!firebaseConfigured || !db) {
    setGuestbookStatus("Buku tamu belum terhubung dengan Firestore.", "error");
    return;
  }

  const formData = new FormData(guestbookForm);
  const name = String(formData.get("name") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!name || !message) {
    setGuestbookStatus("Nama dan pesan wajib diisi.", "error");
    return;
  }
  if (name.length > 50 || message.length > 500) {
    setGuestbookStatus("Nama maksimal 50 karakter dan pesan maksimal 500 karakter.", "error");
    return;
  }

  const submitButton = guestbookForm.querySelector(".guestbook-submit");
  submitButton.disabled = true;
  setGuestbookStatus("Mengirim pesan...");
  try {
    await addDoc(collection(db, "guestbook"), {
      name,
      message,
      createdAt: serverTimestamp(),
    });
    guestbookForm.reset();
    if (guestbookCount) guestbookCount.textContent = "0/500";
    setGuestbookStatus("Pesan berhasil ditambahkan. Terima kasih!", "success");
  } catch (error) {
    console.error("Pesan buku tamu gagal dikirim.", error);
    setGuestbookStatus("Pesan gagal dikirim. Coba lagi sebentar.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#topik")?.addEventListener("click", (event) => {
  const filter = event.target.closest(".filter-chip");
  if (!filter) return;
  selectedCategory = filter.dataset.category ?? "";
  for (const button of document.querySelectorAll(".filter-chip")) {
    button.classList.toggle("active", button === filter);
  }
  filterPosts();
});
searchInput?.addEventListener("input", filterPosts);
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    searchInput &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
  ) {
    event.preventDefault();
    searchInput.focus();
  }
});

filterPosts();
loadGuestbook();

const initialPathSlug = location.pathname.match(/^\/posts\/([^/]+)\/?$/)?.[1];
if (new URLSearchParams(location.search).has("post") || initialPathSlug) {
  loadPosts().then(() => {
    const slug = new URLSearchParams(location.search).get("post") ?? initialPathSlug;
    const post = posts.find((item) => item.slug === slug);
    if (post) renderArticle(post);
    else showStatus("Tulisan ini tidak ditemukan atau belum diterbitkan.");
  }).catch((error) => {
    console.error("Artikel gagal dimuat.", error);
    showStatus("Artikel gagal dimuat. Coba muat ulang halaman.");
  });
} else {
  loadPosts().catch((error) => {
    console.error("Artikel publik gagal dimuat.", error);
    showStatus("Tulisan terbaru belum dapat dimuat. Coba muat ulang halaman.");
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker gagal didaftarkan.", error);
    });
  });
}
