;; ZenMuse Journal Entries Smart Contract
;; A secure, privacy-preserving blockchain journal management system
;; Supports encrypted, user-controlled journal entries with strict access management

;; Error Codes
(define-constant ERR_UNAUTHORIZED (err u403))
(define-constant ERR_ENTRY_NOT_FOUND (err u404))
(define-constant ERR_INVALID_ENTRY (err u400))
(define-constant ERR_ENTRY_LIMIT_REACHED (err u429))

;; Constants
(define-constant MAX_ENTRY_LENGTH u2048)
(define-constant MAX_TAGS_PER_ENTRY u5)
(define-constant MAX_ENTRIES_PER_USER u100)

;; Data Structures
;; A secure journal entry with encrypted content and metadata
(define-map journal-entries 
  {
    owner: principal,  ;; Entry owner
    entry-id: uint     ;; Unique entry identifier
  }
  {
    encrypted-content: (buff 2048),  ;; Encrypted journal entry
    tags: (list 5 (string-ascii 20)),  ;; Optional tags
    created-at: uint,  ;; Timestamp of creation
    updated-at: uint   ;; Timestamp of last update
  }
)

;; Track number of entries per user to prevent spam
(define-map entry-count principal uint)

;; Create a new journal entry
(define-public (create-entry 
  (encrypted-content (buff MAX_ENTRY_LENGTH))
  (tags (list MAX_TAGS_PER_ENTRY (string-ascii 20)))
)
  (if (>= (default-to u0 (map-get? entry-count tx-sender)) MAX_ENTRIES_PER_USER)
    (err ERR_ENTRY_LIMIT_REACHED)
    (if (is-eq (len encrypted-content) u0)
      (err ERR_INVALID_ENTRY)
      (let 
        ((entry-id (+ (default-to u0 (map-get? entry-count tx-sender)) u1)))
        (map-set journal-entries 
          {owner: tx-sender, entry-id: entry-id}
          {
            encrypted-content: encrypted-content,
            tags: tags,
            created-at: block-height,
            updated-at: block-height
          }
        )
        (map-set entry-count tx-sender entry-id)
        (ok entry-id)
      )
    )
  )
)

;; Update an existing journal entry
(define-public (update-entry
  (entry-id uint)
  (new-encrypted-content (buff MAX_ENTRY_LENGTH))
  (new-tags (list MAX_TAGS_PER_ENTRY (string-ascii 20)))
)
  (match 
    (map-get? journal-entries {owner: tx-sender, entry-id: entry-id})
    entry 
      (if (is-eq (len new-encrypted-content) u0)
        (err ERR_INVALID_ENTRY)
        (begin
          (map-set journal-entries 
            {owner: tx-sender, entry-id: entry-id}
            (merge entry {
              encrypted-content: new-encrypted-content,
              tags: new-tags,
              updated-at: block-height
            })
          )
          (ok true)
        )
      )
    (err ERR_ENTRY_NOT_FOUND)
  )
)

;; Delete a journal entry
(define-public (delete-entry (entry-id uint))
  (match 
    (map-get? journal-entries {owner: tx-sender, entry-id: entry-id})
    entry
      (begin
        (map-delete journal-entries {owner: tx-sender, entry-id: entry-id})
        (ok true)
      )
    (err ERR_ENTRY_NOT_FOUND)
  )
)

;; Retrieve a journal entry (read-only, preserves privacy)
(define-read-only (get-entry (owner principal) (entry-id uint))
  (map-get? journal-entries {owner: owner, entry-id: entry-id})
)

;; Get total number of entries for a user
(define-read-only (get-entry-count (user principal))
  (default-to u0 (map-get? entry-count user))
)