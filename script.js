const input = document.getElementById("imageInput");
const drop = document.getElementById("dropZone");
const fileArea = document.getElementById("fileArea");
const thumbs = document.getElementById("thumbs");
const fileCount = document.getElementById("fileCount");
const status = document.querySelector(".status-dot");
let files = [];

document.getElementById("startBtn").onclick = () => input.click();
document.getElementById("chooseBtn").onclick = e => { e.stopPropagation(); input.click(); };
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
  const valid = newFiles.filter(f => /^image\/(jpeg|png|webp)$/.test(f.type));
  files.push(...valid);
  render();
}

function render(){
  fileArea.classList.toggle("hidden", files.length===0);
  fileCount.textContent = `${files.length} page${files.length===1?"":"s"}`;
  thumbs.innerHTML = "";
  files.forEach((file,i)=>{
    const div=document.createElement("div"); div.className="thumb";
    const img=document.createElement("img"); img.src=URL.createObjectURL(file);
    const num=document.createElement("span"); num.className="num"; num.textContent=String(i+1).padStart(2,"0");
    const del=document.createElement("button"); del.textContent="×"; del.title="Remove";
    del.onclick=()=>{files.splice(i,1);render()};
    div.append(img,num,del); thumbs.appendChild(div);
  });
  status.textContent = "● Ready";
}

document.getElementById("clearBtn").onclick=()=>{files=[];input.value="";render()};

document.getElementById("createBtn").onclick = async ()=>{
  if(!files.length) return;

  const size=document.getElementById("pageSize").value;
  const orientation=document.getElementById("orientation").value;
  const quality=document.getElementById("quality").value;
  const wrap=document.getElementById("progressWrap");
  const bar=document.getElementById("progressBar");
  const txt=document.getElementById("progressText");
  const button=document.getElementById("createBtn");

  button.disabled = true;
  wrap.classList.remove("hidden");
  bar.style.width = "0%";

  try {
    const pages = [];

    for(let i=0;i<files.length;i++){
      txt.textContent=`Preparing page ${i+1} of ${files.length}…`;
      const data=await readImage(files[i],quality);
      const img=await decodeImage(data);

      let pageWmm, pageHmm;
      if(size === "letter") {
        pageWmm = 215.9; pageHmm = 279.4;
      } else if(size === "original") {
        pageWmm = 210;
        pageHmm = pageWmm * (img.height / img.width);
      } else {
        pageWmm = 210; pageHmm = 297;
      }

      if(orientation === "landscape" && size !== "original") {
        [pageWmm, pageHmm] = [pageHmm, pageWmm];
      }

      pages.push({ data, width: img.width, height: img.height, pageWmm, pageHmm });
      bar.style.width=((i+1)/files.length*65)+"%";
      await new Promise(r=>setTimeout(r,0));
    }

    txt.textContent = "Building PDF…";
    const pdfBytes = buildImagePdf(pages);
    bar.style.width = "90%";
    downloadBytes(pdfBytes, `PDFMines_${new Date().toISOString().slice(0,10)}.pdf`);
    bar.style.width = "100%";
    txt.textContent="PDF ready ✓";
  } catch (err) {
    console.error(err);
    txt.textContent="Could not create PDF";
    alert("Could not create the PDF. Please try again with JPG/PNG/WEBP images.");
  } finally {
    button.disabled = false;
  }
};

function readImage(file, quality){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error || new Error("Could not read image"));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("Could not decode image"));
      img.onload=()=>{
        const max=quality==="small"?1800:quality==="medium"?2600:3600;
        const scale=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement("canvas");
        c.width=Math.max(1,Math.round(img.width*scale));
        c.height=Math.max(1,Math.round(img.height*scale));
        const ctx=c.getContext("2d", {alpha:false});
        ctx.fillStyle="#fff";
        ctx.fillRect(0,0,c.width,c.height);
        ctx.drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL("image/jpeg",quality==="small"?.72:quality==="medium"?.84:.92));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function decodeImage(dataUrl){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("Could not decode converted image"));
    img.src=dataUrl;
  });
}

// Small, dependency-free PDF writer for JPEG images.
// The browser converts PNG/WEBP to JPEG first, so the resulting PDF needs no external library.
function buildImagePdf(pages){
  const objects=[];
  const pageRefs=[];
  const pageWmmToPt = mm => mm * 72 / 25.4;

  // Object 1: Catalog; object 2: Pages tree. Their page/image object numbers are filled below.
  objects.push(null);
  objects.push(null);

  for (const page of pages) {
    const imageObj = objects.length + 1;
    const contentObj = imageObj + 1;
    const pageObj = imageObj + 2;

    const jpeg = dataUrlToBytes(page.data);
    const pageW = pageWmmToPt(page.pageWmm);
    const pageH = pageWmmToPt(page.pageHmm);
    const margin = pageWmmToPt(8);
    const maxW = Math.max(1, pageW - margin * 2);
    const maxH = Math.max(1, pageH - margin * 2);
    const scale = Math.min(maxW / page.width, maxH / page.height);
    const drawW = page.width * scale;
    const drawH = page.height * scale;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;

    const content = `q\n${fmt(drawW)} 0 0 ${fmt(drawH)} ${fmt(x)} ${fmt(y)} cm\n/Im1 Do\nQ\n`;
    objects.push({
      type: "binary",
      header: `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      data: jpeg,
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
  objects[1] = { type: "text", data: `<< /Type /Pages /Kids [${pageRefs.map(n=>`${n} 0 R`).join(" ")}] /Count ${pageRefs.length} >>` };

  const chunks=[];
  const offsets=[0];
  let offset=0;
  const pushText = text => { const bytes=utf8Bytes(text); chunks.push(bytes); offset += bytes.length; };
  const pushBytes = bytes => { chunks.push(bytes); offset += bytes.length; };

  pushText("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  for(let i=0;i<objects.length;i++){
    offsets.push(offset);
    pushText(`${i+1} 0 obj\n`);
    const obj=objects[i];
    if(obj.type === "binary"){
      pushText(obj.header); pushBytes(obj.data); pushText(obj.footer + "\nendobj\n");
    } else {
      pushText(obj.data + "\nendobj\n");
    }
  }
  const xrefOffset=offset;
  pushText(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`);
  for(let i=1;i<offsets.length;i++) pushText(`${String(offsets[i]).padStart(10,"0")} 00000 n \n`);
  pushText(`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concatBytes(chunks);
}

function dataUrlToBytes(dataUrl){
  const base64=dataUrl.split(",")[1];
  const bin=atob(base64);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return bytes;
}

function utf8Bytes(text){ return new TextEncoder().encode(text); }
function fmt(n){ return Number(n.toFixed(3)).toString(); }
function concatBytes(chunks){
  const total=chunks.reduce((n,c)=>n+c.length,0);
  const out=new Uint8Array(total);
  let p=0;
  for(const c of chunks){ out.set(c,p); p+=c.length; }
  return out;
}
function downloadBytes(bytes, filename){
  const blob=new Blob([bytes], {type:"application/pdf"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
