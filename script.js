const input = document.getElementById("imageInput");
const drop = document.getElementById("dropZone");
const fileArea = document.getElementById("fileArea");
const thumbs = document.getElementById("thumbs");
const fileCount = document.getElementById("fileCount");
const status = document.querySelector(".status-dot");
let files = [];

const $ = id => document.getElementById(id);

$("startBtn").onclick = () => input.click();
$("chooseBtn").onclick = e => { e.stopPropagation(); input.click(); };
drop.addEventListener("click", e => { if (!e.target.closest("button")) input.click(); });
input.addEventListener("change", () => { addFiles([...input.files]); input.value = ""; });

["dragenter","dragover"].forEach(type => drop.addEventListener(type, e => {
  e.preventDefault(); drop.classList.add("drag");
}));
["dragleave","drop"].forEach(type => drop.addEventListener(type, e => {
  e.preventDefault(); drop.classList.remove("drag");
}));
drop.addEventListener("drop", e => addFiles([...e.dataTransfer.files]));

function addFiles(newFiles){
  const valid = newFiles.filter(f => /^(image\/jpeg|image\/png|image\/webp)$/i.test(f.type));
  files.push(...valid);
  render();
}

function render(){
  fileArea.classList.toggle("hidden", files.length === 0);
  fileCount.textContent = `${files.length} page${files.length === 1 ? "" : "s"}`;
  thumbs.innerHTML = "";

  files.forEach((file, i) => {
    const div = document.createElement("div");
    div.className = "thumb";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(i + 1).padStart(2, "0");
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "Remove";
    del.onclick = () => { files.splice(i, 1); render(); };
    div.append(img, num, del);
    thumbs.appendChild(div);
  });
  status.textContent = "● Ready";
}

$("clearBtn").onclick = () => { files = []; input.value = ""; render(); };

$("createBtn").onclick = async () => {
  if (!files.length) return;

  const size = $("pageSize").value;
  const orientation = $("orientation").value;
  const quality = $("quality").value;
  const wrap = $("progressWrap");
  const bar = $("progressBar");
  const txt = $("progressText");
  const button = $("createBtn");

  button.disabled = true;
  wrap.classList.remove("hidden");
  bar.style.width = "0%";
  status.textContent = "● Working…";

  try {
    const pages = [];

    for (let i = 0; i < files.length; i++) {
      txt.textContent = `Preparing page ${i + 1} of ${files.length}…`;
      const image = await prepareImage(files[i], quality);

      let pageWmm, pageHmm;
      if (size === "letter") {
        pageWmm = 215.9; pageHmm = 279.4;
      } else if (size === "original") {
        // Keep a practical physical page size based on the image aspect ratio.
        pageWmm = 210;
        pageHmm = pageWmm * (image.height / image.width);
      } else {
        pageWmm = 210; pageHmm = 297;
      }

      if (orientation === "landscape" && size !== "original") {
        [pageWmm, pageHmm] = [pageHmm, pageWmm];
      }

      pages.push({
        jpeg: image.jpeg,
        width: image.width,
        height: image.height,
        pageWmm,
        pageHmm
      });

      bar.style.width = `${Math.round((i + 1) / files.length * 65)}%`;
      await new Promise(r => setTimeout(r, 0));
    }

    txt.textContent = "Building PDF…";
    const pdfBytes = buildImagePdf(pages);
    bar.style.width = "90%";
    downloadBytes(pdfBytes, `PDFMines_${new Date().toISOString().slice(0, 10)}.pdf`);
    bar.style.width = "100%";
    txt.textContent = "PDF ready ✓";
    status.textContent = "● PDF ready";
  } catch (err) {
    console.error("PDFMines PDF error:", err);
    txt.textContent = "Could not create PDF";
    status.textContent = "● Error";
    // Show the real error during testing; this makes future browser issues diagnosable.
    alert(`Could not create the PDF.\n\n${err && err.message ? err.message : err}`);
  } finally {
    button.disabled = false;
  }
};

// Memory-efficient image preparation for phones:
// - avoids FileReader/base64 duplication
// - decodes the source once
// - creates one JPEG Blob/Uint8Array for the PDF
async function prepareImage(file, quality) {
  const max = quality === "small" ? 1600 : quality === "medium" ? 2400 : 3000;
  const jpegQuality = quality === "small" ? 0.72 : quality === "medium" ? 0.84 : 0.90;

  // Prefer createImageBitmap on modern mobile browsers. It is more reliable
  // for camera/gallery images and avoids the object-URL decoding issue seen
  // on some Android Chrome builds.
  let source = null;
  let sourceW = 0;
  let sourceH = 0;
  let shouldClose = false;

  try {
    if ("createImageBitmap" in window) {
      try {
        source = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (_) {
        // Some browsers reject the options object; try the simple form.
        source = await createImageBitmap(file);
      }
      sourceW = source.width;
      sourceH = source.height;
      shouldClose = true;
    }
  } catch (_) {
    source = null;
  }

  // Reliable fallback: read the actual file bytes into a data URL.
  if (!source) {
    const dataUrl = await fileToDataURL(file);
    source = await loadImageFromDataURL(dataUrl);
    sourceW = source.naturalWidth || source.width;
    sourceH = source.naturalHeight || source.height;
  }

  if (!sourceW || !sourceH) {
    if (shouldClose && source.close) source.close();
    throw new Error("Could not read the image dimensions");
  }

  const scale = Math.min(1, max / Math.max(sourceW, sourceH));
  const width = Math.max(1, Math.round(sourceW * scale));
  const height = Math.max(1, Math.round(sourceH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    if (shouldClose && source.close) source.close();
    throw new Error("Your browser could not create an image canvas");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);

  if (shouldClose && source.close) source.close();

  const blob = await canvasToBlob(canvas, "image/jpeg", jpegQuality);
  const jpeg = new Uint8Array(await blob.arrayBuffer());

  canvas.width = 1;
  canvas.height = 1;

  return { jpeg, width, height };
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected image file"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataURL(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode this image. Please use JPG, PNG or WEBP."));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Browser could not convert the image"));
    }, type, quality);
  });
}

// Dependency-free PDF writer. JPEG bytes are embedded directly, so no CDN/library is required.
function buildImagePdf(pages) {
  if (!pages.length) throw new Error("No pages to add");

  const objects = [null, null];
  const pageRefs = [];
  const mmToPt = mm => mm * 72 / 25.4;

  for (const page of pages) {
    const imageObj = objects.length + 1;
    const contentObj = imageObj + 1;
    const pageObj = imageObj + 2;

    const pageW = mmToPt(page.pageWmm);
    const pageH = mmToPt(page.pageHmm);
    // Full-page mode: 0 mm margin and intentional stretching.
    const margin = 0;
    const drawW = pageW;
    const drawH = pageH;
    const x = 0;
    const y = 0;

    const content = `q\n${fmt(drawW)} 0 0 ${fmt(drawH)} ${fmt(x)} ${fmt(y)} cm\n/Im1 Do\nQ\n`;

    objects.push({
      type: "binary",
      header: `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      data: page.jpeg,
      footer: `\nendstream`
    });
    objects.push({
      type: "text",
      data: `<< /Length ${utf8Bytes(content).length} >>\nstream\n${content}endstream`
    });
    objects.push({
      type: "text",
      data: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(pageW)} ${fmt(pageH)}] /Resources << /XObject << /Im1 ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`
    });
    pageRefs.push(pageObj);
  }

  objects[0] = { type: "text", data: `<< /Type /Catalog /Pages 2 0 R >>` };
  objects[1] = { type: "text", data: `<< /Type /Pages /Kids [${pageRefs.map(n => `${n} 0 R`).join(" ")}] /Count ${pageRefs.length} >>` };

  const chunks = [];
  const offsets = [0];
  let offset = 0;
  const pushText = text => {
    const bytes = utf8Bytes(text);
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pushBytes = bytes => {
    chunks.push(bytes);
    offset += bytes.length;
  };

  pushText("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset);
    pushText(`${i + 1} 0 obj\n`);
    const obj = objects[i];
    if (obj.type === "binary") {
      pushText(obj.header);
      pushBytes(obj.data);
      pushText(obj.footer + "\nendobj\n");
    } else {
      pushText(obj.data + "\nendobj\n");
    }
  }

  const xrefOffset = offset;
  pushText(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i++) {
    pushText(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concatBytes(chunks);
}

function utf8Bytes(text) { return new TextEncoder().encode(text); }
function fmt(n) { return Number(n.toFixed(3)).toString(); }
function concatBytes(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
