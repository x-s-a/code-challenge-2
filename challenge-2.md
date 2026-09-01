# Code Challenge Milestone

# 2

Objective

Build a RESTful API for a Simple Q&A Forum application that helps users ask questions and participate in
discussions. This system requires authentication and must ensure that users are only authorized to update or delete
the threads (questions) they created themselves.

Required Features

● User Management: Registration, login (generating a token/session), and viewing profiles.
● CRUD Threads: Create, Read, Update, and Delete discussion threads.
● Validation & Error Handling: Handle empty inputs, invalid email formats, or unauthorized access by
returning the appropriate HTTP Status Codes (400, 401, 403, 404, 500).
● Database Relations: Implement aone-to-many relationship between users and threads (One user can
create multiple threads).

Requirements

● Language/Framework: Node.js (Express/NestJS), Go, Python, or PHP (Choose the one you are currently
focusing on).
● Database: PostgreSQL, MySQL, or SQLite (recommended for an easy local setup).
● Additional: You must use Environment Variables (.env) to store configurations such as the port, database

---

credentials, and JWT Secret.

Deliverables

1. Source Code: Submit a link to your public GitHub repository containing the complete source code.
2. API Documentation (Screenshots): Include detailed screenshots of your Swagger UI (or OpenAPI
documentation) for each endpoint. The screenshots must clearly demonstrate:
● The endpoint URL and HTTP Method.
● Required request bodies, headers, or parameters.
● Expected responses for both success (e.g., 200, 201) and error states (e.g., 400, 401, 404).

Target API Endpoints

User & Auth Endpoints

Method Endpoint Description

POST /api/auth/register Register a new user (password must be hashed in the DB).

POST /api/auth/login Log in a user and return an authentication token (JWT/Session).

GET /api/users/:id View a user's public profile based on their ID.

Thread Endpoints (With User Relation)

Method Endpoint Description Auth Required

POST /api/threads Create a new thread/question. ✅ Yes

GET /api/threads List all threads from all users. ❌ No

GET /api/threads/my-threads List threads belonging to the currently logged-in user. ✅ Yes

GET /api/threads/:id View details of a specific thread by its ID. ❌ No

---

PUT /api/threads/:id Update the content of a thread (Only accessible by the✅ Yes
thread creator).

DELETE /api/threads/:id Delete a thread (Only accessible by the thread creator). ✅ Yes

Dummy Data Examples (JSON), but not limited to:

users Table

[
{
"id": "U001",
"username": "johndoe",
"email": "johndoe@example.com",
"password_hash": "$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjIQG8.RMG",
"created_at": "2026-04-20T10:00:00Z"
},
{
"id": "U002",
"username": "janedoe",
"email": "jane@example.com",
"password_hash": "$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjIQG8.RMG",
"created_at": "2026-04-21T14:30:00Z"
}
]

threads Table

[
{
"id": "T101",
"user_id": "U001",
"title": "How do I set up environment variables in Node.js?",
"content": "I am new to backend development and confused about how to hide my API keys. Could
someone explain how to use dotenv?",
"created_at": "2026-04-22T08:15:00Z",
"updated_at": "2026-04-22T08:15:00Z"
},
{
"id": "T102",
"user_id": "U002",
"title": "When should I use PostgreSQL vs MongoDB?",
"content": "For a medium-scale e-commerce project, which database is more recommended and
why?",
"created_at": "2026-04-22T09:45:00Z",
"updated_at": "2026-04-22T10:00:00Z"
},
{
"id": "T103",
"user_id": "U001",
"title": "Getting a CORS error when hitting the API from React",

---

"content": "I keep getting an 'Access-Control-Allow-Origin' error. How do I handle this on
the Express.js side?",
"created_at": "2026-04-22T11:20:00Z",
"updated_at": "2026-04-22T11:20:00Z"
}
]

Grading Component

Documentation Is your step-by-step explanation clear and structured?

Problem-Solving Approach Did you choose an efficient approach?

Code Quality Is your code clean, readable, and maintainable?

Correctness Does your solution solve the problem correctly?

---