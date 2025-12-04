const API = "http://127.0.0.1:5000";

let isAdmin = false; // حالة المستخدم (أدمن أو لا)

// ---------------- TOGGLE MENU --------------------
function toggleMenu() {
    let menu = document.getElementById("sideMenu");
    menu.classList.toggle("show");
}

// ---------------- LOGIN --------------------
async function login() {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    let response = await fetch(API + "/api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password})
    });

    let data = await response.json();

    if (data.success) {
        if (data.role === "admin")
            window.location.href = "/admin";
        else
            window.location.href = "/index";
    } else {
        document.getElementById("msg").innerHTML = "Wrong username or password!";
    }
}

// ---------------- REGISTER --------------------
async function register() {
    let username = document.getElementById("newUsername").value;
    let password = document.getElementById("newPassword").value;

    let response = await fetch(API + "/api/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password})
    });

    let data = await response.json();
    if (data.success) {
        document.getElementById("regMsg").innerHTML = "User registered successfully!";
    }
}

// ---------------- CHECK ADMIN --------------------
async function checkAdmin() {
    let res = await fetch(API + "/api/profile");
    let user = await res.json();
    if (user && user.role === "admin") {
        isAdmin = true;
        let adminLink = document.getElementById("adminLink");
        if (adminLink) adminLink.style.display = "block";
    }
}
checkAdmin();

// ---------------- SHOW BOOKS --------------------
let allBooks = [];

async function loadBooks() {
    let container = document.getElementById("books");
    if (!container) return;

    let response = await fetch(API + "/api/books");
    allBooks = await response.json();

    renderBooks(allBooks);
}

function renderBooks(books) {
    let container = document.getElementById("books");
    if (!container) return;
    container.innerHTML = "";

    if (books.length === 0) {
        container.innerHTML = "<p>No books found!</p>";
        return;
    }

    books.forEach(b => {
        container.innerHTML += `
            <div class="book-card">
                <img src="/covers/${b.cover_path}" alt="Cover" style="width:100px;height:150px;">
                <h3>${b.title}</h3>
                <p>${b.author}</p>
                <p><b>Category:</b> ${b.category}</p>
                <a href="${API}/api/download/${b.id}">Download</a>
            </div>
        `;
    });
}

// ---------------- SEARCH BOOKS --------------------
function searchBooks() {
    let query = document.getElementById("search").value.toLowerCase();
    let filtered = allBooks.filter(b =>
        b.title.toLowerCase().includes(query) ||
        b.author.toLowerCase().includes(query) ||
        (b.category && b.category.toLowerCase().includes(query))
    );
    renderBooks(filtered);
}

// ---------------- FILTER BY CATEGORY --------------------
function filterByCategory() {
    let selected = document.getElementById("categoryFilter").value;
    if (selected === "all") {
        renderBooks(allBooks);
    } else {
        let filtered = allBooks.filter(b => b.category === selected);
        renderBooks(filtered);
    }
}

// ---------------- ADD BOOK --------------------
let form = document.getElementById("addBookForm");
if (form) {
    form.onsubmit = async (e) => {
        e.preventDefault();
        let data = new FormData(form);

        let res = await fetch(API + "/api/addBook", {
            method: "POST",
            body: data
        });

        let out = await res.json();
        if (out.success) {
            document.getElementById("result").innerHTML = "Book added!";
        }
    };
}

// ---------------- LOAD CATEGORY FILTER --------------------
async function loadCategoryFilter() {
    let filter = document.getElementById("categoryFilter");
    if (!filter) return;

    let res = await fetch(API + "/api/categories");
    let cats = await res.json();
    cats.forEach(c => {
        filter.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
}
loadCategoryFilter();

// ---------------- DOWNLOAD HISTORY --------------------
async function loadHistory() {
    let container = document.getElementById("history");
    if (!container) return;

    let response = await fetch(API + "/api/downloadHistory");
    let history = await response.json();

    container.innerHTML = "<h3>Download History</h3>";
    if (history.length === 0) {
        container.innerHTML += "<p>No downloads yet.</p>";
        return;
    }

    history.forEach(h => {
        container.innerHTML += `
            <div class="history-item">
                <p><b>${h.title}</b> by ${h.author} (${h.category})</p>
                <p>Downloaded at: ${h.downloaded_at}</p>
            </div>
        `;
    });
}

// ---------------- PROFILE --------------------
async function loadProfile() {
    let container = document.getElementById("profile");
    if (!container) return;

    let response = await fetch(API + "/api/profile");
    let user = await response.json();

    container.innerHTML = "<h3>Profile</h3>";
    if (!user || user === "Unauthorized") {
        container.innerHTML += "<p>Not logged in.</p>";
        return;
    }

    container.innerHTML += `
        <p><b>Username:</b> ${user.username}</p>
        <p><b>Role:</b> ${user.role}</p>
    `;
}

// ---------------- AUTO LOAD --------------------
loadBooks();