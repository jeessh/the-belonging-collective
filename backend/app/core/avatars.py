"""Profile-picture emblems a member can pick instead of uploading a photo.

None of these is, or ever was, a sign-in icon (see core/icons.py and the
frontend's ICON_EMOJI): the icons are the password, and a picture shown next
to a member's name must never be a hint to it. Mirrored in lib/emblems.ts.
"""

EMBLEMS = frozenset(
    {"rainbow", "leaf", "bird", "mountain", "wave", "butterfly", "music", "paint"}
)
