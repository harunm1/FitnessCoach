// Photo size limits, shared by the browser and the server (#16).
//
// Vercel rejects request bodies over 4.5 MB, so the upload itself stays under
// 4 MB. Users can still pick much larger photos: the browser makes them
// smaller first (shrink.ts), and the server then resizes them to 1600 px.

// The largest photo the server accepts, after the browser has shrunk it.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

// The largest photo a user can pick. Big enough for any phone photo, small
// enough not to freeze the browser while it is shrunk.
export const MAX_PICKED_BYTES = 50 * 1024 * 1024; // 50 MB

// The longest side the browser keeps. The server shrinks to 1600 px anyway.
export const SHRINK_SIDE = 2048;

// Progress photos per account. Generous (about one a day for three years),
// but it stops a script from filling the bucket. At about 300 KB a photo, a
// full account uses about 300 MB, so roughly 33 full accounts would fill R2's
// 10 GB free tier (see D3 in docs/ARCHITECTURE.md).
export const MAX_PHOTOS_PER_USER = 1000;

// Photos the gallery shows at first, and how many more each "Show more" adds.
export const GALLERY_PAGE_SIZE = 24;
