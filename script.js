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
  thumbs.querySelectorAll("img").forEach(img=>{
    if(img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  });
  thumbs.innerHTML = "";

  files.forEach((file, i) => {
    const div = document.createElement("div");
    div.className = "thumb";
    div.dataset.fileIndex = String(i);
    div.draggable = true;
    div.title = "Drag to reorder";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.draggable = false;

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

$("createBtn").onclick = async () => {
  if (!files.length) return;

  const size = $("pageSize").value;
  const orientation = $("orientation").value;
  const fitMode = $("fitMode").value;
  const quality = $("quality").value;
  const colorMode = $("colorMode").value;
  const rawTarget = $("targetSize").value.trim();
  const targetValue = rawTarget === "" ? 0 : Number(rawTarget);
  const targetUnit = $("targetUnit").value;
  const targetSize = targetValue > 0
    ? Math.round(targetValue * (targetUnit === "MB" ? 1024 * 1024 : 1024))
    : 0;
  const wrap = $("progressWrap");
  const bar = $("progressBar");
  const txt = $("progressText");
  const button = $("createBtn");

  button.disabled = true;
  wrap.classList.remove("hidden");
  bar.style.width = "0%";
  status.textContent = "● Working…";

  try {
    // When a target size is requested, reduce both JPEG quality AND
    // image resolution progressively. This is much more effective than
    // lowering JPEG quality alone, especially for very small targets.
    const compressionLevels = targetSize
      ? [1, 0.82, 0.68, 0.56, 0.46, 0.37, 0.30, 0.24, 0.19, 0.15, 0.12, 0.09, 0.07]
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

  // Never make the image needlessly tiny for normal use. For a very small
  // requested PDF target, however, allow the compression engine to reduce
  // resolution further so it has a real chance of meeting the target.
  const max = Math.max(180, Math.round(baseMax * factor));
  const jpegQuality = Math.max(0.12, Math.min(0.92, baseJpegQuality * factor));

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
