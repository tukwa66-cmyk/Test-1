window.addEventListener("load", async () => {
  if (document.fonts) {
    await document.fonts.ready;
  }
  document.body.classList.add("ready");
});

document.addEventListener("DOMContentLoaded", () => {

  // จัดการ Input ที่ซ่อน/แสดง ตามเงื่อนไข
  function setupDependentInput(triggerSelector, targetId, conditionFn) {
    const target = document.getElementById(targetId);
    if (!target) return;

    const updateState = () => {
      const isRequired = conditionFn();
      target.disabled = !isRequired;
      target.required = isRequired;
      if (!isRequired) target.value = ""; 
    };

    document.querySelectorAll(triggerSelector).forEach(el => {
      el.addEventListener("change", updateState);
    });
    updateState();
  }

  // คำนำหน้า: อื่นๆ
  setupDependentInput(
    'input[name="title"]', 
    "titleOtherText", 
    () => document.getElementById("titleOtherRadio").checked
  );

  // ช่องทางติดต่อ
  setupDependentInput(
    'input[name="contact"]', 
    "contactId", 
    () => Array.from(document.querySelectorAll('input[name="contact"]')).some(cb => cb.checked)
  );

  // การลงทะเบียน: กรณีไม่ครบ
  setupDependentInput(
    'input[name="regStatus"]', 
    "incompleteReason", 
    () => document.getElementById("regIncomplete").checked
  );

  // การลงทะเบียน: อื่นๆ
  setupDependentInput(
    'input[name="regStatus"]', 
    "otherReason", 
    () => document.getElementById("regOther").checked
  );

  // เบอร์โทรศัพท์
  const phoneInput = document.getElementById("phone");
  if (phoneInput) {
    phoneInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });
  }

  // วันที่และเดือนใต้ช่องเซ็นชื่อ
  ["sigDay", "sigMonth"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("blur", (e) => {
        const val = e.target.value;
        if (val && val.length === 1 && !isNaN(val)) {
          e.target.value = val.padStart(2, "0");
        }
      });
    }
  });

  //Signature Canvas
  const canvas = document.getElementById("signatureCanvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  let drawing = false;

  // ปรับขนาด Canvas
  function setupCanvasSize() {
    const modal = document.querySelector(".sig-modal");
    const targetWidth = Math.min(modal.clientWidth - 40, 420); 
    const targetHeight = 160;

    canvas.style.width = targetWidth + "px";
    canvas.style.height = targetHeight + "px";

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = targetWidth * ratio;
    canvas.height = targetHeight * ratio;
    
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stopDraw() { drawing = false; }

  // Mouse & Touch Events
  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mouseleave", stopDraw);
  
  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stopDraw);

  // Global Functions
  window.clearCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  window.openSignatureModal = () => {
    document.getElementById("signatureModal").classList.add("open");
    document.body.classList.add("modal-open");
    setupCanvasSize();
    clearCanvas();
  };

  window.closeSignatureModal = () => {
    document.getElementById("signatureModal").classList.remove("open");
    document.body.classList.remove("modal-open");
  };

  window.saveSignature = () => {
    const dataURL = canvas.toDataURL("image/png", 1.0);
    document.getElementById("signatureData").value = dataURL;

    const img = document.getElementById("signaturePrev");
    img.src = dataURL;
    img.style.display = "block";
    document.getElementById("placeholderText").style.display = "none";

    closeSignatureModal();
  };

  // ปิด Modal เมื่อคลิกพื้นที่ว่างด้านนอก
  document.getElementById("signatureModal").addEventListener("click", (e) => {
    if (e.target.id === "signatureModal") closeSignatureModal();
  });

  // PDF Export
  window.exportPDF = async () => {
    const form = document.getElementById("registerForm");
    
    // ตรวจสอบ Validation ฟอร์ม
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // ตรวจสอบว่าเซ็นชื่อหรือยัง
    if (!document.getElementById("signatureData").value) {
      Swal.fire({
        icon: "warning",
        title: "กรุณาลงลายมือชื่อ",
        text: "โปรดลงลายมือชื่อก่อนบันทึกเอกสาร PDF",
        confirmButtonColor: "#1a5276",
      });
      return;
    }

    const btn = document.getElementById("saveBtn");
    const originalBtnContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> กำลังสร้าง PDF...`;

    try {
      await document.fonts.ready;
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pages = document.querySelectorAll(".page");

      for (let i = 0; i < pages.length; i++) {
        pages[i].querySelectorAll(".sig-placeholder, .bar").forEach(el => el.style.display = "none");

        const cvs = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: 794,
          onclone: (clonedDoc) => {
            const pageEl = clonedDoc.querySelectorAll('.page')[i];
            if(pageEl) {
              pageEl.style.width = '21cm';
              pageEl.style.minHeight = '29.7cm';
              pageEl.style.padding = '2.54cm 2cm';
              pageEl.style.margin = '0';
              pageEl.style.boxShadow = 'none';
            }
            
            const fixStyle = clonedDoc.createElement('style');
            fixStyle.innerHTML = `
              @media screen {
                input[type="text"], input[type="number"], input[type="tel"] { 
                  border-bottom: 1.5pt dotted #000 !important; 
                  background: transparent !important;
                }
              }
            `;
            clonedDoc.head.appendChild(fixStyle);
          }
        });
        pages[i].querySelectorAll(".sig-placeholder").forEach(el => el.style.display = "");
        pages[i].querySelectorAll(".bar").forEach(el => el.style.display = "block");

        const imgData = cvs.toDataURL("image/png", 1.0);
        const imgWidth = 210;
        const imgHeight = (cvs.height * imgWidth) / cvs.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, Math.min(imgHeight, 297));
      }
      pdf.save("แบบเสนอขออนุมัติจัดประชุมพิจารณาเค้าโครงวิทยานิพนธ์.pdf");

      Swal.fire({
        icon: "success",
        title: "บันทึกสำเร็จ",
        confirmButtonColor: "#1a5276",
        timer: 2000,
        showConfirmButton: false
      }).then(() => {
        window.location.reload();
      });

    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่อีกครั้ง",
        confirmButtonColor: "#c0392b",
      });
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalBtnContent;
    }
  };

  // แอนิเมชันสำหรับโหลดปุ่มบันทึก
  if (!document.getElementById("spinAnim")) {
    const spinStyle = document.createElement("style");
    spinStyle.id = "spinAnim";
    spinStyle.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(spinStyle);
  }
});