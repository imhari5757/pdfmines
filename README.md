# PDFMines — Local Website Prototype

## Run
1. Extract the ZIP.
2. Open `index.html` in Chrome/Edge/Safari.
3. Click **Add Photos**.
4. Select multiple JPG/PNG/WEBP files.
5. Choose page size/orientation/quality.
6. Click **Create PDF**.

## Important
The current prototype uses jsPDF from cdnjs, so the first run needs an internet connection to load the PDF library.

The selected images are processed in the browser; this prototype does not send them to a PDFMines backend.

## GitHub Pages
Upload `index.html`, `style.css`, and `script.js` to a GitHub repository and enable GitHub Pages. No custom domain is required for testing.

## Current feature
- Responsive premium UI
- Image selection + drag/drop
- Thumbnail preview
- Remove files
- A4 / Letter / Original
- Portrait / Landscape
- High / Medium / Small-file quality
- Client-side image → PDF conversion
- PDF download

Merge PDF, image+PDF combine, compression, split, and other tools are placeholders for the next build.
