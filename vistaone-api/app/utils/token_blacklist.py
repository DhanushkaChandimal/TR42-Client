# token_blacklist.py


blacklist = set()


# Simple in-memory set to store revoked token identifiers (jti)
# This keeps track of tokens that have been revoked (e.g., on logout) to prevent their reuse.
# In-memory blacklist resets when the server restarts.

