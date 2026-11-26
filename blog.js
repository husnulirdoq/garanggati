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

const menuToggle = document.querySelector(".menu-toggle");
const mainNavigation = document.querySelector("#main-navigation");

function closeNavigation() {
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Buka menu navigasi");
  mainNavigation?.classList.remove("open");
}

menuToggle?.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!open));
  menuToggle.setAttribute("aria-label", open ? "Buka menu navigasi" : "Tutup menu navigasi");
  mainNavigation?.classList.toggle("open", !open);
});

mainNavigation?.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeNavigation();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) closeNavigation();
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 650) closeNavigation();
});

const btcPrice = document.querySelector("#btc-price");
const btcChange = document.querySelector("#btc-change");
const btcStatus = document.querySelector("#btc-status");
const btcChartLine = document.querySelector("#btc-chart-line");
const btcChartArea = document.querySelector("#btc-chart-area");
const btcChartDescription = document.querySelector("#btc-chart-description");
const btcChartPoint = document.querySelector("#btc-chart-point");
const btcAxisHigh = document.querySelector("#btc-axis-high");
const btcAxisMid = document.querySelector("#btc-axis-mid");
const btcAxisLow = document.querySelector("#btc-axis-low");
const btcAxisStart = document.querySelector("#btc-axis-start");
const btcLivePrices = [];
const btcPriceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
let btcPollingTimer;
let btcPollingInProgress = false;
let btcStopped = false;
let btcDailyChange = null;

function setBtcStatus(message, isError = false) {
  if (!btcStatus) return;
  btcStatus.textContent = message;
  btcStatus.classList.toggle("error", isError);
}

function drawBtcChart() {
  const values = btcLivePrices.map((point) => point.price);
  if (!values.length || !btcChartLine || !btcChartArea) return;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.12, maximum * 0.0005);
  const low = minimum - padding;
  const high = maximum + padding;
  const points = values.map((price, index) => {
    const x = values.length === 1 ? 760 : (index / (values.length - 1)) * 760;
    const y = 220 - ((price - low) / (high - low)) * 200;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const linePoints = values.length === 1 ? `0,${points[0].split(",")[1]} ${points[0]}` : points.join(" ");
  btcChartLine.setAttribute("points", linePoints);
  btcChartArea.setAttribute("d", `M0,220 L${linePoints.replaceAll(" ", " L")} L760,220 Z`);
  btcChartPoint.setAttribute("cx", "760");
  btcChartPoint.setAttribute("cy", points.at(-1).split(",")[1]);
  btcChartPoint.style.display = "block";
  btcAxisHigh.textContent = btcPriceFormatter.format(high);
  btcAxisMid.textContent = btcPriceFormatter.format((high + low) / 2);
  btcAxisLow.textContent = btcPriceFormatter.format(low);

  btcChange.textContent = Number.isFinite(btcDailyChange)
    ? `${btcDailyChange >= 0 ? "+" : ""}${btcDailyChange.toFixed(2)}%`
    : "--";
  btcChange.classList.toggle("negative", btcDailyChange < 0);
  btcChartDescription.textContent =
    "Grafik harga agregat BTC/USD CoinPaprika sejak pemantauan dimulai.";
}

function addBtcPrice(price, timestamp) {
  if (!Number.isFinite(price) || price <= 0) return;
  const latestPoint = btcLivePrices.at(-1);
  if (latestPoint && timestamp <= latestPoint.time) return;
  btcLivePrices.push({ time: timestamp, price });
  const cutoff = Date.now() / 1000 - 24 * 60 * 60;
  while (btcLivePrices.length > 1 && btcLivePrices[0].time < cutoff) btcLivePrices.shift();
  while (btcLivePrices.length > 289) btcLivePrices.shift();
  if (btcLivePrices.length) {
    const first = new Date(btcLivePrices[0].time * 1000);
    btcAxisStart.textContent = `Mulai ${new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(first)}`;
  }
  btcPrice.textContent = btcPriceFormatter.format(price);
  drawBtcChart();
}

async function pollBtcTicker() {
  if (btcPollingInProgress) return;
  btcPollingInProgress = true;
  try {
    const response = await fetch("https://api.coinpaprika.com/v1/tickers/btc-bitcoin?quotes=USD");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const ticker = await response.json();
    const quote = ticker.quotes?.USD;
    const price = Number(quote?.price);
    const percentChange = Number(quote?.percent_change_24h);
    const updatedAt = Date.parse(ticker.last_updated);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(updatedAt)) {
      throw new Error("respons CoinPaprika tidak berisi harga dan waktu pembaruan yang valid");
    }

    btcDailyChange = Number.isFinite(percentChange) ? percentChange : null;
    addBtcPrice(price, updatedAt / 1000);
    const updatedTime = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(new Date(updatedAt));
    const ageMinutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60000));
    setBtcStatus(
      `CoinPaprika · sumber diperbarui ${updatedTime} WIB${ageMinutes ? ` · ${ageMinutes} menit lalu` : ""}`,
    );
  } catch (error) {
    console.error("BTC/USD ticker failed to load from CoinPaprika.", error);
    setBtcStatus(`Data CoinPaprika belum tersedia: ${error.message}`, true);
  } finally {
    btcPollingInProgress = false;
  }
}

function startBtcPolling() {
  if (btcPollingTimer || btcStopped) return;
  setBtcStatus("Mengambil harga BTC dari CoinPaprika...");
  pollBtcTicker();
  btcPollingTimer = window.setInterval(pollBtcTicker, 5 * 60 * 1000);
}

if (btcStatus) {
  startBtcPolling();

  window.addEventListener("pagehide", () => {
    btcStopped = true;
    window.clearInterval(btcPollingTimer);
    btcPollingTimer = null;
  });
  window.addEventListener("pageshow", () => {
    if (!btcStopped) return;
    btcStopped = false;
    startBtcPolling();
  });
}

const web3Connect = document.querySelector("#web3-connect");
const web3Wallet = document.querySelector("#web3-wallet");
const web3Form = document.querySelector("#web3-form");
const web3RecipientDisplay = document.querySelector("#web3-recipient-display");
const web3Amount = document.querySelector("#web3-amount");
const web3Submit = document.querySelector("#web3-submit");
const web3Status = document.querySelector("#web3-status");
const baseChainId = "0x2105";
const usdcContract = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const donationRecipient = "0x38BDa56d56D74A410e9ceaE5a981EbD722dd9613";
let connectedAccount = "";
if (web3RecipientDisplay) web3RecipientDisplay.textContent = donationRecipient;

function setWeb3Status(message, state = "") {
  if (!web3Status) return;
  web3Status.textContent = message;
  web3Status.className = `web3-status${state ? ` ${state}` : ""}`;
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function usdcToUnits(value) {
  const match = /^([0-9]+)(?:\.([0-9]{1,6}))?$/.exec(value);
  if (!match) throw new Error("Jumlah USDC harus positif dengan maksimal 6 angka desimal.");
  const units = BigInt(match[1]) * 1000000n + BigInt((match[2] ?? "").padEnd(6, "0") || "0");
  if (units <= 0n) throw new Error("Jumlah USDC harus lebih besar dari 0.");
  return units.toString(16).padStart(64, "0");
}

function encodeUsdcTransfer(recipient, amount) {
  const address = recipient.slice(2).toLowerCase().padStart(64, "0");
  return `0xa9059cbb${address}${usdcToUnits(amount)}`;
}

async function ensureBaseMainnet() {
  if (!window.ethereum) throw new Error("Wallet browser tidak ditemukan. Instal MetaMask atau wallet EVM.");
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId.toLowerCase() === baseChainId) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: baseChainId }],
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: baseChainId,
        chainName: "Base",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://mainnet.base.org"],
        blockExplorerUrls: ["https://basescan.org"],
      }],
    });
  }
}

async function connectWeb3() {
  if (!web3Connect) return;
  try {
    await ensureBaseMainnet();
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    connectedAccount = accounts[0] ?? "";
    if (!connectedAccount) throw new Error("Tidak ada akun wallet yang dipilih.");
    web3Wallet.textContent = `Terhubung: ${connectedAccount.slice(0, 6)}...${connectedAccount.slice(-4)}`;
    web3Connect.textContent = "Wallet terhubung";
    web3Submit.disabled = false;
    setWeb3Status("Wallet terhubung ke Base Mainnet. Transaksi memakai USDC sungguhan.", "success");
  } catch (error) {
    setWeb3Status(error?.message || "Gagal menghubungkan wallet.", "error");
  }
}

web3Connect?.addEventListener("click", connectWeb3);

web3Form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const amount = web3Amount?.value.trim() ?? "";
  if (!connectedAccount) {
    setWeb3Status("Hubungkan wallet terlebih dahulu.", "error");
    return;
  }
  if (!isAddress(donationRecipient) || !isAddress(usdcContract)) {
    setWeb3Status("Konfigurasi alamat donasi tidak valid. Transaksi dibatalkan.", "error");
    return;
  }
  try {
    const data = encodeUsdcTransfer(donationRecipient, amount);
    await ensureBaseMainnet();
    web3Submit.disabled = true;
    setWeb3Status("Periksa jumlah, token USDC, dan alamat penerima di wallet sebelum menyetujui.");
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{
        from: connectedAccount,
        to: usdcContract,
        value: "0x0",
        data,
      }],
    });
    setWeb3Status(`Transaksi dikirim. Lihat status di BaseScan: https://basescan.org/tx/${txHash}`, "success");
  } catch (error) {
    setWeb3Status(error?.message || "Transaksi dibatalkan atau gagal.", "error");
  } finally {
    web3Submit.disabled = false;
  }
});

if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", (accounts) => {
    connectedAccount = accounts[0] ?? "";
    if (connectedAccount) {
      web3Wallet.textContent = `Terhubung: ${connectedAccount.slice(0, 6)}...${connectedAccount.slice(-4)}`;
      web3Submit.disabled = false;
    } else {
      web3Wallet.textContent = "Wallet belum terhubung.";
      web3Submit.disabled = true;
      web3Connect.textContent = "Hubungkan wallet";
    }
  });
  window.ethereum.on?.("chainChanged", () => {
    window.ethereum.request({ method: "eth_chainId" }).then((chainId) => {
      if (chainId.toLowerCase() !== baseChainId) {
        web3Submit.disabled = true;
        setWeb3Status("Wallet tidak berada di Base Mainnet. Transaksi dinonaktifkan.", "error");
      } else {
        web3Submit.disabled = !connectedAccount;
        setWeb3Status("Wallet berada di Base Mainnet.", "success");
      }
    });
  });
}

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
  return `/posts/${encodeURIComponent(slug)}/`;
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
  setMeta("twitter:title", document.title);
  setMeta("twitter:description", post.excerpt);
  setProperty("og:type", "article");
  setProperty("og:title", document.title);
  setProperty("og:description", post.excerpt);
  setProperty("og:url", canonical);
  setMeta("twitter:card", "summary");
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
