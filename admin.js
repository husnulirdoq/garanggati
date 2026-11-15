import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import DOMPurify from "dompurify";
import { marked } from "marked";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "./firebase-client.js";

const notice = document.querySelector("#admin-notice");
const loginPanel = document.querySelector("#login-panel");
const workspace = document.querySelector("#admin-workspace");
const form = document.querySelector("#post-form");
const postList = document.querySelector("#admin-post-list");
const listStatus = document.querySelector("#post-list-status");
const slugInput = document.querySelector("#post-slug");
const bodyInput = document.querySelector("#post-body");
const bodyCount = document.querySelector("#body-count");
const bodyPreview = document.querySelector("#post-preview");
const editorStatus = document.querySelector("#editor-status");
let currentPosts = [];

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

function resetForm() {
  form.reset();
  document.querySelector("#post-id").value = "";
  document.querySelector("#post-date").value = new Date().toISOString().slice(0, 10);
  slugInput.readOnly = false;
  delete slugInput.dataset.edited;
  document.querySelector("#editor-title").textContent = "Tulisan baru";
  document.querySelector("#delete-post-button").hidden = true;
  updatePreview();
  editorStatus.textContent = "";
  delete editorStatus.dataset.dirty;
  delete editorStatus.dataset.saved;
}

function updatePreview() {
  bodyCount.textContent = `${bodyInput.value.length.toLocaleString("id-ID")} / 50.000`;
  bodyPreview.innerHTML = bodyInput.value
    ? DOMPurify.sanitize(marked.parse(bodyInput.value))
    : "";
}

function selectEditorTab(tab) {
  const writing = tab === "write";
  document.querySelector("#write-tab").classList.toggle("active", writing);
  document.querySelector("#write-tab").setAttribute("aria-selected", String(writing));
  document.querySelector("#preview-tab").classList.toggle("active", !writing);
  document.querySelector("#preview-tab").setAttribute("aria-selected", String(!writing));
  bodyInput.hidden = !writing;
  bodyPreview.hidden = writing;
  if (!writing) updatePreview();
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
  document.querySelector("#import-posts-button").hidden = currentPosts.length !== 0;
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
    showNotice("Tidak dapat membaca Firestore. Pastikan UID akun admin sudah dipasang pada firestore.rules dan rules sudah dipublikasikan.");
  }
}

function editPost(post) {
  clearNotice();
  document.querySelector("#post-id").value = post.id;
  document.querySelector("#post-title").value = post.title;
  slugInput.value = post.slug;
  slugInput.readOnly = true;
  document.querySelector("#post-date").value = post.date;
  document.querySelector("#post-category").value = post.category;
  document.querySelector("#post-excerpt").value = post.excerpt;
  document.querySelector("#post-body").value = post.body;
  document.querySelector("#post-published").checked = post.published;
  document.querySelector("#editor-title").textContent = "Edit tulisan";
  document.querySelector("#delete-post-button").hidden = false;
  updatePreview();
  setEditorStatus("Mengedit tulisan yang tersimpan.");
  selectEditorTab("write");
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
document.querySelector("#write-tab").addEventListener("click", () => selectEditorTab("write"));
document.querySelector("#preview-tab").addEventListener("click", () => selectEditorTab("preview"));

document.querySelector("#post-title").addEventListener("input", (event) => {
  if (!slugInput.readOnly && !slugInput.dataset.edited) slugInput.value = slugify(event.currentTarget.value);
});
slugInput.addEventListener("input", () => { slugInput.dataset.edited = "true"; });
form.addEventListener("input", (event) => {
  if (event.target === bodyInput) updatePreview();
  setEditorStatus("Ada perubahan yang belum disimpan.", "dirty");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();
  const slug = slugInput.value.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    showNotice("Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.");
    return;
  }
  const postId = document.querySelector("#post-id").value;
  const post = {
    title: document.querySelector("#post-title").value.trim(),
    slug,
    date: document.querySelector("#post-date").value,
    category: document.querySelector("#post-category").value.trim(),
    excerpt: document.querySelector("#post-excerpt").value.trim(),
    body: document.querySelector("#post-body").value.trim(),
    published: document.querySelector("#post-published").checked,
    updatedAt: serverTimestamp(),
  };
  if (!post.title || !post.date || !post.category || !post.excerpt || !post.body) {
    showNotice("Lengkapi semua kolom sebelum menyimpan.");
    return;
  }
  if (postId && postId !== slug) {
    showNotice("Slug tulisan yang sudah dibuat tidak bisa diubah.");
    return;
  }

  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  try {
    if (!postId && (await getDoc(doc(db, "posts", slug))).exists()) {
      showNotice("Slug tersebut sudah dipakai. Pilih slug lain.");
      return;
    }
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
    const batch = writeBatch(db);
    for (const post of starterPosts) {
      batch.set(doc(db, "posts", post.slug), { ...post, updatedAt: serverTimestamp() });
    }
    await batch.commit();
    showNotice(`${starterPosts.length} tulisan awal berhasil diimpor.`, "success");
    await loadPosts();
  } catch (error) {
    console.error("Impor tulisan awal gagal.", error);
    showNotice("Impor gagal. Periksa aturan Firestore dan koneksi, lalu coba lagi.");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#login-email").value = "";
document.querySelector("#post-date").value = new Date().toISOString().slice(0, 10);
updatePreview();
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
