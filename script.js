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
input.addEventListener("change", () => addFiles([...input.files]));

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
  status.textContent = files.length ? "● Ready" : "● Ready";
}

document.getElementById("clearBtn").onclick=()=>{files=[];input.value="";render()};

document.getElementById("createBtn").onclick = async ()=>{
  if(!files.length) return;
  if(!window.jspdf){ alert("PDF library could not load. Check your internet connection and reload."); return; }
  const {jsPDF}=window.jspdf;
  const size=document.getElementById("pageSize").value;
  const orientation=document.getElementById("orientation").value;
  const quality=document.getElementById("quality").value;
  const pdf=new jsPDF({orientation:orientation==="landscape"?"landscape":"portrait",unit:"mm",format:size==="letter"?"letter":"a4",compress:true});
  const wrap=document.getElementById("progressWrap"), bar=document.getElementById("progressBar"), txt=document.getElementById("progressText");
  wrap.classList.remove("hidden");
  for(let i=0;i<files.length;i++){
    txt.textContent=`Creating page ${i+1} of ${files.length}…`;
    const data=await readImage(files[i],quality);
    const img=new Image(); img.src=data; await img.decode();
    let pageW=pdf.internal.pageSize.getWidth(), pageH=pdf.internal.pageSize.getHeight();
    if(size==="original"){
      const ratio=img.width/img.height;
      pageW=210; pageH=pageW/ratio;
      if(i===0) pdf.deletePage(1);
      pdf.addPage([pageW,pageH],pageW>pageH?"landscape":"portrait");
    } else if(i>0) pdf.addPage();
    pageW=pdf.internal.pageSize.getWidth(); pageH=pdf.internal.pageSize.getHeight();
    const margin=8, maxW=pageW-margin*2, maxH=pageH-margin*2;
    const scale=Math.min(maxW/img.width*3.78,maxH/img.height*3.78);
    const w=img.width*scale/3.78, h=img.height*scale/3.78;
    pdf.addImage(data,"JPEG",(pageW-w)/2,(pageH-h)/2,w,h,undefined,quality==="small"?"FAST":"MEDIUM");
    bar.style.width=((i+1)/files.length*100)+"%";
    await new Promise(r=>setTimeout(r,0));
  }
  txt.textContent="PDF ready ✓";
  const stamp=new Date().toISOString().slice(0,10);
  pdf.save(`PDFMines_${stamp}.pdf`);
};

function readImage(file, quality){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const max=quality==="small"?1800:quality==="medium"?2600:3600;
        const scale=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(img.width*scale)); c.height=Math.max(1,Math.round(img.height*scale));
        const ctx=c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL("image/jpeg",quality==="small"?.72:quality==="medium"?.84:.92));
      }; img.src=reader.result;
    }; reader.readAsDataURL(file);
  });
}
