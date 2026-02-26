## 2025-02-21 - Federation Authorization (IDOR Prevention)
**Vulnerability:** ActivityPub `Update` and `Delete` handlers (`handleUpdate`, `handleDelete`) lacked sufficient authorization checks. They accepted activities signed by *any* valid actor and processed updates/deletes for *any* object, as long as the object ID matched. This allowed any federated user (or attacker) to update or delete events and comments they didn't own (Insecure Direct Object Reference).
**Learning:** In a federated system, "Authentication" (valid signature) does not equal "Authorization" (permission to act on an object). Just because a request comes from a valid server doesn't mean that server's actor owns the object they are trying to modify. We must explicitly verify that the `actor` of the incoming activity matches the owner (`attributedTo` or `authorId`) of the target object.
**Prevention:**
1.  **Always extract the actor:** Reliably extract the `actor` URL from the incoming ActivityPub payload.
2.  **Enforce ownership in DB queries:** When updating or deleting, include the ownership check *in the database query itself* (e.g., `WHERE id = ... AND attributedTo = actorUrl`). This is safer and more atomic than fetching and checking in application code (though app-code checks are a good secondary defense, especially for complex logic like moderation).
3.  **Specific Checks:**
    -   **Events:** Ensure `attributedTo` matches the activity actor.
    -   **Comments:** Ensure `author.externalActorUrl` matches the activity actor (or the *event owner* for moderation deletions).
    -   **Profiles:** Ensure the `person.id` (which is being updated) matches the activity actor.
