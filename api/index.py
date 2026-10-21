from flask import Flask, jsonify, request

app = Flask(__name__)


# Every route starts with /api/ because Vercel passes the full path through.
@app.get("/api/health")
def health():
    return jsonify(status="ok")


@app.post("/api/check")
def check():
    body = request.get_json(silent=True) or {}
    text = body.get("text")
    if not isinstance(text, str):
        return jsonify(error="'text' must be a string"), 400
    return jsonify(received=text, issues=[])
