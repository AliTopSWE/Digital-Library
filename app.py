from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from database import get_connection
import os

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = "supersecretkey"
UPLOAD_FOLDER = "uploads"
COVER_FOLDER = "covers"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(COVER_FOLDER, exist_ok=True)

@app.route("/api/register", methods=["POST"])
def register():
    data = request.json or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username=%s", (username,))
    if cursor.fetchone():
        cursor.close(); conn.close()
        return jsonify({"success": False, "message": "Username exists"}), 409
    hashed = generate_password_hash(password)
    cursor.execute("INSERT INTO users (username, password, role) VALUES (%s, %s, %s)", (username, hashed, "user"))
    conn.commit(); cursor.close(); conn.close()
    return jsonify({"success": True})

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username"); password = data.get("password")
    if not username or not password:
        return jsonify({"success": False, "message": "Missing credentials"}), 400
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username=%s", (username,))
    user = cursor.fetchone(); cursor.close(); conn.close()
    if user and check_password_hash(user["password"], password):
        session["user"] = {"id": user["id"], "role": user["role"], "username": user["username"]}
        return jsonify({"success": True, "role": user["role"]})
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route("/api/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("home"))

@app.route("/api/books")
def get_books():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT b.id, b.title, b.author, b.file_path, b.cover_path, c.name AS category, b.category_id
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        ORDER BY b.id DESC
    """)
    books = cursor.fetchall(); cursor.close(); conn.close()
    return jsonify(books)

@app.route("/api/download/<int:book_id>")
def download_book(book_id):
    if "user" not in session:
        return "Unauthorized", 403
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT file_path FROM books WHERE id=%s", (book_id,))
    row = cursor.fetchone()
    if row and row["file_path"] and os.path.exists(row["file_path"]):
        cursor.execute("INSERT INTO download_history (user_id, book_id) VALUES (%s, %s)", (session["user"]["id"], book_id))
        conn.commit(); cursor.close(); conn.close()
        return send_file(row["file_path"], as_attachment=True)
    cursor.close(); conn.close()
    return "File not found", 404

@app.route("/api/addBook", methods=["POST"])
def add_book():
    if "user" not in session or session["user"]["role"] != "admin":
        return jsonify({"success": False, "message": "Unauthorized"}), 403
    title = request.form.get("title"); author = request.form.get("author"); category_id = request.form.get("category_id")
    file = request.files.get("file"); cover = request.files.get("cover")
    if not title or not author or not category_id or not file or not cover:
        return jsonify({"success": False, "message": "All fields required"}), 400
    file_name = secure_filename(file.filename); cover_name = secure_filename(cover.filename)
    file_path = os.path.join(UPLOAD_FOLDER, file_name); cover_path_on_disk = os.path.join(COVER_FOLDER, cover_name)
    file.save(file_path); cover.save(cover_path_on_disk)
    conn = get_connection(); cursor = conn.cursor()
    cursor.execute("INSERT INTO books (title, author, category_id, file_path, cover_path) VALUES (%s, %s, %s, %s, %s)",
                   (title, author, category_id, file_path, cover_name))
    conn.commit(); cursor.close(); conn.close()
    return jsonify({"success": True})

@app.route("/api/deleteBook/<int:book_id>", methods=["POST"])
def delete_book(book_id):
    if "user" not in session or session["user"]["role"] != "admin":
        return jsonify({"success": False, "message": "Unauthorized"}), 403
    conn = get_connection(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT file_path, cover_path FROM books WHERE id=%s", (book_id,))
    b = cursor.fetchone()
    if b:
        try:
            if b["file_path"] and os.path.exists(b["file_path"]):
                os.remove(b["file_path"])
        except Exception:
            pass
        try:
            if b["cover_path"]:
                cover_path_on_disk = os.path.join(COVER_FOLDER, b["cover_path"])
                if os.path.exists(cover_path_on_disk):
                    os.remove(cover_path_on_disk)
        except Exception:
            pass
    try:
        cursor.execute("DELETE FROM download_history WHERE book_id=%s", (book_id,))
        cursor.execute("DELETE FROM books WHERE id=%s", (book_id,))
        conn.commit()
    except Exception as e:
        conn.rollback(); cursor.close(); conn.close()
        return jsonify({"success": False, "message": "Delete failed", "error": str(e)}), 500
    cursor.close(); conn.close()
    return jsonify({"success": True})

@app.route("/api/editBook/<int:book_id>", methods=["POST"])
def edit_book(book_id):
    if "user" not in session or session["user"]["role"] != "admin":
        return jsonify({"success": False, "message": "Unauthorized"}), 403
    title = request.form.get("title"); author = request.form.get("author"); category_id = request.form.get("category_id")
    new_file = request.files.get("file"); new_cover = request.files.get("cover")
    conn = get_connection(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT title, author, category_id, file_path, cover_path FROM books WHERE id=%s", (book_id,))
    current = cursor.fetchone()
    if not current:
        cursor.close(); conn.close()
        return jsonify({"success": False, "message": "Book not found"}), 404
    final_title = title if title is not None and title != "" else current["title"]
    final_author = author if author is not None and author != "" else current["author"]
    final_category = category_id if category_id is not None and category_id != "" else current["category_id"]
    file_path = current["file_path"]; cover_name = current["cover_path"]
    if new_file:
        fname = secure_filename(new_file.filename); new_path = os.path.join(UPLOAD_FOLDER, fname)
        new_file.save(new_path)
        try:
            if file_path and os.path.exists(file_path) and file_path != new_path:
                os.remove(file_path)
        except Exception:
            pass
        file_path = new_path
    if new_cover:
        cname = secure_filename(new_cover.filename); cover_disk = os.path.join(COVER_FOLDER, cname)
        new_cover.save(cover_disk)
        try:
            oldc = current["cover_path"]
            oldc_path = os.path.join(COVER_FOLDER, oldc) if oldc else None
            if oldc_path and os.path.exists(oldc_path) and oldc != cname:
                os.remove(oldc_path)
        except Exception:
            pass
        cover_name = cname
    cur2 = conn.cursor()
    cur2.execute("UPDATE books SET title=%s, author=%s, category_id=%s, file_path=%s, cover_path=%s WHERE id=%s",
                 (final_title, final_author, final_category, file_path, cover_name, book_id))
    conn.commit(); cur2.close(); cursor.close(); conn.close()
    return jsonify({"success": True})

@app.route('/covers/<path:filename>')
def serve_cover(filename):
    return send_from_directory(COVER_FOLDER, filename)

@app.route("/api/categories")
def get_categories():
    conn = get_connection(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, name FROM categories ORDER BY name ASC")
    categories = cursor.fetchall(); cursor.close(); conn.close()
    return jsonify(categories)

@app.route("/api/downloadHistory")
def download_history():
    if "user" not in session:
        return "Unauthorized", 403
    conn = get_connection(); cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT dh.downloaded_at, b.title, b.author, c.name AS category
        FROM download_history dh
        JOIN books b ON dh.book_id = b.id
        LEFT JOIN categories c ON b.category_id = c.id
        WHERE dh.user_id = %s
        ORDER BY dh.downloaded_at DESC
    """, (session["user"]["id"],))
    history = cursor.fetchall(); cursor.close(); conn.close()
    return jsonify(history)

@app.route("/api/profile")
def profile():
    if "user" not in session:
        return "Unauthorized", 403
    return jsonify(session["user"])

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