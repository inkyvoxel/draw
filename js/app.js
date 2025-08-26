// Main class for the drawing application, handling all user interaction and canvas logic
class DrawingApp {
  /**
   * Initialises the drawing application, sets up DOM references and state.
   * @constructor
   */
  constructor() {
    this.visibleCanvas = document.getElementById("draw-canvas");
    this.visibleCtx = this.visibleCanvas.getContext("2d");
    this.colorPicker = document.getElementById("color");
    this.sizePicker = document.getElementById("size");
    this.clearBtn = document.getElementById("clear");
    this.undoBtn = document.getElementById("undo");
    this.redoBtn = document.getElementById("redo");
    this.penBtn = document.getElementById("pen");
    this.fillBtn = document.getElementById("fill");
    this.saveBtn = document.getElementById("save");

    this.drawing = false;
    this.currentTool = "pen";
    this.lastPos = { x: 0, y: 0 };
    this.dpr = window.devicePixelRatio || 1;

    this.history = new HistoryManager();

    // Offscreen canvas to preserve the full drawing area
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    this.offscreenCanvas.width = this.visibleCanvas.width;
    this.offscreenCanvas.height = this.visibleCanvas.height;

    this.init();
  }

  /**
   * Initialises event listeners and resizes the canvas on load.
   * @returns {void}
   */
  init() {
    this.setupEventListeners();
    this.resizeCanvas();
  }

  /**
   * Sets up all event listeners for the drawing application.
   * @returns {void}
   */
  setupEventListeners() {
    this.setupCanvasDrawingEvents();
    this.setupToolbarButtonEvents();
    this.setupWindowEvents();
  }

  /**
   * Sets up mouse and touch events for drawing on the canvas.
   * @returns {void}
   */
  setupCanvasDrawingEvents() {
    const drawEvents = this.getDrawingEventConfigurations();

    drawEvents.forEach(({ event, handler, options }) => {
      this.visibleCanvas.addEventListener(event, handler, options);
    });
  }

  /**
   * Returns the configuration for all drawing-related events.
   * @returns {Array<{event: string, handler: Function, options?: Object}>}
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
   * Sets up click events for all toolbar buttons.
   * @returns {void}
   */
  setupToolbarButtonEvents() {
    this.clearBtn.addEventListener("click", this.handleClear.bind(this));
    this.undoBtn.addEventListener("click", this.handleUndo.bind(this));
    this.redoBtn.addEventListener("click", this.handleRedo.bind(this));
    this.penBtn.addEventListener("click", this.selectPenTool.bind(this));
    this.fillBtn.addEventListener("click", this.selectFillTool.bind(this));
    this.saveBtn.addEventListener("click", this.handleSave.bind(this));
  }

  /**
   * Handles the save button click, prompting the user to download the canvas as a PNG file.
   * The filename is in the format Draw_YYYY_MM_DD_HH_MM_SS.png.
   * @returns {void}
   */
  handleSave() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const timestamp = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(
      now.getDate()
    )}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(
      now.getSeconds()
    )}`;
    const filename = `Draw_${timestamp}.png`;
    const dataURL = this.offscreenCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Sets up window-level events such as resize.
   * @returns {void}
   */
  setupWindowEvents() {
    window.addEventListener("resize", this.resizeCanvas.bind(this));
  }

  /**
   * Gets the pointer (mouse or touch) position relative to the canvas.
   * Uses changedTouches[0] for 'touchend' and 'touchcancel', otherwise touches[0].
   * Falls back to mouse event properties if not a touch event.
   * Rounds coordinates for pixel-perfect positioning on high-DPI screens.
   * @param {MouseEvent|TouchEvent} e - The pointer event
   * @returns {{x: number, y: number}} The pointer position
   */
  getPointerPosition(e) {
    const rect = this.visibleCanvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches || e.changedTouches) {
      // Touch event
      if (e.type === "touchend" || e.type === "touchcancel") {
        if (e.changedTouches && e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        } else {
          // Fallback: no touches left, use last known position (could be undefined)
          clientX = 0;
          clientY = 0;
        }
      } else {
        if (e.touches && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = 0;
          clientY = 0;
        }
      }
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Round coordinates to ensure pixel-perfect positioning on high-DPI screens
    return {
      x: Math.round(clientX - rect.left),
      y: Math.round(clientY - rect.top),
    };
  }

  /**
   * Handles pointer down event, switching between pen and fill tools.
   * @param {MouseEvent|TouchEvent} e - The pointer event
   * @returns {void}
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
   * Begins a drawing stroke.
   * @param {MouseEvent|TouchEvent} e - The pointer event
   * @returns {void}
   */
  handleDrawStart(e) {
    this.drawing = true;
    this.lastPos = this.getPointerPosition(e);
  }

  /**
   * Handles pointer movement while drawing, draws lines as the pointer moves.
   * @param {MouseEvent|TouchEvent} e - The pointer event
   * @returns {void}
   */
  handleDrawMove(e) {
    if (!this.drawing) return;

    e.preventDefault();
    const currentPos = this.getPointerPosition(e);

    this.drawLine(this.lastPos, currentPos);
    this.lastPos = currentPos;
  }

  /**
   * Ends a drawing stroke and saves the current canvas state for undo/redo.
   * @returns {void}
   */
  handleDrawEnd() {
    if (this.drawing) {
      this.drawing = false;
      // Copy the visible canvas to the offscreen canvas
      this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.offscreenCtx.drawImage(this.visibleCanvas, 0, 0);
      this.history.saveState(this.offscreenCanvas.toDataURL());
      this.updateUI();
    }
  }

  /**
   * Draws a line between two points with current brush settings.
   * @param {{x: number, y: number}} from - The starting point
   * @param {{x: number, y: number}} to - The ending point
   * @returns {void}
   */
  drawLine(from, to) {
    this.configureBrushSettings();
    this.drawLineSegment(from, to);
  }

  /**
   * Configures the canvas context with current brush settings, ensuring optimal rendering on high-DPI screens.
   * @returns {void}
   */
  configureBrushSettings() {
    this.visibleCtx.strokeStyle = this.colorPicker.value;
    // Ensure minimum line width for visibility on high-DPI screens
    const baseLineWidth = Number(this.sizePicker.value);
    const minLineWidth = 0.5; // Minimum width to ensure visibility
    this.visibleCtx.lineWidth = Math.max(baseLineWidth, minLineWidth);
    this.visibleCtx.lineCap = "round";
    this.visibleCtx.lineJoin = "round";
  }

  /**
   * Draws a single line segment between two points.
   * @param {{x: number, y: number}} from - The starting point
   * @param {{x: number, y: number}} to - The ending point
   * @returns {void}
   */
  drawLineSegment(from, to) {
    this.visibleCtx.beginPath();
    this.visibleCtx.moveTo(from.x, from.y);
    this.visibleCtx.lineTo(to.x, to.y);
    this.visibleCtx.stroke();
  }

  /**
   * Selects the pen tool for freehand drawing.
   * @returns {void}
   */
  selectPenTool() {
    this.currentTool = "pen";
    this.penBtn.classList.add("active");
    this.fillBtn.classList.remove("active");
    this.visibleCanvas.style.cursor = "default";
  }

  /**
   * Selects the fill tool for flood fill operations.
   * @returns {void}
   */
  selectFillTool() {
    this.currentTool = "fill";
    this.fillBtn.classList.add("active");
    this.penBtn.classList.remove("active");
    this.visibleCanvas.style.cursor = "crosshair";
  }

  /**
   * Handles the fill tool operation at a specific position.
   * @param {{x: number, y: number}} pos - The position to fill
   * @returns {void}
   */
  handleFill(pos) {
    const fillPosition = this.convertPositionToPixelCoordinates(pos);
    const targetColor = this.getPixelColor(fillPosition.x, fillPosition.y);
    const fillColor = this.hexToRgba(this.colorPicker.value);
    // Use a small tolerance for anti-aliased edges and transparent pixels
    const tolerance = 1;

    if (this.shouldSkipFill(targetColor, fillColor, tolerance)) {
      return;
    }

    this.performFillOperation(fillPosition, targetColor, fillColor, tolerance);
  }

  /**
   * Converts screen position to pixel co-ordinates accounting for device pixel ratio.
   * @param {{x: number, y: number}} pos - The screen position
   * @returns {{x: number, y: number}} The pixel co-ordinates
   */
  convertPositionToPixelCoordinates(pos) {
    return {
      x: Math.floor(pos.x * this.dpr),
      y: Math.floor(pos.y * this.dpr),
    };
  }

  /**
   * Determines if fill operation should be skipped (when colours are the same).
   * @param {{r: number, g: number, b: number, a: number}} targetColor - The target colour
   * @param {{r: number, g: number, b: number, a: number}} fillColor - The fill colour
   * @param {number} [tolerance=0] - The tolerance for colour differences
   * @returns {boolean}
   */
  shouldSkipFill(targetColor, fillColor, tolerance = 0) {
    return this.colorsEqual(targetColor, fillColor, tolerance);
  }

  /**
   * Performs the complete fill operation and updates history.
   * @param {{x: number, y: number}} position - The fill position
   * @param {{r: number, g: number, b: number, a: number}} targetColor - The target colour
   * @param {{r: number, g: number, b: number, a: number}} fillColor - The fill colour
   * @param {number} [tolerance=0] - The tolerance for colour differences
   * @returns {void}
   */
  performFillOperation(position, targetColor, fillColor, tolerance = 0) {
    this.floodFill(position.x, position.y, targetColor, fillColor, tolerance);
    // Copy the visible canvas to the offscreen canvas after fill
    this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.offscreenCtx.drawImage(this.visibleCanvas, 0, 0);
    this.history.saveState(this.offscreenCanvas.toDataURL());
    this.updateUI();
  }

  /**
   * Retrieves the RGBA colour of a pixel at (x, y) on the canvas.
   * @param {number} x - The x co-ordinate
   * @param {number} y - The y co-ordinate
   * @returns {{r: number, g: number, b: number, a: number}} The pixel colour
   */
  getPixelColor(x, y) {
    const imageData = this.visibleCtx.getImageData(x, y, 1, 1);
    const data = imageData.data;
    return {
      r: data[0],
      g: data[1],
      b: data[2],
      a: data[3],
    };
  }

  /**
   * Converts a hex colour string to an RGBA object.
   * @param {string} hex - The hex colour string
   * @returns {{r: number, g: number, b: number, a: number}} The RGBA colour
   */
  hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, a: 255 };
  }

  /**
   * Compares two RGBA colour objects for equality with tolerance for transparent pixels.
   * @param {{r: number, g: number, b: number, a: number}} color1 - The first colour
   * @param {{r: number, g: number, b: number, a: number}} color2 - The second colour
   * @param {number} [tolerance=0] - The tolerance for colour differences (0-255)
   * @returns {boolean}
   */
  colorsEqual(color1, color2, tolerance = 0) {
    // If both colours are fully transparent, consider them equal regardless of RGB
    if (color1.a === 0 && color2.a === 0) {
      return true;
    }

    // If one is transparent and the other isn't, they're different
    if ((color1.a === 0) !== (color2.a === 0)) {
      return false;
    }

    // For non-transparent pixels, check all channels with tolerance
    return (
      Math.abs(color1.r - color2.r) <= tolerance &&
      Math.abs(color1.g - color2.g) <= tolerance &&
      Math.abs(color1.b - color2.b) <= tolerance &&
      Math.abs(color1.a - color2.a) <= tolerance
    );
  }

  /**
   * Performs flood fill algorithm to fill an area with the same colour.
   * @param {number} startX - The starting x co-ordinate
   * @param {number} startY - The starting y co-ordinate
   * @param {{r: number, g: number, b: number, a: number}} targetColor - The target colour
   * @param {{r: number, g: number, b: number, a: number}} fillColor - The fill colour
   * @param {number} [tolerance=0] - The tolerance for colour differences
   * @returns {void}
   */
  floodFill(startX, startY, targetColor, fillColor, tolerance = 0) {
    const imageData = this.getCanvasImageData();
    const fillArea = this.createFillArea(
      startX,
      startY,
      targetColor,
      fillColor,
      imageData,
      tolerance
    );
    this.applyFillToCanvas(imageData);
  }

  /**
   * Gets the complete image data from the canvas.
   * @returns {ImageData}
   */
  getCanvasImageData() {
    return this.visibleCtx.getImageData(
      0,
      0,
      this.visibleCanvas.width,
      this.visibleCanvas.height
    );
  }

  /**
   * Creates the filled area using a stack-based flood fill algorithm.
   * Delegates stack processing and pixel checks to helper methods for clarity.
   * @param {number} startX - The starting x co-ordinate
   * @param {number} startY - The starting y co-ordinate
   * @param {{r: number, g: number, b: number, a: number}} targetColor - The target colour
   * @param {{r: number, g: number, b: number, a: number}} fillColor - The fill colour
   * @param {ImageData} imageData - The image data
   * @param {number} [tolerance=0] - The tolerance for colour differences
   * @returns {void}
   */
  createFillArea(
    startX,
    startY,
    targetColor,
    fillColor,
    imageData,
    tolerance = 0
  ) {
    const stack = [{ x: startX, y: startY }];
    const data = imageData.data;
    const { width, height } = this.visibleCanvas;
    this.processFillStack(
      stack,
      data,
      width,
      height,
      targetColor,
      fillColor,
      tolerance
    );
  }

  /**
   * Processes the stack for the flood fill, filling pixels as appropriate.
   * @param {Array<{x: number, y: number}>} stack - The stack of pixels
   * @param {Uint8ClampedArray} data - The image data array
   * @param {number} width - The canvas width
   * @param {number} height - The canvas height
   * @param {{r: number, g: number, b: number, a: number}} targetColor - The target colour
   * @param {{r: number, g: number, b: number, a: number}} fillColor - The fill colour
   * @param {number} [tolerance=0] - The tolerance for colour differences
   * @returns {void}
   */
  processFillStack(
    stack,
    data,
    width,
    height,
    targetColor,
    fillColor,
    tolerance = 0
  ) {
    while (stack.length > 0) {
      const currentPixel = stack.pop();
      if (
        !this.shouldFillPixel(
          currentPixel,
          width,
          height,
          data,
          targetColor,
          tolerance
        )
      ) {
        continue;
      }
      this.fillPixel(currentPixel, data, width, fillColor);
      this.addNeighboringPixelsToStack(currentPixel, stack);
    }
  }

  /**
   * Determines if a pixel is within bounds and matches the target colour.
   * @param {{x: number, y: number}} pixel - The pixel
   * @param {number} width - The canvas width
   * @param {number} height - The canvas height
   * @param {Uint8ClampedArray} data - The image data array
   * @param {{r: number, g: number, b: number, a: number}} targetColor - The target colour
   * @param {number} [tolerance=0] - The tolerance for colour differences
   * @returns {boolean}
   */
  shouldFillPixel(pixel, width, height, data, targetColor, tolerance = 0) {
    if (this.isPixelOutOfBounds(pixel, width, height)) {
      return false;
    }
    const pixelColor = this.getPixelColorFromImageData(pixel, data, width);
    return this.colorsEqual(pixelColor, targetColor, tolerance);
  }

  /**
   * Fills a single pixel with the specified fill colour.
   * @param {{x: number, y: number}} pixel - The pixel
   * @param {Uint8ClampedArray} data - The image data array
   * @param {number} width - The canvas width
   * @param {{r: number, g: number, b: number, a: number}} fillColor - The fill colour
   * @returns {void}
   */
  fillPixel(pixel, data, width, fillColor) {
    this.setPixelColor(pixel, fillColor, data, width);
  }

  /**
   * Checks if a pixel co-ordinate is outside the canvas boundaries.
   * @param {{x: number, y: number}} pixel - The pixel
   * @param {number} width - The canvas width
   * @param {number} height - The canvas height
   * @returns {boolean}
   */
  isPixelOutOfBounds(pixel, width, height) {
    return pixel.x < 0 || pixel.x >= width || pixel.y < 0 || pixel.y >= height;
  }

  /**
   * Gets the colour of a specific pixel from image data.
   * @param {{x: number, y: number}} pixel - The pixel
   * @param {Uint8ClampedArray} data - The image data array
   * @param {number} width - The canvas width
   * @returns {{r: number, g: number, b: number, a: number}} The pixel colour
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
   * Sets the colour of a specific pixel in the image data.
   * @param {{x: number, y: number}} pixel - The pixel
   * @param {{r: number, g: number, b: number, a: number}} color - The colour
   * @param {Uint8ClampedArray} data - The image data array
   * @param {number} width - The canvas width
   * @returns {void}
   */
  setPixelColor(pixel, color, data, width) {
    const index = (pixel.y * width + pixel.x) * 4;
    data[index] = color.r;
    data[index + 1] = color.g;
    data[index + 2] = color.b;
    data[index + 3] = color.a;
  }

  /**
   * Adds the four neighbouring pixels (up, down, left, right) to the processing stack.
   * @param {{x: number, y: number}} pixel - The pixel
   * @param {Array<{x: number, y: number}>} stack - The stack of pixels
   * @returns {void}
   */
  addNeighboringPixelsToStack(pixel, stack) {
    stack.push({ x: pixel.x + 1, y: pixel.y });
    stack.push({ x: pixel.x - 1, y: pixel.y });
    stack.push({ x: pixel.x, y: pixel.y + 1 });
    stack.push({ x: pixel.x, y: pixel.y - 1 });
  }

  /**
   * Applies the modified image data back to the canvas.
   * @param {ImageData} imageData - The image data
   * @returns {void}
   */
  applyFillToCanvas(imageData) {
    this.visibleCtx.putImageData(imageData, 0, 0);
  }

  /**
   * Clears the canvas and saves the cleared state to history.
   * @returns {void}
   */
  handleClear() {
    this.visibleCtx.clearRect(
      0,
      0,
      this.visibleCanvas.width,
      this.visibleCanvas.height
    );
    this.offscreenCtx.clearRect(
      0,
      0,
      this.offscreenCanvas.width,
      this.offscreenCanvas.height
    );
    this.history.saveState(this.offscreenCanvas.toDataURL());
    this.updateUI();
  }

  /**
   * Undoes the last action, restoring the previous canvas state.
   * @returns {Promise<void>}
   */
  async handleUndo() {
    const state = this.history.undo();
    if (state) {
      await this.restoreCanvasState(state);
      this.updateUI();
    }
  }

  /**
   * Redoes the last undone action, restoring the next canvas state.
   * @returns {Promise<void>}
   */
  async handleRedo() {
    const state = this.history.redo();
    if (state) {
      await this.restoreCanvasState(state);
      this.updateUI();
    }
  }

  /**
   * Restores the offscreen and visible canvas from a data URL.
   * @param {string} dataURL - The data URL
   * @returns {Promise<void>}
   */
  restoreCanvasState(dataURL) {
    return new Promise((resolve) => {
      const img = this.createImageFromDataURL(dataURL);
      img.onload = () => {
        // Restore to offscreen canvas
        this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.offscreenCtx.clearRect(
          0,
          0,
          this.offscreenCanvas.width,
          this.offscreenCanvas.height
        );
        this.offscreenCtx.drawImage(img, 0, 0);
        // Restore to visible canvas (cropped)
        this.visibleCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.visibleCtx.clearRect(
          0,
          0,
          this.visibleCanvas.width,
          this.visibleCanvas.height
        );
        this.visibleCtx.drawImage(
          this.offscreenCanvas,
          0,
          0,
          this.visibleCanvas.width,
          this.visibleCanvas.height,
          0,
          0,
          this.visibleCanvas.width,
          this.visibleCanvas.height
        );
        this.applyDevicePixelRatioScaling();
        resolve();
      };
    });
  }

  /**
   * Creates an Image object from a data URL.
   * @param {string} dataURL - The data URL
   * @returns {HTMLImageElement}
   */
  createImageFromDataURL(dataURL) {
    const img = new Image();
    img.src = dataURL;
    return img;
  }

  /**
   * Applies device pixel ratio scaling to the canvas context.
   * @returns {void}
   */
  applyDevicePixelRatioScaling() {
    this.visibleCtx.scale(this.dpr, this.dpr);
  }

  /**
   * Updates the UI, enabling or disabling undo/redo buttons as appropriate.
   * @returns {void}
   */
  updateUI() {
    this.undoBtn.disabled = !this.history.canUndo();
    this.redoBtn.disabled = !this.history.canRedo();
  }

  /**
   * Resizes the canvas to fit the available viewport space. If the size changes, updates the visible canvas from the offscreen canvas.
   * @returns {void}
   */
  async resizeCanvas() {
    const { width, height } = this.calculateCanvasSize();
    const prevWidth = this.visibleCanvas.width;
    const prevHeight = this.visibleCanvas.height;
    const newWidth = width * this.dpr;
    const newHeight = height * this.dpr;
    const sizeChanged = prevWidth !== newWidth || prevHeight !== newHeight;
    this.setCanvasSize(width, height);
    this.setupCanvasContext();
    // If the offscreen canvas is smaller than the new size, expand it and copy old content
    if (
      newWidth > this.offscreenCanvas.width ||
      newHeight > this.offscreenCanvas.height
    ) {
      const oldOffscreen = document.createElement("canvas");
      oldOffscreen.width = this.offscreenCanvas.width;
      oldOffscreen.height = this.offscreenCanvas.height;
      oldOffscreen.getContext("2d").drawImage(this.offscreenCanvas, 0, 0);
      this.offscreenCanvas.width = Math.max(
        newWidth,
        this.offscreenCanvas.width
      );
      this.offscreenCanvas.height = Math.max(
        newHeight,
        this.offscreenCanvas.height
      );
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
      this.offscreenCtx.drawImage(oldOffscreen, 0, 0);
    }
    // Redraw the visible canvas from the offscreen canvas (cropped to fit)
    this.visibleCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.visibleCtx.clearRect(
      0,
      0,
      this.visibleCanvas.width,
      this.visibleCanvas.height
    );
    this.visibleCtx.drawImage(
      this.offscreenCanvas,
      0,
      0,
      this.visibleCanvas.width,
      this.visibleCanvas.height,
      0,
      0,
      this.visibleCanvas.width,
      this.visibleCanvas.height
    );
    this.applyDevicePixelRatioScaling();
    this.initializeHistoryIfEmpty();
  }

  /**
   * Calculates the optimal canvas size based on available viewport space.
   * @returns {{width: number, height: number}} The canvas size
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
   * Gets the heights of header and footer elements for layout calculations.
   * @returns {{headerHeight: number, footerHeight: number}}
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
   * Sets the physical and visual dimensions of the canvas and its container.
   * @param {number} width - The width
   * @param {number} height - The height
   * @returns {void}
   */
  setCanvasSize(width, height) {
    this.setContainerDimensions(width, height);
    this.setCanvasDimensions(width, height);
  }

  /**
   * Sets the dimensions of the canvas container element.
   * @param {number} width - The width
   * @param {number} height - The height
   * @returns {void}
   */
  setContainerDimensions(width, height) {
    const container = this.visibleCanvas.parentElement;
    container.style.height = `${height}px`;
    container.style.width = `${width}px`;
  }

  /**
   * Sets the canvas dimensions accounting for device pixel ratio.
   * @param {number} width - The width
   * @param {number} height - The height
   * @returns {void}
   */
  setCanvasDimensions(width, height) {
    this.visibleCanvas.width = width * this.dpr;
    this.visibleCanvas.height = height * this.dpr;
    this.visibleCanvas.style.width = `${width}px`;
    this.visibleCanvas.style.height = `${height}px`;
  }

  /**
   * Initialises the history with an empty canvas state if history is empty.
   * @returns {void}
   */
  initializeHistoryIfEmpty() {
    if (this.history.isEmpty()) {
      this.history.saveState(this.offscreenCanvas.toDataURL());
      this.updateUI();
    }
  }

  /**
   * Sets up the canvas context transformation and scaling for high-DPI screens.
   * @returns {void}
   */
  setupCanvasContext() {
    this.visibleCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.visibleCtx.scale(this.dpr, this.dpr);
  }
}

// Manages the undo/redo history for the drawing application
class HistoryManager {
  /**
   * Initialises the history manager with a maximum number of states.
   * @param {number} [maxStates=50] - The maximum number of states
   */
  constructor(maxStates = 50) {
    this.states = [];
    this.currentIndex = -1;
    this.maxStates = maxStates;
  }

  /**
   * Saves a new canvas state to the history, trimming if necessary.
   * @param {string} dataURL - The canvas state as a data URL
   * @returns {void}
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
   * Moves one step back in the history and returns the previous state.
   * @returns {string|null} The previous state or null if not available
   */
  undo() {
    if (this.canUndo()) {
      this.currentIndex--;
      return this.states[this.currentIndex];
    }
    return null;
  }

  /**
   * Moves one step forward in the history and returns the next state.
   * @returns {string|null} The next state or null if not available
   */
  redo() {
    if (this.canRedo()) {
      this.currentIndex++;
      return this.states[this.currentIndex];
    }
    return null;
  }

  /**
   * Returns true if there is a previous state to undo to.
   * @returns {boolean}
   */
  canUndo() {
    return this.currentIndex > 0;
  }

  /**
   * Returns true if there is a next state to redo to.
   * @returns {boolean}
   */
  canRedo() {
    return this.currentIndex < this.states.length - 1;
  }

  /**
   * Returns true if the history is empty.
   * @returns {boolean}
   */
  isEmpty() {
    return this.states.length === 0;
  }
}

// Instantiate the drawing application when the script loads
const drawingApp = new DrawingApp();
