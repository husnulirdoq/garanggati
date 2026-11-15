const STORAGE_KEY = "ruang-notes-v1";
const categories = ["Filsafat", "Bahasa", "Teknologi", "Belajar"];
const starterNotes = [
  {
    id: "stoikisme-01",
    title: "Lingkar kendali: membedakan yang bisa dan tidak bisa kita ubah",
    category: "Filsafat",
    content: "Epictetus membuka Enchiridion dengan pembedaan sederhana: ada hal yang berada dalam kendali kita, ada yang tidak. Penilaian, niat, dan tindakan kita termasuk yang pertama. Reputasi, tubuh, dan hasil akhir sering kali tidak sepenuhnya milik kita.\n\nLatihan: saat cemas, tulis apa yang bisa dilakukan sekarang—lalu lepaskan sisanya.",
    date: "2025-03-12",
    favorite: true,
  },
  {
    id: "bahasa-01",
    title: "Bahasa membentuk cara kita memperhatikan dunia",
    category: "Bahasa",
    content: "Kata bukan hanya label yang ditempelkan pada benda. Bahasa membantu kita memilah pengalaman, melihat pola, dan membagikan apa yang kita rasakan. Belajar kata baru kadang berarti menemukan perbedaan yang sebelumnya tak terlihat.",
    date: "2025-03-09",
    favorite: false,
  },
  {
    id: "ai-01",
    title: "AI sebagai alat berpikir, bukan pengganti rasa ingin tahu",
    category: "Teknologi",
    content: "Gunakan AI untuk membuka kemungkinan: meminta sudut pandang lain, merangkum bahan, atau menguji argumen. Tetapi rasa ingin tahu dan keputusan akhir tetap milik kita. Kualitas pertanyaan menentukan kualitas percakapan.",
    date: "2025-03-07",
    favorite: false,
  },
  {
    id: "belajar-01",
    title: "Belajar lebih dalam dengan menjelaskan kembali",
    category: "Belajar",
    content: "Setelah membaca sesuatu, tutup sumbernya dan coba jelaskan dengan kata-katamu sendiri. Bagian yang sulit dijelaskan adalah petunjuk tentang apa yang perlu dipelajari lagi. Hubungkan ide baru dengan contoh konkret dari kehidupan sehari-hari.",
    date: "2025-03-04",
    favorite: true,
  },
  {
    id: "filsafat-02",
    title: "Kebijaksanaan dimulai dari pertanyaan yang lebih baik",
    category: "Filsafat",
    content: "Alih-alih buru-buru bertanya apakah sebuah gagasan benar, kita bisa bertanya: dalam kondisi apa gagasan ini berguna? Asumsi apa yang dibawanya? Siapa yang mungkin melihatnya secara berbeda?",
    date: "2025-02-28",
    favorite: false,
  },
];

const grid = document.querySelector("#notes-grid");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const noteDialog = document.querySelector("#note-dialog");
const detailDialog = document.querySelector("#detail-dialog");
let view = "all";
let selectedCategory = "";
let selectedNoteId = null;
let toastTimer;

function readNotes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(starterNotes));
      return [...starterNotes];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isValidNote)) throw new Error("Format catatan tidak valid.");
    return parsed;
  } catch (error) {
    console.error("Catatan tidak dapat dimuat dari penyimpanan lokal.", error);
    showToast("Catatan tidak dapat dibaca. Penyimpanan browser mungkin tidak tersedia.");
    return [...starterNotes];
  }
}

function isValidNote(note) {
  return note && typeof note.id === "string" && typeof note.title === "string" &&
    typeof note.content === "string" && categories.includes(note.category) &&
    typeof note.date === "string" && typeof note.favorite === "boolean";
}

let notes = readNotes();

function persistNotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return true;
  } catch (error) {
    console.error("Catatan tidak dapat disimpan ke penyimpanan lokal.", error);
    showToast("Catatan gagal disimpan. Periksa ruang penyimpanan browser.");
    return false;
  }
}

function categoryColor(category) {
  return { Filsafat: "dot-lilac", Bahasa: "dot-orange", Teknologi: "dot-green", Belajar: "dot-blue" }[category];
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function filteredNotes() {
  const query = searchInput.value.trim().toLocaleLowerCase("id");
  return notes.filter((note) => {
    const matchesView = view !== "favorites" || note.favorite;
    const matchesCategory = !selectedCategory || note.category === selectedCategory;
    const matchesQuery = !query || `${note.title} ${note.content} ${note.category}`.toLocaleLowerCase("id").includes(query);
    return matchesView && matchesCategory && matchesQuery;
  }).sort((a, b) => {
    if (sortSelect.value === "az") return a.title.localeCompare(b.title, "id");
    const order = sortSelect.value === "oldest" ? 1 : -1;
    return order * a.date.localeCompare(b.date);
  });
}

function createCard(note) {
  const card = document.createElement("article");
  card.className = "note-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Buka catatan: ${note.title}`);

  const top = document.createElement("div");
  top.className = "card-top";
  const tag = document.createElement("span");
  tag.className = "category-tag";
  const dot = document.createElement("span");
  dot.className = `topic-dot ${categoryColor(note.category)}`;
  tag.append(dot, document.createTextNode(note.category));
  const favorite = document.createElement("button");
  favorite.className = `favorite-button${note.favorite ? " is-favorite" : ""}`;
  favorite.type = "button";
  favorite.textContent = note.favorite ? "♥" : "♡";
  favorite.setAttribute("aria-label", note.favorite ? "Hapus dari favorit" : "Tambahkan ke favorit");
  favorite.setAttribute("aria-pressed", String(note.favorite));
  favorite.addEventListener("click", (event) => {
    event.stopPropagation();
    const previousFavorite = note.favorite;
    note.favorite = !note.favorite;
    if (persistNotes()) render();
    else note.favorite = previousFavorite;
  });
  top.append(tag, favorite);

  const title = document.createElement("h2");
  title.textContent = note.title;
  const excerpt = document.createElement("p");
  excerpt.className = "note-excerpt";
  excerpt.textContent = note.content;
  const footer = document.createElement("div");
  footer.className = "card-footer";
  const date = document.createElement("span");
  date.textContent = formatDate(note.date);
  const open = document.createElement("span");
  open.className = "read-more";
  open.textContent = "Baca catatan →";
  footer.append(date, open);
  card.append(top, title, excerpt, footer);
  card.addEventListener("click", () => openDetail(note.id));
  card.addEventListener("keydown", (event) => {
    if (event.target === card && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openDetail(note.id);
    }
  });
  return card;
}

function render() {
  const visibleNotes = filteredNotes();
  grid.replaceChildren(...visibleNotes.map(createCard));
  grid.hidden = visibleNotes.length === 0;
  emptyState.hidden = visibleNotes.length !== 0;
  document.querySelector("#all-count").textContent = String(notes.length);
  document.querySelector("#result-count").textContent = `${visibleNotes.length} catatan`;
  document.querySelector("#footer-count").textContent = `${notes.length} catatan`;
}

function setView(nextView, category = "") {
  view = nextView;
  selectedCategory = category;
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view && !category);
  });
  document.querySelectorAll(".topic-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === category);
  });
  let title = category || (view === "favorites" ? "Favorit" : "Semua catatan");
  if (searchInput.value.trim()) title = "Hasil pencarian";
  document.querySelector("#page-title").textContent = title;
  const heading = document.querySelector("#page-title");
  const period = document.createElement("span");
  period.className = "heading-period";
  period.textContent = ".";
  heading.append(period);
  document.querySelector("#breadcrumb-current").textContent = title;
  render();
}

function openDetail(id) {
  const note = notes.find((item) => item.id === id);
  if (!note) return;
  selectedNoteId = id;
  document.querySelector("#detail-category").textContent = note.category;
  document.querySelector("#detail-title").textContent = note.title;
  document.querySelector("#detail-date").textContent = formatDate(note.date);
  document.querySelector("#detail-body").textContent = note.content;
  detailDialog.showModal();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});
document.querySelectorAll(".topic-link").forEach((button) => {
  button.addEventListener("click", () => setView("all", button.dataset.category));
});
searchInput.addEventListener("input", () => setView(view, selectedCategory));
sortSelect.addEventListener("change", render);

function openNewNote() {
  document.querySelector("#note-form").reset();
  noteDialog.showModal();
  document.querySelector("#note-title").focus();
}
document.querySelector("#new-note-button").addEventListener("click", openNewNote);
document.querySelector("#empty-create-button").addEventListener("click", openNewNote);
document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", () => noteDialog.close()));
document.querySelectorAll(".close-detail").forEach((button) => button.addEventListener("click", () => detailDialog.close()));

document.querySelector("#note-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const note = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: String(form.get("title")).trim(),
    category: String(form.get("category")),
    content: String(form.get("content")).trim(),
    date: new Date().toISOString().slice(0, 10),
    favorite: false,
  };
  if (!note.title || !note.content || !categories.includes(note.category)) return;
  notes.unshift(note);
  if (!persistNotes()) {
    notes.shift();
    return;
  }
  noteDialog.close();
  searchInput.value = "";
  setView("all");
  showToast("Catatan baru tersimpan.");
});

document.querySelector("#delete-note-button").addEventListener("click", () => {
  if (!selectedNoteId) return;
  const previous = notes;
  notes = notes.filter((note) => note.id !== selectedNoteId);
  if (!persistNotes()) {
    notes = previous;
    return;
  }
  detailDialog.close();
  selectedNoteId = null;
  render();
  showToast("Catatan dihapus.");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape") {
    if (noteDialog.open) noteDialog.close();
    if (detailDialog.open) detailDialog.close();
  }
});

const today = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
document.querySelector("#today-label").textContent = today.toLocaleUpperCase("id-ID");
function updateConnectionStatus() {
  const online = navigator.onLine;
  document.querySelector("#connection-label").textContent = online ? "Data tersimpan di perangkat" : "Mode offline aktif";
  document.querySelector("#connection-dot").classList.toggle("offline", !online);
}
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();

let installPrompt;
const installButton = document.querySelector("#install-button");
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});
window.addEventListener("appinstalled", () => {
  installButton.hidden = true;
  showToast("Ruang berhasil dipasang.");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker gagal didaftarkan.", error);
    });
  });
}

render();
