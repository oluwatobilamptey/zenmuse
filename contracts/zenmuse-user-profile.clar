;; ZenMuse User Profile Contract
;; A secure, blockchain-powered solution for managing user profiles
;; with emphasis on privacy, ownership, and access control

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; ERROR CODES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(define-constant ERR_UNAUTHORIZED u403)
(define-constant ERR_PROFILE_EXISTS u409)
(define-constant ERR_PROFILE_NOT_FOUND u404)
(define-constant ERR_INVALID_INPUT u400)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; DATA STRUCTURES
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; User profile map with encrypted metadata
(define-map user-profiles 
  principal 
  {
    username: (string-ascii 50),
    encrypted-preferences: (buff 512),
    created-at: uint,
    last-updated: uint
  }
)

;; Track usernames to prevent duplicates
(define-map username-registry 
  (string-ascii 50) 
  principal
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; PRIVATE HELPER FUNCTIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Validate username format
(define-private (is-valid-username (username (string-ascii 50)))
  (and 
    (>= (len username) u3)  ;; Minimum 3 characters
    (<= (len username) u50)  ;; Maximum 50 characters
    ;; Optional: Add more validation (e.g., alphanumeric check)
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; READ-ONLY FUNCTIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Check if a username is already taken
(define-read-only (is-username-available (username (string-ascii 50)))
  (is-none (map-get? username-registry username))
)

;; Retrieve public profile information (excluding encrypted preferences)
(define-read-only (get-profile-info (user principal))
  (match (map-get? user-profiles user)
    profile (some {
      username: (get username profile),
      created-at: (get created-at profile),
      last-updated: (get last-updated profile)
    })
    none
  )
)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; PUBLIC FUNCTIONS
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;; Create a new user profile
(define-public (create-profile 
  (username (string-ascii 50)) 
  (encrypted-preferences (buff 512))
)
  (begin
    ;; Validate username
    (asserts! (is-valid-username username) (err ERR_INVALID_INPUT))
    
    ;; Check username availability
    (asserts! (is-username-available username) (err ERR_PROFILE_EXISTS))
    
    ;; Prevent multiple profile creation
    (asserts! (is-none (map-get? user-profiles tx-sender)) (err ERR_PROFILE_EXISTS))
    
    ;; Create profile
    (map-set user-profiles tx-sender {
      username: username,
      encrypted-preferences: encrypted-preferences,
      created-at: block-height,
      last-updated: block-height
    })
    
    ;; Register username
    (map-set username-registry username tx-sender)
    
    (ok true)
  )
)

;; Update user profile preferences
(define-public (update-preferences (new-encrypted-preferences (buff 512)))
  (let 
    ((existing-profile (unwrap! 
      (map-get? user-profiles tx-sender) 
      (err ERR_PROFILE_NOT_FOUND)
    )))
    
    ;; Update profile with new encrypted preferences
    (map-set user-profiles tx-sender (merge existing-profile {
      encrypted-preferences: new-encrypted-preferences,
      last-updated: block-height
    }))
    
    (ok true)
  )
)

;; Delete user profile
(define-public (delete-profile)
  (let 
    ((existing-profile (unwrap! 
      (map-get? user-profiles tx-sender) 
      (err ERR_PROFILE_NOT_FOUND)
    )))
    
    ;; Remove profile
    (map-delete user-profiles tx-sender)
    
    ;; Remove username registry entry
    (map-delete username-registry (get username existing-profile))
    
    (ok true)
  )
)