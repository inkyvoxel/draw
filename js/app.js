// Main class for the drawing application, handling all user interaction and canvas logic
class DrawingApp {
  /**
   * Initialises the drawing application, sets up DOM references and state
   */
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

  /**
   * Initialises event listeners and resizes the canvas on load
   */
  init() {
    this.setupEventListeners();
    this.resizeCanvas();
  }

  /**
   * Sets up all event listeners for the drawing application
   */
  setupEventListeners() {
    this.setupCanvasDrawingEvents();
    this.setupToolbarButtonEvents();
    this.setupWindowEvents();
  }

  /**
   * Sets up mouse and touch events for drawing on the canvas
   */
  setupCanvasDrawingEvents() {
    const drawEvents = this.getDrawingEventConfigurations();

    drawEvents.forEach(({ event, handler, options }) => {
      this.canvas.addEventListener(event, handler, options);
    });
  }

  /**
   * Returns the configuration for all drawing-related events
   */
  getDrawingEventConfigurations() {
    return [
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
  }

  /**
   * Sets up click events for all toolbar buttons
   */
  setupToolbarButtonEvents() {
    this.clearBtn.addEventListener("click", this.handleClear.bind(this));
    this.undoBtn.addEventListener("click", this.handleUndo.bind(this));
    this.redoBtn.addEventListener("click", this.handleRedo.bind(this));
    this.penBtn.addEventListener("click", this.selectPenTool.bind(this));
    this.fillBtn.addEventListener("click", this.selectFillTool.bind(this));
  }

  /**
   * Sets up window-level events like resize
   */
  setupWindowEvents() {
    window.addEventListener("resize", this.resizeCanvas.bind(this));
  }

  /**
   * Gets the pointer (mouse or touch) position relative to the canvas
   */
  getPointerPosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  /**
   * Handles pointer down event, switching between pen and fill tools
   */
  handlePointerDown(e) {
    const pos = this.getPointerPosition(e);

    if (this.currentTool === "fill") {
      this.handleFill(pos);
    } else {
      this.handleDrawStart(e);
    }
  }

  /**
   * Begins a drawing stroke
   */
  handleDrawStart(e) {
    this.drawing = true;
    this.lastPos = this.getPointerPosition(e);
  }

  /**
   * Handles pointer movement while drawing, draws lines as the pointer moves
   */
  handleDrawMove(e) {
    if (!this.drawing) return;

    e.preventDefault();
    const currentPos = this.getPointerPosition(e);

    this.drawLine(this.lastPos, currentPos);
    this.lastPos = currentPos;
  }

  /**
   * Ends a drawing stroke and saves the current canvas state for undo/redo
   */
  handleDrawEnd() {
    if (this.drawing) {
      this.drawing = false;
      this.history.saveState(this.canvas.toDataURL());
      this.updateUI();
    }
  }

  /**
   * Draws a line between two points with current brush settings
   */
  drawLine(from, to) {
    this.configureBrushSettings();
    this.drawLineSegment(from, to);
  }

  /**
   * Configures the canvas context with current brush settings
   */
  configureBrushSettings() {
    this.ctx.strokeStyle = this.colorPicker.value;
    this.ctx.lineWidth = Number(this.sizePicker.value);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  /**
   * Draws a single line segment between two points
   */
  drawLineSegment(from, to) {
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
  }

  /**
   * Selects the pen tool for freehand drawing
   */
  selectPenTool() {
    this.currentTool = "pen";
    this.penBtn.classList.add("active");
    this.fillBtn.classList.remove("active");
    this.canvas.style.cursor = "default";
  }

  /**
   * Selects the fill tool for flood fill operations
   */
  selectFillTool() {
    this.currentTool = "fill";
    this.fillBtn.classList.add("active");
    this.penBtn.classList.remove("active");
    this.canvas.style.cursor = "crosshair";
  }

  /**
   * Handles the fill tool operation at a specific position
   */
  handleFill(pos) {
    const fillPosition = this.convertPositionToPixelCoordinates(pos);
    const targetColor = this.getPixelColor(fillPosition.x, fillPosition.y);
    const fillColor = this.hexToRgba(this.colorPicker.value);

    if (this.shouldSkipFill(targetColor, fillColor)) {
      return;
    }

    this.performFillOperation(fillPosition, targetColor, fillColor);
  }

  /**
   * Converts screen position to pixel coordinates accounting for device pixel ratio
   */
  convertPositionToPixelCoordinates(pos) {
    return {
      x: Math.floor(pos.x * this.dpr),
      y: Math.floor(pos.y * this.dpr),
    };
  }

  /**
   * Determines if fill operation should be skipped (when colors are the same)
   */
  shouldSkipFill(targetColor, fillColor) {
    return this.colorsEqual(targetColor, fillColor);
  }

  /**
   * Performs the complete fill operation and updates history
   */
  performFillOperation(position, targetColor, fillColor) {
    this.floodFill(position.x, position.y, targetColor, fillColor);
    this.history.saveState(this.canvas.toDataURL());
    this.updateUI();
  }

  /**
   * Retrieves the RGBA colour of a pixel at (x, y) on the canvas
   */
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

  /**
   * Converts a hex colour string to an RGBA object
   */
  hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, a: 255 };
  }

  /**
   * Compares two RGBA colour objects for equality
   */
  colorsEqual(color1, color2) {
    return (
      color1.r === color2.r &&
      color1.g === color2.g &&
      color1.b === color2.b &&
      color1.a === color2.a
    );
  }

  /**
   * Performs flood fill algorithm to fill an area with the same color
   */
  floodFill(startX, startY, targetColor, fillColor) {
    const imageData = this.getCanvasImageData();
    const fillArea = this.createFillArea(
      startX,
      startY,
      targetColor,
      fillColor,
      imageData
    );
    this.applyFillToCanvas(imageData);
  }

  /**
   * Gets the complete image data from the canvas
   */
  getCanvasImageData() {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Creates the filled area using a stack-based flood fill algorithm
   * Delegates stack processing and pixel checks to helper methods for clarity
   */
  createFillArea(startX, startY, targetColor, fillColor, imageData) {
    const stack = [{ x: startX, y: startY }];
    const data = imageData.data;
    const { width, height } = this.canvas;
    this.processFillStack(stack, data, width, height, targetColor, fillColor);
  }

  /**
   * Processes the stack for the flood fill, filling pixels as appropriate
   */
  processFillStack(stack, data, width, height, targetColor, fillColor) {
    while (stack.length > 0) {
      const currentPixel = stack.pop();
      if (
        !this.shouldFillPixel(currentPixel, width, height, data, targetColor)
      ) {
        continue;
      }
      this.fillPixel(currentPixel, data, width, fillColor);
      this.addNeighboringPixelsToStack(currentPixel, stack);
    }
  }

  /**
   * Determines if a pixel is within bounds and matches the target colour
   */
  shouldFillPixel(pixel, width, height, data, targetColor) {
    if (this.isPixelOutOfBounds(pixel, width, height)) {
      return false;
    }
    const pixelColor = this.getPixelColorFromImageData(pixel, data, width);
    return this.colorsEqual(pixelColor, targetColor);
  }

  /**
   * Fills a single pixel with the specified fill colour
   */
  fillPixel(pixel, data, width, fillColor) {
    this.setPixelColor(pixel, fillColor, data, width);
  }

  /**
   * Checks if a pixel coordinate is outside the canvas boundaries
   */
  isPixelOutOfBounds(pixel, width, height) {
    return pixel.x < 0 || pixel.x >= width || pixel.y < 0 || pixel.y >= height;
  }

  /**
   * Gets the color of a specific pixel from image data
   */
  getPixelColorFromImageData(pixel, data, width) {
    const index = (pixel.y * width + pixel.x) * 4;
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3],
    };
  }

  /**
   * Sets the color of a specific pixel in the image data
   */
  setPixelColor(pixel, color, data, width) {
    const index = (pixel.y * width + pixel.x) * 4;
    data[index] = color.r;
    data[index + 1] = color.g;
    data[index + 2] = color.b;
    data[index + 3] = color.a;
  }

  /**
   * Adds the four neighboring pixels (up, down, left, right) to the processing stack
   */
  addNeighboringPixelsToStack(pixel, stack) {
    stack.push({ x: pixel.x + 1, y: pixel.y });
    stack.push({ x: pixel.x - 1, y: pixel.y });
    stack.push({ x: pixel.x, y: pixel.y + 1 });
    stack.push({ x: pixel.x, y: pixel.y - 1 });
  }

  /**
   * Applies the modified image data back to the canvas
   */
  applyFillToCanvas(imageData) {
    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Clears the canvas and saves the cleared state to history
   */
  handleClear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.history.saveState(this.canvas.toDataURL());
    this.updateUI();
  }

  /**
   * Undoes the last action, restoring the previous canvas state
   */
  handleUndo() {
    const state = this.history.undo();
    if (state) {
      this.restoreCanvasState(state);
      this.updateUI();
    }
  }

  /**
   * Redoes the last undone action, restoring the next canvas state
   */
  handleRedo() {
    const state = this.history.redo();
    if (state) {
      this.restoreCanvasState(state);
      this.updateUI();
    }
  }

  /**
   * Restores the canvas to a previous state from a data URL
   */
  restoreCanvasState(dataURL) {
    return new Promise((resolve) => {
      const img = this.createImageFromDataURL(dataURL);
      img.onload = () => {
        this.clearCanvasAndResetTransform();
        this.drawImageToCanvas(img);
        this.applyDevicePixelRatioScaling();
        resolve();
      };
    });
  }

  /**
   * Creates an Image object from a data URL
   */
  createImageFromDataURL(dataURL) {
    const img = new Image();
    img.src = dataURL;
    return img;
  }

  /**
   * Clears the canvas and resets the transformation matrix
   */
  clearCanvasAndResetTransform() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draws the provided image onto the canvas
   */
  drawImageToCanvas(img) {
    this.ctx.drawImage(img, 0, 0);
  }

  /**
   * Applies device pixel ratio scaling to the canvas context
   */
  applyDevicePixelRatioScaling() {
    this.ctx.scale(this.dpr, this.dpr);
  }

  /**
   * Updates the UI, enabling or disabling undo/redo buttons as appropriate
   */
  updateUI() {
    this.undoBtn.disabled = !this.history.canUndo();
    this.redoBtn.disabled = !this.history.canRedo();
  }

  /**
   * Resizes the canvas to fit the available viewport space
   */
  resizeCanvas() {
    const { width, height } = this.calculateCanvasSize();
    this.setCanvasSize(width, height);
    this.setupCanvasContext();
    this.initializeHistoryIfEmpty();
  }

  /**
   * Calculates the optimal canvas size based on available viewport space
   */
  calculateCanvasSize() {
    const { headerHeight, footerHeight } = this.getLayoutElementHeights();
    const padding = 24;

    const availableHeight =
      window.innerHeight - headerHeight - footerHeight - padding;
    const availableWidth = window.innerWidth;

    return { width: availableWidth, height: availableHeight };
  }

  /**
   * Gets the heights of header and footer elements for layout calculations
   */
  getLayoutElementHeights() {
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");

    return {
      headerHeight: header?.offsetHeight || 0,
      footerHeight: footer?.offsetHeight || 0,
    };
  }

  /**
   * Sets the physical and visual dimensions of the canvas and its container
   */
  setCanvasSize(width, height) {
    this.setContainerDimensions(width, height);
    this.setCanvasDimensions(width, height);
  }

  /**
   * Sets the dimensions of the canvas container element
   */
  setContainerDimensions(width, height) {
    const container = this.canvas.parentElement;
    container.style.height = `${height}px`;
    container.style.width = `${width}px`;
  }

  /**
   * Sets the canvas dimensions accounting for device pixel ratio
   */
  setCanvasDimensions(width, height) {
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  /**
   * Initializes the history with an empty canvas state if history is empty
   */
  initializeHistoryIfEmpty() {
    if (this.history.isEmpty()) {
      this.history.saveState(this.canvas.toDataURL());
      this.updateUI();
    }
  }

  /**
   * Sets up the canvas context transformation and scaling for high-DPI screens
   */
  setupCanvasContext() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }
}

// Manages the undo/redo history for the drawing application
class HistoryManager {
  /**
   * Initialises the history manager with a maximum number of states
   */
  constructor(maxStates = 50) {
    this.states = [];
    this.currentIndex = -1;
    this.maxStates = maxStates;
  }

  /**
   * Saves a new canvas state to the history, trimming if necessary
   */
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

  /**
   * Moves one step back in the history and returns the previous state
   */
  undo() {
    if (this.canUndo()) {
      this.currentIndex--;
      return this.states[this.currentIndex];
    }
    return null;
  }

  /**
   * Moves one step forward in the history and returns the next state
   */
  redo() {
    if (this.canRedo()) {
      this.currentIndex++;
      return this.states[this.currentIndex];
    }
    return null;
  }

  /**
   * Returns true if there is a previous state to undo to
   */
  canUndo() {
    return this.currentIndex > 0;
  }

  /**
   * Returns true if there is a next state to redo to
   */
  canRedo() {
    return this.currentIndex < this.states.length - 1;
  }

  /**
   * Returns true if the history is empty
   */
  isEmpty() {
    return this.states.length === 0;
  }
}

// Instantiate the drawing application when the script loads
const drawingApp = new DrawingApp();
