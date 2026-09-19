# PDFMines

Client-side Images → PDF prototype for GitHub Pages.

## Current build
- Browser-only image processing; selected files are not uploaded to a PDFMines server.
- Memory-efficient image conversion for mobile browsers.
- JPG/JPEG, PNG and WEBP input.
- A4, Letter and Original page sizes.
- Portrait/Landscape.
- High, Medium and Small file quality.
- 5 mm white margin with aspect ratio preserved.
- Multi-page PDF download.

## GitHub Pages
Upload the files in this folder to the repository root. The `index.html` uses `script.js?v=3` to avoid stale browser caching after deployment.


### Capture review / elastic crop update
- Captured pages open immediately in a dedicated review interface with a large image preview.
- 8-point crop handles resize independently without swapping opposite edges during drag.
- Corner handles can move horizontally and vertically together without jumpy inversion.
- Back, Recapture, Use this page, and Capture next page controls are included.
