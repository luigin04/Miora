# Miora by Layal — Photo Album Platform

A bilingual (English / Arabic) website where customers design a printed photo
album, pay via CliQ, and Layal reviews orders and downloads a print-ready PDF.

## How it works

1. **Design** — three ways to start an album:
   - **Manual**: drag-and-drop editor with photos, stickers and text.
   - **"AI"**: upload photos and the site lays them out automatically across
     at least 30 pages (a rule-based layout engine — no external AI service).
   - **Templates**: start from one of the illustrated cover designs.
2. **Order** — albums need at least 30 pages (printed as two-page spreads, so
   always an even number). The price tier is picked from the page count.
3. **Pay** — the customer signs in with Google, pays via CliQ to `Miora.Layal`
   and uploads a screenshot of the confirmation.
4. **Review** — Layal gets an email (EmailJS), then approves or rejects the
   order in the admin panel (`/#admin`). Approved orders get a
   **Generate Print-Ready PDF** button.

## Where data lives

| Data | Stored in |
|---|---|
| Album projects while designing | The customer's browser — **IndexedDB** (`src/projectStore.js`). Not synced across devices. |
| Language choice | Browser localStorage |
| Orders + payment screenshot | Firestore `payments/{id}` |
| Album pages of an order | Firestore `payments/{id}/pages/{index}` (one document per page) |
| Reviews | Firestore `reviews` — shown publicly only after Layal approves them |

Photos are stored inside Firestore documents (no paid Firebase Storage). Each
page is saved at full quality when it fits Firestore's 1 MB-per-document limit;
pages with many photos are compressed just enough to fit.

## Print PDF

`src/pageRender.js` is the single source of truth for how a page looks. The
editor and the PDF use the same components and styles, and each PDF page is a
snapshot taken by the browser's own rendering engine (with the same Google
Fonts files embedded), so the PDF matches the design: same fonts, Arabic
shaping, rotation, photo cropping and stickers.

- Page size: 210 × 273 mm (the 400:520 design ratio, full bleed). To match a
  printer's trim size, change `PDF_PAGE_WIDTH_MM` in `src/pageRender.js`.
- Resolution: 2400 × 3120 px per page (≈290 dpi).
- Photo detail is limited by the stored photo itself (uploads are kept at up to
  1600 px wide). Truly 300 dpi full-page photos would need Firebase Storage.
- Generate PDFs in **Chrome on a computer** for best reliability.

`scripts/pdf-fidelity/` contains a test that renders sample pages (Arabic,
custom fonts, rotation, stickers, cropped photos) in headless Chromium and
compares the browser's on-screen rendering against the PDF pixel by pixel.

## Security

`firestore.rules` holds the database security rules: customers can only
create and read their own orders, only the admin can approve orders or read
everyone's data, and reviews stay hidden until approved. **These rules must be
deployed** — from the Firebase console (Firestore Database → Rules → paste →
Publish) or with `firebase deploy --only firestore:rules`.

## Development

```bash
npm install
npm start        # http://localhost:3000
npm run build    # production build in build/
```

Deployed on Netlify (`netlify.toml`): build command `npm run build`, publish
directory `build`. Pushing to the connected GitHub branch deploys automatically.

## Project structure

```
public/
  books/        cover images used by templates and the homepage
  stickers/     transparent PNG sticker library
src/
  MioraPlatform.jsx   the whole app (views, editor, payment, admin)
  pageRender.js       shared page rendering + print PDF export
  projectStore.js     IndexedDB storage for in-progress projects
  firebase.js         Firebase setup and Google sign-in
firestore.rules       database security rules
scripts/pdf-fidelity/ PDF-vs-editor comparison test
```

## Contact

Instagram [@miorabylayal](https://instagram.com/miorabylayal) · WhatsApp link in the site footer.

© 2026 Miora by Layal. All rights reserved.
