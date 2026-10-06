// Sizes an exam may have. Shared by the API, which enforces them, and the
// upload wizard, which shows them before a request fails.
export const MAX_STUDENT_PAGES = 200;   // pages in one exam
export const MAX_KEY_PAGES = 10;        // photos of a klasik answer key
export const MAX_KEY_TEXT = 20_000;     // characters of a typed answer key
export const MAX_TEACHER_NOTE = 1000;   // characters of the teacher's note to the reader
