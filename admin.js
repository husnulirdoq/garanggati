import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import DOMPurify from "dompurify";
import { marked } from "marked";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "./firebase-client.js";

const notice = document.querySelector("#admin-notice");
const loginPanel = document.querySelector("#login-panel");
const workspace = document.querySelector("#admin-workspace");
const form = document.querySelector("#post-form");
const postList = document.querySelector("#admin-post-list");
const listStatus = document.querySelector("#post-list-status");
const categorySelect = document.querySelector("#post-category");
const bodyInput = document.querySelector("#post-body");
const bodyCount = document.querySelector("#body-count");
const editorStatus = document.querySelector("#editor-status");
let currentPosts = [];
const articleTags = [
  "a", "blockquote", "br", "code", "em", "h2", "h3", "h4", "hr", "li",
  "ol", "p", "pre", "strong", "ul",
];

function showNotice(message, type = "error") {
  notice.textContent = message;
  notice.className = `admin-notice ${type}`;
  notice.hidden = false;
}

function clearNotice() {
  notice.hidden = true;
  notice.textContent = "";
  notice.className = "admin-notice";
}

function slugify(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function createUniqueSlug(title) {
  const baseSlug = slugify(title) || "tulisan";
  let slug = baseSlug;
  let suffix = 2;
  while ((await getDoc(doc(db, "posts", slug))).exists()) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function resetForm() {
  categorySelect.querySelectorAll("[data-legacy-category]").forEach((option) => option.remove());
  form.reset();
  bodyInput.replaceChildren();
  document.querySelector("#post-id").value = "";
  document.querySelector("#post-date").value = new Date().toISOString().slice(0, 10);
  document.querySelector("#editor-title").textContent = "Tulisan baru";
  document.querySelector("#delete-post-button").hidden = true;
  updateBodyCount();
  editorStatus.textContent = "";
  delete editorStatus.dataset.dirty;
  delete editorStatus.dataset.saved;
}

function cleanArticleHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: articleTags,
    ALLOWED_ATTR: ["href", "title"],
  });
}

function updateBodyCount() {
  bodyCount.textContent = `${bodyInput.textContent.length.toLocaleString("id-ID")} / 50.000`;
}

function getEditorBody() {
  const content = bodyInput.cloneNode(true);
  content.querySelectorAll("b, i, div").forEach((element) => {
    const tag = element.tagName === "B" ? "strong" : element.tagName === "I" ? "em" : "p";
    const replacement = document.createElement(tag);
    replacement.replaceChildren(...element.childNodes);
    element.replaceWith(replacement);
  });
  return cleanArticleHtml(content.innerHTML).trim();
}

function setEditorStatus(message, state) {
  editorStatus.textContent = message;
  delete editorStatus.dataset.dirty;
  delete editorStatus.dataset.saved;
  if (state) editorStatus.dataset[state] = "true";
}

function renderPosts() {
  const rows = currentPosts.map((post) => {
    const item = document.createElement("li");
    const summary = document.createElement("div");
    summary.className = "admin-post-summary";
    const title = document.createElement("strong");
    title.textContent = post.title;
    const meta = document.createElement("span");
    meta.textContent = `${post.category} · ${post.date} · ${post.published ? "Terbit" : "Draf"}`;
    summary.append(title, meta);

    const edit = document.createElement("button");
    edit.className = "secondary-button";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editPost(post));
    item.append(summary, edit);
    return item;
  });
  postList.replaceChildren(...rows);
  listStatus.textContent = currentPosts.length
    ? `${currentPosts.length} tulisan`
    : "Belum ada tulisan tersimpan.";
}

async function loadPosts() {
  listStatus.textContent = "Memuat tulisan...";
  try {
    const snapshot = await getDocs(collection(db, "posts"));
    currentPosts = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => b.date.localeCompare(a.date));
    renderPosts();
  } catch (error) {
    console.error("Daftar tulisan gagal dimuat dari Firestore.", error);
    listStatus.textContent = "Tulisan gagal dimuat.";
    if (error.code === "permission-denied") {
      const uid = auth.currentUser?.uid ?? "tidak tersedia";
      showNotice(`Akses Firestore ditolak untuk UID ${uid}. Cocokkan UID ini dengan isAdmin() di firestore.rules, lalu publikasikan rules pada project Firebase yang benar.`);
    } else {
      showNotice(`Tulisan gagal dimuat dari Firestore (${error.code ?? "error tidak diketahui"}). Periksa koneksi dan konfigurasi Firebase.`);
    }
  }
}

function editPost(post) {
  clearNotice();
  document.querySelector("#post-id").value = post.id;
  document.querySelector("#post-title").value = post.title;
  document.querySelector("#post-date").value = post.date;
  if (![...categorySelect.options].some((option) => option.value === post.category)) {
    const option = document.createElement("option");
    option.value = post.category;
    option.textContent = `${post.category} (kategori lama)`;
    option.dataset.legacyCategory = "true";
    categorySelect.append(option);
  }
  categorySelect.value = post.category;
  document.querySelector("#post-excerpt").value = post.excerpt;
  bodyInput.innerHTML = cleanArticleHtml(marked.parse(post.body));
  document.querySelector("#post-published").checked = post.published;
  document.querySelector("#editor-title").textContent = "Edit tulisan";
  document.querySelector("#delete-post-button").hidden = false;
  updateBodyCount();
  setEditorStatus("Mengedit tulisan yang tersimpan.");
  document.querySelector("#post-title").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();
  const email = document.querySelector("#login-email").value.trim();
  const password = document.querySelector("#login-password").value;
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Memeriksa akun…";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Login admin gagal.", error);
    const messages = {
      "auth/invalid-credential": "Email atau kata sandi tidak cocok. Coba lagi atau gunakan tautan lupa kata sandi.",
      "auth/invalid-email": "Format email belum benar.",
      "auth/too-many-requests": "Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.",
      "auth/network-request-failed": "Koneksi bermasalah. Periksa internet lalu coba lagi.",
      "auth/operation-not-allowed": "Login email belum diaktifkan di Firebase Authentication.",
      "auth/unauthorized-domain": "Domain situs belum diizinkan di Firebase Authentication.",
    };
    showNotice(messages[error.code] ?? "Login gagal. Periksa email dan kata sandi, lalu coba lagi.");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Masuk ke dashboard <span aria-hidden="true">→</span>';
  }
});

document.querySelector("#reset-password-button").addEventListener("click", async () => {
  clearNotice();
  const email = document.querySelector("#login-email").value.trim();
  if (!email) {
    showNotice("Masukkan email akun admin terlebih dahulu untuk menerima tautan reset kata sandi.");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showNotice("Jika email terdaftar, tautan reset kata sandi akan dikirim.", "success");
  } catch (error) {
    console.error("Permintaan reset kata sandi gagal.", error);
    showNotice("Tautan reset kata sandi gagal dikirim. Pastikan domain situs sudah diizinkan pada Firebase Authentication.");
  }
});

document.querySelector("#sign-out-button").addEventListener("click", async () => {
  try {
    await signOut(auth);
    resetForm();
    clearNotice();
  } catch (error) {
    console.error("Logout admin gagal.", error);
    showNotice("Logout gagal. Coba muat ulang halaman.");
  }
});

document.querySelector("#new-post-button").addEventListener("click", () => {
  resetForm();
  clearNotice();
  document.querySelector("#post-title").focus();
});
document.querySelector("#cancel-edit-button").addEventListener("click", () => {
  resetForm();
  clearNotice();
});

document.querySelector("#editor-toolbar").querySelectorAll("button").forEach((button) => {
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    const command = button.dataset.command;
    let value = button.dataset.value;
    if (command === "createLink") {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !bodyInput.contains(selection.anchorNode)) {
        showNotice("Pilih teks yang ingin dijadikan tautan terlebih dahulu.");
        return;
      }
      value = window.prompt("Masukkan alamat tautan:");
      if (!value) return;
      let protocol;
      try {
        protocol = new URL(value, window.location.href).protocol;
      } catch {
        showNotice("Alamat tautan tidak valid.");
        return;
      }
      if (!["http:", "https:", "mailto:"].includes(protocol)) {
        showNotice("Tautan hanya boleh menggunakan http, https, atau email.");
        return;
      }
    }
    bodyInput.focus();
    document.execCommand(command, false, value);
    updateBodyCount();
    setEditorStatus("Ada perubahan yang belum disimpan.", "dirty");
  });
});

form.addEventListener("input", (event) => {
  if (bodyInput.contains(event.target)) updateBodyCount();
  setEditorStatus("Ada perubahan yang belum disimpan.", "dirty");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();
  const postId = document.querySelector("#post-id").value;
  const post = {
    title: document.querySelector("#post-title").value.trim(),
    date: document.querySelector("#post-date").value,
    category: categorySelect.value,
    excerpt: document.querySelector("#post-excerpt").value.trim(),
    body: getEditorBody(),
    published: document.querySelector("#post-published").checked,
  };
  if (!post.title || !post.date || !post.category || !post.excerpt || !bodyInput.textContent.trim()) {
    showNotice("Lengkapi semua kolom sebelum menyimpan.");
    return;
  }
  if (post.body.length > 50000) {
    showNotice("Isi artikel melebihi batas 50.000 karakter setelah pemformatan. Kurangi isi atau pemformatannya.");
    return;
  }

  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  try {
    const slug = postId || await createUniqueSlug(post.title);
    post.slug = slug;
    post.updatedAt = serverTimestamp();
    await setDoc(doc(db, "posts", slug), post);
    showNotice("Tulisan berhasil disimpan.", "success");
    resetForm();
    setEditorStatus("Perubahan tersimpan.", "saved");
    await loadPosts();
  } catch (error) {
    console.error("Tulisan gagal disimpan ke Firestore.", error);
    showNotice("Tulisan gagal disimpan. Pastikan aturan Firestore mengizinkan UID admin ini.");
  } finally {
    saveButton.disabled = false;
  }
});

document.querySelector("#delete-post-button").addEventListener("click", async () => {
  const postId = document.querySelector("#post-id").value;
  const post = currentPosts.find((entry) => entry.id === postId);
  if (!postId || !post || !window.confirm(`Hapus tulisan “${post.title}” secara permanen?`)) return;
  try {
    await deleteDoc(doc(db, "posts", postId));
    resetForm();
    showNotice("Tulisan berhasil dihapus.", "success");
    await loadPosts();
  } catch (error) {
    console.error("Tulisan gagal dihapus dari Firestore.", error);
    showNotice("Tulisan gagal dihapus. Pastikan aturan Firestore mengizinkan UID admin ini.");
  }
});

document.querySelector("#import-posts-button").addEventListener("click", async () => {
  const button = document.querySelector("#import-posts-button");
  button.disabled = true;
  clearNotice();
  try {
    const response = await fetch("/posts.json");
    if (!response.ok) throw new Error(`Seed artikel tidak tersedia (HTTP ${response.status}).`);
    const starterPosts = await response.json();
    const importedCount = await runTransaction(db, async (transaction) => {
      const existingPosts = [];
      for (const post of starterPosts) {
        existingPosts.push(await transaction.get(doc(db, "posts", post.slug)));
      }

      let count = 0;
      starterPosts.forEach((post, index) => {
        if (existingPosts[index].exists()) return;
        transaction.set(doc(db, "posts", post.slug), { ...post, updatedAt: serverTimestamp() });
        count += 1;
      });
      return count;
    });
    showNotice(
      importedCount
        ? `${importedCount} tulisan baru diimpor. Tulisan yang sudah ada tidak diubah.`
        : "Tidak ada tulisan baru untuk diimpor. Tulisan yang sudah ada tidak diubah.",
      "success",
    );
    await loadPosts();
  } catch (error) {
    console.error("Impor tulisan awal gagal.", error);
    showNotice(`Impor gagal (${error.code ?? error.message ?? "error tidak diketahui"}). Periksa aturan Firestore dan koneksi, lalu coba lagi.`);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#login-email").value = "";
document.querySelector("#post-date").value = new Date().toISOString().slice(0, 10);
updateBodyCount();
if (!firebaseConfigured) {
  document.querySelector("#login-form").querySelectorAll("input, button").forEach((element) => { element.disabled = true; });
  showNotice("Firebase belum dikonfigurasi. Ikuti bagian setup Firebase di README sebelum menggunakan panel admin.");
} else {
  onAuthStateChanged(auth, async (user) => {
    loginPanel.hidden = Boolean(user);
    workspace.hidden = !user;
    if (!user) {
      currentPosts = [];
      postList.replaceChildren();
      return;
    }
    document.querySelector("#signed-in-email").textContent = user.email ?? "Admin";
    clearNotice();
    await loadPosts();
  });
}
