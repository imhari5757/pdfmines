const input = document.getElementById("imageInput");
const drop = document.getElementById("dropZone");
const fileArea = document.getElementById("fileArea");
const thumbs = document.getElementById("thumbs");
const fileCount = document.getElementById("fileCount");
const status = document.querySelector(".status-dot");
let files = [];

const $ = id => document.getElementById(id);
const mainCaptureBtn = $("mainCaptureBtn");

$("startBtn").onclick = () => input.click();
$("chooseBtn").onclick = e => { e.stopPropagation(); input.click(); };
mainCaptureBtn?.addEventListener("click", e => { e.stopPropagation(); openCaptureFor("main"); });
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

let desktopDragIndex = null;
let touchDrag = {
  active:false, startIndex:-1, el:null, ghost:null,
  hoverIndex:-1, lastX:0, lastY:0, pointerId:null,
  startX:0, startY:0
};

function reorderFiles(fromIndex,toIndex){
  if(fromIndex===toIndex || fromIndex<0 || toIndex<0 ||
     fromIndex>=files.length || toIndex>=files.length) return;
  const moved=files.splice(fromIndex,1)[0];
  files.splice(toIndex,0,moved);
}

function makeTouchGhost(el,x,y){
  const r=el.getBoundingClientRect();
  const ghost=el.cloneNode(true);
  ghost.classList.add("touch-drag-ghost");
  ghost.classList.remove("dragging","drag-over");
  ghost.style.setProperty("width", `${r.width}px`, "important");
  ghost.style.setProperty("height", `${r.height}px`, "important");
  ghost.style.maxWidth = `${r.width}px`;
  ghost.style.maxHeight = `${r.height}px`;
  ghost.style.left=`${x-r.width/2}px`;
  ghost.style.top=`${y-r.height/2}px`;
  document.body.appendChild(ghost);
  return ghost;
}

function updateTouchGhost(x,y){
  if(!touchDrag.ghost) return;
  const w=touchDrag.ghost.offsetWidth;
  const h=touchDrag.ghost.offsetHeight;
  touchDrag.ghost.style.left=`${x-w/2}px`;
  touchDrag.ghost.style.top=`${y-h/2}px`;
}

function findTouchHoverIndex(x,y){
  let best=-1, bestD=Infinity;
  thumbs.querySelectorAll(".thumb").forEach(el=>{
    if(el===touchDrag.el) return;
    const i=Number(el.dataset.fileIndex);
    if(!Number.isInteger(i)) return;
    const r=el.getBoundingClientRect();
    const d=Math.hypot(x-(r.left+r.width/2),(y-(r.top+r.height/2))*0.45);
    if(d<bestD){bestD=d;best=i;}
  });
  return best;
}

function showTouchDropTarget(index){
  thumbs.querySelectorAll(".thumb").forEach(el=>{
    el.classList.toggle("drag-over",
      Number(el.dataset.fileIndex)===index && el!==touchDrag.el);
  });
}

function resetTouchDrag(){
  if(touchDrag.ghost) touchDrag.ghost.remove();
  touchDrag.el?.classList.remove("dragging");
  thumbs.querySelectorAll(".thumb").forEach(el=>{
    el.classList.remove("drag-over");
    el.removeAttribute("aria-grabbed");
  });
  touchDrag={
    active:false,startIndex:-1,el:null,ghost:null,hoverIndex:-1,
    lastX:0,lastY:0,pointerId:null,startX:0,startY:0
  };
}

function finishTouchDrag(){
  if(!touchDrag.active){resetTouchDrag();return;}
  const from=touchDrag.startIndex;
  const hover=touchDrag.hoverIndex;

  if(hover>=0 && hover!==from){
    const target=[...thumbs.querySelectorAll(".thumb")]
      .find(el=>Number(el.dataset.fileIndex)===hover);
    let to=hover;
    if(target){
      const r=target.getBoundingClientRect();
      if(touchDrag.lastX>r.left+r.width/2) to=hover+1;
    }
    if(to>from) to--;
    to=Math.max(0,Math.min(files.length-1,to));
    reorderFiles(from,to);
  }

  resetTouchDrag();
  render();
}

function render(){
  fileArea.classList.toggle("hidden", files.length === 0);
  fileCount.textContent = `${files.length} page${files.length === 1 ? "" : "s"}`;
  thumbs.innerHTML = "";

  files.forEach((file, i) => {
    const div = document.createElement("div");
    div.className = "thumb";
    div.dataset.fileIndex = String(i);
    div.draggable = true;
    div.title = "Drag to reorder";

    const img = document.createElement("img");
    img.draggable = false;
    img.decoding = "async";
    img.loading = "eager";
    img.alt = `Page ${i + 1} preview`;
    img.classList.add("preview-loading");

    // Use a data URL for thumbnails instead of a blob URL. This is slightly
    // more work once, but is much more reliable on Android Chrome and desktop
    // when several images are added/re-rendered quickly.
    const reader = new FileReader();
    reader.onload = () => {
      if (!img.isConnected) return;
      img.src = reader.result;
      img.classList.remove("preview-loading");
    };
    reader.onerror = () => {
      if (!img.isConnected) return;
      img.classList.remove("preview-loading");
      img.classList.add("preview-error");
      img.alt = "Preview unavailable";
    };
    reader.readAsDataURL(file);

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(i + 1).padStart(2, "0");

    const dragHint = document.createElement("span");
    dragHint.className = "drag-hint";
    dragHint.textContent = "⋮⋮";
    dragHint.title = "Drag to reorder";

    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "Remove";
    del.onclick = e => {
      e.stopPropagation();
      files.splice(i, 1);
      render();
    };

    div.append(img, num, dragHint, del);
    thumbs.appendChild(div);

    // Desktop / mouse drag-and-drop
    div.addEventListener("dragstart", e => {
      desktopDragIndex = i;
      div.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    });

    div.addEventListener("dragend", () => {
      desktopDragIndex = null;
      [...thumbs.children].forEach(el => el.classList.remove("dragging","drag-over"));
    });

    div.addEventListener("dragover", e => {
      e.preventDefault();
      if (desktopDragIndex === null || desktopDragIndex === i) return;
      e.dataTransfer.dropEffect = "move";
      [...thumbs.children].forEach(el => el.classList.remove("drag-over"));
      div.classList.add("drag-over");
    });

    div.addEventListener("dragleave", () => div.classList.remove("drag-over"));

    div.addEventListener("drop", e => {
      e.preventDefault();
      const from = desktopDragIndex;
      const to = i;
      [...thumbs.children].forEach(el => el.classList.remove("dragging","drag-over"));
      desktopDragIndex = null;
      if (from !== null && from !== to) {
        reorderFiles(from, to);
        render();
      }
    });

    // Touch / mobile drag: use a visual floating copy. We never move the
    // real DOM thumbnail during the finger movement, avoiding mobile
    // browser drag/scroll errors.
    div.addEventListener("pointerdown", e => {
      if(e.pointerType!=="touch" || e.target.closest("button")) return;
      touchDrag.active=false;
      touchDrag.startIndex=i;
      touchDrag.el=div;
      touchDrag.pointerId=e.pointerId;
      touchDrag.startX=e.clientX;
      touchDrag.startY=e.clientY;
      touchDrag.lastX=e.clientX;
      touchDrag.lastY=e.clientY;
      try{div.setPointerCapture(e.pointerId);}catch(_){}
    },{passive:false});

    div.addEventListener("pointermove", e => {
      if(e.pointerType!=="touch" || touchDrag.el!==div ||
         touchDrag.pointerId!==e.pointerId) return;

      touchDrag.lastX=e.clientX;
      touchDrag.lastY=e.clientY;

      if(!touchDrag.active){
        if(Math.hypot(e.clientX-touchDrag.startX,e.clientY-touchDrag.startY)<8) return;
        touchDrag.active=true;
        e.preventDefault();
        div.classList.add("dragging");
        div.setAttribute("aria-grabbed","true");
        touchDrag.ghost=makeTouchGhost(div,e.clientX,e.clientY);
      }

      e.preventDefault();
      updateTouchGhost(e.clientX,e.clientY);
      touchDrag.hoverIndex=findTouchHoverIndex(e.clientX,e.clientY);
      showTouchDropTarget(touchDrag.hoverIndex);
    },{passive:false});

    div.addEventListener("pointerup", e => {
      if(e.pointerType==="touch" && touchDrag.el===div &&
         touchDrag.pointerId===e.pointerId){
        e.preventDefault();
        finishTouchDrag();
      }
    },{passive:false});

    div.addEventListener("pointercancel", e => {
      if(e.pointerType==="touch" && touchDrag.el===div &&
         touchDrag.pointerId===e.pointerId) resetTouchDrag();
    });
  });

  status.textContent = "● Ready";
}

$("clearBtn").onclick = () => { files = []; input.value = ""; render(); };

function getAutoQuality(targetBytes, pageCount) {
  if (!targetBytes || !pageCount) return "high";

  // Target size is for the whole PDF, so estimate the budget per page.
  const perPage = targetBytes / pageCount;

  if (perPage >= 600 * 1024) return "high";
  if (perPage >= 180 * 1024) return "medium";
  return "small";
}

function qualityLabel(value) {
  return value === "high" ? "High" : value === "medium" ? "Medium" : "Small file";
}

$("targetSize").addEventListener("input", () => {
  const raw = $("targetSize").value.trim();
  const targetValue = raw === "" ? 0 : Number(raw);
  const unit = $("targetUnit").value;
  const targetBytes = targetValue > 0
    ? targetValue * (unit === "MB" ? 1024 * 1024 : 1024)
    : 0;

  if (targetBytes > 0) {
    const auto = getAutoQuality(targetBytes, files.length || 1);
    $("quality").value = auto;
    $("quality").title = `Automatically selected for the ${raw} ${unit} target`;
  } else {
    $("quality").value = "auto";
    $("quality").title = "Quality will be High when no target size is set";
  }
});

$("targetUnit").addEventListener("change", () => {
  $("targetSize").dispatchEvent(new Event("input"));
});

$("createBtn").onclick = async () => {
  if (!files.length) return;

  const size = $("pageSize").value;
  const orientation = $("orientation").value;
  const fitMode = $("fitMode").value;
  const selectedQuality = $("quality").value;
  const colorMode = $("colorMode").value;
  const rawTarget = $("targetSize").value.trim();
  const targetValue = rawTarget === "" ? 0 : Number(rawTarget);
  const targetUnit = $("targetUnit").value;
  const targetSize = targetValue > 0
    ? Math.round(targetValue * (targetUnit === "MB" ? 1024 * 1024 : 1024))
    : 0;

  // When a target size is supplied, automatically choose the appropriate
  // quality tier based on the approximate per-page size budget.
  const quality = targetSize
    ? getAutoQuality(targetSize, files.length)
    : (selectedQuality === "auto" ? "high" : selectedQuality);

  if (targetSize) {
    $("quality").value = quality;
    $("quality").title = `Auto quality: ${qualityLabel(quality)}`;
  }
  const wrap = $("progressWrap");
  const bar = $("progressBar");
  const txt = $("progressText");
  const button = $("createBtn");

  button.disabled = true;
  wrap.classList.remove("hidden");
  bar.style.width = "0%";
  status.textContent = targetSize ? `● Auto quality: ${qualityLabel(quality)}` : "● Working…";

  try {
    // When a target size is requested, reduce both JPEG quality AND
    // image resolution progressively. This is much more effective than
    // lowering JPEG quality alone, especially for very small targets.
    const compressionLevels = targetSize
      ? [1, 0.78, 0.60, 0.45, 0.32, 0.22]
      : [1];

    let finalPdf = null;
    let finalPages = null;
    let reachedTarget = !targetSize;

    for (let attempt = 0; attempt < compressionLevels.length; attempt++) {
      const factor = compressionLevels[attempt];
      const pages = [];

      for (let i = 0; i < files.length; i++) {
        txt.textContent = targetSize && attempt > 0
          ? `Optimizing size… pass ${attempt + 1}/${compressionLevels.length}, page ${i + 1}/${files.length}`
          : `Preparing page ${i + 1} of ${files.length}…`;

        const image = await prepareImage(files[i], quality, factor, colorMode);

        let pageWmm, pageHmm;
        if (size === "letter") {
          pageWmm = 215.9; pageHmm = 279.4;
        } else if (size === "original") {
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
          pageHmm,
          fitMode
        });

        bar.style.width = `${Math.round(((attempt + (i + 1) / files.length) / compressionLevels.length) * 65)}%`;
        await new Promise(r => setTimeout(r, 0));
      }

      txt.textContent = targetSize ? "Checking PDF size…" : "Building PDF…";
      const pdfBytes = buildImagePdf(pages);
      finalPdf = pdfBytes;
      finalPages = pages;

      if (!targetSize || pdfBytes.length <= targetSize) {
        reachedTarget = true;
        break;
      }
    }

    if (!finalPdf) throw new Error("Could not build the PDF");

    bar.style.width = "90%";
    const actualKB = finalPdf.length / 1024;
    const targetDisplay = targetUnit === "MB" ? targetSize / (1024 * 1024) : targetSize / 1024;

    downloadBytes(finalPdf, `PDFMines_${new Date().toISOString().slice(0, 10)}.pdf`);
    bar.style.width = "100%";

    if (targetSize && !reachedTarget) {
      txt.textContent = `PDF ready ✓ (${actualKB.toFixed(0)} KB; target ${targetDisplay.toFixed(targetUnit === "MB" ? 2 : 0)} ${targetUnit} could not be reached)`;
    } else if (targetSize) {
      txt.textContent = `PDF ready ✓ (${actualKB.toFixed(0)} KB)`;
    } else {
      txt.textContent = `PDF ready ✓ (${actualKB.toFixed(0)} KB)`;
    }
    status.textContent = "● PDF ready";
  } catch (err) {
    console.error("PDFMines PDF error:", err);
    txt.textContent = "Could not create PDF";
    status.textContent = "● Error";
    alert(`Could not create the PDF.\n\n${err && err.message ? err.message : err}`);
  } finally {
    button.disabled = false;
  }
};

// Memory-efficient image preparation for phones:
// - avoids FileReader/base64 duplication
// - decodes the source once
// - creates one JPEG Blob/Uint8Array for the PDF
async function prepareImage(file, quality, factor = 1, colorMode = "color") {
  const baseMax = quality === "small" ? 1600 : quality === "medium" ? 2400 : 3000;
  const baseJpegQuality = quality === "small" ? 0.72 : quality === "medium" ? 0.84 : 0.90;

  // Keep the original working resolution. Target-size mode changes JPEG
  // quality only, which is substantially faster and preserves text/detail.
  const max = baseMax;
  const jpegQuality = Math.max(0.22, Math.min(0.92, baseJpegQuality * factor));

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

  // Optional grayscale conversion plus light local contrast/sharpening.
  // Kept intentionally subtle so fine text/edges remain legible without
  // creating heavy halos or ringing artifacts.
  const imageData = ctx.getImageData(0, 0, width, height);
  const px = imageData.data;

  if (colorMode === "bw") {
    for (let i = 0; i < px.length; i += 4) {
      const gray = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
      px[i] = px[i + 1] = px[i + 2] = gray;
    }
  }

  // Mild unsharp-mask style enhancement. More restrained at lower quality.
  const baseSharpen = quality === "small" ? 0.16 : quality === "medium" ? 0.22 : 0.28;
  // Reduce sharpening at extreme compression levels so it does not amplify
  // JPEG noise or create halos around small text.
  const sharpenAmount = baseSharpen * Math.min(1, Math.sqrt(factor));
  if (sharpenAmount > 0 && width > 2 && height > 2) {
    const srcPx = new Uint8ClampedArray(px);
    const idx = (x, y) => (y * width + x) * 4;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = idx(x, y);
        for (let c = 0; c < 3; c++) {
          const center = srcPx[p + c];
          const avg = (
            srcPx[idx(x-1,y)+c] + srcPx[idx(x+1,y)+c] +
            srcPx[idx(x,y-1)+c] + srcPx[idx(x,y+1)+c]
          ) / 4;
          px[p + c] = Math.max(0, Math.min(255, center + (center - avg) * sharpenAmount));
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

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
    let drawW, drawH, x, y;

    if (page.fitMode === "original") {
      // Preserve the image's aspect ratio and center it inside the PDF page.
      const scale = Math.min(pageW / page.width, pageH / page.height);
      drawW = page.width * scale;
      drawH = page.height * scale;
      x = (pageW - drawW) / 2;
      y = (pageH - drawH) / 2;
    } else {
      // Full stretch: zero margin and fill the entire selected PDF page.
      drawW = pageW;
      drawH = pageH;
      x = 0;
      y = 0;
    }

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


/* =========================
   PDFMines toolbox
   Advanced PDF tools use pdf-lib in-browser.
   ========================= */
const toolModal = $("toolModal");
const toolInput = $("toolInput");
const toolDrop = $("toolDrop");
const toolChoose = $("toolChoose");
const toolFilesEl = $("toolFiles");
const toolRun = $("toolRun");
const toolStatus = $("toolStatus");
const toolTitle = $("toolModalTitle");
const toolDesc = $("toolModalDesc");
const toolDropTitle = $("toolDropTitle");
const toolDropHint = $("toolDropHint");
const splitPagesWrap = $("splitPagesWrap");
const rotateAngleWrap = $("rotateAngleWrap");
const numberOptionsWrap = $("numberOptionsWrap");
const numberPositionGrid = $("numberPositionGrid");
let activeTool = null;

function setNumberPosition(pos){
  numberPositionGrid?.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.pos===pos));
}

function setupNumberPageSelectors(){
  const from=$("numberFrom"), to=$("numberTo");
  if(!from || !to) return;
  const count=toolFiles[0]?.__pdfPageCount || null;
  from.innerHTML="<option value=\"1\">All pages from the beginning</option>";
  to.innerHTML="<option value=\"end\">All pages to the end</option>";
  if(count){
    for(let i=1;i<=count;i++){
      const a=document.createElement("option"); a.value=String(i); a.textContent=`From page ${i}`; from.append(a);
      const b=document.createElement("option"); b.value=String(i); b.textContent=`To page ${i}`; to.append(b);
    }
  }
}

let toolFiles = [];

const TOOL_CONFIG = {
  merge: {
    title:"Merge PDF",
    desc:"Combine multiple PDF files into one document. Everything stays in this browser.",
    accept:"application/pdf",
    multiple:true,
    action:"Merge PDFs"
  },
  mix: {
    title:"Mix & Combine",
    desc:"Combine PDF and image files into one PDF in the order you choose.",
    accept:"application/pdf,image/jpeg,image/png,image/webp",
    multiple:true,
    action:"Create combined PDF"
  },
  compress: {
    title:"Compress PDF",
    desc:"Re-save the PDF with compressed object streams. Image-heavy PDFs may not shrink much without rasterization.",
    accept:"application/pdf",
    multiple:false,
    action:"Optimize PDF"
  },
  split: {
    title:"Split PDF",
    desc:"Extract selected pages into a new PDF. Example: 1-3,5,7-9.",
    accept:"application/pdf",
    multiple:false,
    action:"Split PDF"
  },
  rotate: {
    title:"Rotate Pages",
    desc:"Rotate all pages of a PDF in your browser.",
    accept:"application/pdf",
    multiple:false,
    action:"Rotate PDF"
  },
  number: {
    title:"Page Numbers",
    desc:"Add page numbers to your PDF in your browser. Choose the format, position and starting number.",
    accept:"application/pdf",
    multiple:false,
    action:"Add Page Numbers"
  },
  capture: {
    title:"Scan documents",
    desc:"Capture document pages with your camera, adjust borders, then add them to the current tool.",
    accept:"image/jpeg,image/png,image/webp",
    multiple:true,
    action:"Add captured pages"
  }
};

let captureReturnTarget = null;

function openCaptureFor(target){
  captureReturnTarget = target;
  openTool("capture");
}

function openTool(name){
  const cfg=TOOL_CONFIG[name];
  if(!cfg) return;
  activeTool=name;
  toolFiles=[];
  toolInput.value="";
  toolInput.accept=cfg.accept;
  toolInput.multiple=cfg.multiple;
  toolDrop.classList.toggle("hidden",name==="capture");
  toolFilesEl.classList.toggle("hidden",name==="capture");
  captureOptionsWrap?.classList.toggle("hidden",name!=="capture");
  toolCapture?.classList.toggle("hidden",!(cfg.accept||"").includes("image"));
  toolTitle.textContent=cfg.title;
  toolDesc.textContent=cfg.desc;
  toolDropTitle.textContent=cfg.multiple ? "Choose files" : "Choose a file";
  toolDropHint.textContent=name==="mix"
    ? "PDF + JPG/PNG/WEBP supported."
    : "Files are processed locally in your browser.";
  toolRun.textContent="";
  toolRun.append(cfg.action," →");
  if(name==="capture") toolRun.textContent="Add captured pages →";
  toolStatus.textContent="";
  splitPagesWrap.classList.toggle("hidden",name!=="split");
  rotateAngleWrap.classList.toggle("hidden",name!=="rotate");
  if(name==="split") {
    document.querySelectorAll('input[name="splitOutput"]').forEach(r=>r.checked=(r.value==="single"));
  }
  capturePdfOptions?.classList.toggle("hidden",name==="capture" && !!captureReturnTarget);
  numberOptionsWrap.classList.toggle("hidden",name!=="number");
  if(name==="number") {
    setNumberPosition("bottom-center");
    setupNumberPageSelectors();
    document.querySelectorAll('input[name="numberPageMode"]').forEach(r=>r.checked=(r.value==="single"));
    $("numberBold")?.classList.remove("active");
    $("numberItalic")?.classList.remove("active");
    $("numberUnderline")?.classList.remove("active");
  }
  if(name==="capture") {
    capturePdfOptions?.classList.toggle("hidden",!!captureReturnTarget);
    toolTitle.textContent="Scan documents";
    toolDesc.textContent="Capture pages like a scanning app, adjust borders, then add them directly to the current PDF tool.";
    toolRun.textContent="Add captured pages →";
    captureItems=[]; captureIndex=0; renderCapturePages();
    captureEditor.classList.add("hidden"); captureEditorEmpty.classList.remove("hidden");
    stopCaptureCamera();
  }
  renderToolFiles();
  toolModal.classList.remove("hidden");
  toolModal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

function closeTool(){
  toolModal.classList.add("hidden");
  toolModal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
  if(activeTool==="capture") stopCaptureCamera();
  activeTool=null;
  toolFiles=[];
  toolInput.value="";
  captureUploadInput && (captureUploadInput.value="");
}

document.querySelectorAll(".tool-open").forEach(btn=>{
  btn.addEventListener("click",()=>openTool(btn.dataset.tool));
});
$("toolModalClose").onclick=closeTool;
document.querySelectorAll("[data-close-tool]").forEach(el=>el.onclick=closeTool);
toolChoose.onclick=e=>{e.stopPropagation();toolInput.click();};
toolCapture?.addEventListener("click",e=>{e.stopPropagation();openCaptureFor("tool");});
toolDrop.addEventListener("click",e=>{
  if(!e.target.closest("button")) toolInput.click();
});
toolInput.addEventListener("change",async()=>{
  const chosen=[...toolInput.files];
  if(activeTool==="capture"){
    toolInput.value="";
    await addCaptureFiles(chosen);
    return;
  }
  if(activeTool==="mix"){
    toolFiles.push(...chosen.filter(f=>/^(application\/pdf|image\/jpeg|image\/png|image\/webp)$/i.test(f.type)));
  }else{
    toolFiles=chosen.slice(0, activeTool==="merge" ? 50 : 1);
  }
  toolInput.value="";
  renderToolFiles();
  if(activeTool==="number" && toolFiles[0]){
    try{
      toolFiles[0].__pdfPageCount=await getPdfPageCount(toolFiles[0]);
    }catch(e){}
    setupNumberPageSelectors();
  }
});

function renderToolFiles(){
  toolFilesEl.innerHTML="";
  toolFiles.forEach((f,i)=>{
    const row=document.createElement("div");
    row.className="tool-file";
    row.innerHTML=`<span class="tool-file-num">${String(i+1).padStart(2,"0")}</span><span class="tool-file-name"></span><button type="button" aria-label="Remove">×</button>`;
    row.querySelector(".tool-file-name").textContent=f.name;
    row.querySelector("button").onclick=()=>{
      toolFiles.splice(i,1); renderToolFiles();
    };
    toolFilesEl.append(row);
  });
}

function ensurePDFLib(){
  if(!window.PDFLib) throw new Error("PDF engine could not load. Please reload the page.");
  return window.PDFLib;
}

async function readBytes(file){
  return new Uint8Array(await file.arrayBuffer());
}

function downloadToolBytes(bytes,name){
  const blob=new Blob([bytes],{type:"application/pdf"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}

async function imageFileToPdfBytes(file){
  // Use the existing image-to-PDF engine for a single image so quality and
  // browser-side processing remain consistent with Images -> PDF.
  const data=await readImage(file,"high");
  const img=await decodeImage(data);
  const pageW=210, pageH=297, mm=n=>n*72/25.4;
  const margin=mm(8), pw=mm(pageW), ph=mm(pageH);
  const scale=Math.min((pw-margin*2)/img.width,(ph-margin*2)/img.height);
  const w=img.width*scale,h=img.height*scale;
  const page={data,width:img.width,height:img.height,pageWmm:pageW,pageHmm:pageH};
  return buildImagePdf([page]);
}

async function mergePdfFiles(pdfFiles){
  const {PDFDocument}=ensurePDFLib();
  const out=await PDFDocument.create();
  for(const file of pdfFiles){
    const src=await PDFDocument.load(await readBytes(file),{ignoreEncryption:false});
    const pages=await out.copyPages(src,src.getPageIndices());
    pages.forEach(p=>out.addPage(p));
  }
  return await out.save({useObjectStreams:true});
}

async function mixFiles(items){
  const {PDFDocument}=ensurePDFLib();
  const out=await PDFDocument.create();

  for(const file of items){
    if(file.type==="application/pdf"){
      const src=await PDFDocument.load(await readBytes(file));
      const pages=await out.copyPages(src,src.getPageIndices());
      pages.forEach(p=>out.addPage(p));
    }else{
      const data=await readImage(file,"high");
      const img=new Image();
      await new Promise((resolve,reject)=>{
        img.onload=resolve;img.onerror=reject;img.src=data;
      });
      const page=out.addPage([595.276,841.89]);
      const jpg=await out.embedJpg(data);
      const scale=Math.min(555.276/img.width,801.89/img.height);
      const w=img.width*scale,h=img.height*scale;
      page.drawImage(jpg,{x:(595.276-w)/2,y:(841.89-h)/2,width:w,height:h});
    }
  }
  return await out.save({useObjectStreams:true});
}

async function optimizePdf(file){
  const {PDFDocument}=ensurePDFLib();
  const doc=await PDFDocument.load(await readBytes(file));
  return await doc.save({useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false});
}

function parsePageSelection(text,count){
  const set=new Set();
  for(const part of text.split(",")){
    const t=part.trim();
    if(!t) continue;
    if(/^\d+$/.test(t)){
      const n=Number(t);
      if(n<1||n>count) throw new Error(`Page ${n} is outside the PDF.`);
      set.add(n-1);
    }else if(/^(\d+)\s*-\s*(\d+)$/.test(t)){
      const [,a,b]=t.match(/^(\d+)\s*-\s*(\d+)$/).map(Number);
      if(a<1||b<a||b>count) throw new Error("Invalid page range.");
      for(let n=a;n<=b;n++) set.add(n-1);
    }else throw new Error(`Invalid page selection: ${t}`);
  }
  return [...set].sort((a,b)=>a-b);
}

function parseSplitGroups(text,count){
  const raw=text.trim();
  if(!raw) return [Array.from({length:count},(_,i)=>i)];
  const groups=[];
  for(const part of raw.split(",")){
    const t=part.trim();
    if(!t) continue;
    groups.push(parsePageSelection(t,count));
  }
  if(!groups.length) throw new Error("Select at least one page.");
  return groups;
}

async function makeSplitPdf(src,indices){
  const {PDFDocument}=ensurePDFLib();
  if(!indices.length) throw new Error("Select at least one page.");
  const out=await PDFDocument.create();
  const pages=await out.copyPages(src,indices);
  pages.forEach(p=>out.addPage(p));
  return await out.save({useObjectStreams:true});
}

async function splitPdf(file, separate=false){
  const {PDFDocument}=ensurePDFLib();
  const src=await PDFDocument.load(await readBytes(file));
  const text=$("splitPages").value.trim();
  if(!separate){
    const indices=text ? parsePageSelection(text,src.getPageCount()) : src.getPageIndices();
    return {bytes:await makeSplitPdf(src,indices), count:1};
  }
  const groups=parseSplitGroups(text,src.getPageCount());
  const outputs=[];
  for(const indices of groups){
    outputs.push(await makeSplitPdf(src,indices));
  }
  return {bytesList:outputs,count:outputs.length};
}

async function rotatePdf(file){
  const {PDFDocument,degrees}=ensurePDFLib();
  const doc=await PDFDocument.load(await readBytes(file));
  const angle=Number($("rotateAngle").value);
  doc.getPages().forEach(page=>{
    page.setRotation(degrees(angle));
  });
  return await doc.save({useObjectStreams:true});
}

numberPositionGrid?.addEventListener("click",e=>{
  const b=e.target.closest("button[data-pos]");
  if(b) setNumberPosition(b.dataset.pos);
});
["numberBold","numberItalic","numberUnderline"].forEach(id=>{
  $(id)?.addEventListener("click",()=>$(id).classList.toggle("active"));
});

async function getPdfPageCount(file){
  const {PDFDocument}=ensurePDFLib();
  const doc=await PDFDocument.load(await readBytes(file));
  return doc.getPageCount();
}

async function numberPdf(file){
  const {PDFDocument,StandardFonts,rgb}=ensurePDFLib();
  const doc=await PDFDocument.load(await readBytes(file));
  const pages=doc.getPages();
  const format=$("numberFormat").value;
  const position=(numberPositionGrid?.querySelector("button.active")?.dataset.pos)||"bottom-center";
  const start=Math.max(1,Number($("numberStart").value)||1);
  const marginValue=$("numberMargin")?.value || "recommended";
  const marginMm=marginValue==="recommended" ? 8 : Number(marginValue);
  const margin=marginMm*72/25.4;
  const pageMode=document.querySelector('input[name="numberPageMode"]:checked')?.value || "single";
  const fromVal=$("numberFrom")?.value || "1";
  const toVal=$("numberTo")?.value || "end";
  const from=Math.max(1,Number(fromVal)||1)-1;
  const to=toVal==="end" ? pages.length-1 : Math.min(pages.length-1,Math.max(from,Number(toVal)-1));
  const size=Math.max(6,Number($("numberFontSize").value)||11);
  const family=$("numberFontFamily")?.value || "helvetica";
  const bold=$("numberBold")?.classList.contains("active");
  const italic=$("numberItalic")?.classList.contains("active");
  const underline=$("numberUnderline")?.classList.contains("active");
  const hex=$("numberColor")?.value || "#333333";
  const rr=parseInt(hex.slice(1,3),16)/255, gg=parseInt(hex.slice(3,5),16)/255, bb=parseInt(hex.slice(5,7),16)/255;

  let fontName=StandardFonts.Helvetica;
  if(family==="times") fontName=bold ? StandardFonts.TimesRomanBold : italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman;
  else if(family==="courier") fontName=bold ? StandardFonts.CourierBold : italic ? StandardFonts.CourierOblique : StandardFonts.Courier;
  else if(bold) fontName=StandardFonts.HelveticaBold;
  else if(italic) fontName=StandardFonts.HelveticaOblique;
  const font=await doc.embedFont(fontName);
  const totalNumbered=Math.max(0,to-from+1);

  for(let index=from;index<=to;index++){
    const page=pages[index];
    let n=start+(index-from);
    let label=String(n);
    if(format==="page") label=`Page ${n}`;
    else if(format==="of") label=`Page ${n} of ${start+totalNumbered-1}`;
    else if(format==="slash") label=`${n} / ${start+totalNumbered-1}`;

    const textWidth=font.widthOfTextAtSize(label,size);
    const w=page.getWidth(), h=page.getHeight();
    let pos=position;
    if(pageMode==="facing"){
      const relative=index-from;
      if(position.endsWith("center")) pos=position;
      else {
        const leftSide=relative%2===0;
        if(position.endsWith("left") || position.endsWith("right")) pos=leftSide ? "bottom-left" : "bottom-right";
      }
    }
    const vertical=pos.startsWith("top") ? "top" : pos.startsWith("middle") ? "middle" : "bottom";
    const side=pos.endsWith("left") ? "left" : pos.endsWith("right") ? "right" : "center";
    const x=side==="left" ? margin : side==="right" ? w-margin-textWidth : (w-textWidth)/2;
    const y=vertical==="top" ? h-margin-size : vertical==="middle" ? (h-size)/2 : margin;
    page.drawText(label,{x,y,size,font,color:rgb(rr,gg,bb)});
    if(underline) page.drawLine({start:{x,y:y-2},end:{x:x+textWidth,y:y-2},thickness:Math.max(0.6,size/14),color:rgb(rr,gg,bb)});
  }
  return await doc.save({useObjectStreams:true});
}


/* =========================
   Capture Images -> PDF
   Camera + conservative automatic document border detection + smooth manual crop.
   ========================= */
const captureOptionsWrap = $("captureOptionsWrap");
const captureVideo = $("captureVideo");
const captureVideoPlaceholder = $("captureVideoPlaceholder");
const captureStartCamera = $("captureStartCamera");
const captureTakePhoto = $("captureTakePhoto");
const captureStopCamera = $("captureStopCamera");
const captureUploadBtn = $("captureUploadBtn");
const captureUploadInput = $("captureUploadInput");
const captureEditorEmpty = $("captureEditorEmpty");
const captureEditor = $("captureEditor");
const captureEditorTitle = $("captureEditorTitle");
const cropViewport = $("cropViewport");
const cropImage = $("cropImage");
const cropBox = $("cropBox");
const cropInfo = $("captureCropInfo");
const capturePagesEl = $("capturePages");
const captureAutoAdjust = $("captureAutoAdjust");
const capturePdfOptions = $("capturePdfOptions");
const captureResetCrop = $("captureResetCrop");
const captureReviewBack = $("captureReviewBack");
const captureReviewRecapture = $("captureReviewRecapture");
const captureReviewAdd = $("captureReviewAdd");
const captureReviewNext = $("captureReviewNext");
let captureItems = [];
let captureIndex = 0;
let captureStream = null;
let cropDrag = null;
let cropRaf = 0;
let cropPending = null;

function openCaptureReview(){
  captureOptionsWrap?.classList.add("reviewing");
  captureEditor?.scrollIntoView({block:"start",behavior:"instant"});
  setTimeout(()=>renderCrop(),0);
}

function closeCaptureReview(){
  captureOptionsWrap?.classList.remove("reviewing");
  setTimeout(()=>renderCrop(),0);
}

function stopCaptureCamera(){
  if(captureStream){
    captureStream.getTracks().forEach(t=>t.stop());
    captureStream=null;
  }
  captureVideo.srcObject=null;
  captureStartCamera.disabled=false;
  captureTakePhoto.disabled=true;
  captureStopCamera.disabled=true;
  captureVideoPlaceholder.style.display="grid";
}

async function startCaptureCamera(){
  stopCaptureCamera();
  try{
    captureStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});
    captureVideo.srcObject=captureStream;
    await captureVideo.play();
    captureVideoPlaceholder.style.display="none";
    captureStartCamera.disabled=true;
    captureTakePhoto.disabled=false;
    captureStopCamera.disabled=false;
  }catch(err){
    toolStatus.textContent="Camera permission was not available. You can still add photos from your device.";
  }
}

function makeImageFile(blob, name){
  return new File([blob], name, {type:blob.type || "image/jpeg", lastModified:Date.now()});
}

function imageFromFile(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Could not read this image."));};
    img.src=url;
  });
}

async function fileToDataUrlSafe(file){
  return await fileToDataURL(file);
}

function clampCrop(c){
  // Keep each edge independent. Never swap opposite edges while dragging:
  // swapping makes a corner jump and is what causes the non-elastic feel.
  const min=0.004;
  let l=Math.max(0,Math.min(1,c.l)), t=Math.max(0,Math.min(1,c.t));
  let r=Math.max(0,Math.min(1,c.r)), b=Math.max(0,Math.min(1,c.b));
  if(r-l<min){
    if(c.r!==undefined && c.r<=c.l) r=Math.min(1,l+min);
    else l=Math.max(0,r-min);
  }
  if(b-t<min){
    if(c.b!==undefined && c.b<=c.t) b=Math.min(1,t+min);
    else t=Math.max(0,b-min);
  }
  return {l,t,r,b};
}

async function detectDocumentCrop(file){
  const img=await imageFromFile(file);
  const max=900;
  const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
  const w=Math.max(1,Math.round(img.naturalWidth*scale));
  const h=Math.max(1,Math.round(img.naturalHeight*scale));
  const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(img,0,0,w,h);
  const d=ctx.getImageData(0,0,w,h).data;
  const sample=(x,y)=>{const i=(y*w+x)*4;return [d[i],d[i+1],d[i+2]];};
  const pts=[sample(2,2),sample(w-3,2),sample(2,h-3),sample(w-3,h-3)];
  const bg=[0,1,2].map(c=>pts.reduce((s,p)=>s+p[c],0)/pts.length);
  const dist=(x,y)=>{const i=(y*w+x)*4;return Math.sqrt((d[i]-bg[0])**2+(d[i+1]-bg[1])**2+(d[i+2]-bg[2])**2);};
  const threshold=34;
  const rowScore=y=>{let hits=0, total=0; const step=Math.max(1,Math.floor(w/140)); for(let x=0;x<w;x+=step){total++; if(dist(x,y)>threshold) hits++;} return hits/Math.max(1,total);};
  const colScore=x=>{let hits=0,total=0; const step=Math.max(1,Math.floor(h/140)); for(let y=0;y<h;y+=step){total++; if(dist(x,y)>threshold) hits++;} return hits/Math.max(1,total);};
  const edgeFrac=0.018;
  let left=0,right=w-1,top=0,bottom=h-1;
  // Require persistent foreground across several nearby scan lines/columns.
  const findStart=(fn,n)=>{for(let i=0;i<n;i++) if(fn(i)>edgeFrac && fn(Math.min(n-1,i+2))>edgeFrac) return i; return 0;};
  const findEnd=(fn,n)=>{for(let i=n-1;i>=0;i--) if(fn(i)>edgeFrac && fn(Math.max(0,i-2))>edgeFrac) return i; return n-1;};
  left=findStart(colScore,w); right=findEnd(colScore,w); top=findStart(rowScore,h); bottom=findEnd(rowScore,h);
  const bw=right-left+1, bh=bottom-top+1;
  const ratioW=bw/w, ratioH=bh/h;
  // Conservative fallback: if detection is weak or nearly full-frame, keep the full image.
  let confidence=0;
  confidence += ratioW<0.96 ? 1 : 0;
  confidence += ratioH<0.96 ? 1 : 0;
  const paddingX=Math.max(8,Math.round(w*0.025));
  const paddingY=Math.max(8,Math.round(h*0.025));
  if(confidence===0 || ratioW<0.60 || ratioH<0.60){
    return {l:0,t:0,r:1,b:1,confidence:0};
  }
  left=Math.max(0,left-paddingX); right=Math.min(w-1,right+paddingX);
  top=Math.max(0,top-paddingY); bottom=Math.min(h-1,bottom+paddingY);
  return {l:left/w,t:top/h,r:(right+1)/w,b:(bottom+1)/h,confidence:confidence};
}

function getDisplayedImageRect(){
  if(!cropViewport || !cropImage.naturalWidth) return null;
  const vw=cropViewport.clientWidth, vh=cropViewport.clientHeight;
  const iw=cropImage.naturalWidth, ih=cropImage.naturalHeight;
  const scale=Math.min(vw/iw,vh/ih);
  const w=iw*scale, h=ih*scale;
  return {x:(vw-w)/2,y:(vh-h)/2,w,h};
}

function renderCrop(){
  const item=captureItems[captureIndex];
  const rect=getDisplayedImageRect();
  if(!item || !rect) return;
  const c=clampCrop(item.crop);
  item.crop=c;
  const x=rect.x+c.l*rect.w, y=rect.y+c.t*rect.h;
  const w=(c.r-c.l)*rect.w, h=(c.b-c.t)*rect.h;
  cropBox.style.left=`${x}px`; cropBox.style.top=`${y}px`; cropBox.style.width=`${w}px`; cropBox.style.height=`${h}px`;
  $("cropShadeTop").style.height=`${y}px`;
  $("cropShadeBottom").style.height=`${Math.max(0,cropViewport.clientHeight-(y+h))}px`;
  $("cropShadeLeft").style.top=`${y}px`; $("cropShadeLeft").style.width=`${x}px`; $("cropShadeLeft").style.height=`${h}px`;
  $("cropShadeRight").style.top=`${y}px`; $("cropShadeRight").style.width=`${Math.max(0,cropViewport.clientWidth-(x+w))}px`; $("cropShadeRight").style.height=`${h}px`;
  cropInfo.textContent=item.auto ? "Border: automatic · safety padding applied" : "Border: manual";
}

function scheduleCropRender(){
  if(cropRaf) return;
  cropRaf=requestAnimationFrame(()=>{cropRaf=0;renderCrop();});
}

async function selectCapturePage(index){
  if(index<0 || index>=captureItems.length) return;
  captureIndex=index;
  const item=captureItems[index];
  captureEditorTitle.textContent=`Page ${index+1} · ${item.file.name}`;
  cropImage.src=item.dataUrl;
  cropImage.onload=()=>{renderCrop();};
  document.querySelectorAll(".capture-page-chip").forEach((el,i)=>el.classList.toggle("active",i===index));
  const radio=document.querySelector(`input[name="captureBorderMode"][value="${item.auto?"auto":"manual"}"]`);
  if(radio) radio.checked=true;
  captureEditorEmpty.classList.add("hidden");
  captureEditor.classList.remove("hidden");
}

async function addCaptureFiles(newFiles){
  for(const file of newFiles.filter(f=>/^image\/(jpeg|png|webp)$/i.test(f.type))){
    const dataUrl=await fileToDataUrlSafe(file);
    let crop={l:0,t:0,r:1,b:1};
    let auto=true;
    try{crop=await detectDocumentCrop(file);}catch(_){auto=false;}
    captureItems.push({file,dataUrl,crop,auto});
  }
  renderCapturePages();
  if(captureItems.length) await selectCapturePage(captureItems.length-1);
}

function renderCapturePages(){
  capturePagesEl.innerHTML="";
  captureItems.forEach((item,i)=>{
    const b=document.createElement("button"); b.type="button"; b.className="capture-page-chip"; b.textContent=`${i+1} · ${item.file.name}`;
    b.onclick=()=>selectCapturePage(i); capturePagesEl.appendChild(b);
  });
}

async function capturePhoto(){
  if(!captureStream || !captureVideo.videoWidth) return;
  const canvas=document.createElement("canvas");
  canvas.width=captureVideo.videoWidth; canvas.height=captureVideo.videoHeight;
  const ctx=canvas.getContext("2d");
  ctx.drawImage(captureVideo,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Camera capture failed.")),"image/jpeg",0.94));
  await addCaptureFiles([makeImageFile(blob,`Capture_${String(captureItems.length+1).padStart(2,"0")}.jpg`)]);
  stopCaptureCamera();
  openCaptureReview();
}

async function recaptureCurrentPage(){
  if(!captureStream || !captureVideo.videoWidth || !captureItems[captureIndex]){
    await startCaptureCamera();
    return;
  }
  const canvas=document.createElement("canvas");
  canvas.width=captureVideo.videoWidth; canvas.height=captureVideo.videoHeight;
  const ctx=canvas.getContext("2d"); ctx.drawImage(captureVideo,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Camera capture failed.")),"image/jpeg",0.94));
  const file=makeImageFile(blob,`Capture_${String(captureIndex+1).padStart(2,"0")}.jpg`);
  const dataUrl=await fileToDataUrlSafe(file);
  let crop={l:0,t:0,r:1,b:1}, auto=true;
  try{crop=await detectDocumentCrop(file);}catch(_){auto=false;}
  captureItems[captureIndex]={file,dataUrl,crop,auto};
  renderCapturePages();
  await selectCapturePage(captureIndex);
  stopCaptureCamera();
  openCaptureReview();
}

async function resetCurrentCrop(){
  const item=captureItems[captureIndex]; if(!item) return;
  item.crop={l:0,t:0,r:1,b:1}; item.auto=false;
  document.querySelector('input[name="captureBorderMode"][value="manual"]')?.click();
  renderCrop();
}

async function autoAdjustCurrentCrop(){
  const item=captureItems[captureIndex]; if(!item) return;
  try{
    item.crop=await detectDocumentCrop(item.file); item.auto=true;
    document.querySelector('input[name="captureBorderMode"][value="auto"]')?.click();
    renderCrop();
  }catch(err){ toolStatus.textContent="Automatic border detection could not analyze this image."; }
}

captureStartCamera?.addEventListener("click",startCaptureCamera);
captureStopCamera?.addEventListener("click",stopCaptureCamera);
captureTakePhoto?.addEventListener("click",capturePhoto);
captureUploadBtn?.addEventListener("click",()=>captureUploadInput.click());
captureUploadInput?.addEventListener("change",async()=>{const fs=[...captureUploadInput.files];captureUploadInput.value="";await addCaptureFiles(fs);});
captureAutoAdjust?.addEventListener("click",autoAdjustCurrentCrop);
captureResetCrop?.addEventListener("click",resetCurrentCrop);
captureReviewBack?.addEventListener("click",()=>{closeCaptureReview();startCaptureCamera();});
captureReviewRecapture?.addEventListener("click",async()=>{closeCaptureReview();await startCaptureCamera();});
captureReviewAdd?.addEventListener("click",()=>{closeCaptureReview();renderCapturePages();});
captureReviewNext?.addEventListener("click",()=>{closeCaptureReview();startCaptureCamera();});

document.querySelectorAll('input[name="captureBorderMode"]').forEach(r=>r.addEventListener("change",async()=>{
  const item=captureItems[captureIndex]; if(!item) return;
  if(r.value==="auto" && r.checked){ await autoAdjustCurrentCrop(); }
  if(r.value==="manual" && r.checked){ item.auto=false; renderCrop(); }
}));

function updateCropFromPointer(clientX,clientY){
  if(!cropDrag) return;
  const rect=getDisplayedImageRect(); if(!rect) return;
  const dx=(clientX-cropDrag.startX)/rect.w, dy=(clientY-cropDrag.startY)/rect.h;
  const s=cropDrag.startCrop; const h=cropDrag.handle;
  let c={...s};
  const min=0.004;

  if(h!=="move") {
    if(h.includes("w")) c.l=Math.max(0,Math.min(s.r-min,s.l+dx));
    if(h.includes("e")) c.r=Math.min(1,Math.max(s.l+min,s.r+dx));
    if(h.includes("n")) c.t=Math.max(0,Math.min(s.b-min,s.t+dy));
    if(h.includes("s")) c.b=Math.min(1,Math.max(s.t+min,s.b+dy));
  } else {
    const ww=s.r-s.l, hh=s.b-s.t;
    c.l=Math.max(0,Math.min(1-ww,s.l+dx)); c.r=c.l+ww;
    c.t=Math.max(0,Math.min(1-hh,s.t+dy)); c.b=c.t+hh;
  }
  const item=captureItems[captureIndex];
  if(item){item.crop=clampCrop(c);item.auto=false;}
  cropPending=item?.crop || null;
  scheduleCropRender();
}
function beginCropDrag(e, handle){
  const item=captureItems[captureIndex];
  if(!item) return;
  cropDrag={handle,startX:e.clientX,startY:e.clientY,startCrop:{...item.crop},pointerId:e.pointerId};
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}
  cropBox?.classList.add("is-resizing");
  e.preventDefault(); e.stopPropagation();
}

// Attach the 8 handles directly. This avoids event bubbling/capture glitches on mobile
// and makes every edge/corner independently draggable.
document.querySelectorAll(".crop-handle").forEach(handleEl=>{
  handleEl.addEventListener("pointerdown",e=>beginCropDrag(e,handleEl.dataset.handle));
  handleEl.addEventListener("pointermove",e=>{
    if(cropDrag && cropDrag.pointerId===e.pointerId){e.preventDefault();updateCropFromPointer(e.clientX,e.clientY);}
  });
  handleEl.addEventListener("pointerup",e=>{if(cropDrag && cropDrag.pointerId===e.pointerId) endCropDrag(e);});
  handleEl.addEventListener("pointercancel",e=>{if(cropDrag && cropDrag.pointerId===e.pointerId) endCropDrag(e);});
});

// Drag the inside of the border to move the whole crop box.
cropBox?.addEventListener("pointerdown",e=>{
  if(e.target.closest(".crop-handle")) return;
  beginCropDrag(e,"move");
});
cropBox?.addEventListener("pointermove",e=>{
  if(cropDrag && cropDrag.pointerId===e.pointerId){e.preventDefault();updateCropFromPointer(e.clientX,e.clientY);}
});
const endCropDrag=e=>{
  if(cropDrag && (!e.pointerId || cropDrag.pointerId===e.pointerId)){
    cropDrag=null; cropPending=null; cropBox?.classList.remove("is-resizing"); renderCrop();
  }
};
cropBox?.addEventListener("pointerup",endCropDrag);
cropBox?.addEventListener("pointercancel",endCropDrag);
window.addEventListener("resize",()=>{if(activeTool==="capture") scheduleCropRender();});

async function materializeCaptureFiles(){
  if(!captureItems.length) throw new Error("Capture or add at least one image first.");
  const out=[];
  for(let i=0;i<captureItems.length;i++){
    const item=captureItems[i];
    const img=await imageFromFile(item.file);
    const sw=img.naturalWidth, sh=img.naturalHeight;
    const sx=Math.max(0,Math.floor(item.crop.l*sw)), sy=Math.max(0,Math.floor(item.crop.t*sh));
    const ex=Math.min(sw,Math.ceil(item.crop.r*sw)), ey=Math.min(sh,Math.ceil(item.crop.b*sh));
    const cw=Math.max(1,ex-sx), ch=Math.max(1,ey-sy);
    const c=document.createElement("canvas"); c.width=cw; c.height=ch;
    const ctx=c.getContext("2d"); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
    ctx.drawImage(img,sx,sy,cw,ch,0,0,cw,ch);
    const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("Could not prepare captured image.")),"image/jpeg",.94));
    out.push(makeImageFile(blob,`Scan_${String(i+1).padStart(2,"0")}.jpg`));
    await new Promise(r=>setTimeout(r,0));
  }
  return out;
}

async function createCapturePdf(){
  if(!captureItems.length) throw new Error("Capture or add at least one image first.");
  const size=$("capturePageSize").value;
  const quality=$("captureQuality").value;
  const color=$("captureColor").value;
  const pages=[];
  for(let i=0;i<captureItems.length;i++){
    const item=captureItems[i];
    const img=await imageFromFile(item.file);
    const sw=img.naturalWidth, sh=img.naturalHeight;
    const sx=Math.max(0,Math.floor(item.crop.l*sw)), sy=Math.max(0,Math.floor(item.crop.t*sh));
    const ex=Math.min(sw,Math.ceil(item.crop.r*sw)), ey=Math.min(sh,Math.ceil(item.crop.b*sh));
    const cw=Math.max(1,ex-sx), ch=Math.max(1,ey-sy);
    const c=document.createElement("canvas"); c.width=cw; c.height=ch;
    const ctx=c.getContext("2d"); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
    ctx.drawImage(img,sx,sy,cw,ch,0,0,cw,ch);
    const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("Could not prepare image.")),"image/jpeg",quality==="small"?.72:quality==="medium"?.84:.90));
    const cropped=makeImageFile(blob,`capture-${i+1}.jpg`);
    const prepared=await prepareImage(cropped,quality,1,color);
    let pageWmm=210,pageHmm=297;
    if(size==="letter"){pageWmm=215.9;pageHmm=279.4;}
    if(size==="original") pageHmm=pageWmm*(prepared.height/prepared.width);
    pages.push({jpeg:prepared.jpeg,width:prepared.width,height:prepared.height,pageWmm,pageHmm,fitMode:"original"});
    await new Promise(r=>setTimeout(r,0));
  }
  return buildImagePdf(pages);
}

toolRun.onclick=async()=>{
  if(!activeTool) return;
  if(activeTool==="capture" && !captureItems.length){
    toolStatus.textContent="Capture or add at least one image first.";
    return;
  }
  if(activeTool==="capture" && captureReturnTarget){
    toolRun.disabled=true;
    toolStatus.textContent="Preparing captured pages…";
    try{
      const captured=await materializeCaptureFiles();
      const target=captureReturnTarget;
      closeTool();
      captureReturnTarget=null;
      if(target==="main") addFiles(captured);
      else if(target==="tool"){ toolFiles.push(...captured); renderToolFiles(); }
      toolStatus.textContent="";
    }catch(err){
      toolStatus.textContent=err?.message||"Could not prepare captured pages.";
    }finally{ toolRun.disabled=false; }
    return;
  }
  if(activeTool!=="capture" && !toolFiles.length){
    toolStatus.textContent="Please choose a file first.";
    return;
  }
  if(activeTool==="merge" && toolFiles.length<2){
    toolStatus.textContent="Choose at least 2 PDF files.";
    return;
  }

  toolRun.disabled=true;
  toolStatus.textContent="Processing locally…";
  try{
    let bytes;
    if(activeTool==="merge") bytes=await mergePdfFiles(toolFiles);
    else if(activeTool==="mix") bytes=await mixFiles(toolFiles);
    else if(activeTool==="compress") bytes=await optimizePdf(toolFiles[0]);
    else if(activeTool==="split") {
      const separate=document.querySelector('input[name="splitOutput"]:checked')?.value==="separate";
      const result=await splitPdf(toolFiles[0],separate);
      if(separate){
        for(let i=0;i<result.bytesList.length;i++){
          const part=result.bytesList[i];
          downloadToolBytes(part,`PDFMines_Split_${i+1}_${new Date().toISOString().slice(0,10)}.pdf`);
          if(i<result.bytesList.length-1) await new Promise(r=>setTimeout(r,350));
        }
        const totalKb=Math.round(result.bytesList.reduce((sum,b)=>sum+b.length,0)/1024);
        toolStatus.textContent=`Done ✓  ${result.count} PDF files downloaded separately — ${totalKb} KB total.`;
        return;
      }
      bytes=result.bytes;
    }
    else if(activeTool==="rotate") bytes=await rotatePdf(toolFiles[0]);
    else if(activeTool==="number") bytes=await numberPdf(toolFiles[0]);
    else if(activeTool==="capture") bytes=await createCapturePdf();

    const base=activeTool==="merge"?"PDFMines_Merged":
      activeTool==="mix"?"PDFMines_Combined":
      activeTool==="compress"?"PDFMines_Optimized":
      activeTool==="split"?"PDFMines_Split":
      activeTool==="rotate"?"PDFMines_Rotated":
      activeTool==="capture"?"PDFMines_Captured":
      "PDFMines_Numbered";
    downloadToolBytes(bytes,`${base}_${new Date().toISOString().slice(0,10)}.pdf`);
    const kb=Math.round(bytes.length/1024);
    toolStatus.textContent=`Done ✓  ${kb} KB — downloaded to your device.`;
  }catch(err){
    console.error(err);
    toolStatus.textContent=err?.message || "Could not process this PDF.";
  }finally{
    toolRun.disabled=false;
  }
};
