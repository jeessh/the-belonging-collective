"""Hidden icon allocation.

Icon keys were retired on 2026-09-28: members sign in with an email and a
password. `users.icons` stays because it is NOT NULL and half of
`uq_users_username_icons`, so every account still gets a set allocated —
never shown, never a credential.
"""

import secrets

ICON_POOL = [
    "tree", "cat", "apple", "sun", "moon", "dog",
    "fish", "flower", "house", "car", "heart", "star",
]

ICON_COUNT = 2


def random_icon_set() -> list[str]:
    pool = list(ICON_POOL)
    return [pool.pop(secrets.randbelow(len(pool))) for _ in range(ICON_COUNT)]
