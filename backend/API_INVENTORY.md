# Class Management System — API Inventory

**Base URL:** `https://<host>/api`

**Global prefix:** `/api` (all route groups mounted under this)
**Non-API endpoints:**
- `GET /health` — health check → `{ status, timestamp }`
- `GET /uploads/*` — static file serving
- `GET /apk/*` — APK file serving
- `GET *` (catch-all) — SPA fallback → `index.html`

**Common Auth:** `Authorization: Bearer <jwt>` header required on most endpoints.
**Common Response Wrapper:** `{ success: boolean, ...data }` on success; `{ success: false, error: string }` on error.

---

## 1. Auth (`/api/auth`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| POST | `/api/auth/login` | No | WeChat Mini-Program login (code → openid) | `{ success, token, user: { id, name, role, class_id, avatarUrl } }` |
| POST | `/api/auth/cloudbase-login` | No | CloudBase UID login (H5/Web) | `{ success, token, user: { id, name, nickName, student_id, role, class_id, avatarUrl, phone, email } }` |
| POST | `/api/auth/register` | No | Register new user | `{ success, token, [reused: bool], user: {...} }` |
| POST | `/api/auth/refresh` | No | Refresh JWT token | `{ success, token }` |
| POST | `/api/auth/logout` | Yes | Logout (no-op server) | `{ success, message }` |
| GET  | `/api/auth/userinfo` | Yes | Get current user info | `{ success, user: { id, name, student_id, class_id, role, phone, email, avatarUrl, nickName } }` |
| POST | `/api/auth/find-by-student` | Yes | Find user by student_id | `{ success, user: {...} }` |
| POST | `/api/auth/login-with-password` | No | Student ID + password login | `{ success, token, user: {...} }` |
| POST | `/api/auth/login-with-phone` | No | Phone + password login | `{ success, token, user: {...} }` |
| POST | `/api/auth/send-code` | No | Send verification code (phone/email) | `{ success, code, message }` |
| POST | `/api/auth/phone-code-login` | No | Phone + code login/register | `{ success, token, user: {...} }` |
| POST | `/api/auth/email-code-login` | No | Email + code login | `{ success, token, user: {...} }` |
| POST | `/api/auth/set-password` | No | Set/reset password | *standard response* |
| POST | `/api/auth/change-password` | Yes | Change password (logged-in) | *standard response* |

---

## 2. Users (`/api/users`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/users` | Yes+Admin | List all users | `{ success, users: [...] }` |
| GET  | `/api/users/:id` | Yes | Get single user | `{ success, user: {...} }` |
| PUT  | `/api/users/:id` | Yes | Update user (self or admin) | `{ success, message }` |
| DELETE | `/api/users/:id` | Yes+Admin | Delete user | `{ success, message }` |

---

## 3. Leave (`/api/leave`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| POST | `/api/leave/apply` | Yes | Submit leave application | `{ success, leaveId, message }` |
| GET  | `/api/leave/my` | Yes | Get my leave records | `{ success, leaves: [...] }` |
| GET  | `/api/leave/all` | Yes+Admin | Get all leave records | `{ success, leaves: [...] }` |
| GET  | `/api/leave/:id` | Yes | Get leave detail (owner/admin) | `{ success, leave: {...} }` |
| PUT  | `/api/leave/approve` | Yes+Admin | Approve/reject leave | `{ success, message }` |
| PUT  | `/api/leave/cancel/:id` | Yes | Cancel leave (owner only) | `{ success, message }` |

---

## 4. Notice (`/api/notice`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| POST | `/api/notice/create` | Yes+Admin | Create notice | `{ success, noticeId, message }` |
| GET  | `/api/notice` | Yes | List notices | `{ success, notices: [...] }` |
| GET  | `/api/notice/unread/count` | Yes | Unread notice count | `{ success, count: number }` |
| GET  | `/api/notice/todo/count` | Yes | Todo notice count | `{ success, count: number }` |
| POST | `/api/notice/:id/complete` | Yes | Mark todo as complete | `{ success, message }` |
| GET  | `/api/notice/:id/completion` | Yes | Get todo completion status | `{ success, ...result }` |
| GET  | `/api/notice/:id` | Yes | Get notice detail | `{ success, notice: {...} }` |
| PUT  | `/api/notice/:id` | Yes+Admin | Update notice | `{ success, notice: {...} }` |
| DELETE | `/api/notice/:id` | Yes+Admin | Delete notice | `{ success }` |

---

## 5. Announcement (`/api/announcement`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/announcement` | Yes | List announcements | `{ success, announcements: [...] }` |
| POST | `/api/announcement/create` | Yes+Admin | Create announcement | `{ success, id, message }` |
| GET  | `/api/announcement/resources` | Yes | List resources | `{ success, resources: [...] }` |
| POST | `/api/announcement/resources` | Yes+Admin | Create resource | `{ success, id }` |
| POST | `/api/announcement/resources/upload` | Yes+Admin | Upload resource file | `{ success, url, id }` |
| DELETE | `/api/announcement/resources/:id` | Yes+Admin | Delete resource | `{ success }` |
| GET  | `/api/announcement/:id` | Yes | Get announcement detail | `{ success, announcement: {...} }` |
| DELETE | `/api/announcement/:id` | Yes+Admin | Delete announcement | `{ success }` |

---

## 6. Album (`/api/album`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/album` | Yes | List albums | `{ success, albums: [...] }` |
| POST | `/api/album` | Yes+Admin | Create album | `{ success, id, message }` |
| POST | `/api/album/photos` | Yes | Upload photos (bulk) | `{ success, photos: [...] }` |
| POST | `/api/album/photos/upload` | Yes | Upload single photo file | `{ success, url, id }` |
| GET  | `/api/album/photos/pending` | Yes | Get pending photos for approval | `{ success, photos: [...] }` |
| POST | `/api/album/photos/:id/approve` | Yes | Approve a photo | `{ success }` |
| DELETE | `/api/album/photos/:id` | Yes | Reject/delete a photo | `{ success }` |
| GET  | `/api/album/:id` | Yes | Get album detail (with photos) | `{ success, album: {...}, photos: [...] }` |
| DELETE | `/api/album/:id` | Yes | Delete album | `{ success }` |

---

## 7. Fee (`/api/fee`)

### Collections (收缴)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| POST | `/api/fee/collections` | Yes | Create fee collection | `{ success, id }` |
| GET  | `/api/fee/collections` | Yes | List fee collections | `{ success, collections: [...] }` |
| GET  | `/api/fee/collections/:id` | Yes | Get collection detail | `{ success, collection: {...} }` |
| GET  | `/api/fee/collections/:id/records` | Yes | Get collection payment records | `{ success, records: [...] }` |
| POST | `/api/fee/collections/:id/pay` | Yes | Pay a collection | `{ success }` |
| POST | `/api/fee/collections/:id/exempt` | Yes | Exempt a user from collection | `{ success }` |
| POST | `/api/fee/collections/:id/close` | Yes | Close a collection | `{ success }` |

### Expenses (申请)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| POST | `/api/fee/expenses` | Yes | Create expense application | `{ success, id }` |
| GET  | `/api/fee/expenses/my` | Yes | Get my expenses | `{ success, expenses: [...] }` |
| GET  | `/api/fee/expenses` | Yes | Get all expenses | `{ success, expenses: [...] }` |
| GET  | `/api/fee/expenses/:id` | Yes | Get expense detail | `{ success, expense: {...} }` |

### Approvals (审批)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/fee/approvals/pending` | Yes | Get pending approvals | `{ success, approvals: [...] }` |
| POST | `/api/fee/approvals/:id` | Yes | Approve expense | `{ success }` |
| POST | `/api/fee/approvals/:id/reject` | Yes | Reject expense | `{ success }` |
| POST | `/api/fee/approvals/:id/vote` | Yes | Cast vote on approval | `{ success }` |
| GET  | `/api/fee/approvals/:id/votes` | Yes | Get vote result | `{ success, votes: [...] }` |

### Publications (公示)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| POST | `/api/fee/publications` | Yes | Create publication | `{ success, id }` |
| GET  | `/api/fee/publications` | Yes | List publications | `{ success, publications: [...] }` |
| GET  | `/api/fee/publications/:id` | Yes | Get publication detail | `{ success, publication: {...} }` |

### Summary & Legacy

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/fee/summary` | Yes | Get fee summary | `{ success, summary: {...} }` |
| POST | `/api/fee/expense` | Yes | *(legacy)* Create expense | `{ success, id }` |
| GET  | `/api/fee/my` | Yes | *(legacy)* Get my expenses | `{ success, expenses: [...] }` |
| GET  | `/api/fee/all` | Yes | *(legacy)* Get all expenses | `{ success, expenses: [...] }` |
| GET  | `/api/fee/balance` | Yes | *(legacy)* Get balance | `{ success, balance: number }` |
| POST | `/api/fee/proof/upload` | Yes | Upload proof document | `{ success, url }` |

---

## 8. Homework (`/api/homework`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/homework/pending/count` | Yes | Pending homework count | `{ success, count: number }` |
| GET  | `/api/homework` | Yes | List homework | `{ success, homeworks: [...] }` |
| POST | `/api/homework` | Yes+Admin | Create homework | `{ success, id }` |
| GET  | `/api/homework/:id` | Yes | Get homework detail | `{ success, homework: {...}, mySubmission, submissions: [...] }` |
| POST | `/api/homework/:id/submit` | Yes | Submit homework | `{ success, id }` |
| PUT  | `/api/homework/submission/:submissionId/grade` | Yes+Admin | Grade a submission | `{ success }` |
| DELETE | `/api/homework/:id` | Yes+Admin | Delete homework | `{ success }` |

---

## 9. Vote (`/api/vote`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/vote` | Yes | List votes | `{ success, votes: [...] }` |
| POST | `/api/vote` | Yes | Create vote | `{ success, id, message }` |
| GET  | `/api/vote/:id` | Yes | Get vote detail | `{ success, vote: {...}, options: [{..., rate, vote_count}], my_choices, total_votes }` |
| POST | `/api/vote/:id/cast` | Yes | Cast vote | `{ success, message }` |
| POST | `/api/vote/:id/close` | Yes | Close vote | `{ success }` |

---

## 10. Psychological (`/api/psychological`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| POST | `/api/psychological` | Yes | Create psychological report | `{ success, id }` |
| GET  | `/api/psychological/mine` | Yes | List my reports | `{ success, records: [...] }` |
| GET  | `/api/psychological/all` | Yes | List all reports | `{ success, records: [...] }` |
| GET  | `/api/psychological/:id` | Yes | Get report detail | `{ success, record: {...} }` |
| PUT  | `/api/psychological/:id/handle` | Yes | Handle/triage report | `{ success, message }` |

---

## 11. Challenge (`/api/challenge`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/challenge` | Yes | List challenges | `{ success, challenges: [...] }` |
| POST | `/api/challenge` | Yes | Create challenge | `{ success, id }` |
| GET  | `/api/challenge/my-applications` | Yes | My challenge applications | `{ success, applications: [...] }` |
| GET  | `/api/challenge/:id` | Yes | Get challenge detail | `{ success, challenge: {...} }` |
| POST | `/api/challenge/:id/apply` | Yes | Apply for challenge | `{ success }` |
| PUT  | `/api/challenge/application/:applicationId/approve` | Yes | Approve application | `{ success }` |
| POST | `/api/challenge/:id/record` | Yes | Record challenge result | `{ success }` |

---

## 12. Suggestion (`/api/suggestion`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| POST | `/api/suggestion` | Yes | Submit suggestion (anonymous) | `{ success, id }` |
| GET  | `/api/suggestion` | Yes | List all suggestions (admin) | `{ success, suggestions: [...] }` |
| GET  | `/api/suggestion/mine` | Yes | List my suggestions | `{ success, suggestions: [...] }` |
| GET  | `/api/suggestion/:id` | Yes | Get suggestion detail | `{ success, suggestion: {...} }` |
| POST | `/api/suggestion/:id/handle` | Yes | Handle suggestion (admin) | `{ success }` |

---

## 13. Lottery (`/api/lottery`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/lottery` | Yes | List lotteries | `{ success, lotteries: [...] }` |
| POST | `/api/lottery` | Yes | Create lottery | `{ success, id }` |
| GET  | `/api/lottery/:id` | Yes | Get lottery detail | `{ success, lottery: {...} }` |
| POST | `/api/lottery/:id/join` | Yes | Join a lottery | `{ success }` |
| POST | `/api/lottery/:id/draw` | Yes | Draw lottery winners | `{ success, winners: [...] }` |
| PUT  | `/api/lottery/:id/close` | Yes | Close a lottery | `{ success }` |

---

## 14. Points (`/api/points`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/points/mine` | Yes | Get my points & records | `{ success, records: [...], total: number }` |
| GET  | `/api/points/ranking` | Yes | Get points ranking | `{ success, ranking: [...] }` |
| GET  | `/api/points/all` | Yes+Admin | Get all points records | `{ success, records: [...] }` |
| POST | `/api/points` | Yes+Admin | Add points record | `{ success, id }` |

---

## 15. Classes (`/api/classes`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/classes` | No | List classes | `{ success, classes: [...] }` |
| POST | `/api/classes` | Yes | Create class | `{ success, id }` |

---

## 16. Message (`/api/message`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/message` | Yes | List messages | `{ success, messages: [...] }` |
| POST | `/api/message` | Yes | Create/send message | `{ success, id }` |
| DELETE | `/api/message/:id` | Yes | Delete a message | `{ success }` |

---

## 17. Admin (`/api/admin`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/admin/members` | Yes+Admin | List members (with roles) | `{ success, members: [...] }` |
| GET  | `/api/admin/members/:id` | Yes+Admin | Member detail (leave + operations) | `{ success, member: {...} }` |
| GET  | `/api/admin/operations` | Yes+Admin | Recent system operations | `{ success, operations: [...] }` |

---

## 18. App Version (`/api/app`)

| Method | Path | Auth | Description | Response Shape |
|--------|------|------|-------------|----------------|
| GET  | `/api/app/latest?platform=android|ios` | No | Get latest app version | `{ success, data: { versionName, versionCode, minVersionCode, downloadUrl, apkSize, releasedAt, forceUpdate, changelog } }` |

---

## Summary Statistics

- **Route files:** 18
- **Total endpoints:** ~106 (including legacy/duplicate paths)
- **Public endpoints (no auth):** `GET /api/classes`, `POST /api/auth/login|register|refresh|login-with-password|login-with-phone|send-code|phone-code-login|email-code-login|set-password`, `GET /api/app/latest`, `GET /health`
- **Auth mechanism:** JWT Bearer tokens, role-based admin checks (role 1-8 = admin)
- **Consistent response pattern:** `{ success: boolean }` wrapper across all endpoints
