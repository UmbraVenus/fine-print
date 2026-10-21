from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class CheckRequest(BaseModel):
    text: str


# Every route starts with /api/ because Vercel passes the full path through.
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/check")
def check(req: CheckRequest):
    return {"received": req.text, "issues": []}
