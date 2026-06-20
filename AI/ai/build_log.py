import os
from datetime import datetime

LOG_FILE = "laundry_vector_db/build_log.txt"


def get_today():
    return str(datetime.now().date())


def read_log():
    if not os.path.exists(LOG_FILE):
        return {}

    data = {}
    with open(LOG_FILE, "r") as f:
        for line in f:
            token, date = line.strip().split("|")
            data[token] = date
    return data


def write_log(token: str):
    data = read_log()
    data[token] = get_today()

    with open(LOG_FILE, "w") as f:
        for t, d in data.items():
            f.write(f"{t}|{d}\n")


def needs_rebuild(token: str) -> bool:
    data = read_log()
    return data.get(token) != get_today()