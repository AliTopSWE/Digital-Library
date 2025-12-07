// static/script.js
const API = "";
let isAdmin = false;
let allBooks = [];

/* ----------------- Theme handling (removed) ----------------- */
/* Dark mode removed as requested. */

/* ----------------- Helpers ----------------- */
function showCenterMessage(text, type = "info") {
  const msg = document.createElement("div");
  msg.className = "center-msg " + type;
  msg.innerText = text;
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 2000);
}
function escapeHtml(s){ return (s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* ----------------- Menu & Admin check ----------------- */
function toggleMenu() {
  const menu = document.getElementById("sideMenu");
  if (!menu) return;
  menu.classList.toggle("show");
}
async function checkAdmin() {
  try {
    const res = await fetch(API + "/api/profile");
    if (!res.ok) return false;
    const user = await res.json();
    isAdmin = user.role === "admin";
    const adminLink = document.getElementById("adminLink");
    if (adminLink) adminLink.style.display = isAdmin ? "block" : "none";
  } catch {
    isAdmin = false;
  }
  return isAdmin;
}

/* ----------------- Index: load & render books ----------------- */
async function loadBooks() {
  const container = document.getElementById("books");
  if (!container) return;
  try {
    const res = await fetch(API + "/api/books");
    allBooks = await res.json();
    renderBooks(allBooks);
  } catch (e) {
    console.error(e);
    container.innerHTML = "<p>Error loading books.</p>";
  }
}
function renderBooks(books) {
  const container = document.getElementById("books");
  if (!container) return;
  container.innerHTML = "";
  if (!books || books.length === 0) {
    container.innerHTML = "<p>No books found!</p>";
    return;
  }
  books.forEach(b => {
    container.innerHTML += `
      <div class="book-card">
        <img src="/covers/${b.cover_path}" alt="Cover" class="cover" loading="lazy">
        <div class="book-info">
          <h3>${escapeHtml(b.title)}</h3>
          <p class="muted-text">${escapeHtml(b.author)}</p>
          <p class="muted-text"><b>Category:</b> ${b.category || "-"}</p>
        </div>
        <div class="book-actions">
          <a class="btn" href="${API}/api/download/${b.id}">Download</a>
        </div>
      </div>
    `;
  });
}
function searchBooks() {
  const q = (document.getElementById("search")?.value || "").toLowerCase();
  const filtered = allBooks.filter(b =>
    (b.title || "").toLowerCase().includes(q) ||
    (b.author || "").toLowerCase().includes(q) ||
    (b.category || "").toLowerCase().includes(q)
  );
  renderBooks(filtered);
}
async function loadCategoryFilter() {
  const filter = document.getElementById("categoryFilter");
  if (!filter) return;
  try {
    const res = await fetch(API + "/api/categories");
    const cats = await res.json();
    filter.innerHTML = `<option value="all">All Categories</option>`;
    cats.forEach(c => filter.innerHTML += `<option value="${c.name}">${c.name}</option>`);
  } catch (e) { console.error(e); }
}
function filterByCategory() {
  const sel = document.getElementById("categoryFilter")?.value;
  if (!sel || sel === "all") return renderBooks(allBooks);
  renderBooks(allBooks.filter(b => b.category === sel));
}

/* ----------------- Admin: load, search, add ----------------- */
async function loadAdminBooks() {
  const container = document.getElementById("adminBooks");
  if (!container) return;
  try {
    const res = await fetch(API + "/api/books");
    const books = await res.json();
    allBooks = books;
    container.innerHTML = "";
    if (!books || books.length === 0) {
      container.innerHTML = "<p>No books found!</p>";
      return;
    }
    books.forEach(b => {
      container.innerHTML += `
        <div class="book-card admin">
          <img src="/covers/${b.cover_path}" alt="Cover" class="cover" loading="lazy">
          <div class="book-info">
            <h3>${escapeHtml(b.title)}</h3>
            <p class="muted-text">${escapeHtml(b.author)}</p>
            <p class="muted-text"><b>Category:</b> ${b.category || "-"}</p>
          </div>
          <div class="admin-actions">
            <button class="btn-warning" onclick="openEditModal(${b.id})">Edit</button>
            <button class="btn-danger" onclick="confirmDeleteModal(${b.id})">Delete</button>
          </div>
        </div>
      `;
    });
  } catch (e) { console.error(e); container.innerHTML = "<p>Error loading admin books.</p>"; }
}
function adminSearchBooks() {
  const q = (document.getElementById("adminSearch")?.value || "").toLowerCase();
  const filtered = allBooks.filter(b =>
    (b.title || "").toLowerCase().includes(q) ||
    (b.author || "").toLowerCase().includes(q) ||
    (b.category || "").toLowerCase().includes(q)
  );
  const container = document.getElementById("adminBooks");
  if (!container) return;
  container.innerHTML = "";
  filtered.forEach(b => {
    container.innerHTML += `
      <div class="book-card admin">
        <img src="/covers/${b.cover_path}" alt="Cover" class="cover" loading="lazy">
        <div class="book-info">
          <h3>${escapeHtml(b.title)}</h3>
          <p class="muted-text">${escapeHtml(b.author)}</p>
          <p class="muted-text"><b>Category:</b> ${b.category || "-"}</p>
        </div>
        <div class="admin-actions">
          <button class="btn-warning" onclick="openEditModal(${b.id})">Edit</button>
          <button class="btn-danger" onclick="confirmDeleteModal(${b.id})">Delete</button>
        </div>
      </div>
    `;
  });
}
const addForm = document.getElementById("addBookForm");
if (addForm) {
  addForm.onsubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(addForm);
    try {
      const res = await fetch(API + "/api/addBook", { method: "POST", body: data });
      const out = await res.json();
      if (out.success) { showCenterMessage("Book added successfully!", "success"); addForm.reset(); await loadAdminBooks(); }
      else showCenterMessage(out.message || "Failed to add book.", "error");
    } catch (err) { console.error(err); showCenterMessage("Add failed. Check console.", "error"); }
  };
}

/* ----------------- Delete with confirmation ----------------- */
function confirmDeleteModal(id) {
  if (!isAdmin) return;
  const confirmModal = document.createElement("div");
  confirmModal.className = "modal-backdrop";
  confirmModal.innerHTML = `
    <div class="modal">
      <h3>Confirm delete</h3>
      <p>Are you sure you want to permanently delete this book?</p>
      <div class="modal-actions">
        <button class="btn-danger" id="confirmDelete">Delete</button>
        <button class="btn-secondary" id="cancelDelete">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);
  confirmModal.querySelector("#cancelDelete").onclick = () => confirmModal.remove();
  confirmModal.querySelector("#confirmDelete").onclick = async () => {
    try {
      const res = await fetch(API + "/api/deleteBook/" + id, { method: "POST" });
      const out = await res.json();
      if (out.success) { showCenterMessage("تم حذف الكتاب بنجاح", "success"); await loadAdminBooks(); }
      else showCenterMessage(out.message || "فشل الحذف", "error");
    } catch (e) { console.error(e); showCenterMessage("حدث خطأ أثناء الحذف. راجع الكونسول.", "error"); }
    finally { confirmModal.remove(); }
  };
}

/* ----------------- Edit modal with confirmation ----------------- */
function openEditModal(id) {
  if (document.querySelector(".modal-backdrop")) return;
  const book = allBooks.find(b => b.id === id);
  if (!book) { showCenterMessage("Book not found", "error"); return; }
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal">
      <h3>Edit Book</h3>
      <label>Title</label><input id="editTitle" value="${escapeHtml(book.title)}">
      <label>Author</label><input id="editAuthor" value="${escapeHtml(book.author)}">
      <label>Category</label><select id="editCategory"></select>
      <label>New File (optional)</label><input type="file" id="editFile">
      <label>New Cover (optional)</label><input type="file" id="editCover">
      <div class="modal-actions">
        <button class="btn" id="saveEdit">Save</button>
        <button class="btn-secondary" id="cancelEdit">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  (async () => {
    try {
      const res = await fetch(API + "/api/categories");
      const cats = await res.json();
      const select = modal.querySelector("#editCategory");
      select.innerHTML = "";
      cats.forEach(c => {
        const sel = (book.category_id === c.id) ? 'selected' : '';
        select.innerHTML += `<option value="${c.id}" ${sel}>${c.name}</option>`;
      });
    } catch (e) { console.error(e); showCenterMessage("Could not load categories", "error"); }
  })();

  modal.querySelector("#cancelEdit").onclick = () => modal.remove();

  modal.querySelector("#saveEdit").onclick = async () => {
    const title = modal.querySelector("#editTitle").value.trim();
    const author = modal.querySelector("#editAuthor").value.trim();
    const category_id = modal.querySelector("#editCategory").value;
    if (!title || !author || !category_id) { showCenterMessage("Title, author and category required", "error"); return; }

    const confirmSave = document.createElement("div");
    confirmSave.className = "modal-backdrop";
    confirmSave.innerHTML = `
      <div class="modal">
        <h3>تأكيد التعديل</h3>
        <p>هل تريد حفظ التغييرات على هذا الكتاب؟</p>
        <div class="modal-actions">
          <button class="btn" id="confirmSaveBtn">حفظ</button>
          <button class="btn-secondary" id="cancelSaveBtn">إلغاء</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmSave);
    confirmSave.querySelector("#cancelSaveBtn").onclick = () => confirmSave.remove();

    confirmSave.querySelector("#confirmSaveBtn").onclick = async () => {
      confirmSave.querySelector("#confirmSaveBtn").disabled = true;
      const file = modal.querySelector("#editFile").files[0];
      const cover = modal.querySelector("#editCover").files[0];
      const formData = new FormData();
      formData.append("title", title); formData.append("author", author); formData.append("category_id", category_id);
      if (file) formData.append("file", file); if (cover) formData.append("cover", cover);

      try {
        const res = await fetch(API + "/api/editBook/" + id, { method: "POST", body: formData });
        const out = await res.json();
        if (res.ok && out.success) {
          showCenterMessage("تم حفظ التعديلات بنجاح", "success");
          modal.remove(); await loadAdminBooks();
        } else {
          showCenterMessage(out.message || "فشل التحديث", "error"); console.error("Edit error:", out);
        }
      } catch (e) { console.error(e); showCenterMessage("حدث خطأ أثناء التحديث. راجع الكونسول.", "error"); }
      finally { confirmSave.remove(); }
    };
  };
}

/* ----------------- History & Profile ----------------- */
async function loadHistory() {
  const container = document.getElementById("history");
  if (!container) return;
  try {
    const res = await fetch(API + "/api/downloadHistory");
    if (!res.ok) { container.innerHTML = "<p>Unauthorized or error.</p>"; return; }
    const history = await res.json();
    container.innerHTML = "<h3>Download History</h3>";
    if (!history || history.length === 0) { container.innerHTML += "<p>No downloads yet.</p>"; return; }
    let table = `<table class="table"><tr><th>Title</th><th>Author</th><th>Category</th><th>Downloaded At</th></tr>`;
    history.forEach(h => { table += `<tr><td>${escapeHtml(h.title)}</td><td>${escapeHtml(h.author)}</td><td>${escapeHtml(h.category || "-")}</td><td>${escapeHtml(h.downloaded_at)}</td></tr>`; });
    table += "</table>"; container.innerHTML += table;
  } catch (e) { console.error(e); container.innerHTML = "<p>Error loading history.</p>"; }
}
async function loadProfile() {
  const container = document.getElementById("profile");
  if (!container) return;
  try {
    const res = await fetch(API + "/api/profile");
    if (!res.ok) { showCenterMessage("You are not logged in!", "error"); container.innerHTML = "<p>Not logged in.</p>"; return; }
    const user = await res.json();
    container.innerHTML = `<p><b>Username:</b> ${escapeHtml(user.username)}</p><p><b>Role:</b> ${escapeHtml(user.role)}</p>`;
  } catch (e) { console.error(e); }
}

/* ----------------- Inject theme button removed ----------------- */
/* No theme button needed per request. */

/* ----------------- Init ----------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await checkAdmin();
  if (document.getElementById("books")) { loadBooks(); loadCategoryFilter(); }
  if (document.getElementById("adminBooks")) { loadAdminBooks(); }
  if (document.getElementById("history")) { loadHistory(); }
  if (document.getElementById("profile")) { loadProfile(); }

  const addFormLocal = document.getElementById("addBookForm");
  if (addFormLocal) {
    addFormLocal.onsubmit = async (e) => {
      e.preventDefault();
      const data = new FormData(addFormLocal);
      try {
        const res = await fetch(API + "/api/addBook", { method: "POST", body: data });
        const out = await res.json();
        if (out.success) { showCenterMessage("Book added successfully!", "success"); addFormLocal.reset(); await loadAdminBooks(); }
        else showCenterMessage(out.message || "Failed to add book.", "error");
      } catch (err) { console.error(err); showCenterMessage("Add failed. Check console.", "error"); }
    };
  }
});