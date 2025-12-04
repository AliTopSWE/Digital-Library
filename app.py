from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_connection
import os

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = "supersecretkey"
CORS(app)

UPLOAD_FOLDER = "uploads"
COVER_FOLDER = "covers"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(COVER_FOLDER, exist_ok=True)

# ---------------- REGISTER USER --------------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    username = data["username"]
    password = generate_password_hash(data["password"])
    role = "user"   # ثابت user

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO users (username, password, role) VALUES (%s, %s, %s)",
                   (username, password, role))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"success": True})

# ---------------- LOGIN --------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    username = data["username"]
    password = data["password"]

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username=%s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if user and check_password_hash(user["password"], password):
        session["user"] = {"id": user["id"], "role": user["role"]}
        return jsonify({"success": True, "role": user["role"]})
    return jsonify({"success": False})

# ---------------- LOGOUT --------------------
@app.route("/api/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("home"))

# ---------------- GET BOOKS --------------------
@app.route("/api/books")
def get_books():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT b.id, b.title, b.author, b.file_path, b.cover_path, c.name AS category
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
    """)
    books = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(books)

# ---------------- DOWNLOAD BOOK --------------------
@app.route("/api/download/<int:book_id>")
def download_book(book_id):
    if "user" not in session:
        return "Unauthorized", 403

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT file_path FROM books WHERE id=%s", (book_id,))
    row = cursor.fetchone()

    if row:
        cursor.execute("INSERT INTO download_history (user_id, book_id) VALUES (%s, %s)",
                       (session["user"]["id"], book_id))
        conn.commit()
        cursor.close()
        conn.close()
        return send_file(row["file_path"], as_attachment=True)

    cursor.close()
    conn.close()
    return "File not found", 404

# ---------------- ADD BOOK (ADMIN) --------------------
@app.route("/api/addBook", methods=["POST"])
def add_book():
    if "user" not in session or session["user"]["role"] != "admin":
        return "Unauthorized", 403

    title = request.form.get("title")
    author = request.form.get("author")
    category_id = request.form.get("category_id")

    file = request.files.get("file")
    cover = request.files.get("cover")

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    cover_path = os.path.join(COVER_FOLDER, cover.filename)

    file.save(file_path)
    cover.save(cover_path)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO books (title, author, category_id, file_path, cover_path) VALUES (%s, %s, %s, %s, %s)",
                   (title, author, category_id, file_path, cover_path))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"success": True})

# ---------------- SERVE COVERS --------------------
@app.route('/covers/<path:filename>')
def serve_cover(filename):
    return send_from_directory(COVER_FOLDER, filename)

# ---------------- GET CATEGORIES --------------------
@app.route("/api/categories")
def get_categories():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM categories")
    categories = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(categories)

# ---------------- DOWNLOAD HISTORY --------------------
@app.route("/api/downloadHistory")
def download_history():
    if "user" not in session:
        return "Unauthorized", 403

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT dh.downloaded_at, b.title, b.author, c.name AS category
        FROM download_history dh
        JOIN books b ON dh.book_id = b.id
        LEFT JOIN categories c ON b.category_id = c.id
        WHERE dh.user_id = %s
        ORDER BY dh.downloaded_at DESC
    """, (session["user"]["id"],))
    history = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(history)

# ---------------- PROFILE --------------------
@app.route("/api/profile")
def profile():
    if "user" not in session:
        return "Unauthorized", 403

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, username, role FROM users WHERE id=%s", (session["user"]["id"],))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return jsonify(user)

# ---------------- FRONTEND ROUTES --------------------
@app.route("/")
def home():
    return render_template("login.html")

@app.route("/index")
def index_page():
    return render_template("index.html")

@app.route("/admin")
def admin_page():
    if "user" not in session or session["user"]["role"] != "admin":
        return redirect(url_for("home"))
    return render_template("admin.html")

@app.route("/history")
def history_page():
    if "user" not in session:
        return redirect(url_for("home"))
    return render_template("history.html")

@app.route("/profile")
def profile_page():
    if "user" not in session:
        return redirect(url_for("home"))
    return render_template("profile.html")

if __name__ == "__main__":
    app.run(debug=True)