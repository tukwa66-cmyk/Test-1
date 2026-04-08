// ===== Signature Canvas Setup =====
const canvas = document.getElementById("signatureCanvas");
const ctx = canvas.getContext("2d");
let drawing = false;

function initCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  // ปรับความละเอียด canvas ให้ชัดตามจอ
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function getPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

// Mouse Events
canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  drawing = true;
  const p = getPos(e.clientX, e.clientY);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
});

window.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  const p = getPos(e.clientX, e.clientY);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
});

window.addEventListener("mouseup", () => {
  drawing = false;
});

// Touch Events (สำหรับมือถือ)
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  drawing = true;
  const t = e.touches[0];
  const p = getPos(t.clientX, t.clientY);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
}, { passive: false });

window.addEventListener("touchmove", (e) => {
  if (!drawing) return;
  e.preventDefault();
  const t = e.touches[0];
  const p = getPos(t.clientX, t.clientY);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
}, { passive: false });

window.addEventListener("touchend", () => {
  drawing = false;
});

function clearCanvas() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
}

// ===== Modal Logic =====
let _sigTargetHidden = "signatureData";
let _sigTargetImg = "signaturePrev";
let _sigTargetPlaceholder = "placeholderText";

function openSignatureModal(hiddenId, imgId, placeholderId) {
  _sigTargetHidden = hiddenId;
  _sigTargetImg = imgId;
  _sigTargetPlaceholder = placeholderId;
  document.getElementById("signatureModal").classList.add("open");
  // รอให้ Modal กางออกเสร็จก่อนค่อย Reset Canvas
  setTimeout(initCanvas, 100);
}

function closeSignatureModal() {
  drawing = false;
  document.getElementById("signatureModal").classList.remove("open");
}

function saveSignature() {
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const hasDrawing = data.some((v, i) => i % 4 === 3 && v > 10);

  if (!hasDrawing) {
    Swal.fire({ icon: "warning", title: "ยังไม่มีลายเซ็น", text: "กรุณาวาดลายเซ็นในกรอบก่อน", confirmButtonColor: "#1a5276" });
    return;
  }

  const dataURL = canvas.toDataURL("image/png");
  document.getElementById(_sigTargetHidden).value = dataURL;
  const imgEl = document.getElementById(_sigTargetImg);
  imgEl.src = dataURL;
  imgEl.style.display = "block";
  document.getElementById(_sigTargetPlaceholder).style.display = "none";
  closeSignatureModal();
}

// ปิด Modal เมื่อคลิกพื้นหลัง
document.getElementById("signatureModal").addEventListener("click", function (e) {
  if (e.target === this) closeSignatureModal();
});

// ===== Export PDF (แก้ไขปัญหาหน้าแหว่ง/หน้าว่าง) =====
async function exportPDF() {
  // 1. ตรวจสอบข้อมูลบังคับ
  const requiredFields = [
    { id: "chairmanCurriculum", label: "เรียน ประธานกรรมการ" },
    { id: "majorTo", label: "สาขาวิชา (ถึง)" },
    { id: "name", label: "ชื่อ-นามสกุล" },
    { id: "IdNumber", label: "รหัสประจำตัว" },
    { id: "curriculumName", label: "หลักสูตร" },
    { id: "major", label: "สาขาวิชา" },
    { id: "thesisTopicShort", label: "ชื่อเรื่อง (สั้น)" },
    { id: "thesisTitleTH1", label: "ชื่อภาษาไทย" },
    { id: "thesisTitleEN1", label: "ชื่อภาษาอังกฤษ" },
    { id: "advisor1", label: "ที่ปรึกษา 2.1" },
    { id: "copies", label: "จำนวนชุด" },
    { id: "printName", label: "ชื่อผู้ลงนาม" },
  ];

  for (const f of requiredFields) {
    const el = document.getElementById(f.id);
    if (!el || !el.value.trim()) {
      Swal.fire({ icon: "warning", title: "กรุณากรอกข้อมูลให้ครบ", text: `กรุณากรอก: ${f.label}`, confirmButtonColor: "#1a5276" });
      el?.focus();
      return;
    }
  }

  if (!document.querySelector('input[name="degree"]:checked')) {
    Swal.fire({ icon: "warning", title: "กรุณาเลือกระดับการศึกษา", confirmButtonColor: "#1a5276" });
    return;
  }
  if (!document.querySelector('input[name="section"]:checked')) {
    Swal.fire({ icon: "warning", title: "กรุณาเลือกภาค (ปกติ/พิเศษ)", confirmButtonColor: "#1a5276" });
    return;
  }
  if (!document.getElementById("signatureData").value) {
    Swal.fire({ icon: "warning", title: "กรุณาลงนาม", text: "โปรดลงลายมือชื่อก่อนบันทึก", confirmButtonColor: "#1a5276" });
    return;
  }

  // 2. เตรียม UI สำหรับการ Render
  const btn = document.getElementById("saveBtn");
  const originalBtnText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "กำลังเตรียมไฟล์...";

  // ซ่อนจุดที่ไม่ต้องการให้ติดไปใน PDF
  document.querySelectorAll(".sig-placeholder, .bar").forEach(el => el.style.opacity = "0");

  // ฉีด Style ชั่วคราวเพื่อคุมขนาดหน้ากระดาษให้นิ่ง
  const styleHack = document.createElement("style");
  styleHack.id = "pdf-hack";
  styleHack.textContent = `
    body { background: #fff !important; overflow: visible !important; }
    .page { 
      margin: 0 auto !important; 
      box-shadow: none !important;
      border: none !important;
      width: 210mm !important; 
      height: 297mm !important;
      position: relative !important;
      page-break-after: always !important;
    }
  `;
  document.head.appendChild(styleHack);

  // สำคัญ: เลื่อนไปบนสุดเพื่อให้ html2canvas คำนวณตำแหน่งจาก 0,0
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 500)); // รอให้ UI นิ่ง

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pages = document.querySelectorAll(".page");

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      // Render ทีละหน้า
      const canvasRender = await html2canvas(page, {
        scale: 2, // ความคมชัด x2
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200 // กำหนด Virtual Width ให้คงที่ขณะ Render
      });

      const imgData = canvasRender.toDataURL("image/jpeg", 0.95);

      if (i > 0) pdf.addPage();

      // วาดภาพลง A4 (กว้าง 210mm สูง 297mm)
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    pdf.save("แบบ_บว2_ขออนุมัติจัดประชุมพิจารณาเค้าโครงวิทยานิพนธ์.pdf");
    Swal.fire({ icon: "success", title: "บันทึกสำเร็จ", text: "ไฟล์ PDF ถูกบันทึกแล้ว", confirmButtonColor: "#1a5276", timer: 2000 });

  } catch (err) {
    console.error("PDF Error:", err);
    Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: "ไม่สามารถสร้าง PDF ได้: " + err.message });
  } finally {
    // คืนค่า UI กลับเป็นปกติ
    document.getElementById("pdf-hack")?.remove();
    btn.disabled = false;
    btn.innerHTML = originalBtnText;
    document.querySelectorAll(".sig-placeholder, .bar").forEach(el => el.style.opacity = "1");
  }
}

// เพิ่ม Animation หมุนๆ ตอนโหลด (Optional)
const styleAnim = document.createElement("style");
styleAnim.textContent = `@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;
document.head.appendChild(styleAnim);