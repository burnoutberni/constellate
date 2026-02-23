## 2025-02-14 - Missing Digest Verification in ActivityPub

**Vulnerability:** ActivityPub inbox handlers validated HTTP Signatures but did not verify the `Digest` header against the request body.
**Learning:** Signature verification only proves the sender signed the _headers_. If the `Digest` header (which hashes the body) is not checked against the actual body content, an attacker can substitute the body while keeping the valid signature headers, bypassing integrity checks.
**Prevention:** Always calculate the hash of the request body and compare it to the `Digest` header before processing signed requests.
