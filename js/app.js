// Configuration constants for the drawing application
class DrawingConfig {
  /**
   * Returns the default configuration values for the drawing application.
   * @returns {Object} The configuration object with default values
   */
  static get DEFAULTS() {
    return {
      // History management
      HISTORY_MAX_STATES: 50,
      HISTORY_MAX_MEMORY_MB: 500,

      // State management
      STATE_SAVE_DELAY_MS: 300,

      // Drawing settings
      MIN_LINE_WIDTH: 0.5,
      FILL_TOLERANCE: 0,

      // Canvas settings
      CANVAS_PADDING: 24,
      MAX_CANVAS_SIZE: 32767,
      DEFAULT_DEVICE_PIXEL_RATIO: 1,
      SAFE_FALLBACK_CANVAS_SIZE: { width: 800, height: 600 },

      // Memory calculations
      BYTES_PER_MB: 1024 * 1024,
      MEMORY_CALCULATION_PRECISION: 100,

      // Flood fill neighbour offsets
      NEIGHBOUR_OFFSETS: [
        { x: 1, y: 0 }, // Right
        { x: -1, y: 0 }, // Left
        { x: 0, y: 1 }, // Down
        { x: 0, y: -1 }, // Up
      ],

      // DOM element IDs and configuration
      DOM_ELEMENTS: [
        {
          id: "draw-canvas",
          name: "Canvas element",
          property: "visibleCanvas",
        },
        { id: "color", name: "Colour picker", property: "colorPicker" },
        { id: "size", name: "Size picker", property: "sizePicker" },
        { id: "clear", name: "Clear button", property: "clearBtn" },
        { id: "undo", name: "Undo button", property: "undoBtn" },
        { id: "redo", name: "Redo button", property: "redoBtn" },
        { id: "save", name: "Save button", property: "saveBtn" },
        { id: "pen", name: "Pen tool button", property: "penBtn" },
        { id: "fill", name: "Fill tool button", property: "fillBtn" },
      ],
    };
  }
}

// Main class for the drawing application, coordinating between specialised manager classes
class DrawingApp {
  /**
   * Initialises the drawing application, sets up DOM references, and instantiates manager classes.
   * @constructor
   */
  constructor() {
    /** Validate and get DOM references with proper error handling */
    this.validateAndSetupDOMElements();
    this.visibleCtx = this.visibleCanvas.getContext("2d");

    this.drawing = false;
    this.lastPos = { x: 0, y: 0 };
    this.dpr =
      window.devicePixelRatio ||
      DrawingConfig.DEFAULTS.DEFAULT_DEVICE_PIXEL_RATIO;

    /** Canvas manager for canvas operations */
    this.canvasManager = new CanvasManager(this.visibleCanvas, this.dpr);

    /** Event handler for DOM event management */
    this.eventHandler = new EventHandler(this);

    /** Flood fill engine for fill operations */
    this.floodFillEngine = new FloodFillEngine();

    /** Drawing engine for line and fill operations */
    this.drawingEngine = new DrawingEngine(
      this,
      this.canvasManager,
      this.floodFillEngine,
      this.colorPicker,
      this.sizePicker,
      this.visibleCtx,
      this.visibleCanvas
    );

    /** Tool manager for tool selection and UI updates */
    this.toolManager = new ToolManager(
      this,
      this.penBtn,
      this.fillBtn,
      this.visibleCanvas
    );

    this.history = new HistoryManager();

    /** State manager for state saving and history coordination */
    this.stateManager = new StateManager(
      this,
      this.canvasManager,
      this.history,
      this.undoBtn,
      this.redoBtn
    );

    this.init();
  }

  /**
   * Validates that all required DOM elements exist and sets up references.
   * Throws descriptive errors if any required elements are missing.
   * @returns {void}
   * @throws {Error} If any required DOM element is not found
   */
  validateAndSetupDOMElements() {
    const requiredElements = this.getRequiredDOMElements();
    this.validateDOMElements(requiredElements);
    this.setupDOMReferences(requiredElements);
    this.validateCanvasContext();
  }

  /**
   * Returns the configuration of required DOM elements.
   * @returns {Array<{id: string, name: string, property: string}>}
   */
  getRequiredDOMElements() {
    return DrawingConfig.DEFAULTS.DOM_ELEMENTS;
  }

  /**
   * Validates that all required DOM elements exist.
   * @param {Array<{id: string, name: string, property: string}>} elements - The elements to validate
   * @returns {void}
   * @throws {Error} If any required DOM element is not found
   */
  validateDOMElements(elements) {
    const missingElements = [];

    /** Check each required element and collect any missing ones */
    for (const element of elements) {
      const domElement = document.getElementById(element.id);
      if (!domElement) {
        missingElements.push(`${element.name} (ID: "${element.id}")`);
      }
    }

    /** If any elements are missing, throw a descriptive error */
    if (missingElements.length > 0) {
      const errorMessage =
        this.createMissingElementsErrorMessage(missingElements);
      throw new Error(errorMessage);
    }
  }

  /**
   * Creates a descriptive error message for missing DOM elements.
   * @param {string[]} missingElements - Array of missing element descriptions
   * @returns {string} The error message
   */
  createMissingElementsErrorMessage(missingElements) {
    return `Drawing application cannot initialise. Missing required DOM elements:\n${missingElements.join(
      "\n"
    )}`;
  }

  /**
   * Sets up references to DOM elements.
   * @param {Array<{id: string, name: string, property: string}>} elements - The elements to reference
   * @returns {void}
   */
  setupDOMReferences(elements) {
    for (const element of elements) {
      this[element.property] = document.getElementById(element.id);
    }
  }

  /**
   * Validates that the canvas context is available.
   * @returns {void}
   * @throws {Error} If the canvas context cannot be obtained
   */
  validateCanvasContext() {
    /** Validate that canvas context is available */
    const tempCtx = this.visibleCanvas.getContext("2d");
    if (!tempCtx) {
      throw new Error("Failed to get 2D context for main canvas element");
    }
  }

  /**
   * Validates numeric input parameters with range checking.
   * @param {number} value - The value to validate
   * @param {string} paramName - The parameter name for error messages
   * @param {number} [min=0] - Minimum allowed value
   * @param {number} [max=Infinity] - Maximum allowed value
   * @returns {number} The validated value
   * @throws {Error} If validation fails
   */
  validateNumericInput(value, paramName, min = 0, max = Infinity) {
    if (typeof value !== "number" || isNaN(value)) {
      throw new Error(`${paramName} must be a valid number`);
    }
    if (value < min || value > max) {
      throw new Error(`${paramName} must be between ${min} and ${max}`);
    }
    return value;
  }

  /**
   * Validates brush size input ensuring it meets application requirements.
   * @param {number} size - The brush size to validate
   * @returns {number} The validated brush size
   * @throws {Error} If brush size is invalid
   */
  validateBrushSize(size) {
    return this.validateNumericInput(
      size,
      "Brush size",
      DrawingConfig.DEFAULTS.MIN_LINE_WIDTH,
      1000 // Maximum reasonable brush size
    );
  }

  /**
   * Validates canvas dimensions ensuring they meet browser limitations.
   * @param {number} width - The canvas width to validate
   * @param {number} height - The canvas height to validate
   * @returns {{width: number, height: number}} The validated dimensions
   * @throws {Error} If dimensions are invalid
   */
  validateCanvasDimensions(width, height) {
    const validatedWidth = this.validateNumericInput(
      width,
      "Canvas width",
      1,
      DrawingConfig.DEFAULTS.MAX_CANVAS_SIZE
    );
    const validatedHeight = this.validateNumericInput(
      height,
      "Canvas height",
      1,
      DrawingConfig.DEFAULTS.MAX_CANVAS_SIZE
    );
    return { width: validatedWidth, height: validatedHeight };
  }

  /**
   * Validates colour values ensuring they are in proper hex format.
   * @param {string} colour - The colour value to validate
   * @returns {string} The validated colour value
   * @throws {Error} If colour format is invalid
   */
  validateColour(colour) {
    if (typeof colour !== "string") {
      throw new Error("Colour must be a string");
    }

    // Allow various colour formats and normalize them
    const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    const rgbPattern = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
    const namedColours = [
      "black",
      "white",
      "red",
      "green",
      "blue",
      "yellow",
      "cyan",
      "magenta",
    ];

    // If it's already a valid hex colour, return it
    if (hexPattern.test(colour)) {
      return colour;
    }

    // If it's a valid RGB colour, allow it (browser will handle it)
    if (rgbPattern.test(colour)) {
      return colour;
    }

    // If it's a named colour, allow it
    if (namedColours.includes(colour.toLowerCase())) {
      return colour;
    }

    // Try to add # if it's missing and looks like hex
    if (/^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(colour)) {
      return "#" + colour;
    }

    throw new Error(
      "Colour must be in valid format (e.g., #ff0000, #f00, rgb(255,0,0), or named colour)"
    );
  }

  /**
   * Handles errors gracefully and provides user feedback.
   * @param {Error} error - The error to handle
   * @param {string} context - The context where the error occurred
   * @returns {void}
   */
  handleError(error, context) {
    console.error(`Error in ${context}:`, error);

    // Log the full error stack for debugging
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }

    // Attempt recovery based on context
    this.attemptErrorRecovery(context);

    // Could show user-friendly notification in the future
    // this.showUserNotification(`Something went wrong: ${error.message}`);
  }

  /**
   * Attempts to recover from errors based on the context.
   * @param {string} context - The context where the error occurred
   * @returns {void}
   */
  attemptErrorRecovery(context) {
    try {
      switch (context) {
        case "drawing":
          if (this.drawing) {
            this.handleDrawEnd();
          }
          break;
        case "tool-switching":
          // Ensure any pending saves are completed
          this.stateManager.ensureStateSaved();
          break;
        case "canvas-resize":
          // Reset canvas to a safe size
          const safeSize = DrawingConfig.DEFAULTS.SAFE_FALLBACK_CANVAS_SIZE;
          this.canvasManager.resizeCanvas(safeSize.width, safeSize.height);
          break;
        case "state-management":
          // Clear any pending operations
          if (this.stateManager.stateSaveTimeout) {
            clearTimeout(this.stateManager.stateSaveTimeout);
            this.stateManager.stateSaveTimeout = null;
          }
          break;
        default:
          console.warn(`No recovery strategy for context: ${context}`);
      }
    } catch (recoveryError) {
      console.error(`Recovery failed for ${context}:`, recoveryError);
    }
  }

  /**
   * Initialises event listeners and resizes the canvas on load.
   * @returns {void}
   */
  init() {
    this.eventHandler.setupAllEventListeners();
    this.resizeCanvas();
  }

  /**
   * Handles the save button click, ensuring any pending saves are completed before prompting the user to download the canvas as a PNG file.
   * The filename is in the format Draw_YYYY_MM_DD_HH_MM_SS.png.
   * @returns {void}
   */
  handleSave() {
    /** Ensure any pending saves are completed before downloading */
    this.ensureStateSaved();

    const filename = this.generateTimestampedFilename();
    const dataURL = this.canvasManager.offscreenCanvas.toDataURL("image/png");
    this.downloadDataURL(dataURL, filename);
  }

  /**
   * Generates a timestamped filename for canvas exports.
   * @returns {string} The filename in format "Draw_YYYY_MM_DD_HH_MM_SS.png"
   */
  generateTimestampedFilename() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const timestamp = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(
      now.getDate()
    )}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(
      now.getSeconds()
    )}`;
    return `Draw_${timestamp}.png`;
  }

  /**
   * Downloads a data URL as a file.
   * @param {string} dataURL - The data URL to download
   * @param {string} filename - The filename for the download
   * @returns {void}
   */
  downloadDataURL(dataURL, filename) {
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Handles pointer down event, switching between pen and fill tools.
   * @param {MouseEvent|TouchEvent} e - The pointer event
   * @returns {void}
   */
  handlePointerDown(e) {
    try {
      const pos = this.eventHandler.getPointerPosition(e);

      if (this.toolManager.getCurrentTool() === "fill") {
        this.handleFill(pos);
      } else {
        this.handleDrawStart(e);
      }
    } catch (error) {
      this.handleError(error, "drawing");
    }
  }

  /**
   * Begins a drawing stroke.
   * @param {MouseEvent|TouchEvent} e - The pointer event
   * @returns {void}
   */
  handleDrawStart(e) {
    this.drawing = true;
    this.lastPos = this.eventHandler.getPointerPosition(e);
  }

  /**
   * Handles pointer movement while drawing, draws lines as the pointer moves.
   * @param {MouseEvent|TouchEvent} e - The pointer event
   * @returns {void}
   */
  handleDrawMove(e) {
    if (!this.drawing) return;

    try {
      e.preventDefault();
      const currentPos = this.eventHandler.getPointerPosition(e);

      this.drawLine(this.lastPos, currentPos);
      this.lastPos = currentPos;
    } catch (error) {
      this.handleError(error, "drawing");
    }
  }

  /**
   * Schedules a canvas state save with debouncing for drawing operations.
   * Immediate saves for discrete actions, debounced saves for continuous drawing.
   * @param {boolean} [immediate=false] - Whether to save immediately or use debouncing
   * @returns {void}
   */
  scheduleStateSave(immediate = false) {
    try {
      this.stateManager.scheduleStateSave(immediate);
    } catch (error) {
      this.handleError(error, "state-management");
    }
  }

  /**
   * Immediately saves the current canvas state to history and updates UI.
   * @returns {void}
   */
  saveCanvasStateNow() {
    this.stateManager.saveCanvasStateNow();
  }

  /**
   * Ensures any pending state save is completed immediately.
   * Used when switching tools or performing discrete actions.
   * @returns {void}
   */
  ensureStateSaved() {
    this.stateManager.ensureStateSaved();
  }

  /**
   * Ends a drawing stroke and schedules a debounced state save.
   * @returns {void}
   */
  handleDrawEnd() {
    if (this.drawing) {
      this.drawing = false;
      /** Use debounced save for drawing strokes */
      this.scheduleStateSave(false);
    }
  }

  /**
   * Draws a line between two points with current brush settings.
   * @param {{x: number, y: number}} from - The starting point
   * @param {{x: number, y: number}} to - The ending point
   * @returns {void}
   */
  drawLine(from, to) {
    this.drawingEngine.drawLine(from, to);
  }

  /**
   * Selects the pen tool for freehand drawing, ensuring any pending saves are completed first.
   * @returns {void}
   */
  selectPenTool() {
    try {
      this.toolManager.selectPenTool();
    } catch (error) {
      this.handleError(error, "tool-switching");
    }
  }

  /**
   * Selects the fill tool for flood fill operations, ensuring any pending saves are completed first.
   * @returns {void}
   */
  selectFillTool() {
    this.toolManager.selectFillTool();
  }

  /**
   * Handles the fill tool operation at a specific position.
   * @param {{x: number, y: number}} pos - The position to fill
   * @returns {void}
   */
  handleFill(pos) {
    this.drawingEngine.performFill(pos, this.dpr);
  }

  /**
   * Clears the canvas and immediately saves the cleared state to history.
   * @returns {void}
   */
  handleClear() {
    this.canvasManager.clearCanvas();
    /** Use immediate save for discrete clear actions */
    this.scheduleStateSave(true);
  }

  /**
   * Undoes the last action, ensuring any pending saves are completed before restoring the previous canvas state.
   * @returns {Promise<void>}
   */
  async handleUndo() {
    await this.stateManager.performUndo();
  }

  /**
   * Redoes the last undone action, ensuring any pending saves are completed before restoring the next canvas state.
   * @returns {Promise<void>}
   */
  async handleRedo() {
    await this.stateManager.performRedo();
  }

  /**
   * Resizes the canvas to fit the available viewport space, ensuring state is saved and initialized.
   * @returns {Promise<void>}
   */
  async resizeCanvas() {
    try {
      // Ensure any pending saves are completed before resizing
      this.ensureStateSaved();

      // Delegate canvas resizing to canvas manager
      await this.canvasManager.resizeCanvas();

      this.stateManager.initializeHistoryIfEmpty();
    } catch (error) {
      this.handleError(error, "canvas-resize");
    }
  }

  /**
   * Initialises the history with an empty canvas state if history is empty, using immediate save.
   * @returns {void}
   */
  initializeHistoryIfEmpty() {
    this.stateManager.initializeHistoryIfEmpty();
  }
}

// Manages the undo/redo history for the drawing application
class HistoryManager {
  /**
   * Initialises the history manager with a maximum number of states.
   * @param {number} [maxStates] - The maximum number of states
   */
  constructor(maxStates = DrawingConfig.DEFAULTS.HISTORY_MAX_STATES) {
    this.states = [];
    this.currentIndex = -1;
    this.maxStates = maxStates;
    this.memoryUsage = 0;
    /** @type {number} Maximum memory usage in bytes for storing canvas states */
    this.maxMemoryUsage =
      DrawingConfig.DEFAULTS.HISTORY_MAX_MEMORY_MB *
      DrawingConfig.DEFAULTS.BYTES_PER_MB;
  }

  /**
   * Saves a new canvas state to the history, trimming if necessary.
   * @param {ImageData} imageData - The canvas state as ImageData
   * @returns {void}
   */
  saveState(imageData) {
    // Handle branching history (when user draws after undo)
    if (this.currentIndex < this.states.length - 1) {
      const removedStates = this.states.splice(this.currentIndex + 1);
      removedStates.forEach((state) => {
        this.memoryUsage -= this.calculateImageDataSize(state);
      });
    }

    // Calculate size of new state
    const stateSize = this.calculateImageDataSize(imageData);

    // Check memory limit and trim if necessary
    if (this.memoryUsage + stateSize > this.maxMemoryUsage) {
      this.trimOldStates(stateSize);
    }

    // Add new state
    this.states.push(imageData);
    this.currentIndex++;
    this.memoryUsage += stateSize;

    // Only enforce maxStates if we're not already memory-limited
    // This prevents unnecessary trimming when memory is the real constraint
    const estimatedMaxStatesByMemory = Math.floor(
      this.maxMemoryUsage / stateSize
    );
    const effectiveMaxStates = Math.min(
      this.maxStates,
      Math.max(10, estimatedMaxStatesByMemory)
    );

    if (this.states.length > effectiveMaxStates) {
      const removedState = this.states.shift();
      this.memoryUsage -= this.calculateImageDataSize(removedState);
      this.currentIndex--;
    }
  }

  /**
   * Calculates the approximate memory usage of ImageData in bytes.
   * @param {ImageData} imageData - The ImageData object
   * @returns {number} Memory usage in bytes
   */
  calculateImageDataSize(imageData) {
    /** ImageData uses 4 bytes per pixel (RGBA) */
    return imageData.data.length;
  }

  /**
   * Trims old states to make room for new state.
   * @param {number} requiredSize - Size needed for new state
   * @returns {void}
   */
  trimOldStates(requiredSize) {
    /** Keep at least 2 states for undo functionality */
    while (
      this.states.length > 2 &&
      this.memoryUsage + requiredSize > this.maxMemoryUsage
    ) {
      const removedState = this.states.shift();
      this.memoryUsage -= this.calculateImageDataSize(removedState);
      this.currentIndex--;
    }
  }

  /**
   * Moves one step back in the history and returns the previous state.
   * @returns {ImageData|null} The previous state or null if not available
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
   * @returns {ImageData|null} The next state or null if not available
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

  /**
   * Gets current memory usage in MB.
   * @returns {number} Memory usage in MB
   */
  getMemoryUsageMB() {
    return (
      Math.round(
        (this.memoryUsage / DrawingConfig.DEFAULTS.BYTES_PER_MB) *
          DrawingConfig.DEFAULTS.MEMORY_CALCULATION_PRECISION
      ) / DrawingConfig.DEFAULTS.MEMORY_CALCULATION_PRECISION
    );
  }
}

// Manages tool selection and tool-specific behaviours
class ToolManager {
  /**
   * Initialises the tool manager with required UI elements.
   * @param {Object} drawingApp - The main drawing app instance
   * @param {HTMLElement} penBtn - The pen tool button
   * @param {HTMLElement} fillBtn - The fill tool button
   * @param {HTMLCanvasElement} visibleCanvas - The visible canvas element
   */
  constructor(drawingApp, penBtn, fillBtn, visibleCanvas) {
    this.drawingApp = drawingApp;
    this.penBtn = penBtn;
    this.fillBtn = fillBtn;
    this.visibleCanvas = visibleCanvas;
    this.currentTool = "pen";
  }

  /**
   * Selects the pen tool for freehand drawing, ensuring any pending saves are completed first.
   * @returns {void}
   */
  selectPenTool() {
    /** Ensure any pending saves are completed before switching tools */
    this.drawingApp.ensureStateSaved();

    this.currentTool = "pen";
    this.penBtn.classList.add("active");
    this.fillBtn.classList.remove("active");
    this.visibleCanvas.style.cursor = "default";
  }

  /**
   * Selects the fill tool for flood fill operations, ensuring any pending saves are completed first.
   * @returns {void}
   */
  selectFillTool() {
    /** Ensure any pending saves are completed before switching tools */
    this.drawingApp.ensureStateSaved();

    this.currentTool = "fill";
    this.fillBtn.classList.add("active");
    this.penBtn.classList.remove("active");
    this.visibleCanvas.style.cursor = "crosshair";
  }

  /**
   * Gets the currently selected tool.
   * @returns {string} The current tool name
   */
  getCurrentTool() {
    return this.currentTool;
  }

  /**
   * Selects a tool by name.
   * @param {string} toolName - The tool name ('pen' or 'fill')
   * @returns {void}
   */
  selectTool(toolName) {
    switch (toolName) {
      case "pen":
        this.selectPenTool();
        break;
      case "fill":
        this.selectFillTool();
        break;
      default:
        console.warn(`Unknown tool: ${toolName}`);
    }
  }
}

// Coordinates state saving/loading between CanvasManager and HistoryManager
class StateManager {
  /**
   * Initialises the state manager with required dependencies.
   * @param {Object} drawingApp - The main drawing app instance
   * @param {CanvasManager} canvasManager - The canvas manager
   * @param {HistoryManager} historyManager - The history manager
   * @param {HTMLElement} undoBtn - The undo button
   * @param {HTMLElement} redoBtn - The redo button
   */
  constructor(drawingApp, canvasManager, historyManager, undoBtn, redoBtn) {
    this.drawingApp = drawingApp;
    this.canvasManager = canvasManager;
    this.historyManager = historyManager;
    this.undoBtn = undoBtn;
    this.redoBtn = redoBtn;

    /** State saving optimisation properties */
    this.pendingStateSave = false;
    this.stateSaveTimeout = null;
    /** @type {number} Delay in milliseconds for debouncing state saves to prevent excessive history entries */
    this.stateSaveDelay = DrawingConfig.DEFAULTS.STATE_SAVE_DELAY_MS;

    /** UI state tracking for optimised updates */
    this.lastUndoState = null;
    this.lastRedoState = null;
  }

  /**
   * Schedules a state save with optional debouncing to optimise performance during continuous drawing.
   * Immediate saves for discrete actions, debounced saves for continuous drawing.
   * @param {boolean} [immediate=false] - Whether to save immediately or use debouncing
   * @returns {void}
   */
  scheduleStateSave(immediate = false) {
    if (immediate) {
      this.saveCanvasStateNow();
      return;
    }

    /** Cancel any pending save */
    if (this.stateSaveTimeout) {
      clearTimeout(this.stateSaveTimeout);
    }

    this.pendingStateSave = true;
    this.stateSaveTimeout = setTimeout(() => {
      this.saveCanvasStateNow();
    }, this.stateSaveDelay);
  }

  /**
   * Immediately saves the current canvas state to history and updates UI.
   * @returns {void}
   */
  saveCanvasStateNow() {
    if (this.stateSaveTimeout) {
      clearTimeout(this.stateSaveTimeout);
      this.stateSaveTimeout = null;
    }

    this.pendingStateSave = false;

    this.canvasManager.copyVisibleToOffscreenCanvas();

    /** Get ImageData from offscreen canvas for efficient storage */
    const imageData = this.canvasManager.offscreenCtx.getImageData(
      0,
      0,
      this.canvasManager.offscreenCanvas.width,
      this.canvasManager.offscreenCanvas.height
    );

    /** Save state to history */
    this.historyManager.saveState(imageData);
    this.updateUI();
  }

  /**
   * Ensures any pending state save is completed immediately.
   * Used when switching tools or performing discrete actions.
   * @returns {void}
   */
  ensureStateSaved() {
    if (this.pendingStateSave) {
      this.saveCanvasStateNow();
    }
  }

  /**
   * Undoes the last action, ensuring any pending saves are completed before restoring the previous canvas state.
   * @returns {Promise<void>}
   */
  async performUndo() {
    this.clearPendingStateSaves();

    const state = this.historyManager.undo();
    if (state) {
      await this.restoreCanvasState(state);
      this.updateUI();
    }
  }

  /**
   * Redoes the last undone action, ensuring any pending saves are completed before restoring the next canvas state.
   * @returns {Promise<void>}
   */
  async performRedo() {
    this.clearPendingStateSaves();

    const state = this.historyManager.redo();
    if (state) {
      await this.restoreCanvasState(state);
      this.updateUI();
    }
  }

  /**
   * Clears any pending state saves to prevent interference with undo/redo operations.
   * @returns {void}
   */
  clearPendingStateSaves() {
    if (this.stateSaveTimeout) {
      clearTimeout(this.stateSaveTimeout);
      this.stateSaveTimeout = null;
    }
    this.pendingStateSave = false;
  }

  /**
   * Restores a canvas state from ImageData.
   * @param {ImageData} imageData - The canvas state as ImageData
   * @returns {Promise<void>}
   */
  restoreCanvasState(imageData) {
    return new Promise((resolve) => {
      this.canvasManager.clearOffscreenCanvas();
      this.canvasManager.restoreImageDataToOffscreen(imageData);
      this.canvasManager.copyOffscreenToVisibleCanvas();
      this.canvasManager.applyDevicePixelRatioScaling();
      resolve();
    });
  }

  /**
   * Updates the UI, enabling or disabling undo/redo buttons only when their state changes.
   * @returns {void}
   */
  updateUI() {
    const canUndo = this.historyManager.canUndo();
    const canRedo = this.historyManager.canRedo();

    // Only update undo button if its state has changed
    if (this.lastUndoState !== canUndo) {
      this.undoBtn.disabled = !canUndo;
      this.lastUndoState = canUndo;
    }

    // Only update redo button if its state has changed
    if (this.lastRedoState !== canRedo) {
      this.redoBtn.disabled = !canRedo;
      this.lastRedoState = canRedo;
    }
  }

  /**
   * Initialises the history with an empty canvas state if history is empty, using immediate save.
   * @returns {void}
   */
  initializeHistoryIfEmpty() {
    if (this.historyManager.isEmpty()) {
      // Use immediate save for initial state
      this.scheduleStateSave(true);
    }
  }
}

// Handles all drawing operations and coordinates with other engines
class DrawingEngine {
  /**
   * Initialises the drawing engine with required dependencies.
   * @param {Object} drawingApp - The main drawing app instance
   * @param {CanvasManager} canvasManager - The canvas manager
   * @param {FloodFillEngine} floodFillEngine - The flood fill engine
   * @param {HTMLInputElement} colorPicker - The colour picker input
   * @param {HTMLInputElement} sizePicker - The size picker input
   * @param {CanvasRenderingContext2D} visibleCtx - The visible canvas context
   * @param {HTMLCanvasElement} visibleCanvas - The visible canvas element
   */
  constructor(
    drawingApp,
    canvasManager,
    floodFillEngine,
    colorPicker,
    sizePicker,
    visibleCtx,
    visibleCanvas
  ) {
    this.drawingApp = drawingApp;
    this.canvasManager = canvasManager;
    this.floodFillEngine = floodFillEngine;
    this.colorPicker = colorPicker;
    this.sizePicker = sizePicker;
    this.visibleCtx = visibleCtx;
    this.visibleCanvas = visibleCanvas;
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
   * Validates colour and brush size inputs with graceful fallbacks for invalid values.
   * @returns {void}
   */
  configureBrushSettings() {
    try {
      // Validate and set colour with fallback
      try {
        this.visibleCtx.strokeStyle = this.drawingApp.validateColour(
          this.colorPicker.value
        );
      } catch (colourError) {
        console.warn("Invalid colour, using fallback:", colourError.message);
        this.visibleCtx.strokeStyle = this.colorPicker.value || "#000000";
      }

      /** Ensure minimum line width for visibility on high-DPI screens */
      const minLineWidth = DrawingConfig.DEFAULTS.MIN_LINE_WIDTH;

      // Validate and set brush size with fallback
      let baseLineWidth;
      try {
        baseLineWidth = this.drawingApp.validateBrushSize(
          Number(this.sizePicker.value)
        );
      } catch (sizeError) {
        console.warn("Invalid brush size, using fallback:", sizeError.message);
        baseLineWidth = Number(this.sizePicker.value) || 1;
      }

      this.visibleCtx.lineWidth = Math.max(baseLineWidth, minLineWidth);
      this.visibleCtx.lineCap = "round";
      this.visibleCtx.lineJoin = "round";
    } catch (error) {
      this.drawingApp.handleError(error, "drawing");
      // Use safe defaults if everything fails
      this.visibleCtx.strokeStyle = "#000000";
      this.visibleCtx.lineWidth = DrawingConfig.DEFAULTS.MIN_LINE_WIDTH;
      this.visibleCtx.lineCap = "round";
      this.visibleCtx.lineJoin = "round";
    }
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
   * Performs a flood fill operation at the specified position.
   * Validates inputs and uses configurable tolerance for better edge handling.
   * @param {{x: number, y: number}} pos - The position to fill
   * @param {number} dpr - The device pixel ratio
   * @returns {void}
   */
  performFill(pos, dpr) {
    const fillPosition = this.convertPositionToPixelCoordinates(pos, dpr);
    const targetColor = this.getPixelColor(fillPosition.x, fillPosition.y);
    const fillColor = this.hexToRgba(this.colorPicker.value);
    /** @type {number} Colour tolerance for fill operations (0-255), helps with anti-aliased edges */
    const tolerance = 1;

    if (this.shouldSkipFill(targetColor, fillColor, tolerance)) {
      return;
    }

    this.performFillOperation(fillPosition, targetColor, fillColor, tolerance);
  }

  /**
   * Converts screen position to pixel co-ordinates accounting for device pixel ratio.
   * @param {{x: number, y: number}} pos - The screen position
   * @param {number} dpr - The device pixel ratio
   * @returns {{x: number, y: number}} The pixel co-ordinates
   */
  convertPositionToPixelCoordinates(pos, dpr) {
    return {
      x: Math.floor(pos.x * dpr),
      y: Math.floor(pos.y * dpr),
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
    return this.floodFillEngine.colorsEqual(targetColor, fillColor, tolerance);
  }

  /**
   * Performs the complete fill operation and immediately saves state to history.
   * Uses configurable tolerance and optimised bounding box updates.
   * @param {{x: number, y: number}} position - The fill position
   * @param {{r: number, g: number, b: number, a: number}} targetColor - The target colour
   * @param {{r: number, g: number, b: number, a: number}} fillColor - The fill colour
   * @param {number} [tolerance] - The tolerance for colour differences (uses config default if not specified)
   * @returns {void}
   */
  performFillOperation(
    position,
    targetColor,
    fillColor,
    tolerance = DrawingConfig.DEFAULTS.FILL_TOLERANCE
  ) {
    // Get image data for the entire canvas
    const fullImageData = this.canvasManager.getCanvasImageData();

    // Perform flood fill using the engine
    const result = this.floodFillEngine.performFloodFill(
      fullImageData,
      position.x,
      position.y,
      targetColor,
      fillColor,
      this.visibleCanvas.width,
      this.visibleCanvas.height,
      tolerance
    );

    // Only update the affected region if bounding box is valid
    if (
      result.boundingBox.minX <= result.boundingBox.maxX &&
      result.boundingBox.minY <= result.boundingBox.maxY
    ) {
      this.floodFillEngine.applyFillToCanvasRegion(
        this.visibleCtx,
        result.imageData,
        result.boundingBox,
        this.visibleCanvas.width
      );
    }

    /** Use immediate save for discrete fill actions */
    this.drawingApp.scheduleStateSave(true);
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
}

// Implements flood fill algorithm with colour tolerance and bounding box optimisation
class FloodFillEngine {
  /**
   * Initialises the flood fill engine.
   */
  constructor() {
    // No initialization needed for this stateless engine
  }

  /**
   * Performs flood fill algorithm to fill an area with the same colour.
   * Uses bounding box optimisation to only process affected regions.
   * @param {ImageData} imageData - The image data to modify
   * @param {number} startX - The starting x co-ordinate
   * @param {number} startY - The starting y co-ordinate
   * @param {{r: number, g: number, b: number, a: number}} targetColor - The target colour
   * @param {{r: number, g: number, b: number, a: number}} fillColor - The fill colour
   * @param {number} canvasWidth - The canvas width
   * @param {number} canvasHeight - The canvas height
   * @param {number} [tolerance] - The tolerance for colour differences
   * @returns {{imageData: ImageData, boundingBox: {minX: number, maxX: number, minY: number, maxY: number}}} Modified image data and bounding box
   */
  performFloodFill(
    imageData,
    startX,
    startY,
    targetColor,
    fillColor,
    canvasWidth,
    canvasHeight,
    tolerance = DrawingConfig.DEFAULTS.FILL_TOLERANCE
  ) {
    // Initialize bounding box to track filled area
    const boundingBox = {
      minX: startX,
      maxX: startX,
      minY: startY,
      maxY: startY,
    };

    this.createFillArea(
      startX,
      startY,
      targetColor,
      fillColor,
      imageData,
      canvasWidth,
      canvasHeight,
      tolerance,
      boundingBox
    );

    return { imageData, boundingBox };
  }

  /**
   * Creates the filled area using a stack-based flood fill algorithm.
   * Delegates stack processing and pixel checks to helper methods for clarity.
   * @param {number} startX - The starting x co-ordinate
   * @param {number} startY - The starting y co-ordinate
   * @param {{r: number, g: number, b: number, a: number}} targetColor - The target colour
   * @param {{r: number, g: number, b: number, a: number}} fillColor - The fill colour
   * @param {ImageData} imageData - The image data
   * @param {number} width - The canvas width
   * @param {number} height - The canvas height
   * @param {number} [tolerance=0] - The tolerance for colour differences
   * @param {{minX: number, maxX: number, minY: number, maxY: number}} boundingBox - The bounding box to update
   * @returns {void}
   */
  createFillArea(
    startX,
    startY,
    targetColor,
    fillColor,
    imageData,
    width,
    height,
    tolerance = 0,
    boundingBox
  ) {
    const stack = [{ x: startX, y: startY }];
    const data = imageData.data;
    this.processFillStack(
      stack,
      data,
      width,
      height,
      targetColor,
      fillColor,
      tolerance,
      boundingBox
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
   * @param {{minX: number, maxX: number, minY: number, maxY: number}} boundingBox - The bounding box to update
   * @returns {void}
   */
  processFillStack(
    stack,
    data,
    width,
    height,
    targetColor,
    fillColor,
    tolerance = 0,
    boundingBox
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

      // Update bounding box
      boundingBox.minX = Math.min(boundingBox.minX, currentPixel.x);
      boundingBox.maxX = Math.max(boundingBox.maxX, currentPixel.x);
      boundingBox.minY = Math.min(boundingBox.minY, currentPixel.y);
      boundingBox.maxY = Math.max(boundingBox.maxY, currentPixel.y);

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
    DrawingConfig.DEFAULTS.NEIGHBOUR_OFFSETS.forEach((offset) => {
      stack.push({ x: pixel.x + offset.x, y: pixel.y + offset.y });
    });
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
   * Applies the modified image data back to the canvas for a specific region.
   * @param {CanvasRenderingContext2D} ctx - The canvas context
   * @param {ImageData} imageData - The image data
   * @param {{minX: number, maxX: number, minY: number, maxY: number}} boundingBox - The bounding box of the region to update
   * @param {number} canvasWidth - The canvas width
   * @returns {void}
   */
  applyFillToCanvasRegion(ctx, imageData, boundingBox, canvasWidth) {
    const regionWidth = boundingBox.maxX - boundingBox.minX + 1;
    const regionHeight = boundingBox.maxY - boundingBox.minY + 1;

    // Create a new ImageData for just the affected region
    const regionImageData = new ImageData(regionWidth, regionHeight);
    const fullData = imageData.data;
    const regionData = regionImageData.data;

    // Copy the affected region from the full image data
    for (let y = boundingBox.minY; y <= boundingBox.maxY; y++) {
      for (let x = boundingBox.minX; x <= boundingBox.maxX; x++) {
        const fullIndex = (y * canvasWidth + x) * 4;
        const regionIndex =
          ((y - boundingBox.minY) * regionWidth + (x - boundingBox.minX)) * 4;

        regionData[regionIndex] = fullData[fullIndex]; // R
        regionData[regionIndex + 1] = fullData[fullIndex + 1]; // G
        regionData[regionIndex + 2] = fullData[fullIndex + 2]; // B
        regionData[regionIndex + 3] = fullData[fullIndex + 3]; // A
      }
    }

    // Put only the affected region back to the canvas
    ctx.putImageData(regionImageData, boundingBox.minX, boundingBox.minY);
  }
}

// Manages all DOM event setup and delegation
class EventHandler {
  /**
   * Initialises the event handler with reference to the drawing application.
   * @param {DrawingApp} drawingApp - The drawing application instance
   */
  constructor(drawingApp) {
    this.drawingApp = drawingApp;
    this.visibleCanvas = drawingApp.visibleCanvas;
  }

  /**
   * Sets up all event listeners for the drawing application.
   * @returns {void}
   */
  setupAllEventListeners() {
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
      {
        event: "mousedown",
        handler: this.drawingApp.handlePointerDown.bind(this.drawingApp),
      },
      {
        event: "mousemove",
        handler: this.drawingApp.handleDrawMove.bind(this.drawingApp),
      },
      {
        event: "mouseup",
        handler: this.drawingApp.handleDrawEnd.bind(this.drawingApp),
      },
      {
        event: "mouseleave",
        handler: this.drawingApp.handleDrawEnd.bind(this.drawingApp),
      },
      {
        event: "touchstart",
        handler: this.drawingApp.handlePointerDown.bind(this.drawingApp),
        options: { passive: false },
      },
      {
        event: "touchmove",
        handler: this.drawingApp.handleDrawMove.bind(this.drawingApp),
        options: { passive: false },
      },
      {
        event: "touchend",
        handler: this.drawingApp.handleDrawEnd.bind(this.drawingApp),
      },
      {
        event: "touchcancel",
        handler: this.drawingApp.handleDrawEnd.bind(this.drawingApp),
      },
    ];
  }

  /**
   * Sets up click events for all toolbar buttons.
   * @returns {void}
   */
  setupToolbarButtonEvents() {
    this.drawingApp.clearBtn.addEventListener(
      "click",
      this.drawingApp.handleClear.bind(this.drawingApp)
    );
    this.drawingApp.undoBtn.addEventListener(
      "click",
      this.drawingApp.handleUndo.bind(this.drawingApp)
    );
    this.drawingApp.redoBtn.addEventListener(
      "click",
      this.drawingApp.handleRedo.bind(this.drawingApp)
    );
    this.drawingApp.penBtn.addEventListener(
      "click",
      this.drawingApp.selectPenTool.bind(this.drawingApp)
    );
    this.drawingApp.fillBtn.addEventListener(
      "click",
      this.drawingApp.selectFillTool.bind(this.drawingApp)
    );
    this.drawingApp.saveBtn.addEventListener(
      "click",
      this.drawingApp.handleSave.bind(this.drawingApp)
    );
  }

  /**
   * Sets up window-level events such as resize.
   * @returns {void}
   */
  setupWindowEvents() {
    window.addEventListener(
      "resize",
      this.drawingApp.resizeCanvas.bind(this.drawingApp)
    );
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
    const clientPos = this.getClientPositionFromEvent(e);
    return this.convertClientToCanvasPosition(clientPos, rect);
  }

  /**
   * Extracts client coordinates from a mouse or touch event.
   * @param {MouseEvent|TouchEvent} e - The pointer event
   * @returns {{x: number, y: number}} The client coordinates
   */
  getClientPositionFromEvent(e) {
    if (e.touches || e.changedTouches) {
      return this.getTouchPosition(e);
    } else {
      return this.getMousePosition(e);
    }
  }

  /**
   * Extracts client coordinates from a touch event.
   * @param {TouchEvent} e - The touch event
   * @returns {{x: number, y: number}} The client coordinates
   */
  getTouchPosition(e) {
    let clientX, clientY;
    if (e.type === "touchend" || e.type === "touchcancel") {
      if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        /** Fallback: no touches left, use last known position (could be undefined) */
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
    return { x: clientX, y: clientY };
  }

  /**
   * Extracts client coordinates from a mouse event.
   * @param {MouseEvent} e - The mouse event
   * @returns {{x: number, y: number}} The client coordinates
   */
  getMousePosition(e) {
    return { x: e.clientX, y: e.clientY };
  }

  /**
   * Converts client coordinates to canvas-relative coordinates.
   * @param {{x: number, y: number}} clientPos - The client coordinates
   * @param {DOMRect} rect - The canvas bounding rectangle
   * @returns {{x: number, y: number}} The canvas coordinates
   */
  convertClientToCanvasPosition(clientPos, rect) {
    /** Round coordinates to ensure pixel-perfect positioning on high-DPI screens */
    return {
      x: Math.round(clientPos.x - rect.left),
      y: Math.round(clientPos.y - rect.top),
    };
  }
}

// Manages canvas setup, sizing, and rendering operations for both visible and offscreen canvases
class CanvasManager {
  /**
   * Initialises the canvas manager with visible canvas and device pixel ratio.
   * @param {HTMLCanvasElement} visibleCanvas - The visible canvas element
   * @param {number} dpr - The device pixel ratio
   */
  constructor(visibleCanvas, dpr) {
    this.visibleCanvas = visibleCanvas;
    this.visibleCtx = this.visibleCanvas.getContext("2d");
    this.dpr = dpr;

    /** Offscreen canvas to preserve the full drawing area */
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");

    /** Validate offscreen canvas context */
    if (!this.offscreenCtx) {
      throw new Error("Failed to get 2D context for offscreen canvas");
    }
  }

  /**
   * Validates canvas dimensions to ensure they are positive and reasonable.
   * @param {number} width - The width to validate
   * @param {number} height - The height to validate
   * @returns {{width: number, height: number}} Validated dimensions
   */
  validateCanvasDimensions(width, height) {
    /** @type {number} Minimum canvas dimension in pixels */
    const minSize = 1;
    /** @type {number} Maximum canvas dimension in pixels supported by most browsers */
    const maxSize = DrawingConfig.DEFAULTS.MAX_CANVAS_SIZE;

    const validatedWidth = Math.max(
      minSize,
      Math.min(maxSize, Math.floor(width))
    );
    const validatedHeight = Math.max(
      minSize,
      Math.min(maxSize, Math.floor(height))
    );

    if (validatedWidth !== width || validatedHeight !== height) {
      console.warn(
        `Canvas dimensions adjusted from ${width}x${height} to ${validatedWidth}x${validatedHeight}`
      );
    }

    return { width: validatedWidth, height: validatedHeight };
  }

  /**
   * Calculates the optimal canvas size based on available viewport space.
   * @returns {{width: number, height: number}} The canvas size
   */
  calculateCanvasSize() {
    const { headerHeight, footerHeight } = this.getLayoutElementHeights();
    /** @type {number} Padding in pixels around the canvas for better visual spacing */
    const padding = DrawingConfig.DEFAULTS.CANVAS_PADDING;

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
   * Sets up the canvas context transformation and scaling for high-DPI screens.
   * @returns {void}
   */
  setupCanvasContext() {
    this.visibleCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.visibleCtx.scale(this.dpr, this.dpr);
  }

  /**
   * Applies device pixel ratio scaling to the canvas context.
   * @returns {void}
   */
  applyDevicePixelRatioScaling() {
    this.visibleCtx.scale(this.dpr, this.dpr);
  }

  /**
   * Copies the visible canvas content to the offscreen canvas.
   * @returns {void}
   */
  copyVisibleToOffscreenCanvas() {
    /** Copy the visible canvas to the offscreen canvas */
    this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.offscreenCtx.drawImage(this.visibleCanvas, 0, 0);
  }

  /**
   * Copies the offscreen canvas content to the visible canvas.
   * @returns {void}
   */
  copyOffscreenToVisibleCanvas() {
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
  }

  /**
   * Clears the offscreen canvas.
   * @returns {void}
   */
  clearOffscreenCanvas() {
    this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.offscreenCtx.clearRect(
      0,
      0,
      this.offscreenCanvas.width,
      this.offscreenCanvas.height
    );
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
   * Clears both visible and offscreen canvases.
   * @returns {void}
   */
  clearCanvas() {
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
  }

  /**
   * Restores ImageData to the offscreen canvas.
   * @param {ImageData} imageData - The ImageData to restore
   * @returns {void}
   */
  restoreImageDataToOffscreen(imageData) {
    this.offscreenCtx.putImageData(imageData, 0, 0);
  }

  /**
   * Resizes the canvas to fit the available viewport space and updates the visible canvas from the offscreen canvas.
   * @returns {void}
   */
  async resizeCanvas() {
    const calculatedSize = this.calculateCanvasSize();
    const validatedSize = this.validateCanvasDimensions(
      calculatedSize.width,
      calculatedSize.height
    );
    const { width, height } = validatedSize;
    const newWidth = width * this.dpr;
    const newHeight = height * this.dpr;
    this.setCanvasSize(width, height);
    this.setupCanvasContext();
    // Handle offscreen canvas sizing - initial setup or expansion
    const needsResize =
      newWidth > this.offscreenCanvas.width ||
      newHeight > this.offscreenCanvas.height ||
      this.offscreenCanvas.width === 0 ||
      this.offscreenCanvas.height === 0;

    if (needsResize) {
      // Save existing content if canvas has valid dimensions
      const hasExistingContent =
        this.offscreenCanvas.width > 0 && this.offscreenCanvas.height > 0;
      let oldOffscreen = null;

      if (hasExistingContent) {
        oldOffscreen = document.createElement("canvas");
        oldOffscreen.width = this.offscreenCanvas.width;
        oldOffscreen.height = this.offscreenCanvas.height;
        oldOffscreen.getContext("2d").drawImage(this.offscreenCanvas, 0, 0);
      }

      // Set new dimensions
      this.offscreenCanvas.width = Math.max(
        newWidth,
        this.offscreenCanvas.width
      );
      this.offscreenCanvas.height = Math.max(
        newHeight,
        this.offscreenCanvas.height
      );
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");

      // Restore existing content if there was any
      if (hasExistingContent && oldOffscreen) {
        this.offscreenCtx.drawImage(oldOffscreen, 0, 0);
      }
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
  }
}

// Instantiate the drawing application when the script loads
const drawingApp = new DrawingApp();
