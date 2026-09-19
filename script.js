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
  ghost.style.width=`${r.width}px`;
  ghost.style.height=`${r.height}px`;
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
  }
};

function openTool(name){
  const cfg=TOOL_CONFIG[name];
  if(!cfg) return;
  activeTool=name;
  toolFiles=[];
  toolInput.value="";
  toolInput.accept=cfg.accept;
  toolInput.multiple=cfg.multiple;
  toolTitle.textContent=cfg.title;
  toolDesc.textContent=cfg.desc;
  toolDropTitle.textContent=cfg.multiple ? "Choose files" : "Choose a file";
  toolDropHint.textContent=name==="mix"
    ? "PDF + JPG/PNG/WEBP supported."
    : "Files are processed locally in your browser.";
  toolRun.textContent="";
  toolRun.append(cfg.action," →");
  toolStatus.textContent="";
  splitPagesWrap.classList.toggle("hidden",name!=="split");
  rotateAngleWrap.classList.toggle("hidden",name!=="rotate");
  numberOptionsWrap.classList.toggle("hidden",name!=="number");
  if(name==="number") {
    setNumberPosition("bottom-center");
    setupNumberPageSelectors();
    document.querySelectorAll('input[name="numberPageMode"]').forEach(r=>r.checked=(r.value==="single"));
    $("numberBold")?.classList.remove("active");
    $("numberItalic")?.classList.remove("active");
    $("numberUnderline")?.classList.remove("active");
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
  activeTool=null;
  toolFiles=[];
  toolInput.value="";
}

document.querySelectorAll(".tool-open").forEach(btn=>{
  btn.addEventListener("click",()=>openTool(btn.dataset.tool));
});
$("toolModalClose").onclick=closeTool;
document.querySelectorAll("[data-close-tool]").forEach(el=>el.onclick=closeTool);
toolChoose.onclick=e=>{e.stopPropagation();toolInput.click();};
toolDrop.addEventListener("click",e=>{
  if(!e.target.closest("button")) toolInput.click();
});
toolInput.addEventListener("change",async()=>{
  const chosen=[...toolInput.files];
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

async function splitPdf(file){
  const {PDFDocument}=ensurePDFLib();
  const src=await PDFDocument.load(await readBytes(file));
  const text=$("splitPages").value.trim();
  const indices=text ? parsePageSelection(text,src.getPageCount()) : src.getPageIndices();
  if(!indices.length) throw new Error("Select at least one page.");
  const out=await PDFDocument.create();
  const pages=await out.copyPages(src,indices);
  pages.forEach(p=>out.addPage(p));
  return await out.save({useObjectStreams:true});
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

toolRun.onclick=async()=>{
  if(!activeTool) return;
  if(!toolFiles.length){
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
    else if(activeTool==="split") bytes=await splitPdf(toolFiles[0]);
    else if(activeTool==="rotate") bytes=await rotatePdf(toolFiles[0]);
    else if(activeTool==="number") bytes=await numberPdf(toolFiles[0]);

    const base=activeTool==="merge"?"PDFMines_Merged":
      activeTool==="mix"?"PDFMines_Combined":
      activeTool==="compress"?"PDFMines_Optimized":
      activeTool==="split"?"PDFMines_Split":
      activeTool==="rotate"?"PDFMines_Rotated":
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
