"""Create the first administrator with an interactive password prompt."""

import argparse
import getpass

from sqlalchemy import select

from database.connection import SessionLocal
from database.migrate import migrate_database
from database.models import User
from services.auth import hash_password


def main():
    parser = argparse.ArgumentParser(description="Create the first EduVision administrator")
    parser.add_argument("username")
    args = parser.parse_args()
    migrate_database()
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.role == "admin")):
            raise SystemExit("An administrator already exists; use the authenticated user API.")
        password = getpass.getpass("New administrator password (12+ characters): ")
        repeat = getpass.getpass("Repeat password: ")
        if len(password) < 12 or password != repeat:
            raise SystemExit("Passwords must match and contain at least 12 characters.")
        db.add(User(username=args.username, password_hash=hash_password(password), role="admin", active=True))
        db.commit()
    print(f"Administrator {args.username!r} created.")


if __name__ == "__main__":
    main()
