from fastapi import FastAPI, Request
import json

app = FastAPI()

DB = "players.json"

def read_db():
    try:
        with open(DB, "r") as f:
            return json.load(f)
    except:
        return {}

def write_db(data):
    with open(DB, "w") as f:
        json.dump(data, f, indent=4)

@app.post("/update_score")
async def update_score(req: Request):
    data = await req.json()
    user_id = str(data["user_id"])

    db = read_db()
    db[user_id] = {
        "name": data["name"],
        "score": data["score"]
    }
    write_db(db)
    return {"status": "ok"}

@app.get("/rating")
async def get_rating():
    db = read_db()
    sorted_players = sorted(db.values(), key=lambda x: x["score"], reverse=True)
    return sorted_players
