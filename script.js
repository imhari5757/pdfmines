// PDFMines v53 — compact responsive thumbnail cards
const $ = id => document.getElementById(id);
const input = $("imageInput");
const drop = $("dropZone");
const fileArea = $("fileArea");
const thumbs = $("thumbs");
const fileCount = $("fileCount");
const status = document.querySelector(".status-dot");
let files = [];

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

function isSupportedImageFile(file){
  if(!file) return false;
  const type=String(file.type||"").toLowerCase().split(";")[0].trim();
  const name=String(file.name||"").toLowerCase();
  const ext=name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  // Some Android Gallery/File Manager providers return an empty or non-standard
  // MIME type even though the selected file is a normal JPG/PNG/WEBP. In that
  // case, trust the filename extension.
  return ["image/jpeg","image/jpg","image/png","image/webp"].includes(type)
      || [".jpg",".jpeg",".png",".webp"].includes(ext);
}

function addFiles(newFiles){
  const valid = newFiles.filter(isSupportedImageFile);
  if(!valid.length && newFiles.length){
    status.textContent = "● Unsupported image";
    alert("PDFMines could not recognize the selected image.\n\nPlease choose JPG, JPEG, PNG or WEBP.");
    return;
  }
  valid.forEach(file=>{
    if(!file.__previewUrl){
      try{ file.__previewUrl=URL.createObjectURL(file); }catch(_){ file.__previewUrl=null; }
    }
  });
  files.push(...valid);
  render();
}

let desktopDragIndex = null;
let desktopDragPoint = {x:0,y:0,active:false,autoScrollFrame:null};
let touchDrag = {
  active:false, startIndex:-1, el:null, ghost:null,
  hoverIndex:-1, lastX:0, lastY:0, pointerId:null,
  startX:0, startY:0, autoScrollFrame:null
};

function getScrollElement(){
  return document.scrollingElement || document.documentElement || document.body;
}

function scrollPageBy(delta){
  if(!delta) return false;
  const scroller=getScrollElement();
  const before=scroller.scrollTop;
  scroller.scrollTop=before+delta;
  if(scroller.scrollTop!==before) return true;

  const y=window.scrollY;
  window.scrollTo(0,y+delta);
  return window.scrollY!==y;
}

function edgeScrollDelta(y, viewportHeight){
  const edge=Math.min(170,Math.max(90,viewportHeight*0.20));
  const maxSpeed=Math.max(18,Math.min(42,viewportHeight*0.055));
  if(y<edge){
    const ratio=Math.min(1,(edge-y)/edge);
    return -Math.max(3,maxSpeed*ratio*ratio);
  }
  if(y>viewportHeight-edge){
    const ratio=Math.min(1,(y-(viewportHeight-edge))/edge);
    return Math.max(3,maxSpeed*ratio*ratio);
  }
  return 0;
}

function runDesktopAutoScroll(){
  if(!desktopDragPoint.active){
    desktopDragPoint.autoScrollFrame=null;
    return;
  }
  const h=window.innerHeight || document.documentElement.clientHeight;
  const delta=edgeScrollDelta(desktopDragPoint.y,h);
  if(delta) scrollPageBy(delta);
  desktopDragPoint.autoScrollFrame=requestAnimationFrame(runDesktopAutoScroll);
}

function startDesktopAutoScroll(){
  if(desktopDragPoint.autoScrollFrame===null){
    desktopDragPoint.autoScrollFrame=requestAnimationFrame(runDesktopAutoScroll);
  }
}

function stopDesktopAutoScroll(){
  desktopDragPoint.active=false;
  if(desktopDragPoint.autoScrollFrame!==null){
    cancelAnimationFrame(desktopDragPoint.autoScrollFrame);
    desktopDragPoint.autoScrollFrame=null;
  }
}

function updateDesktopDragPoint(e){
  desktopDragPoint.x=e.clientX;
  desktopDragPoint.y=e.clientY;
  desktopDragPoint.active=true;
  startDesktopAutoScroll();
}

function stopTouchAutoScroll(){
  if(touchDrag.autoScrollFrame !== null){
    cancelAnimationFrame(touchDrag.autoScrollFrame);
    touchDrag.autoScrollFrame = null;
  }
}

function runTouchAutoScroll(){
  if(!touchDrag.active){
    stopTouchAutoScroll();
    return;
  }

  const h=window.innerHeight || document.documentElement.clientHeight;
  const delta=edgeScrollDelta(touchDrag.lastY,h);
  if(delta){
    scrollPageBy(delta);
    updateTouchGhost(touchDrag.lastX,touchDrag.lastY);
    touchDrag.hoverIndex=findTouchHoverIndex(touchDrag.lastX,touchDrag.lastY);
    showTouchDropTarget(touchDrag.hoverIndex);
  }

  touchDrag.autoScrollFrame=requestAnimationFrame(runTouchAutoScroll);
}

function startTouchAutoScroll(){
  if(touchDrag.autoScrollFrame === null){
    touchDrag.autoScrollFrame = requestAnimationFrame(runTouchAutoScroll);
  }
}

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
  ghost.style.setProperty('width', `${r.width}px`, 'important');
  ghost.style.setProperty('min-width', '0px', 'important');
  ghost.style.setProperty('max-width', `${r.width}px`, 'important');
  ghost.style.setProperty('height', `${r.height}px`, 'important');
  ghost.style.setProperty('min-height', '0px', 'important');
  ghost.style.setProperty('max-height', `${r.height}px`, 'important');
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
  stopTouchAutoScroll();
  touchDrag={
    active:false,startIndex:-1,el:null,ghost:null,hoverIndex:-1,
    lastX:0,lastY:0,pointerId:null,startX:0,startY:0,autoScrollFrame:null
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
    const coarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    div.draggable = !coarsePointer;
    div.title = "Drag to reorder";

    const img = document.createElement("img");
    img.draggable = false;
    // The thumbnail is a preview only. Do not let Android Chrome treat a
    // long-press on the image as an image action/context-menu gesture.
    img.style.pointerEvents = "none";
    img.addEventListener("dragstart", e => e.preventDefault());
    img.addEventListener("contextmenu", e => e.preventDefault());
    img.decoding = "async";
    img.loading = "eager";
    img.alt = `Page ${i + 1} preview`;
    img.classList.add("preview-loading");

    const showPreviewError = () => {
      if (!img.isConnected) return;
      img.classList.remove("preview-loading");
      img.classList.add("preview-error");
      img.alt = "Preview unavailable";
    };

    const loadFromFileReader = () => {
      const reader = new FileReader();
      reader.onload = () => {
        if (!img.isConnected) return;
        img.src = reader.result;
        img.classList.remove("preview-loading");
      };
      reader.onerror = showPreviewError;
      try{ reader.readAsDataURL(file); }catch(_){ showPreviewError(); }
    };

    if(file.__previewUrl){
      img.onload = () => {
        img.classList.remove("preview-loading");
      };
      img.onerror = () => {
        URL.revokeObjectURL(file.__previewUrl);
        file.__previewUrl = null;
        loadFromFileReader();
      };
      img.src = file.__previewUrl;
    }else{
      loadFromFileReader();
    }

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
      const removed=files.splice(i, 1)[0];
      if(removed?.__previewUrl){ try{URL.revokeObjectURL(removed.__previewUrl);}catch(_){} removed.__previewUrl=null; }
      render();
    };

    div.append(img, num, dragHint, del);
    // Prevent Android/iOS image context menus during the intentional
    // long-press used to start reordering. Normal vertical scrolling is
    // still handled by the card's touch-action.
    div.addEventListener("contextmenu", e => e.preventDefault());
    thumbs.appendChild(div);

    div.addEventListener("dragstart", e => {
      if(coarsePointer) { e.preventDefault(); return; }

      desktopDragIndex = i;
      div.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    });

    if(!coarsePointer) div.addEventListener("dragend", () => {
      desktopDragIndex = null;
      stopDesktopAutoScroll();
      [...thumbs.children].forEach(el => el.classList.remove("dragging","drag-over"));
    });

    if(!coarsePointer) div.addEventListener("dragover", e => {
      e.preventDefault();
      updateDesktopDragPoint(e);
      if (desktopDragIndex === null || desktopDragIndex === i) return;
      e.dataTransfer.dropEffect = "move";
      [...thumbs.children].forEach(el => el.classList.remove("drag-over"));
      div.classList.add("drag-over");
    });

    if(!coarsePointer) div.addEventListener("dragleave", () => div.classList.remove("drag-over"));

    if(!coarsePointer) div.addEventListener("drop", e => {
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

    let longPressTimer = null;
    let touchPending = false;
    let touchPointerId = null;

    const cancelPendingTouch = () => {
      if(longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = null;
      touchPending = false;
      touchPointerId = null;
    };

    dragHint.style.touchAction = "none";
    dragHint.style.pointerEvents = "auto";

    dragHint.addEventListener("pointerdown", e => {
      if(e.pointerType !== "touch") return;
      e.preventDefault();

      touchPending = true;
      touchPointerId = e.pointerId;
      touchDrag.active = false;
      touchDrag.startIndex = i;
      touchDrag.el = div;
      touchDrag.pointerId = e.pointerId;
      touchDrag.startX = e.clientX;
      touchDrag.startY = e.clientY;
      touchDrag.lastX = e.clientX;
      touchDrag.lastY = e.clientY;

      try{ dragHint.setPointerCapture(e.pointerId); }catch(_){ }

      longPressTimer = setTimeout(() => {
        if(!touchPending || touchPointerId !== e.pointerId) return;
        touchDrag.active = true;
        div.classList.add("dragging");
        div.setAttribute("aria-grabbed", "true");
        touchDrag.ghost = makeTouchGhost(div, e.clientX, e.clientY);
        startTouchAutoScroll();
      }, 320);
    }, {passive:false});

    dragHint.addEventListener("pointermove", e => {
      if(e.pointerType !== "touch" || touchDrag.el !== div ||
         touchDrag.pointerId !== e.pointerId) return;

      e.preventDefault();
      const dx = e.clientX - touchDrag.startX;
      const dy = e.clientY - touchDrag.startY;
      touchDrag.lastX = e.clientX;
      touchDrag.lastY = e.clientY;

      if(!touchDrag.active){
        if(Math.hypot(dx, dy) > 8) cancelPendingTouch();
        return;
      }

      updateTouchGhost(e.clientX, e.clientY);
      touchDrag.hoverIndex = findTouchHoverIndex(e.clientX, e.clientY);
      showTouchDropTarget(touchDrag.hoverIndex);
      startTouchAutoScroll();
    }, {passive:false});

    const finishPointer = e => {
      if(e.pointerType !== "touch" || touchDrag.el !== div ||
         touchDrag.pointerId !== e.pointerId) return;

      e.preventDefault();
      if(touchDrag.active){
        finishTouchDrag();
      }else{
        cancelPendingTouch();
        stopTouchAutoScroll();
        touchDrag = {
          active:false,startIndex:-1,el:null,ghost:null,hoverIndex:-1,
          lastX:0,lastY:0,pointerId:null,startX:0,startY:0,autoScrollFrame:null
        };
      }
      try{ dragHint.releasePointerCapture(e.pointerId); }catch(_){ }
    };

    dragHint.addEventListener("pointerup", finishPointer, {passive:false});
    dragHint.addEventListener("pointercancel", finishPointer, {passive:false});

  });

  status.textContent = "● Ready";
}


document.addEventListener("dragover", e => {
  if(desktopDragIndex===null) return;
  updateDesktopDragPoint(e);
});

document.addEventListener("drop", () => {
  if(desktopDragIndex!==null) stopDesktopAutoScroll();
});

window.addEventListener("blur", () => {
  stopDesktopAutoScroll();
  if(touchDrag.active) resetTouchDrag();
});

$("clearBtn").onclick = () => {
  files.forEach(file=>{ if(file.__previewUrl){ try{URL.revokeObjectURL(file.__previewUrl);}catch(_){} file.__previewUrl=null; } });
  files = [];
  input.value = "";
  render();
};

function updatePdfImageFormatUI(){
  const isPng=pdfImageFormat?.value==="png";
  pdfImageQualityWrap?.classList.toggle("hidden",isPng);
  if(pdfImagePreviewStatus && activeTool==="pdf2image" && toolFiles[0]){
    const label=isPng ? "PNG • lossless" : pdfImageFormat?.value.toUpperCase()+" • compressed image";
    pdfImagePreviewStatus.textContent=`${toolFiles[0].__pdfPageCount || ""} page${toolFiles[0].__pdfPageCount===1?"":"s"} found • ${label}`;
  }
}

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

        const image = await prepareImage(files[i], quality, factor, colorMode, i);

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
    console.error("[PDFMines] PDF creation failed", {
      error: err,
      message: err && err.message,
      stack: err && err.stack,
      files: files.map(f => ({ name: f.name, type: f.type, size: f.size }))
    });
    txt.textContent = "Could not create PDF";
    status.textContent = "● Error";
    const message = err && err.message ? err.message : String(err);
    alert(`Could not create the PDF.\n\n${message}\n\nTip: Open Chrome → ⋮ → Developer tools/remote debugging if you need the detailed diagnostic log.`);
  } finally {
    button.disabled = false;
  }
};

// Memory-efficient image preparation for phones:
// - avoids FileReader/base64 duplication
// - decodes the source once
// - creates one JPEG Blob/Uint8Array for the PDF
async function prepareImage(file, quality, factor = 1, colorMode = "color", fileIndex = -1) {
  let source = null;
  let sourceW = 0;
  let sourceH = 0;
  let shouldClose = false;

  const baseMax = quality === "small" ? 1600 : quality === "medium" ? 2400 : 3000;
  const baseJpegQuality = quality === "small" ? 0.72 : quality === "medium" ? 0.84 : 0.90;

  // Keep the original working resolution. Target-size mode changes JPEG
  // quality only, which is substantially faster and preserves text/detail.
  const max = baseMax;
  const jpegQuality = Math.max(0.22, Math.min(0.92, baseJpegQuality * factor));

  // Diagnostic pipeline: keep the exact stage so Android/browser failures are
  // actionable instead of collapsing everything into "Could not read image".
  let stage = "initializing";
  let bitmapFirstError = null;
  let bitmapSimpleError = null;
  let objectUrlError = null;
  let fileReaderError = null;

  try {
    stage = "createImageBitmap (orientation-aware)";
    if ("createImageBitmap" in window) {
      try {
        source = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (err) {
        bitmapFirstError = err;
        // Some browsers reject the options object; try the simple form.
        stage = "createImageBitmap (basic)";
        try {
          source = await createImageBitmap(file);
        } catch (err2) {
          bitmapSimpleError = err2;
          source = null;
        }
      }
      if (source) {
        sourceW = source.width;
        sourceH = source.height;
        shouldClose = true;
      }
    } else {
      stage = "createImageBitmap unavailable";
    }
  } catch (err) {
    bitmapSimpleError = err;
    source = null;
  }

  // Android-safe fallback: use a temporary object URL instead of FileReader/base64.
  // This stays local to the browser and avoids duplicating large images as Base64 text.
  if (!source) {
    let objectUrl = null;
    try {
      stage = "object URL creation";
      objectUrl = URL.createObjectURL(file);
      stage = "image decode via object URL";
      source = await loadImageFromObjectURL(objectUrl);
      sourceW = source.naturalWidth || source.width;
      sourceH = source.naturalHeight || source.height;
    } catch (err) {
      objectUrlError = err;
      source = null;

      // Some Android file providers expose a File that can create a blob URL
      // but fail when read directly by FileReader. Re-fetch the local blob URL
      // first, then decode the normalized Blob. This never leaves the browser.
      try {
        if (!objectUrl) throw new Error("Could not create a local image URL");
        stage = "local blob normalization";
        const response = await fetch(objectUrl);
        if (!response.ok) throw new Error(`Local image read returned HTTP ${response.status}`);
        const normalizedBlob = await response.blob();
        stage = "image decode via normalized blob";
        if ("createImageBitmap" in window) {
          try {
            source = await createImageBitmap(normalizedBlob, { imageOrientation: "from-image" });
          } catch (_) {
            source = await createImageBitmap(normalizedBlob);
          }
        } else {
          const normalizedUrl = URL.createObjectURL(normalizedBlob);
          try {
            source = await loadImageFromObjectURL(normalizedUrl);
          } finally {
            URL.revokeObjectURL(normalizedUrl);
          }
        }
        sourceW = source.width || source.naturalWidth;
        sourceH = source.height || source.naturalHeight;
      } catch (normalizeErr) {
        objectUrlError = normalizeErr;
        source = null;
      }

      // Final fallback only.
      if (!source) {
        try {
          stage = "FileReader → Data URL (last fallback)";
          const dataUrl = await fileToDataURL(file);
          stage = "image decode via Data URL";
          source = await loadImageFromDataURL(dataUrl);
          sourceW = source.naturalWidth || source.width;
          sourceH = source.naturalHeight || source.height;
        } catch (err2) {
          fileReaderError = err2;
          source = null;
        }
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  if (!sourceW || !sourceH) {
    if (shouldClose && source.close) source.close();

    const name = file && file.name ? file.name : `file ${fileIndex + 1}`;
    const detail = [
      bitmapSimpleError && `createImageBitmap: ${bitmapSimpleError.message || "failed"}`,
      objectUrlError && `local image decode: ${objectUrlError.message || "failed"}`,
      fileReaderError && `FileReader: ${fileReaderError.message || "failed"}`
    ].filter(Boolean).join("; ") || "No image decoder succeeded";

    console.error("[PDFMines image diagnostic]", {
      file: name,
      fileIndex,
      type: file && file.type,
      size: file && file.size,
      lastStage: stage,
      bitmapFirstError,
      bitmapSimpleError,
      objectUrlError,
      fileReaderError
    });

    throw new Error(`Image read failed at: ${stage}. File: ${name}. ${detail}`);
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

function loadImageFromObjectURL(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode this image. Please use JPG, PNG or WEBP."));
    img.src = objectUrl;
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
const pdfImageOptions = $("pdfImageOptions");
const pdfImageFormat = $("pdfImageFormat");
const pdfImageQuality = $("pdfImageQuality");
const pdfImageQualityWrap = $("pdfImageQualityWrap");
const pdfImagePages = $("pdfImagePages");
const pdfImagePreview = $("pdfImagePreview");
const pdfImagePreviewStatus = $("pdfImagePreviewStatus");
const examResizerOptions = $("examResizerOptions");
const examProfile = $("examProfile");
const examDocType = $("examDocType");
const examRequirementCard = $("examRequirementCard");
const examWidth = $("examWidth");
const examHeight = $("examHeight");
const examMaxKB = $("examMaxKB");
const examFormat = $("examFormat");
const examPreviewCanvas = $("examPreviewCanvas");
const examPreviewEmpty = $("examPreviewEmpty");
const examSourceInfo = $("examSourceInfo");
const examZoom = $("examZoom");
const examZoomValue = $("examZoomValue");
const examOffsetX = $("examOffsetX");
const examOffsetY = $("examOffsetY");
const examBackground = $("examBackground");
const examFilter = $("examFilter");
const examSharpness = $("examSharpness");
const examAutoFit = $("examAutoFit");
const examAutoCropMode = $("examAutoCropMode");
const examManualCropMode = $("examManualCropMode");
const examLockCropRatio = $("examLockCropRatio");
const examCropHint = $("examCropHint");
const examManualNote = $("examManualNote");
const examSaveCrop = $("examSaveCrop");
const examResetCrop = $("examResetCrop");
const examCropDimensions = $("examCropDimensions");
const examLiveCropDimensions = $("examLiveCropDimensions");
const examFinalCanvas = $("examFinalCanvas");
const examReadyBadge = $("examReadyBadge");
const examReadyText = $("examReadyText");
const examValidation = $("examValidation");
const examBeforeCanvas = $("examBeforeCanvas");
const examAfterCanvas = $("examAfterCanvas");
const examCompareRange = $("examCompareRange");
const examMakeReady = $("examMakeReady");
const examCheck = $("examCheck");
const examQualitySummary = $("examQualitySummary");
const examQualityCard = $("examQualityCard");
const examBatchDownload = $("examBatchDownload");
const batchPhoto = $("batchPhoto");
const batchSignature = $("batchSignature");
const batchThumb = $("batchThumb");
const batchDeclaration = $("batchDeclaration");
const dpiCmW = $("dpiCmW");
const dpiCmH = $("dpiCmH");
const dpiValue = $("dpiValue");
const dpiResult = $("dpiResult");
let activeTool = null;
pdfImageFormat?.addEventListener("change",updatePdfImageFormatUI);

if(window.pdfjsLib){
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

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
  pdf2image: {
    title:"PDF → JPG / PNG",
    desc:"Convert PDF pages into JPG, JPEG or PNG images. Preview pages before exporting. Everything stays in this browser.",
    accept:"application/pdf",
    multiple:false,
    action:"Convert PDF to Images"
  },
  "exam-resizer": {
    title:"Exam Photo & Signature",
    desc:"Resize, crop and compress application images in your browser.",
    accept:"image/jpeg,image/png,image/webp,image/bmp",
    multiple:false,
    action:"Download Image"
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
  if(name==="split") {
    document.querySelectorAll('input[name="splitOutput"]').forEach(r=>r.checked=(r.value==="single"));
  }
  numberOptionsWrap.classList.toggle("hidden",name!=="number");
  pdfImageOptions?.classList.toggle("hidden",name!=="pdf2image");
  examResizerOptions?.classList.toggle("hidden",name!=="exam-resizer");
  if(name!=="pdf2image" && pdfImagePreview){
    pdfImagePreview.innerHTML="";
    if(pdfImagePreviewStatus) pdfImagePreviewStatus.textContent="Choose a PDF to preview.";
  }
  if(name==="pdf2image") {
    if(pdfImageFormat) pdfImageFormat.value="jpg";
    if(pdfImageQuality) pdfImageQuality.value="0.92";
    if(pdfImagePages) pdfImagePages.value="";
    const individualOutput=document.querySelector('input[name="pdfImageOutput"][value="individual"]');
    if(individualOutput) individualOutput.checked=true;
    if(pdfImageQualityWrap) pdfImageQualityWrap.classList.remove("hidden");
    if(pdfImagePreview) pdfImagePreview.innerHTML='<div class="pdf-image-preview-empty">Choose a PDF to see page previews here.</div>';
    if(pdfImagePreviewStatus) pdfImagePreviewStatus.textContent="Choose a PDF to preview.";
    updatePdfImageFormatUI();
  }
  if(name==="number") {
    setNumberPosition("bottom-center");
    setupNumberPageSelectors();
    document.querySelectorAll('input[name="numberPageMode"]').forEach(r=>r.checked=(r.value==="single"));
    $("numberBold")?.classList.remove("active");
    $("numberItalic")?.classList.remove("active");
    $("numberUnderline")?.classList.remove("active");
  }
  if(name==="exam-resizer") resetExamResizer();
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

function backFromTool(){ closeTool(); }

document.querySelectorAll("[data-tool]").forEach(btn=>{
  btn.type = "button";
  btn.addEventListener("click",e=>{
    e.preventDefault();
    e.stopPropagation();
    const name=btn.dataset.tool;
    if(name) openTool(name);
  });
});

// Delegated fallback keeps toolbox cards clickable even if their DOM is rebuilt.
document.addEventListener("click",e=>{
  const btn=e.target.closest?.("[data-tool]");
  if(!btn) return;
  if(btn.dataset.tool) {
    e.preventDefault();
    e.stopPropagation();
    openTool(btn.dataset.tool);
  }
},true);
$("toolModalClose").onclick=closeTool;
$("toolModalBack")?.addEventListener("click",backFromTool);
document.querySelectorAll("[data-close-tool]").forEach(el=>el.onclick=closeTool);
toolChoose.onclick=e=>{e.stopPropagation();toolInput.click();};
toolDrop.addEventListener("click",e=>{
  if(!e.target.closest("button")) toolInput.click();
});
toolInput.addEventListener("change",async()=>{
  const chosen=[...toolInput.files];
  if(activeTool==="mix"){
    const valid=chosen.filter(f=>/^application\/pdf$/i.test(String(f.type||"").split(";")[0].trim()) || isSupportedImageFile(f));
    toolFiles.push(...valid);
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
  if(activeTool==="pdf2image" && toolFiles[0]){
    await renderPdfImagePreview(toolFiles[0]);
  }
  if(activeTool==="exam-resizer" && toolFiles[0]){
    try{
      examImage=await loadExamImage(toolFiles[0]);
      examSourceInfo.textContent=`${toolFiles[0].name} • ${examImage.naturalWidth} × ${examImage.naturalHeight} px`;
      examQualitySummary.textContent="Image loaded. Run Check quality or Make Exam Ready.";
      updateExamPreview();
      setExamValidation("Image loaded. Adjust crop, background, filter or sharpness, then download the validated output.","ok");
    }catch(err){
      examImage=null;
      setExamValidation(err.message,"error");
    }
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

function ensurePDFJS(){
  if(!window.pdfjsLib) throw new Error("PDF preview engine could not load. Please reload the page.");
  return window.pdfjsLib;
}

async function loadPdfJsDocument(file){
  const pdfjs=ensurePDFJS();
  const data=await readBytes(file);
  return await pdfjs.getDocument({data}).promise;
}

function getPdfImagePages(count){
  const text=(pdfImagePages?.value || "").trim();
  if(!text) return Array.from({length:count},(_,i)=>i);
  return parsePageSelection(text,count);
}

async function renderPdfImagePreview(file){
  if(!pdfImagePreview) return;
  pdfImagePreview.innerHTML='<div class="pdf-image-preview-empty">Loading page previews…</div>';
  if(pdfImagePreviewStatus) pdfImagePreviewStatus.textContent="Reading PDF…";
  try{
    const pdf=await loadPdfJsDocument(file);
    file.__pdfPageCount=pdf.numPages;
    const indices=Array.from({length:Math.min(pdf.numPages,12)},(_,i)=>i);
    pdfImagePreview.innerHTML="";
    for(const index of indices){
      const card=document.createElement("div");
      card.className="pdf-page-thumb loading";
      const canvas=document.createElement("canvas");
      canvas.width=160; canvas.height=210;
      const label=document.createElement("span");
      label.textContent=`Page ${index+1}`;
      card.append(canvas,label);
      pdfImagePreview.append(card);
      try{
        const page=await pdf.getPage(index+1);
        const base=page.getViewport({scale:1});
        const scale=Math.min(0.45, 160/base.width);
        const viewport=page.getViewport({scale:Math.max(0.25,scale)});
        const ratio=window.devicePixelRatio || 1;
        canvas.width=Math.max(1,Math.round(viewport.width*ratio));
        canvas.height=Math.max(1,Math.round(viewport.height*ratio));
        canvas.style.width=`${viewport.width}px`;
        canvas.style.height=`${viewport.height}px`;
        const ctx=canvas.getContext("2d",{alpha:false});
        await page.render({canvasContext:ctx,viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:null}).promise;
        card.classList.remove("loading");
      }catch(err){
        card.classList.remove("loading");
        label.textContent=`Page ${index+1} — preview unavailable`;
        console.warn("PDF page preview failed",index+1,err);
      }
    }
    const more=pdf.numPages>12 ? ` Showing first 12 of ${pdf.numPages}.` : "";
    if(pdfImagePreviewStatus) pdfImagePreviewStatus.textContent=`${pdf.numPages} page${pdf.numPages===1?"":"s"} found.${more}`;
    updatePdfImageFormatUI();
  }catch(err){
    console.error("PDF preview failed",err);
    pdfImagePreview.innerHTML=`<div class="pdf-image-preview-empty">Could not preview this PDF. ${err?.message || "Please try another PDF."}</div>`;
    if(pdfImagePreviewStatus) pdfImagePreviewStatus.textContent="Preview failed.";
  }
}

function canvasToImageBlob(canvas,format,quality){
  const mime=format==="png" ? "image/png" : "image/jpeg";
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not create the image output.")),mime,format==="png"?undefined:quality));
}

async function convertPdfToImages(file){
  const pdf=await loadPdfJsDocument(file);
  const indices=getPdfImagePages(pdf.numPages);
  if(!indices.length) throw new Error("Select at least one PDF page.");
  const format=pdfImageFormat?.value || "jpg";
  const quality=Number(pdfImageQuality?.value || 0.92);
  const outputs=[];
  for(let n=0;n<indices.length;n++){
    const index=indices[n];
    toolStatus.textContent=`Rendering page ${n+1} of ${indices.length}…`;
    const page=await pdf.getPage(index+1);
    const viewport=page.getViewport({scale:1.6});
    const canvas=document.createElement("canvas");
    const ratio=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.max(1,Math.round(viewport.width*ratio));
    canvas.height=Math.max(1,Math.round(viewport.height*ratio));
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.fillStyle="#ffffff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const renderViewport=ratio===1 ? viewport : page.getViewport({scale:1.6*ratio});
    await page.render({canvasContext:ctx,viewport:renderViewport}).promise;
    const blob=await canvasToImageBlob(canvas,format,quality);
    outputs.push({blob,page:index+1});
  }
  return outputs;
}

function downloadImageBlob(blob,name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1800);
}

async function pdfToImagesAndDownload(file){
  const outputs=await convertPdfToImages(file);
  const format=pdfImageFormat?.value || "jpg";
  const ext=format==="jpeg" ? "jpeg" : format;
  const base=(file.name||"PDF").replace(/\.pdf$/i,"") || "PDF";
  const outputMode=document.querySelector('input[name="pdfImageOutput"]:checked')?.value || "individual";

  if(outputMode==="zip"){
    if(typeof JSZip==="undefined") throw new Error("ZIP support could not be loaded. Please refresh the page and try again.");
    toolStatus.textContent=`Creating ZIP with ${outputs.length} image${outputs.length===1?"":"s"}…`;
    const zip=new JSZip();
    outputs.forEach(item=>{
      const filename=`${base}_page_${String(item.page).padStart(2,"0")}.${ext}`;
      zip.file(filename,item.blob);
    });
    const zipBlob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}}, meta=>{
      toolStatus.textContent=`Creating ZIP… ${Math.round(meta.percent)}%`;
    });
    downloadImageBlob(zipBlob,`${base}_images.zip`);
    return outputs;
  }

  for(let i=0;i<outputs.length;i++){
    downloadImageBlob(outputs[i].blob,`${base}_page_${String(outputs[i].page).padStart(2,"0")}.${ext}`);
    if(i<outputs.length-1) await new Promise(r=>setTimeout(r,280));
  }
  return outputs;
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


/* Camera/capture feature removed from the PDFMines UI. */


/* Competitive exam image resizer */
const EXAM_PROFILES = {
  "upsc-recruitment": {
    label: "UPSC Recruitment",
    source: "UPSC Recruitment Branch FAQ",
    docs: {
      photo: {w:110,h:140,maxKB:40,format:"jpeg",note:"140 px height × 110 px width; each scanned image ≤ 40 KB."},
      signature: {w:140,h:110,maxKB:40,format:"jpeg",note:"140 px width × 110 px height; each scanned image ≤ 40 KB."}
    }
  },
  "ssc-2026": {
    label: "SSC 2026",
    source: "SSC 2026 notices",
    docs: {
      photo: {w:null,h:null,maxKB:null,format:"jpeg",note:"Several 2026 SSC applications use live photo capture rather than a fixed uploaded photo size."},
      signature: {w:709,h:236,maxKB:20,format:"jpeg",note:"About 6.0 cm × 2.0 cm at 300 DPI; JPEG/JPG 10–20 KB. Pixel equivalent is approximately 709 × 236."}
    }
  },
  ibps: {
    label: "IBPS",
    source: "IBPS application instructions",
    docs: {
      photo: {w:200,h:230,maxKB:50,format:"jpeg",note:"Preferred photograph size: 200 × 230 pixels; 20–50 KB."},
      signature: {w:140,h:60,maxKB:20,format:"jpeg",note:"Preferred signature size: 140 × 60 pixels; 10–20 KB."},
      thumb: {w:240,h:240,maxKB:50,format:"jpeg",note:"Preferred left thumb impression size: 240 × 240 pixels (3 cm × 3 cm) at 200 DPI; 20–50 KB."},
      declaration: {w:800,h:400,maxKB:100,format:"jpeg",note:"Preferred handwritten declaration size: 800 × 400 pixels (10 cm × 5 cm) at 200 DPI; 50–100 KB."}
    }
  }
};

const EXAM_DOC_LABELS = {photo:"Photograph",signature:"Signature",declaration:"Declaration",thumb:"Left thumb impression"};
let examImage = null;
let examObjectUrl = null;
let examCropMode = "auto";
let examManualCrop = null;
let examManualZoomBaseCrop = null;
let examAppliedCrop = null;
let examDraftAutoCrop = null;
let examCropPointer = {active:false,mode:"draw",edge:null,startX:0,startY:0,currentX:0,currentY:0,offsetX:0,offsetY:0,baseCrop:null};

function examDefaultConfig(){
  return {w:140,h:180,maxKB:40,format:"jpeg",note:"Enter the dimensions and size limit from the latest notification for this application."};
}

function setExamValidation(message,type=""){
  if(!examValidation) return;
  examValidation.className="exam-validation"+(type?` ${type}`:"");
  examValidation.textContent=message;
}

function getExamConfig(){
  const profile=EXAM_PROFILES[examProfile?.value];
  const doc=profile?.docs?.[examDocType?.value];
  return doc ? {...examDefaultConfig(),...doc} : examDefaultConfig();
}

function updateExamZoomLabel(){
  if(!examZoomValue || !examZoom) return;
  const v=Number(examZoom.value)||0;
  examZoomValue.textContent=`${v>0?"+":""}${v}%`;
}

function updateExamRequirement(){
  if(!examRequirementCard) return;
  const profile=EXAM_PROFILES[examProfile?.value];
  const doc=profile?.docs?.[examDocType?.value];
  const cfg=getExamConfig();
  const docLabel=EXAM_DOC_LABELS[examDocType?.value] || "Image";
  if(!profile){
    examRequirementCard.innerHTML=`<strong>${docLabel}</strong><br>Custom mode: enter the exact width, height and file-size limit from the application notification.`;
  }else if(!doc){
    examRequirementCard.innerHTML=`<strong>${profile.label} · ${docLabel}</strong><br>No fixed profile is stored for this document type. Enter the exact values from the current notification.`;
  }else{
    const dims=cfg.w&&cfg.h ? `${cfg.w} × ${cfg.h} px` : "No fixed pixel size stated in the selected source";
    const size=cfg.maxKB ? `Maximum ${cfg.maxKB} KB` : "File-size limit not specified in the selected source";
    examRequirementCard.innerHTML=`<strong>${profile.label} · ${docLabel}</strong><br>${dims} · ${size}<br><span>${cfg.note}</span><br><small>Source: ${profile.source}. Requirements can vary by recruitment/application.</small>`;
  }
  if(cfg.w) examWidth.value=cfg.w;
  if(cfg.h) examHeight.value=cfg.h;
  if(cfg.maxKB) examMaxKB.value=cfg.maxKB;
  if(cfg.format) examFormat.value=cfg.format;
  updateExamPreview();
}

function resetExamResizer(){
  examImage=null;
  if(examObjectUrl){URL.revokeObjectURL(examObjectUrl);examObjectUrl=null;}
  examCropMode="auto";
  examManualCrop=null;
  examManualZoomBaseCrop=null;
  examAppliedCrop=null;
  examDraftAutoCrop=null;
  examCropPointer={active:false,mode:"draw",edge:null,startX:0,startY:0,currentX:0,currentY:0,offsetX:0,offsetY:0,baseCrop:null};
  if(examCropDimensions) examCropDimensions.textContent="Crop: —";
  if(examLiveCropDimensions) examLiveCropDimensions.textContent="Selection: —";
  if(examReadyBadge){examReadyBadge.className="exam-ready-badge";examReadyBadge.textContent="READY TO EDIT";}
  if(examReadyText) examReadyText.textContent="Adjust the crop and save it when ready.";
  examZoom.value="0"; examOffsetX.value="0"; examOffsetY.value="0"; updateExamZoomLabel();
  examBackground.value=examDocType.value==="photo" ? "original" : "white";
  examFilter.value=examDocType.value==="photo" ? "original" : "clean";
  examSharpness.value="medium";
  const cfg=getExamConfig();
  if(cfg.w) examWidth.value=cfg.w;
  if(cfg.h) examHeight.value=cfg.h;
  if(cfg.maxKB) examMaxKB.value=cfg.maxKB;
  if(cfg.format) examFormat.value=cfg.format;
  examSourceInfo.textContent="Choose an image to begin.";
  setExamCropMode("auto");
  examPreviewEmpty.classList.remove("hidden");
  const ctx=examPreviewCanvas?.getContext("2d");
  if(ctx){ctx.clearRect(0,0,examPreviewCanvas.width,examPreviewCanvas.height);}
  updateExamRequirement();
  updateExamComparison();
  updateDpiResult();
  examQualityCard?.classList.add("hidden");
  examQualitySummary.textContent="Upload an image for a quality check.";
  setExamValidation("Ready. Your image will be processed only in this browser.");
}

function loadExamImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Could not read the selected image file."));};
    img.src=url;
  });
}

function getExamCrop(){
  if(!examImage) return null;
  const sw=examImage.naturalWidth||examImage.width;
  const sh=examImage.naturalHeight||examImage.height;
  const tw=Math.max(1,Number(examWidth.value)||140);
  const th=Math.max(1,Number(examHeight.value)||180);
  const aspect=tw/th;

  if(examCropMode==="manual" && examManualCrop){
    // Manual mode uses the rectangle as a fixed frame. Image Zoom and
    // Horizontal/Vertical position change the image content inside that frame;
    // they do not change the frame itself. This lets the user freely resize the
    // frame (locked or unlocked) and then fine-tune the image inside it.
    const base=examManualZoomBaseCrop || examManualCrop;
    const frameX=Math.max(0,Math.min(sw-1,base.x));
    const frameY=Math.max(0,Math.min(sh-1,base.y));
    const frameW=Math.max(1,Math.min(sw-frameX,base.w));
    const frameH=Math.max(1,Math.min(sh-frameY,base.h));
    const zoomPct=Math.max(-100,Math.min(100,Number(examZoom?.value)||0));
    const zoom=zoomPct>=0 ? 1+(zoomPct/50) : Math.max(0.2,1+(zoomPct/100));
    let w=Math.max(1,frameW/zoom), h=Math.max(1,frameH/zoom);
    if(w>sw || h>sh){
      const fit=Math.min(sw/w,sh/h);
      w*=fit; h*=fit;
    }
    const centerX=frameX+frameW/2, centerY=frameY+frameH/2;
    const maxX=Math.max(0,sw-w), maxY=Math.max(0,sh-h);
    const ox=Number(examOffsetX.value)||0, oy=Number(examOffsetY.value)||0;
    let x=centerX-w/2 + (ox*maxX/2);
    let y=centerY-h/2 + (oy*maxY/2);
    x=Math.max(0,Math.min(maxX,x));
    y=Math.max(0,Math.min(maxY,y));
    return {x,y,w,h,sw,sh,tw,th,frame:{x:frameX,y:frameY,w:frameW,h:frameH}};
  }

  if(examCropMode!=="manual" && examDraftAutoCrop){
    const x=Math.max(0,Math.min(sw-1,examDraftAutoCrop.x));
    const y=Math.max(0,Math.min(sh-1,examDraftAutoCrop.y));
    const w=Math.max(1,Math.min(sw-x,examDraftAutoCrop.w));
    const h=Math.max(1,Math.min(sh-y,examDraftAutoCrop.h));
    return {x,y,w,h,sw,sh,tw,th};
  }

  if(examAppliedCrop){
    const x=Math.max(0,Math.min(sw-1,examAppliedCrop.x));
    const y=Math.max(0,Math.min(sh-1,examAppliedCrop.y));
    const w=Math.max(1,Math.min(sw-x,examAppliedCrop.w));
    const h=Math.max(1,Math.min(sh-y,examAppliedCrop.h));
    return {x,y,w,h,sw,sh,tw,th};
  }

  let cropW=sw, cropH=sw/aspect;
  if(cropH>sh){cropH=sh;cropW=sh*aspect;}

  // Zoom is centred at 0%: negative values zoom out, positive values zoom in.
  // The asymmetric mapping gives useful fine control around the original view
  // while still allowing a strong zoom-in when needed.
  const zoomPct=Math.max(-100,Math.min(100,Number(examZoom.value)||0));
  const zoom=zoomPct>=0 ? 1+(zoomPct/50) : Math.max(0.2,1+(zoomPct/100));
  cropW=Math.max(1,cropW/zoom);
  cropH=Math.max(1,cropH/zoom);

  // At strong zoom-out, keep the crop inside the uploaded image while preserving
  // the requested output aspect ratio.
  if(cropW>sw || cropH>sh){
    const fit=Math.min(sw/cropW,sh/cropH);
    cropW*=fit; cropH*=fit;
  }

  const maxX=Math.max(0,sw-cropW), maxY=Math.max(0,sh-cropH);
  const ox=Number(examOffsetX.value)||0, oy=Number(examOffsetY.value)||0;
  const x=Math.max(0,Math.min(maxX,(maxX/2)+(ox*maxX/2)));
  const y=Math.max(0,Math.min(maxY,(maxY/2)+(oy*maxY/2)));
  return {x,y,w:cropW,h:cropH,sw,sh,tw,th};
}

function sourceToPreviewPoint(x,y,canvas){
  const sw=examImage.naturalWidth||examImage.width, sh=examImage.naturalHeight||examImage.height;
  const scale=Math.min(canvas.width/sw,canvas.height/sh);
  return {x:x*scale,y:y*scale,scale};
}

function previewToSourcePoint(clientX,clientY,canvas){
  const rect=canvas.getBoundingClientRect();
  const px=(clientX-rect.left)*(canvas.width/rect.width);
  const py=(clientY-rect.top)*(canvas.height/rect.height);
  const sw=examImage.naturalWidth||examImage.width, sh=examImage.naturalHeight||examImage.height;
  const scale=Math.min(canvas.width/sw,canvas.height/sh);
  const ox=(canvas.width-sw*scale)/2, oy=(canvas.height-sh*scale)/2;
  return {x:(px-ox)/scale,y:(py-oy)/scale};
}

function normalizeManualRect(a,b){
  const sw=examImage.naturalWidth||examImage.width, sh=examImage.naturalHeight||examImage.height;
  let x1=Math.max(0,Math.min(sw,a.x)), x2=Math.max(0,Math.min(sw,b.x));
  let y1=Math.max(0,Math.min(sh,a.y)), y2=Math.max(0,Math.min(sh,b.y));
  let x=Math.min(x1,x2), y=Math.min(y1,y2), w=Math.abs(x2-x1), h=Math.abs(y2-y1);
  if(examLockCropRatio.checked){
    const aspect=Math.max(0.01,(Number(examWidth.value)||140)/(Number(examHeight.value)||180));
    if(w>=h*aspect) h=w/aspect;
    else w=h*aspect;
    const sx=a.x<=b.x?x1:x1-w;
    const sy=a.y<=b.y?y1:y1-h;
    x=Math.max(0,Math.min(sw-w,sx));
    y=Math.max(0,Math.min(sh-h,sy));
  }
  w=Math.min(w,sw-x); h=Math.min(h,sh-y);
  if(w<5||h<5) return null;
  return {x,y,w,h};
}

function updateLiveExamCropDimensions(crop,mode="selection"){
  if(!examLiveCropDimensions) return;
  if(!crop){
    examLiveCropDimensions.textContent="Selection: —";
    return;
  }
  const w=Math.round(crop.w),h=Math.round(crop.h);
  const label=mode==="resizing" ? "Resizing" : "Selection";
  examLiveCropDimensions.innerHTML=`${label}: <strong>${w} × ${h} px</strong> <small>• output ${crop.tw} × ${crop.th} px</small>`;
}

function getExamEdgeAtPoint(crop,x,y,canvas){
  if(!crop||!examImage) return null;
  const p=sourceToPreviewPoint(crop.x,crop.y,canvas);
  const scale=p.scale;
  const w=crop.w*scale,h=crop.h*scale;
  const cx=p.x+w/2,cy=p.y+h/2;
  const tol=Math.max(12,Math.min(22,16));
  const point=sourceToPreviewPoint(x,y,canvas);
  const px=point.x,py=point.y;
  const hits={left:[p.x,cy,"ew-resize"],right:[p.x+w,cy,"ew-resize"],top:[cx,p.y,"ns-resize"],bottom:[cx,p.y+h,"ns-resize"]};
  for(const [edge,[hx,hy]] of Object.entries(hits)){
    if(Math.hypot(px-hx,py-hy)<=tol) return edge;
  }
  return null;
}

function getExamResizeCursor(crop,x,y,canvas){
  const edge=getExamEdgeAtPoint(crop,x,y,canvas);
  return edge ? ((edge==="left"||edge==="right")?"ew-resize":"ns-resize") : null;
}

function resizeExamCrop(base,edge,pt){
  if(!base||!examImage) return null;
  const sw=examImage.naturalWidth||examImage.width;
  const sh=examImage.naturalHeight||examImage.height;
  const minSize=5;
  const lock=!!examLockCropRatio?.checked;
  const aspect=Math.max(0.01,(Number(examWidth.value)||140)/(Number(examHeight.value)||180));
  let x=base.x,y=base.y,w=base.w,h=base.h;
  const left=base.x,right=base.x+base.w,top=base.y,bottom=base.y+base.h,cx=base.x+base.w/2,cy=base.y+base.h/2;

  if(!lock){
    if(edge==="left") { x=Math.max(0,Math.min(right-minSize,pt.x)); w=right-x; }
    if(edge==="right") { const nx=Math.max(left+minSize,Math.min(sw,pt.x)); w=nx-left; }
    if(edge==="top") { y=Math.max(0,Math.min(bottom-minSize,pt.y)); h=bottom-y; }
    if(edge==="bottom") { const ny=Math.max(top+minSize,Math.min(sh,pt.y)); h=ny-top; }
    return {x,y,w,h};
  }

  if(edge==="left"||edge==="right"){
    const maxW=Math.min(sw,2*cx,2*(sw-cx),2*cy*aspect,2*(sh-cy)*aspect);
    let desiredW=edge==="left" ? right-Math.max(0,Math.min(right-minSize,pt.x)) : Math.max(minSize,Math.min(sw,left+base.w+(pt.x-right)))-left;
    if(edge==="left") desiredW=Math.max(minSize,Math.min(maxW,desiredW));
    else desiredW=Math.max(minSize,Math.min(maxW,pt.x-left));
    w=desiredW;h=w/aspect;x=cx-w/2;y=cy-h/2;
  }else{
    const maxH=Math.min(sh,2*cy,2*(sh-cy),2*cx/aspect,2*(sw-cx)/aspect);
    let desiredH=edge==="top" ? bottom-Math.max(0,Math.min(bottom-minSize,pt.y)) : Math.max(minSize,Math.min(sh,top+base.h+(pt.y-bottom)))-top;
    if(edge==="top") desiredH=Math.max(minSize,Math.min(maxH,desiredH));
    else desiredH=Math.max(minSize,Math.min(maxH,pt.y-top));
    h=desiredH;w=h*aspect;x=cx-w/2;y=cy-h/2;
  }
  x=Math.max(0,Math.min(sw-w,x));y=Math.max(0,Math.min(sh-h,y));
  return {x,y,w,h};
}

function drawCropHandles(ctx,crop,canvas){
  if(!crop) return;
  const p=sourceToPreviewPoint(crop.x,crop.y,canvas),w=crop.w*p.scale,h=crop.h*p.scale;
  const handles=[[p.x+w/2,p.y,"top"],[p.x+w,p.y+h/2,"right"],[p.x+w/2,p.y+h,"bottom"],[p.x,p.y+h/2,"left"]];
  ctx.save();
  handles.forEach(([x,y])=>{
    ctx.fillStyle="#fff";ctx.strokeStyle="#0f172a";ctx.lineWidth=1.5;
    ctx.beginPath();ctx.roundRect(x-8,y-5,16,10,5);ctx.fill();ctx.stroke();
  });
  ctx.restore();
}

function drawManualEditor(){
  if(!examPreviewCanvas||!examImage) return;
  const canvas=examPreviewCanvas;
  const sw=examImage.naturalWidth||examImage.width, sh=examImage.naturalHeight||examImage.height;
  const scale=Math.min(420/sw,360/sh,1);
  canvas.width=Math.max(1,Math.round(sw*scale));
  canvas.height=Math.max(1,Math.round(sh*scale));
  const ctx=canvas.getContext("2d",{alpha:false});
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  // Always show the complete uploaded image first. The rectangle is a frame;
  // zoom/pan changes the image content displayed inside that frame.
  ctx.drawImage(examImage,0,0,sw,sh,0,0,canvas.width,canvas.height);

  const frame=examManualCrop;
  if(!frame) return;
  const fp=sourceToPreviewPoint(frame.x,frame.y,canvas);
  const fw=frame.w*fp.scale, fh=frame.h*fp.scale;
  const visible=getExamCrop();

  ctx.save();
  ctx.fillStyle="rgba(10,15,30,.48)";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.clearRect(fp.x,fp.y,fw,fh);

  // Render the currently zoomed/panned image content into the fixed frame.
  if(visible){
    ctx.drawImage(examImage,visible.x,visible.y,visible.w,visible.h,fp.x,fp.y,fw,fh);
  }

  ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.setLineDash([7,5]);
  ctx.strokeRect(fp.x,fp.y,fw,fh);ctx.setLineDash([]);
  drawCropHandles(ctx,frame,canvas);

  if(fw>80 && fh>42){
    const label=Number(examZoom?.value||0)!==0 ? "✋  Drag to move • Zoom active" : "✋  Drag to move";
    ctx.font="700 12px system-ui,-apple-system,Segoe UI,sans-serif";
    const tw=Math.min(fw-8,ctx.measureText(label).width+24), th=30;
    if(tw>70){
      const lx=fp.x+(fw-tw)/2, ly=fp.y+(fh-th)/2;
      ctx.fillStyle="rgba(15,23,42,.82)";
      ctx.beginPath();ctx.roundRect(lx,ly,tw,th,10);ctx.fill();
      ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(label,lx+tw/2,ly+th/2+0.5);
    }
  }
  ctx.restore();
}

function drawAutoEditor(){
  if(!examPreviewCanvas||!examImage) return;
  const canvas=examPreviewCanvas;
  const sw=examImage.naturalWidth||examImage.width;
  const sh=examImage.naturalHeight||examImage.height;
  const scale=Math.min(420/sw,360/sh,1);
  canvas.width=Math.max(1,Math.round(sw*scale));
  canvas.height=Math.max(1,Math.round(sh*scale));
  const ctx=canvas.getContext("2d",{alpha:false});
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  // Show the uploaded image itself first. The crop frame is only a guide; the
  // source image is never visually cropped until the user commits the crop.
  ctx.drawImage(examImage,0,0,sw,sh,0,0,canvas.width,canvas.height);

  const crop=getExamCrop();
  if(!crop) return;
  const p=sourceToPreviewPoint(crop.x,crop.y,canvas);
  const w=crop.w*p.scale, h=crop.h*p.scale;
  ctx.save();
  ctx.fillStyle="rgba(15,23,42,.14)";
  ctx.fillRect(p.x,p.y,w,h);
  ctx.strokeStyle="#ffffff";
  ctx.lineWidth=2;
  ctx.setLineDash([8,5]);
  ctx.strokeRect(p.x,p.y,w,h);
  ctx.setLineDash([]);
  drawCropHandles(ctx,crop,canvas);
  ctx.fillStyle="rgba(15,23,42,.82)";
  ctx.font="700 11px system-ui,-apple-system,Segoe UI,sans-serif";
  const label=`Output area • ${Math.round(crop.w)} × ${Math.round(crop.h)} px`;
  const tw=Math.min(w-10,ctx.measureText(label).width+18);
  if(tw>70 && h>24){
    const lx=p.x+8,ly=p.y+8,lh=24;
    ctx.beginPath();ctx.roundRect(lx,ly,tw,lh,8);ctx.fill();
    ctx.fillStyle="#fff";ctx.textBaseline="middle";
    ctx.fillText(label,lx+9,ly+lh/2+0.5);
  }
  ctx.restore();
}

function setExamCropMode(mode,preserveApplied=false){
  examCropMode=mode;
  if(mode==="manual"){
    // Start manual mode with no pre-existing rectangle. The user must draw the first rectangle.
    examManualCrop=null;
    examAutoCropMode?.classList.remove("active");
    examManualCropMode?.classList.add("active");
    if(examCropHint) examCropHint.textContent="Drag to draw. Resize from the 4 edge handles, drag inside to move, and use Image Zoom to adjust the picture inside the frame.";
    examManualNote?.classList.add("visible");
    examPreviewCanvas?.parentElement?.classList.add("manual");
    const hasManualFrame=!!examManualCrop;
    if(examZoom) examZoom.disabled=!hasManualFrame;
    if(examOffsetX) examOffsetX.disabled=!hasManualFrame;
    if(examOffsetY) examOffsetY.disabled=!hasManualFrame;
  }else{
    if(!preserveApplied) examAppliedCrop=null;
    examManualCrop=null;
    examDraftAutoCrop=null;
    examAutoCropMode?.classList.add("active");
    examManualCropMode?.classList.remove("active");
    if(examCropHint) examCropHint.textContent="Auto crop uses the selected output aspect ratio. Zoom and position remain available.";
    examManualNote?.classList.remove("visible");
    examPreviewCanvas?.parentElement?.classList.remove("manual");
    if(examZoom) examZoom.disabled=false;
    if(examOffsetX) examOffsetX.disabled=false;
    if(examOffsetY) examOffsetY.disabled=false;
  }
  updateExamPreview();
}

function saveCurrentCrop(){
  // In manual mode the frame is only the selection boundary; save the actual
  // zoomed/panned image content currently visible inside that frame.
  const crop=getExamCrop();
  if(!crop || crop.w<5 || crop.h<5){
    setExamValidation("Adjust the crop first, then save the crop.","warn");
    return;
  }
  examAppliedCrop={x:crop.x,y:crop.y,w:crop.w,h:crop.h};
  examManualCrop=null;
  examManualZoomBaseCrop=null;
  examDraftAutoCrop=null;
  examManualNote?.classList.add("saved");
  if(examCropMode==="manual"){
    if(examZoom) examZoom.disabled=true;
    if(examOffsetX) examOffsetX.disabled=true;
    if(examOffsetY) examOffsetY.disabled=true;
  }
  if(examCropHint) examCropHint.textContent="Crop saved ✓. Resize the frame or use Image Zoom before saving again; unsaved changes never replace the saved preview.";
  if(examSaveCropHint) examSaveCropHint.textContent="Crop saved ✓. You can now adjust background, filter and sharpness.";
  setExamValidation("Crop saved ✓. The selected area will be used for the final image.","ok");
  if(examReadyBadge){examReadyBadge.className="exam-ready-badge ready";examReadyBadge.textContent="READY TO EXPORT";}
  if(examReadyText) examReadyText.textContent=`Saved crop • final output ${crop.tw} × ${crop.th} px`;
  updateExamPreview();
}

function bindManualCropEditor(){
  const canvas=examPreviewCanvas;
  if(!canvas) return;
  canvas.addEventListener("pointerdown",e=>{
    if(!examImage) return;
    if(examCropMode!=="manual" && examCropMode!=="auto") return;
    e.preventDefault();
    const pt=previewToSourcePoint(e.clientX,e.clientY,canvas);
    const sw=examImage.naturalWidth||examImage.width;
    const sh=examImage.naturalHeight||examImage.height;
    const x=Math.max(0,Math.min(sw-1,pt.x));
    const y=Math.max(0,Math.min(sh-1,pt.y));
    let existing=examCropMode==="manual" ? examManualCrop : (examDraftAutoCrop || getExamCrop());
    const edge=getExamEdgeAtPoint(existing,x,y,canvas);

    if(edge){
      if(examCropMode==="auto" && !examDraftAutoCrop){
        examDraftAutoCrop={x:existing.x,y:existing.y,w:existing.w,h:existing.h};
        existing=examDraftAutoCrop;
      }
      examCropPointer={active:true,mode:"resize",edge,startX:x,startY:y,currentX:x,currentY:y,offsetX:0,offsetY:0,baseCrop:{x:existing.x,y:existing.y,w:existing.w,h:existing.h}};
      canvas.style.cursor=(edge==="left"||edge==="right")?"ew-resize":"ns-resize";
    }else if(examCropMode==="manual"){
      const inside=existing && x>=existing.x && x<=existing.x+existing.w && y>=existing.y && y<=existing.y+existing.h;
      if(inside){
        examCropPointer={active:true,mode:"move",edge:null,startX:x,startY:y,currentX:x,currentY:y,offsetX:x-existing.x,offsetY:y-existing.y,baseCrop:{x:existing.x,y:existing.y,w:existing.w,h:existing.h}};
        canvas.style.cursor="grabbing";
      }else{
        examCropPointer={active:true,mode:"draw",edge:null,startX:x,startY:y,currentX:x,currentY:y,offsetX:0,offsetY:0,baseCrop:null};
        canvas.style.cursor="crosshair";
        examManualCrop={x,y,w:1,h:1};
      }
    }
    updateLiveExamCropDimensions(existing,edge?"resizing":"selection");
    if(examCropMode==="manual") drawManualEditor(); else drawAutoEditor();
    try{canvas.setPointerCapture(e.pointerId);}catch(_){ }
  });

  canvas.addEventListener("pointermove",e=>{
    if(!examImage || (examCropMode!=="manual" && examCropMode!=="auto")) return;
    const pt=previewToSourcePoint(e.clientX,e.clientY,canvas);
    if(!examCropPointer.active){
      const crop=examCropMode==="manual" ? examManualCrop : (examDraftAutoCrop || getExamCrop());
      const cursor=getExamResizeCursor(crop,pt.x,pt.y,canvas);
      if(cursor){ canvas.style.cursor=cursor; return; }
      if(examCropMode==="manual" && crop && pt.x>=crop.x && pt.x<=crop.x+crop.w && pt.y>=crop.y && pt.y<=crop.y+crop.h){
        canvas.style.cursor="grab";
      }else{
        canvas.style.cursor=examCropMode==="manual" ? "crosshair" : "default";
      }
      return;
    }
    const sw=examImage.naturalWidth||examImage.width, sh=examImage.naturalHeight||examImage.height;
    examCropPointer.currentX=pt.x;examCropPointer.currentY=pt.y;
    if(examCropPointer.mode==="resize" && examCropPointer.baseCrop){
      const resized=resizeExamCrop(examCropPointer.baseCrop,examCropPointer.edge,pt);
      if(resized){
        if(examCropMode==="manual"){ examManualCrop=resized; examManualZoomBaseCrop={x:resized.x,y:resized.y,w:resized.w,h:resized.h}; } else examDraftAutoCrop=resized;
        updateLiveExamCropDimensions({...resized,tw:Number(examWidth.value)||140,th:Number(examHeight.value)||180},"resizing");
      }
      canvas.style.cursor=(examCropPointer.edge==="left"||examCropPointer.edge==="right")?"ew-resize":"ns-resize";
    }else if(examCropPointer.mode==="move" && examManualCrop){
      const w=examManualCrop.w,h=examManualCrop.h;
      const x=Math.max(0,Math.min(sw-w,pt.x-examCropPointer.offsetX));
      const y=Math.max(0,Math.min(sh-h,pt.y-examCropPointer.offsetY));
      examManualCrop={x,y,w,h};
      examManualZoomBaseCrop={x,y,w,h};
      updateLiveExamCropDimensions({...examManualCrop,tw:Number(examWidth.value)||140,th:Number(examHeight.value)||180},"selection");
      canvas.style.cursor="grabbing";
    }else if(examCropPointer.mode==="draw"){
      const rect=normalizeManualRect({x:examCropPointer.startX,y:examCropPointer.startY},{x:pt.x,y:pt.y});
      if(rect){
        examManualCrop=rect;
        examManualZoomBaseCrop={x:rect.x,y:rect.y,w:rect.w,h:rect.h};
        updateLiveExamCropDimensions({...rect,tw:Number(examWidth.value)||140,th:Number(examHeight.value)||180},"selection");
      }else{
        examManualCrop={x:examCropPointer.startX,y:examCropPointer.startY,w:1,h:1};
        examManualZoomBaseCrop=null;
      }
      canvas.style.cursor="crosshair";
    }
    if(examCropMode==="manual") drawManualEditor(); else drawAutoEditor();
  });

  const finish=e=>{
    if(!examCropPointer.active) return;
    const mode=examCropPointer.mode;
    examCropPointer.active=false;
    canvas.style.cursor="default";
    try{canvas.releasePointerCapture(e.pointerId);}catch(_){ }
    const crop=examCropMode==="manual" ? examManualCrop : (examDraftAutoCrop || getExamCrop());
    if(mode==="draw" && (!crop||crop.w<5||crop.h<5)){
      examManualCrop=null;
      examManualZoomBaseCrop=null;
      if(examZoom) examZoom.disabled=true;
      if(examOffsetX) examOffsetX.disabled=true;
      if(examOffsetY) examOffsetY.disabled=true;
      updateLiveExamCropDimensions(null);
      if(examCropMode==="manual") drawManualEditor();
      setExamValidation("Drag across the image to select a crop, or drag inside the rectangle to move it.","warn");
      return;
    }
    if(examCropMode==="manual"){
      if(examZoom) examZoom.disabled=false;
      if(examOffsetX) examOffsetX.disabled=false;
      if(examOffsetY) examOffsetY.disabled=false;
    }
    updateLiveExamCropDimensions(crop,mode==="resize"?"selection":"selection");
    updateExamPreview();
  };
  canvas.addEventListener("pointerup",finish);
  canvas.addEventListener("pointercancel",finish);
}

function drawExamBase(canvas, crop){
  canvas.width=crop.tw;
  canvas.height=crop.th;
  const ctx=canvas.getContext("2d",{alpha:false,willReadFrequently:true});
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,crop.tw,crop.th);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(examImage,crop.x,crop.y,crop.w,crop.h,0,0,crop.tw,crop.th);
  return ctx;
}

function applyExamImageAdjustments(canvas){
  const ctx=canvas.getContext("2d",{alpha:false,willReadFrequently:true});
  const image=ctx.getImageData(0,0,canvas.width,canvas.height);
  const data=image.data;
  const background=examBackground.value;
  const filter=examFilter.value;
  const sharpness=examSharpness.value;

  if(background==="white"){
    const samplePoints=[
      [0,0],[canvas.width-1,0],[0,canvas.height-1],[canvas.width-1,canvas.height-1]
    ];
    let sr=0,sg=0,sb=0;
    for(const [x,y] of samplePoints){
      const i=(y*canvas.width+x)*4;
      sr+=data[i]; sg+=data[i+1]; sb+=data[i+2];
    }
    sr/=4; sg/=4; sb/=4;
    for(let i=0;i<data.length;i+=4){
      const r=data[i],g=data[i+1],b=data[i+2];
      const lum=0.299*r+0.587*g+0.114*b;
      const distance=Math.sqrt((r-sr)**2+(g-sg)**2+(b-sb)**2);
      if(lum>175 && distance<70){
        const strength=Math.min(1,Math.max(0,(lum-175)/80));
        data[i]=Math.round(r+(255-r)*strength);
        data[i+1]=Math.round(g+(255-g)*strength);
        data[i+2]=Math.round(b+(255-b)*strength);
      }
    }
  }

  if(filter!=="original"){
    for(let i=0;i<data.length;i+=4){
      let r=data[i],g=data[i+1],b=data[i+2];
      let v=0.299*r+0.587*g+0.114*b;
      if(filter==="clean"){
        v=Math.max(0,Math.min(255,(v-118)*1.35+128));
        if(v>220) v=255;
      }
      data[i]=data[i+1]=data[i+2]=Math.round(v);
    }
  }

  if(sharpness!=="off"){
    const amount=sharpness==="strong"?0.72:0.42;
    const src=new Uint8ClampedArray(data);
    const w=canvas.width,h=canvas.height;
    for(let y=1;y<h-1;y++){
      for(let x=1;x<w-1;x++){
        const i=(y*w+x)*4;
        for(let c=0;c<3;c++){
          const v=src[i+c];
          const avg=(src[i-4+c]+src[i+4+c]+src[i-w*4+c]+src[i+w*4+c])/4;
          data[i+c]=Math.max(0,Math.min(255,Math.round(v+(v-avg)*amount)));
        }
      }
    }
  }
  ctx.putImageData(image,0,0);
}

function renderExamCanvas(canvas, crop, maxW=420, maxH=360){
  const scale=Math.min(maxW/crop.tw,maxH/crop.th,1);
  canvas.width=Math.max(1,Math.round(crop.tw*scale));
  canvas.height=Math.max(1,Math.round(crop.th*scale));
  const temp=document.createElement("canvas");
  temp.width=crop.tw; temp.height=crop.th;
  drawExamBase(temp,crop);
  applyExamImageAdjustments.call(null,temp);
  const ctx=canvas.getContext("2d",{alpha:false});
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(temp,0,0,canvas.width,canvas.height);
}

function drawOriginalExamCanvas(canvas,crop,maxW=220,maxH=180){
  if(!canvas||!crop||!examImage) return;
  const scale=Math.min(maxW/crop.tw,maxH/crop.th,1);
  canvas.width=Math.max(1,Math.round(crop.tw*scale));
  canvas.height=Math.max(1,Math.round(crop.th*scale));
  const ctx=canvas.getContext("2d",{alpha:false});
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.drawImage(examImage,crop.x,crop.y,crop.w,crop.h,0,0,canvas.width,canvas.height);
}

function updateExamComparison(){
  const crop=getExamCommittedCrop();
  if(!crop||!examImage) return;
  drawOriginalExamCanvas(examBeforeCanvas,crop);
  renderExamCanvas(examAfterCanvas,crop,220,180);
  const enhanced=Number(examCompareRange?.value||100)>=50;
  if(examAfterCanvas) examAfterCanvas.style.opacity=enhanced?"1":"0.35";
  if(examBeforeCanvas) examBeforeCanvas.style.opacity=enhanced?"0.35":"1";
}

function getExamQuality(canvas,blob){
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let sum=0,sum2=0,dark=0,bright=0,count=0;
  const pixels=data.length/4, stride=Math.max(1,Math.ceil(pixels/20000));
  for(let p=0;p<pixels;p+=stride){
    const i=p*4,lum=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
    sum+=lum;sum2+=lum*lum;count++;
    if(lum<45) dark++;
    if(lum>250) bright++;
  }
  const mean=count?sum/count:0;
  const variance=count?Math.max(0,sum2/count-mean*mean):0;
  return {brightness:mean,contrast:Math.sqrt(variance),darkRatio:count?dark/count:0,brightRatio:count?bright/count:0,sizeKB:blob?blob.size/1024:0};
}

function runExamQualityCheck(blob){
  const crop=getExamCrop();
  if(!crop||!examImage){setExamValidation("Please choose an image first.","error");return;}
  const temp=document.createElement("canvas");
  drawExamBase(temp,crop);applyExamImageAdjustments(temp);
  const q=getExamQuality(temp,blob),maxKB=Number(examMaxKB.value)||0,items=[];
  items.push(q.brightness<75?"<span class='quality-warn'>⚠ Brightness is low</span>":q.brightness>245?"<span class='quality-warn'>⚠ Image is very bright</span>":"<span class='quality-ok'>✓ Brightness looks usable</span>");
  items.push(q.contrast<22?"<span class='quality-warn'>⚠ Low contrast</span>":"<span class='quality-ok'>✓ Contrast looks usable</span>");
  items.push(q.darkRatio>0.48?"<span class='quality-warn'>⚠ Large dark area detected</span>":"<span class='quality-ok'>✓ No excessive dark area</span>");
  items.push(maxKB?(q.sizeKB<=maxKB?"<span class='quality-ok'>✓ File size within limit</span>":"<span class='quality-bad'>✕ File size exceeds the limit</span>"):"<span class='quality-ok'>✓ No file-size limit entered</span>");
  examQualitySummary.textContent=`Quality check • brightness ${Math.round(q.brightness)} • contrast ${Math.round(q.contrast)}`;
  examQualityCard.innerHTML=items.join("<br>")+`<br><small>Final dimensions: ${crop.tw} × ${crop.th} px • File: ${q.sizeKB.toFixed(1)} KB</small>`;
  examQualityCard.classList.remove("hidden");
}

function updateDpiResult(){
  const w=Math.max(0,Number(dpiCmW?.value)||0),h=Math.max(0,Number(dpiCmH?.value)||0),dpi=Math.max(1,Number(dpiValue?.value)||1);
  if(dpiResult) dpiResult.textContent=`${Math.round(w/2.54*dpi)} × ${Math.round(h/2.54*dpi)} px`;
}

function makeExamReady(){
  if(!examImage){setExamValidation("Please choose an image first.","error");return;}
  setExamCropMode("auto");
  examZoom.value="0";examOffsetX.value="0";examOffsetY.value="0"; updateExamZoomLabel();
  examBackground.value="white";
  examFilter.value=examDocType.value==="photo"?"original":"clean";
  examSharpness.value="medium";
  updateExamPreview();
  setExamValidation("Exam-ready adjustments applied. Review the crop before downloading.","ok");
}

async function createBatchExamZip(){
  if(typeof JSZip==="undefined") throw new Error("ZIP support could not be loaded. Please refresh the page and try again.");
  const jobs=[[batchPhoto,"photo"],[batchSignature,"signature"],[batchThumb,"thumb"],[batchDeclaration,"declaration"]].filter(([input])=>input?.files?.[0]);
  if(!jobs.length) throw new Error("Select at least one IBPS document for the ZIP.");
  const zip=new JSZip();
  for(const [input,type] of jobs){
    const file=input.files[0],cfg=EXAM_PROFILES.ibps.docs[type];
    const old={image:examImage,w:examWidth.value,h:examHeight.value,max:examMaxKB.value,format:examFormat.value,bg:examBackground.value,filter:examFilter.value,sharp:examSharpness.value,zoom:examZoom.value,ox:examOffsetX.value,oy:examOffsetY.value};
    try{
      examImage=await loadExamImage(file);
      examWidth.value=cfg.w;examHeight.value=cfg.h;examMaxKB.value=cfg.maxKB;examFormat.value=cfg.format;
      examBackground.value="white";examFilter.value=type==="photo"?"original":"clean";examSharpness.value="medium";examZoom.value="0";examOffsetX.value="0";examOffsetY.value="0"; updateExamZoomLabel();
      const blob=await createExamBlob();
      zip.file(`IBPS_${EXAM_DOC_LABELS[type].replace(/[^a-z0-9]+/gi,"_")}.${cfg.format==="png"?"png":"jpg"}`,blob);
    }finally{
      examImage=old.image;examWidth.value=old.w;examHeight.value=old.h;examMaxKB.value=old.max;examFormat.value=old.format;examBackground.value=old.bg;examFilter.value=old.filter;examSharpness.value=old.sharp;examZoom.value=old.zoom;examOffsetX.value=old.ox;examOffsetY.value=old.oy;
    }
  }
  return zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
}

function resetExamCrop(){
  examAppliedCrop=null;
  examManualCrop=null;
  examManualZoomBaseCrop=null;
  examDraftAutoCrop=null;
  examCropPointer={active:false,mode:"draw",edge:null,startX:0,startY:0,currentX:0,currentY:0,offsetX:0,offsetY:0,baseCrop:null};
  examManualNote?.classList.remove("saved");
  if(examCropMode==="manual"){
    if(examZoom) examZoom.disabled=true;
    if(examOffsetX) examOffsetX.disabled=true;
    if(examOffsetY) examOffsetY.disabled=true;
  }
  if(examSaveCropHint) examSaveCropHint.textContent="Save the current crop and continue with enhancement.";
  if(examCropHint) examCropHint.textContent=examCropMode==="manual" ? (examManualCrop ? "Rectangle selected. Drag inside to move it, or drag outside to draw a new one." : "Drag on the image to draw a rectangle.") : "Auto crop uses the selected output aspect ratio. Zoom and position remain available.";
  updateExamPreview();
  setExamValidation("Crop reset. Adjust the crop and save it when ready.","warn");
}

function getExamCommittedCrop(){
  if(!examImage) return null;
  if(examAppliedCrop){
    const sw=examImage.naturalWidth||examImage.width;
    const sh=examImage.naturalHeight||examImage.height;
    const tw=Math.max(1,Number(examWidth.value)||140);
    const th=Math.max(1,Number(examHeight.value)||180);
    const x=Math.max(0,Math.min(sw-1,examAppliedCrop.x));
    const y=Math.max(0,Math.min(sh-1,examAppliedCrop.y));
    const w=Math.max(1,Math.min(sw-x,examAppliedCrop.w));
    const h=Math.max(1,Math.min(sh-y,examAppliedCrop.h));
    return {x,y,w,h,sw,sh,tw,th};
  }
  return getExamCrop();
}

function updateExamFinalPreview(crop){
  if(!examFinalCanvas||!crop||!examImage) return;
  renderExamCanvas(examFinalCanvas,crop,260,210);
  if(examCropDimensions) examCropDimensions.textContent=`Crop: ${Math.round(crop.w)} × ${Math.round(crop.h)} px → ${crop.tw} × ${crop.th} px`;
  const limit=Number(examMaxKB.value)||0;
  if(examReadyBadge){
    examReadyBadge.className="exam-ready-badge ready";
    examReadyBadge.textContent=examAppliedCrop?"READY TO EXPORT":"READY TO EDIT";
  }
  if(examReadyText){
    examReadyText.textContent=examAppliedCrop
      ? `Saved crop • final output ${crop.tw} × ${crop.th} px • ${examFormat.value.toUpperCase()}${limit?` • max ${limit} KB`:""}`
      : `Preview only • save the crop when ready • ${crop.tw} × ${crop.th} px`;
  }
}

function updateExamPreview(){
  if(!examPreviewCanvas) return;
  const crop=getExamCrop();
  if(!crop){
    examPreviewEmpty?.classList.remove("hidden");
    return;
  }
  examPreviewEmpty?.classList.add("hidden");
  if(examCropMode==="manual") drawManualEditor();
  else drawAutoEditor();
  updateExamComparison();
  updateExamFinalPreview(getExamCommittedCrop());
  const kb=Number(examMaxKB.value)||0;
  setExamValidation(`${crop.tw} × ${crop.th} px • ${examFormat.value.toUpperCase()}${kb?` • max ${kb} KB`:""}`);
}

async function createExamBlob(){
  if(!examImage) throw new Error("Please choose an image first.");
  const crop=getExamCommittedCrop();
  const canvas=document.createElement("canvas");
  drawExamBase(canvas,crop);
  applyExamImageAdjustments(canvas);
  const format=examFormat.value;
  const maxBytes=Math.max(0,(Number(examMaxKB.value)||0)*1024);
  if(format==="png"){
    const blob=await new Promise(r=>canvas.toBlob(r,"image/png"));
    if(!blob) throw new Error("Could not create the PNG image.");
    if(maxBytes && blob.size>maxBytes) throw new Error(`PNG is ${Math.ceil(blob.size/1024)} KB, above the ${Number(examMaxKB.value)} KB limit. Use JPG/JPEG or change the target size only if the notification permits it.`);
    return blob;
  }
  if(!maxBytes){
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Could not create the JPG image.")),"image/jpeg",0.92));
  }
  let low=0.1,high=0.98,best=null;
  for(let i=0;i<8;i++){
    const q=(low+high)/2;
    const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",q));
    if(!blob) throw new Error("Could not create the JPG image.");
    if(blob.size<=maxBytes){best=blob;low=q;}else high=q;
  }
  if(!best){
    const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",0.1));
    if(!blob || blob.size>maxBytes) throw new Error(`The exact ${crop.tw} × ${crop.th} dimensions cannot be compressed below ${Number(examMaxKB.value)} KB without changing the required dimensions.`);
    best=blob;
  }
  return best;
}
function downloadExamBlob(blob){
  const doc=EXAM_DOC_LABELS[examDocType.value]||"Image";
  const safe=doc.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
  const ext=examFormat.value==="png"?"png":"jpg";
  const a=document.createElement("a");
  const url=URL.createObjectURL(blob);
  a.href=url;a.download=`PDFMines_${safe}.${ext}`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1800);
}

[examProfile,examDocType].forEach(el=>el?.addEventListener("change",updateExamRequirement));
[examWidth,examHeight].forEach(el=>el?.addEventListener("input",()=>{examAppliedCrop=null;examDraftAutoCrop=null;updateExamPreview();}));
[examMaxKB,examFormat,examOffsetX,examOffsetY,examBackground,examFilter,examSharpness].forEach(el=>el?.addEventListener("input",updateExamPreview));
examZoom?.addEventListener("input",()=>{examDraftAutoCrop=null;updateExamZoomLabel();updateExamPreview();});
[examBackground,examFilter,examSharpness].forEach(el=>el?.addEventListener("change",updateExamPreview));
examAutoFit?.addEventListener("click",()=>{examAppliedCrop=null;examDraftAutoCrop=null;setExamCropMode("auto");examZoom.value="0";examOffsetX.value="0";examOffsetY.value="0"; updateExamZoomLabel();examManualNote?.classList.remove("saved");if(examSaveCropHint)examSaveCropHint.textContent="Save the current crop and continue with enhancement.";updateExamPreview();});
examAutoCropMode?.addEventListener("click",()=>setExamCropMode("auto"));
examManualCropMode?.addEventListener("click",()=>setExamCropMode("manual"));
examSaveCrop?.addEventListener("click",saveCurrentCrop);
examResetCrop?.addEventListener("click",resetExamCrop);
examLockCropRatio?.addEventListener("change",()=>{if(examCropMode==="manual"||examCropMode==="auto") updateExamPreview();});
bindManualCropEditor();
examMakeReady?.addEventListener("click",makeExamReady);
examCheck?.addEventListener("click",async()=>{try{const blob=await createExamBlob();runExamQualityCheck(blob);}catch(err){setExamValidation(err.message||"Quality check failed.","error");}});
examCompareRange?.addEventListener("input",updateExamComparison);
[batchPhoto,batchSignature,batchThumb,batchDeclaration].forEach(el=>el?.addEventListener("change",()=>{const n=[batchPhoto,batchSignature,batchThumb,batchDeclaration].filter(x=>x?.files?.[0]).length;if(examQualitySummary&&!examImage)examQualitySummary.textContent=`${n} IBPS document${n===1?"":"s"} selected for batch ZIP.`;}));
examBatchDownload?.addEventListener("click",async()=>{
  examBatchDownload.disabled=true;
  try{
    setExamValidation("Preparing IBPS ZIP…");
    const blob=await createBatchExamZip();
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="PDFMines_IBPS_Exam_Documents.zip";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1800);
    setExamValidation(`IBPS package ready • ${(blob.size/1024).toFixed(1)} KB • Downloaded ✓`,"ok");
  }catch(err){setExamValidation(err.message||"Could not create the ZIP.","error");}
  finally{examBatchDownload.disabled=false;}
});
[dpiCmW,dpiCmH,dpiValue].forEach(el=>el?.addEventListener("input",updateDpiResult));
updateDpiResult();


function cropSummary(){
  const c=getExamCrop();
  return c?`${c.tw} × ${c.th} px • ${examFormat.value.toUpperCase()}`:"Image ready";
}

toolRun.onclick=async()=>{
  if(!activeTool) return;
  if(activeTool==="exam-resizer") {
    if(!toolFiles.length){setExamValidation("Please choose an image first.","error");return;}
    if(!examImage){setExamValidation("The selected image is still loading or could not be read.","error");return;}
    toolRun.disabled=true;
    setExamValidation("Preparing final image…");
    try{
      const blob=await createExamBlob();
      downloadExamBlob(blob);
      const limit=Number(examMaxKB.value)||0;
      const kb=(blob.size/1024).toFixed(1);
      const withinLimit=!limit||blob.size<=limit*1024;
      if(examReadyBadge){examReadyBadge.className=`exam-ready-badge ${withinLimit?"ready":"needs"}`;examReadyBadge.textContent=withinLimit?"READY":"NEEDS FIX";}
      if(examReadyText) examReadyText.textContent=withinLimit?`Final file ${kb} KB • within the ${limit||"allowed"} KB limit.`:`Final file ${kb} KB • above the ${limit} KB limit. Lower the image quality or review the requirement.`;
      setExamValidation(`${cropSummary()} • Final size ${kb} KB${limit?` / limit ${limit} KB`:""} • Downloaded ✓`,withinLimit?"ok":"warn");
    }catch(err){
      setExamValidation(err.message||"Could not create the image.","error");
    }finally{toolRun.disabled=false;}
    return;
  }
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
    else if(activeTool==="pdf2image") {
      const outputs=await pdfToImagesAndDownload(toolFiles[0]);
      const format=pdfImageFormat?.value || "jpg";
      const mode=document.querySelector('input[name="pdfImageOutput"]:checked')?.value || "individual";
      const totalKb=Math.round(outputs.reduce((sum,item)=>sum+item.blob.size,0)/1024);
      toolStatus.textContent=mode==="zip"
        ? `Done ✓  ${outputs.length} ${format.toUpperCase()} image${outputs.length===1?"":"s"} packed into one ZIP — ${totalKb} KB images total.`
        : `Done ✓  ${outputs.length} ${format.toUpperCase()} image${outputs.length===1?"":"s"} downloaded — ${totalKb} KB total.`;
      return;
    }

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

updateExamZoomLabel();
