class DrawingApp {
  constructor() {
    this.canvas = document.getElementById("draw-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.colorPicker = document.getElementById("color");
    this.sizePicker = document.getElementById("size");
    this.clearBtn = document.getElementById("clear");
    this.undoBtn = document.getElementById("undo");
    this.redoBtn = document.getElementById("redo");
    this.penBtn = document.getElementById("pen");
    this.fillBtn = document.getElementById("fill");

    this.drawing = false;
    this.currentTool = "pen";
    this.lastPos = { x: 0, y: 0 };
    this.dpr = window.devicePixelRatio || 1;

    this.history = new HistoryManager();

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.resizeCanvas();
  }

  setupEventListeners() {
    const drawEvents = [
      { event: "mousedown", handler: this.handlePointerDown.bind(this) },
      { event: "mousemove", handler: this.handleDrawMove.bind(this) },
      { event: "mouseup", handler: this.handleDrawEnd.bind(this) },
      { event: "mouseleave", handler: this.handleDrawEnd.bind(this) },
      {
        event: "touchstart",
        handler: this.handlePointerDown.bind(this),
        options: { passive: false },
      },
      {
        event: "touchmove",
        handler: this.handleDrawMove.bind(this),
        options: { passive: false },
      },
      { event: "touchend", handler: this.handleDrawEnd.bind(this) },
      { event: "touchcancel", handler: this.handleDrawEnd.bind(this) },
    ];

    drawEvents.forEach(({ event, handler, options }) => {
      this.canvas.addEventListener(event, handler, options);
    });

    this.clearBtn.addEventListener("click", this.handleClear.bind(this));
    this.undoBtn.addEventListener("click", this.handleUndo.bind(this));
    this.redoBtn.addEventListener("click", this.handleRedo.bind(this));
    this.penBtn.addEventListener("click", this.selectPenTool.bind(this));
    this.fillBtn.addEventListener("click", this.selectFillTool.bind(this));
    window.addEventListener("resize", this.resizeCanvas.bind(this));
  }

  getPointerPosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  handlePointerDown(e) {
    const pos = this.getPointerPosition(e);

    if (this.currentTool === "fill") {
      this.handleFill(pos);
    } else {
      this.handleDrawStart(e);
    }
  }

  handleDrawStart(e) {
    this.drawing = true;
    this.lastPos = this.getPointerPosition(e);
  }

  handleDrawMove(e) {
    if (!this.drawing) return;

    e.preventDefault();
    const currentPos = this.getPointerPosition(e);

    this.drawLine(this.lastPos, currentPos);
    this.lastPos = currentPos;
  }

  handleDrawEnd() {
    if (this.drawing) {
      this.drawing = false;
      this.history.saveState(this.canvas.toDataURL());
      this.updateUI();
    }
  }

  drawLine(from, to) {
    this.ctx.strokeStyle = this.colorPicker.value;
    this.ctx.lineWidth = Number(this.sizePicker.value);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
  }

  toggleFillMode() {
    this.fillMode = !this.fillMode;
    this.fillBtn.classList.toggle("active", this.fillMode);
    this.canvas.style.cursor = this.fillMode ? "crosshair" : "default";
  }

  selectPenTool() {
    this.currentTool = "pen";
    this.penBtn.classList.add("active");
    this.fillBtn.classList.remove("active");
    this.canvas.style.cursor = "default";
  }

  selectFillTool() {
    this.currentTool = "fill";
    this.fillBtn.classList.add("active");
    this.penBtn.classList.remove("active");
    this.canvas.style.cursor = "crosshair";
  }

  handleFill(pos) {
    const x = Math.floor(pos.x * this.dpr);
    const y = Math.floor(pos.y * this.dpr);

    const targetColor = this.getPixelColor(x, y);
    const fillColor = this.hexToRgba(this.colorPicker.value);

    if (this.colorsEqual(targetColor, fillColor)) {
      return;
    }

    this.floodFill(x, y, targetColor, fillColor);
    this.history.saveState(this.canvas.toDataURL());
    this.updateUI();
  }

  getPixelColor(x, y) {
    const imageData = this.ctx.getImageData(x, y, 1, 1);
    const data = imageData.data;
    return {
      r: data[0],
      g: data[1],
      b: data[2],
      a: data[3],
    };
  }

  hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, a: 255 };
  }

  colorsEqual(color1, color2) {
    return (
      color1.r === color2.r &&
      color1.g === color2.g &&
      color1.b === color2.b &&
      color1.a === color2.a
    );
  }

  floodFill(startX, startY, targetColor, fillColor) {
    const stack = [{ x: startX, y: startY }];
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    const data = imageData.data;
    const width = this.canvas.width;
    const height = this.canvas.height;

    while (stack.length > 0) {
      const { x, y } = stack.pop();

      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const index = (y * width + x) * 4;
      const currentColor = {
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
        a: data[index + 3],
      };

      if (!this.colorsEqual(currentColor, targetColor)) continue;

      data[index] = fillColor.r;
      data[index + 1] = fillColor.g;
      data[index + 2] = fillColor.b;
      data[index + 3] = fillColor.a;

      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  handleClear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.history.saveState(this.canvas.toDataURL());
    this.updateUI();
  }

  handleUndo() {
    const state = this.history.undo();
    if (state) {
      this.restoreCanvasState(state);
      this.updateUI();
    }
  }

  handleRedo() {
    const state = this.history.redo();
    if (state) {
      this.restoreCanvasState(state);
      this.updateUI();
    }
  }

  restoreCanvasState(dataURL) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
        resolve();
      };
      img.src = dataURL;
    });
  }

  updateUI() {
    this.undoBtn.disabled = !this.history.canUndo();
    this.redoBtn.disabled = !this.history.canRedo();
  }

  resizeCanvas() {
    const { width, height } = this.calculateCanvasSize();

    this.setCanvasSize(width, height);
    this.setupCanvasContext();

    if (this.history.isEmpty()) {
      this.history.saveState(this.canvas.toDataURL());
      this.updateUI();
    }
  }

  calculateCanvasSize() {
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");
    const padding = 24;

    const headerHeight = header?.offsetHeight || 0;
    const footerHeight = footer?.offsetHeight || 0;
    const availableHeight =
      window.innerHeight - headerHeight - footerHeight - padding;
    const availableWidth = window.innerWidth;

    return { width: availableWidth, height: availableHeight };
  }

  setCanvasSize(width, height) {
    const container = this.canvas.parentElement;

    container.style.height = `${height}px`;
    container.style.width = `${width}px`;

    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  setupCanvasContext() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }
}

class HistoryManager {
  constructor(maxStates = 50) {
    this.states = [];
    this.currentIndex = -1;
    this.maxStates = maxStates;
  }

  saveState(dataURL) {
    if (this.currentIndex < this.states.length - 1) {
      this.states = this.states.slice(0, this.currentIndex + 1);
    }

    this.states.push(dataURL);
    this.currentIndex++;

    if (this.states.length > this.maxStates) {
      this.states.shift();
      this.currentIndex--;
    }
  }

  undo() {
    if (this.canUndo()) {
      this.currentIndex--;
      return this.states[this.currentIndex];
    }
    return null;
  }

  redo() {
    if (this.canRedo()) {
      this.currentIndex++;
      return this.states[this.currentIndex];
    }
    return null;
  }

  canUndo() {
    return this.currentIndex > 0;
  }

  canRedo() {
    return this.currentIndex < this.states.length - 1;
  }

  isEmpty() {
    return this.states.length === 0;
  }
}

const drawingApp = new DrawingApp();
