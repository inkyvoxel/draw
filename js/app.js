const canvas = document.getElementById("draw-canvas");
const ctx = canvas.getContext("2d");
const colourPicker = document.getElementById("color");
const sizePicker = document.getElementById("size");
const clearBtn = document.getElementById("clear");

let drawing = false;
let lastX = 0;
let lastY = 0;
let dpr = window.devicePixelRatio || 1;

function getPointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;
  if (e.touches) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function startDraw(e) {
  drawing = true;
  const pos = getPointerPos(e);
  lastX = pos.x;
  lastY = pos.y;
}

function draw(e) {
  if (!drawing) return;
  e.preventDefault();
  const pos = getPointerPos(e);
  ctx.strokeStyle = colourPicker.value;
  ctx.lineWidth = Number(sizePicker.value);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  lastX = pos.x;
  lastY = pos.y;
}

function endDraw() {
  drawing = false;
}

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("mouseleave", endDraw);

canvas.addEventListener("touchstart", startDraw, { passive: false });
canvas.addEventListener("touchmove", draw, { passive: false });
canvas.addEventListener("touchend", endDraw);
canvas.addEventListener("touchcancel", endDraw);

clearBtn.addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

function resizeCanvas() {
  const header = document.querySelector("header");
  const footer = document.querySelector("footer");
  const container = canvas.parentElement;
  const padding = 24;

  const headerH = header ? header.offsetHeight : 0;
  const footerH = footer ? footer.offsetHeight : 0;
  const availableH = window.innerHeight - headerH - footerH - padding;
  const availableW = window.innerWidth;

  container.style.height = availableH + "px";
  container.style.width = availableW + "px";

  canvas.width = availableW * dpr;
  canvas.height = availableH * dpr;
  canvas.style.width = availableW + "px";
  canvas.style.height = availableH + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
