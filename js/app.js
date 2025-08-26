class DrawingApp {
  constructor() {
    this.canvas = document.getElementById("draw-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.colorPicker = document.getElementById("color");
    this.sizePicker = document.getElementById("size");
    this.clearBtn = document.getElementById("clear");
    this.undoBtn = document.getElementById("undo");
    this.redoBtn = document.getElementById("redo");

    this.drawing = false;
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
      { event: "mousedown", handler: this.handleDrawStart.bind(this) },
      { event: "mousemove", handler: this.handleDrawMove.bind(this) },
      { event: "mouseup", handler: this.handleDrawEnd.bind(this) },
      { event: "mouseleave", handler: this.handleDrawEnd.bind(this) },
      {
        event: "touchstart",
        handler: this.handleDrawStart.bind(this),
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
