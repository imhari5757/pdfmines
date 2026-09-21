PDFMines Exam Photo & Signature Resizer v67

Fixes JPG→PDF image decoding failures seen on some Android/Chrome file-provider combinations.
The PDF image pipeline now tries createImageBitmap, object-URL decoding, local blob normalization, and FileReader as a final fallback, with clearer diagnostics.
No server upload is used for image conversion.
