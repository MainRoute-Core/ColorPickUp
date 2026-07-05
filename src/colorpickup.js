/*!
 * ColorPickUp - Modern, Grid-Optimized, and Fully Accessible Color Picker
 * Engineered for professional integration and clean responsive alignment.
 * Released under the MIT License.
 */

((window, document, Math, undefined) => {
  // Temporary canvas context used strictly for translating color strings
  const ctx = document.createElement('canvas').getContext('2d');

  // Library Internal State
  const activeColor = { r: 0, g: 0, b: 0, h: 0, s: 0, v: 0, a: 1 };
  let container, colorPicker, colorArea, colorMarker, colorPreview, colorValue,
    clearButton, closeButton, hueSlider, hueMarker, alphaSlider, alphaMarker,
    currentEl, currentFormat, previousColor, keyboardNav,
    contrastValue, contrastRating, harmonyPanel, historyPanel,
    copyButton, pasteButton, eyedropperBtn, formatSelect, paletteSelect, swatchesContainer,
    colorAreaDims = {};

  // Throttling registers for render passes
  let rafPending = false;
  let nextMarkerCoords = null;
  let hueRafPending = false;
  let alphaRafPending = false;

  // Track event listeners to prevent memory leaks on destruction
  const eventRegistry = [];

  // Preset Palettes Mapping
  const builtInPalettes = {
    tailwind: ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'],
    material: ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#4caf50', '#ffeb3b', '#ff9800'],
    adobe: ['#00a4e4', '#ff0000', '#ff8a00', '#ffcc00', '#33cc33', '#0099ff', '#9933ff', '#e6005c', '#1e1e1e', '#7a7a7a'],
    vscode: ['#007acc', '#1e1e1e', '#252526', '#3c3c3c', '#d4d4d4', '#c586c0', '#569cd6', '#4ec9b0', '#ce9178', '#b5cea8']
  };

  // Baseline Configurations
  const settings = {
    el: '[data-colorpickup]',
    parent: 'body',
    style: 'modern',             // Style Engine Profile
    theme: 'light',              // Theme Engine Profile
    animation: 'scale',          // Entry Transition Profile
    rtl: false,
    wrap: true,
    margin: 2,
    format: 'hex',
    formatToggle: true,          // Controls Format Dropdown (Row 3 Right)
    fieldMode: 'both',           // Input Display Mode: both, input, color
    swatches: [],
    swatchesOnly: false,
    alpha: true,                 // Controls Alpha Slider (Row 5)
    forceAlpha: false,
    focusInput: true,
    selectInput: false,
    inline: false,
    defaultColor: '#000000',
    clearLabel: 'Clear',
    closeLabel: 'Close',
    historyLimit: 10,
    wcagTextBackground: '#ffffff', // Background reference target for WCAG contrast Checker
    components: {
      history: true,             // Controls Recent Colors Dropdown (Row 6)
      palette: true,             // Controls Swatch Grid (Row 7)
      paletteSelector: true,     // Controls Swatch Target Dropdown (Row 7 Right)
      harmony: true,             // Controls Related Harmonies Accordion (Row 8)
      eyedropper: true,          // Controls Top Eyedropper API triggers
      copyPaste: true            // Controls Top Copy and Paste handlers
    },
    onChange: () => undefined,
    a11y: {
      open: 'Open color picker',
      close: 'Close color picker',
      clear: 'Clear selected color value',
      marker: 'Saturation: {s}%. Brightness: {v}%.',
      hueSlider: 'Hue slider controller',
      alphaSlider: 'Opacity slider controller',
      input: 'Parsed color hex text bar',
      format: 'Format output selection dropdown',
      swatch: 'Direct preset swatch selection',
      instruction: 'Saturation and brightness mapping. Adjust with navigation keys.',
      copy: 'Copy value to active clipboard',
      paste: 'Paste target color string from clipboard',
      eyedropper: 'Activate screen target color dropper'
    }
  };

  // Virtual instances runtime cache
  const instances = {};
  let currentInstanceId = '';
  let defaultInstance = {};
  let hasInstance = false;

  function getEl(id) {
    return document.getElementById(id);
  }

  /**
   * Configures parameters and updates DOM representations dynamically
   */
  function configure(options) {
    if (typeof options !== 'object') {
      return;
    }

    for (const key in options) {
      switch (key) {
        case 'el':
          bindFields(options.el);
          if (options.wrap !== false) {
            wrapFields(options.el);
          }
          break;
        case 'parent':
          container = options.parent instanceof HTMLElement ? options.parent : document.querySelector(options.parent);
          if (container && colorPicker) {
            container.appendChild(colorPicker);
            settings.parent = options.parent;
            if (container === document.body) {
              container = undefined;
            }
          }
          break;
        case 'theme':
        case 'style':
        case 'animation':
          if (options[key]) {
            settings[key] = options[key];
          }
          applyThemeAndStyle();
          break;
        case 'rtl':
          settings.rtl = !!options.rtl;
          refreshFieldsWrapping();
          break;
        case 'margin':
          const parsedMargin = parseFloat(options.margin);
          settings.margin = !isNaN(parsedMargin) ? parsedMargin : settings.margin;
          break;
        case 'wrap':
          settings.wrap = !!options.wrap;
          refreshFieldsWrapping();
          break;
        case 'fieldMode':
          settings.fieldMode = options.fieldMode;
          refreshFieldsWrapping();
          break;
        case 'formatToggle':
          settings.formatToggle = !!options.formatToggle;
          if (formatSelect) {
            if (settings.formatToggle) {
              formatSelect.style.display = '';
              colorValue.classList.remove('cpu-span-4');
            } else {
              formatSelect.style.display = 'none';
              colorValue.classList.add('cpu-span-4');
            }
          }
          break;
        case 'swatches':
          if (Array.isArray(options.swatches)) {
            settings.swatches = options.swatches.slice();
            buildSwatches(settings.swatches);
          }
          break;
        case 'swatchesOnly':
          settings.swatchesOnly = !!options.swatchesOnly;
          colorPicker.setAttribute('data-minimal', settings.swatchesOnly);
          break;
        case 'alpha':
          settings.alpha = !!options.alpha;
          const alphaRow = getEl('cpu-row-5');
          if (alphaRow) {
            alphaRow.style.display = settings.alpha ? '' : 'none';
          }
          break;
        case 'inline':
          settings.inline = !!options.inline;
          colorPicker.setAttribute('data-inline', settings.inline);
          if (settings.inline) {
            const defColor = options.defaultColor || settings.defaultColor;
            currentFormat = getColorFormatFromStr(defColor);
            updatePickerPosition();
            setColorFromStr(defColor);
          }
          break;
        case 'components':
          if (typeof options.components === 'object') {
            settings.components = { ...settings.components, ...options.components };
          }
          updateComponentsVisibility();
          break;
        case 'a11y':
          const labels = options.a11y;
          if (typeof labels === 'object') {
            for (const l in labels) {
              if (labels[l] && settings.a11y[l]) {
                settings.a11y[l] = labels[l];
              }
            }
          }
          applyAccessibilityLabels();
          break;
        default:
          settings[key] = options[key];
      }
    }
  }

  /**
   * Applies the theme and style classes dynamically
   */
  function applyThemeAndStyle() {
    if (!colorPicker) return;

    let resolvedTheme = settings.theme;
    if (resolvedTheme === 'auto') {
      resolvedTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }

    colorPicker.className = `cpu-picker cpu-style-${settings.style} cpu-theme-${resolvedTheme} cpu-anim-${settings.animation}`;

    if (settings.inline) {
      updatePickerPosition();
    }
  }

  /**
   * Dynamic column and visibility management
   */
  function updateComponentsVisibility() {
    if (!colorPicker) return;

    const comps = settings.components;

    // Row 1 Buttons Visibility
    if (copyButton) copyButton.style.display = comps.copyPaste ? '' : 'none';
    if (pasteButton) pasteButton.style.display = comps.copyPaste ? '' : 'none';
    if (eyedropperBtn) eyedropperBtn.style.display = (comps.eyedropper && !!window.EyeDropper) ? '' : 'none';

    // Row 3 Format Selector Dropdown
    if (formatSelect) {
      if (settings.formatToggle) {
        formatSelect.style.display = '';
        colorValue.classList.remove('cpu-span-4');
      } else {
        formatSelect.style.display = 'none';
        colorValue.classList.add('cpu-span-4');
      }
    }

    // Row 5 Alpha Slider Track
    const alphaRow = getEl('cpu-row-5');
    if (alphaRow) {
      alphaRow.style.display = settings.alpha ? '' : 'none';
    }

    // Row 6 Recent Colors Accordion
    const historyRow = getEl('cpu-row-6');
    if (historyRow) {
      historyRow.style.display = comps.history ? '' : 'none';
    }

    // Row 7 Swatches Panel & Selector Dropdown
    const paletteRow = getEl('cpu-row-7');
    if (paletteRow) {
      paletteRow.style.display = comps.palette ? '' : 'none';
      if (paletteSelect && swatchesContainer) {
        if (comps.paletteSelector) {
          paletteSelect.style.display = '';
          swatchesContainer.classList.remove('cpu-span-4');
        } else {
          paletteSelect.style.display = 'none';
          swatchesContainer.classList.add('cpu-span-4');
        }
      }
    }

    // Row 8 Generated Harmonies Accordion
    const harmonyRow = getEl('cpu-row-8');
    if (harmonyRow) {
      harmonyRow.style.display = comps.harmony ? '' : 'none';
    }
  }

  function applyAccessibilityLabels() {
    if (!colorPicker) return;

    const openLabel = getEl('cpu-open-label');
    const swatchLabel = getEl('cpu-swatch-label');

    if (openLabel) openLabel.innerHTML = settings.a11y.open;
    if (swatchLabel) swatchLabel.innerHTML = settings.a11y.swatch;

    closeButton.setAttribute('aria-label', settings.a11y.close);
    clearButton.setAttribute('aria-label', settings.a11y.clear);
    hueSlider.setAttribute('aria-label', settings.a11y.hueSlider);
    alphaSlider.setAttribute('aria-label', settings.a11y.alphaSlider);
    colorValue.setAttribute('aria-label', settings.a11y.input);
    colorArea.setAttribute('aria-label', settings.a11y.instruction);

    if (copyButton) copyButton.setAttribute('aria-label', settings.a11y.copy);
    if (pasteButton) pasteButton.setAttribute('aria-label', settings.a11y.paste);
    if (eyedropperBtn) eyedropperBtn.setAttribute('aria-label', settings.a11y.eyedropper);
    if (formatSelect) formatSelect.setAttribute('aria-label', settings.a11y.format);
  }

  function setVirtualInstance(selector, options) {
    if (typeof selector === 'string' && typeof options === 'object') {
      instances[selector] = options;
      hasInstance = true;
    }
  }

  function removeVirtualInstance(selector) {
    delete instances[selector];
    if (Object.keys(instances).length === 0) {
      hasInstance = false;
      if (selector === currentInstanceId) {
        resetVirtualInstance();
      }
    }
  }

  function attachVirtualInstance(element) {
    if (hasInstance) {
      const unsupported = ['el', 'wrap', 'rtl', 'inline', 'defaultColor', 'a11y'];
      for (let selector in instances) {
        if (element.matches(selector)) {
          currentInstanceId = selector;
          defaultInstance = {};

          const options = { ...instances[selector] };
          unsupported.forEach(prop => delete options[prop]);

          for (let option in options) {
            defaultInstance[option] = Array.isArray(settings[option]) ? settings[option].slice() : settings[option];
          }

          configure(options);
          break;
        }
      }
    }
  }

  function resetVirtualInstance() {
    if (Object.keys(defaultInstance).length > 0) {
      configure(defaultInstance);
      currentInstanceId = '';
      defaultInstance = {};
    }
  }

  function bindFields(selector) {
    if (selector instanceof HTMLElement) {
      selector = [selector];
    }

    if (Array.isArray(selector)) {
      selector.forEach(field => {
        addListener(field, 'click', openPicker);
        addListener(field, 'input', updateColorPreview);
      });
    } else {
      addListener(document, 'click', selector, openPicker);
      addListener(document, 'input', selector, updateColorPreview);
    }
  }

  function openPicker(event) {
    if (settings.inline) {
      return;
    }

    attachVirtualInstance(event.target);

    currentEl = event.target;
    previousColor = currentEl.value;
    currentFormat = getColorFormatFromStr(previousColor);

    colorPicker.classList.add('cpu-open');
    updatePickerPosition();
    setColorFromStr(previousColor);

    // Sync Format drop-down to matching initial string type
    if (formatSelect) {
      formatSelect.value = currentFormat;
    }

    if (settings.focusInput || settings.selectInput) {
      colorValue.focus({ preventScroll: true });
      colorValue.setSelectionRange(currentEl.selectionStart, currentEl.selectionEnd);
    }

    if (settings.selectInput) {
      colorValue.select();
    }

    if (keyboardNav || settings.swatchesOnly) {
      const focusables = getFocusableElements();
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }

    // Refresh child panels
    renderHistory();
    renderHarmonies();

    currentEl.dispatchEvent(new Event('open', { bubbles: false }));
    document.dispatchEvent(new CustomEvent('colorpickup:open', { detail: { currentEl } }));
  }

  function updatePickerPosition() {
    const parent = container;
    const scrollY = window.scrollY;
    const pickerWidth = colorPicker.offsetWidth;
    const pickerHeight = colorPicker.offsetHeight;
    const reposition = { left: false, top: false };
    let parentOffset = { x: 0, y: 0 };

    if (parent) {
      const style = window.getComputedStyle(parent);
      const borderTop = parseFloat(style.borderTopWidth);
      parentOffset = parent.getBoundingClientRect();
      parentOffset.y += borderTop + scrollY;
    }

    if (!settings.inline && currentEl) {
      const coords = currentEl.getBoundingClientRect();
      let left = coords.x;
      let top = scrollY + coords.y + coords.height + settings.margin;

      if (parent) {
        left -= parentOffset.x;
        top -= parentOffset.y;

        if (left + pickerWidth > parent.clientWidth) {
          left += coords.width - pickerWidth;
          reposition.left = true;
        }
        if (top + pickerHeight > parent.clientHeight - parseFloat(window.getComputedStyle(parent).marginTop)) {
          if (pickerHeight + settings.margin <= coords.top - (parentOffset.y - scrollY)) {
            top -= coords.height + pickerHeight + (settings.margin * 2);
            reposition.top = true;
          }
        }
        top += parent.scrollTop;
      } else {
        if (left + pickerWidth > document.documentElement.clientWidth) {
          left += coords.width - pickerWidth;
          reposition.left = true;
        }
        if (top + pickerHeight - scrollY > document.documentElement.clientHeight) {
          if (pickerHeight + settings.margin <= coords.top) {
            top = scrollY + coords.y - pickerHeight - settings.margin;
            reposition.top = true;
          }
        }
      }

      colorPicker.classList.toggle('cpu-left', reposition.left);
      colorPicker.classList.toggle('cpu-top', reposition.top);
      colorPicker.style.left = `${left}px`;
      colorPicker.style.top = `${top}px`;
      parentOffset.x += colorPicker.offsetLeft;
      parentOffset.y += colorPicker.offsetTop;
    }

    colorAreaDims = {
      width: colorArea.offsetWidth,
      height: colorArea.offsetHeight,
      x: colorArea.offsetLeft + parentOffset.x,
      y: colorArea.offsetTop + parentOffset.y
    };
  }

  function wrapFields(selector) {
    if (selector instanceof HTMLElement) {
      wrapColorField(selector);
    } else if (Array.isArray(selector)) {
      selector.forEach(wrapColorField);
    } else {
      document.querySelectorAll(selector).forEach(wrapColorField);
    }
  }

  /**
   * Refreshes wrappers for all targeted elements based on settings changes
   */
  function refreshFieldsWrapping() {
    let elements = [];
    if (settings.el instanceof HTMLElement) {
      elements = [settings.el];
    } else if (Array.isArray(settings.el)) {
      elements = settings.el;
    } else if (typeof settings.el === 'string') {
      elements = Array.from(document.querySelectorAll(settings.el));
    }

    elements.forEach(field => {
      if (settings.wrap === false || settings.fieldMode === 'input') {
        unwrapColorField(field);
      } else {
        wrapColorField(field);
      }
    });
  }

  /**
   * Wraps inputs based on visual presentation flags
   */
  function wrapColorField(field) {
    const mode = settings.fieldMode || 'both';

    if (mode === 'input') {
      unwrapColorField(field);
      return;
    }

    let wrapper = field.parentNode;
    if (!wrapper || !wrapper.classList.contains('cpu-field')) {
      wrapper = document.createElement('div');
      let classes = 'cpu-field';
      if (settings.rtl || field.classList.contains('cpu-rtl')) {
        classes += ' cpu-rtl';
      }
      wrapper.className = classes;

      field.parentNode.insertBefore(wrapper, field);

      const button = document.createElement('button');
      button.setAttribute('type', 'button');
      button.setAttribute('aria-labelledby', 'cpu-open-label');
      wrapper.appendChild(button);

      wrapper.appendChild(field);
    }

    wrapper.style.color = field.value || settings.defaultColor;
    wrapper.classList.toggle('cpu-rtl', settings.rtl || field.classList.contains('cpu-rtl'));
    wrapper.classList.toggle('cpu-mode-color', mode === 'color');
  }

  /**
   * Restores wrapped fields back to their original unwrapped DOM structures
   */
  function unwrapColorField(field) {
    const wrapper = field.parentNode;
    if (wrapper && wrapper.classList.contains('cpu-field')) {
      wrapper.parentNode.insertBefore(field, wrapper);
      wrapper.parentNode.removeChild(wrapper);
    }
  }

  function updateColorPreview(event) {
    const parent = event.target.parentNode;
    if (parent.classList.contains('cpu-field')) {
      parent.style.color = event.target.value;
    }
  }

  function closePicker(revert) {
    if (currentEl && !settings.inline) {
      const prevEl = currentEl;

      if (revert) {
        currentEl = undefined;
        if (previousColor !== prevEl.value) {
          prevEl.value = previousColor;
          prevEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      setTimeout(() => {
        if (previousColor !== prevEl.value) {
          prevEl.dispatchEvent(new Event('change', { bubbles: true }));
          saveColorToHistory(prevEl.value);
        }
      });

      colorPicker.classList.remove('cpu-open');
      if (hasInstance) {
        resetVirtualInstance();
      }

      prevEl.dispatchEvent(new Event('close', { bubbles: false }));
      document.dispatchEvent(new CustomEvent('colorpickup:close', { detail: { currentEl: prevEl } }));

      if (settings.focusInput) {
        prevEl.focus({ preventScroll: true });
      }

      currentEl = undefined;
    }
  }

  function setColorFromStr(str) {
    const rgba = strToRGBA(str);
    const hsva = RGBAtoHSVA(rgba);

    updateMarkerA11yLabel(hsva.s, hsva.v);
    updateColor(rgba, hsva);

    hueSlider.value = hsva.h;
    colorPicker.style.color = `hsl(${hsva.h}, 100%, 50%)`;
    hueMarker.style.left = `${hsva.h / 360 * 100}%`;

    colorMarker.style.left = `${colorAreaDims.width * hsva.s / 100}px`;
    colorMarker.style.top = `${colorAreaDims.height - (colorAreaDims.height * hsva.v / 100)}px`;

    alphaSlider.value = hsva.a * 100;
    alphaMarker.style.left = `${hsva.a * 100}%`;

    // Process additional panel recalculations
    calculateWCAGContrast();
    renderHarmonies();
  }

  function getColorFormatFromStr(str) {
    const fmt = str.substring(0, 3).toLowerCase();
    if (fmt === 'rgb' || fmt === 'hsl') {
      return fmt;
    }
    return 'hex';
  }

  function pickColor(color) {
    color = color !== undefined ? color : colorValue.value;
    if (currentEl) {
      currentEl.value = color;
      currentEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (settings.onChange) {
      settings.onChange.call(window, color, currentEl);
    }
    document.dispatchEvent(new CustomEvent('colorpickup:pick', { detail: { color, currentEl } }));
    calculateWCAGContrast();
  }

  function setColorAtPosition(x, y) {
    const hsva = {
      h: hueSlider.value * 1,
      s: x / colorAreaDims.width * 100,
      v: 100 - (y / colorAreaDims.height * 100),
      a: alphaSlider.value / 100
    };
    const rgba = HSVAtoRGBA(hsva);

    updateMarkerA11yLabel(hsva.s, hsva.v);
    updateColor(rgba, hsva);
    pickColor();
  }

  function updateMarkerA11yLabel(saturation, value) {
    let label = settings.a11y.marker;
    saturation = saturation.toFixed(1) * 1;
    value = value.toFixed(1) * 1;
    label = label.replace('{s}', saturation).replace('{v}', value);
    colorMarker.setAttribute('aria-label', label);
  }

  function getPointerPosition(event) {
    return {
      pageX: event.changedTouches ? event.changedTouches[0].pageX : event.pageX,
      pageY: event.changedTouches ? event.changedTouches[0].pageY : event.pageY
    };
  }

  function moveMarker(event) {
    const pointer = getPointerPosition(event);
    let x = pointer.pageX - colorAreaDims.x;
    let y = pointer.pageY - colorAreaDims.y;

    if (container) {
      y += container.scrollTop;
    }

    nextMarkerCoords = { x, y };

    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(processMarkerUpdate);
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function processMarkerUpdate() {
    if (nextMarkerCoords) {
      setMarkerPosition(nextMarkerCoords.x, nextMarkerCoords.y);
      nextMarkerCoords = null;
    }
    rafPending = false;
  }

  function moveMarkerOnKeydown(offsetX, offsetY) {
    const x = colorMarker.style.left.replace('px', '') * 1 + offsetX;
    const y = colorMarker.style.top.replace('px', '') * 1 + offsetY;
    setMarkerPosition(x, y);
  }

  function setMarkerPosition(x, y) {
    x = (x < 0) ? 0 : (x > colorAreaDims.width) ? colorAreaDims.width : x;
    y = (y < 0) ? 0 : (y > colorAreaDims.height) ? colorAreaDims.height : y;

    colorMarker.style.left = `${x}px`;
    colorMarker.style.top = `${y}px`;

    setColorAtPosition(x, y);
    colorMarker.focus();
  }

  function updateColor(rgba = {}, hsva = {}) {
    let format = settings.format;

    for (const key in rgba) {
      activeColor[key] = rgba[key];
    }
    for (const key in hsva) {
      activeColor[key] = hsva[key];
    }

    const hex = RGBAToHex(activeColor);
    const opaqueHex = hex.substring(0, 7);

    colorMarker.style.color = opaqueHex;
    alphaMarker.parentNode.style.color = opaqueHex;
    alphaMarker.style.color = hex;
    colorPreview.style.color = hex;

    // Fix: Dynamically evaluate Format Selector dropdown value when toggleable
    if (settings.formatToggle && formatSelect) {
      format = formatSelect.value;
    } else if (format === 'mixed') {
      format = activeColor.a === 1 ? 'hex' : 'rgb';
    } else if (format === 'auto') {
      format = currentFormat;
    }

    switch (format) {
      case 'hex':
        colorValue.value = hex;
        break;
      case 'rgb':
        colorValue.value = RGBAToStr(activeColor);
        break;
      case 'hsl':
        colorValue.value = HSLAToStr(HSVAtoHSLA(activeColor));
        break;
    }

    if (formatSelect) {
      formatSelect.value = format;
    }
  }

  function setHue() {
    if (!hueRafPending) {
      hueRafPending = true;
      requestAnimationFrame(() => {
        const hue = hueSlider.value * 1;
        const x = colorMarker.style.left.replace('px', '') * 1;
        const y = colorMarker.style.top.replace('px', '') * 1;

        colorPicker.style.color = `hsl(${hue}, 100%, 50%)`;
        hueMarker.style.left = `${hue / 360 * 100}%`;

        setColorAtPosition(x, y);
        hueRafPending = false;
      });
    }
  }

  function setAlpha() {
    if (!alphaRafPending) {
      alphaRafPending = true;
      requestAnimationFrame(() => {
        const alpha = alphaSlider.value / 100;
        alphaMarker.style.left = `${alpha * 100}%`;
        updateColor({ a: alpha });
        pickColor();
        alphaRafPending = false;
      });
    }
  }

  function HSVAtoRGBA(hsva) {
    const s = hsva.s / 100;
    const v = hsva.v / 100;
    let chroma = s * v;
    let hue60 = hsva.h / 60;
    let x = chroma * (1 - Math.abs(hue60 % 2 - 1));
    let m = v - chroma;

    chroma += m;
    x += m;

    const index = Math.floor(hue60) % 6;
    const r = [chroma, x, m, m, x, chroma][index];
    const g = [x, chroma, chroma, x, m, m][index];
    const b = [m, m, x, chroma, chroma, x][index];

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
      a: hsva.a
    };
  }

  function HSVAtoHSLA(hsva) {
    const v = hsva.v / 100;
    const lightness = v * (1 - (hsva.s / 100) / 2);
    let saturation;

    if (lightness > 0 && lightness < 1) {
      saturation = Math.round((v - lightness) / Math.min(lightness, 1 - lightness) * 100);
    }

    return {
      h: hsva.h,
      s: saturation || 0,
      l: Math.round(lightness * 100),
      a: hsva.a
    };
  }

  function RGBAtoHSVA(rgba) {
    const r = rgba.r / 255;
    const g = rgba.g / 255;
    const b = rgba.b / 255;
    const xmax = Math.max(r, g, b);
    const xmin = Math.min(r, g, b);
    const chroma = xmax - xmin;
    const v = xmax;
    let h = 0;
    let s = 0;

    if (chroma) {
      if (xmax === r) h = (g - b) / chroma;
      if (xmax === g) h = 2 + (b - r) / chroma;
      if (xmax === b) h = 4 + (r - g) / chroma;
      if (xmax) s = chroma / xmax;
    }

    h = Math.floor(h * 60);

    return {
      h: h < 0 ? h + 360 : h,
      s: Math.round(s * 100),
      v: Math.round(v * 100),
      a: rgba.a
    };
  }

  function strToRGBA(str) {
    const regex = /^((rgba)|rgb)[\D]+([\d.]+)[\D]+([\d.]+)[\D]+([\d.]+)[\D]*?([\d.]+|$)/i;
    let match, rgba;

    ctx.fillStyle = '#000000';
    ctx.fillStyle = str;
    match = regex.exec(ctx.fillStyle);

    if (match) {
      rgba = {
        r: match[3] * 1,
        g: match[4] * 1,
        b: match[5] * 1,
        a: match[6] * 1
      };
    } else {
      const parts = ctx.fillStyle.replace('#', '').match(/.{2}/g);
      if (parts && parts.length >= 3) {
        rgba = {
          r: parseInt(parts[0], 16),
          g: parseInt(parts[1], 16),
          b: parseInt(parts[2], 16),
          a: 1
        };
      } else {
        rgba = { r: 0, g: 0, b: 0, a: 1 };
      }
    }
    return rgba;
  }

  function RGBAToHex(rgba) {
    let r = rgba.r.toString(16);
    let g = rgba.g.toString(16);
    let b = rgba.b.toString(16);
    let a = '';

    if (rgba.r < 16) r = '0' + r;
    if (rgba.g < 16) g = '0' + g;
    if (rgba.b < 16) b = '0' + b;

    if (settings.alpha && (rgba.a < 1 || settings.forceAlpha)) {
      const alpha = rgba.a * 255 | 0;
      a = alpha.toString(16);
      if (alpha < 16) a = '0' + a;
    }

    return '#' + r + g + b + a;
  }

  function RGBAToStr(rgba) {
    if (!settings.alpha || (rgba.a === 1 && !settings.forceAlpha)) {
      return `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`;
    }
    return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
  }

  function HSLAToStr(hsla) {
    if (!settings.alpha || (hsla.a === 1 && !settings.forceAlpha)) {
      return `hsl(${hsla.h}, ${hsla.s}%, ${hsla.l}%)`;
    }
    return `hsla(${hsla.h}, ${hsla.s}%, ${hsla.l}%, ${hsla.a})`;
  }

  /**
   * EyeDropper API Execution
   */
  function activateEyeDropper() {
    if (window.EyeDropper) {
      const dropper = new window.EyeDropper();
      dropper.open()
        .then(result => {
          setColorFromStr(result.sRGBHex);
          pickColor();
        })
        .catch(() => { });
    }
  }

  /**
   * WCAG Contrast Calculations
   */
  function getRelativeLuminance(r, g, b) {
    const mapVal = val => {
      const normalized = val / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * mapVal(r) + 0.7152 * mapVal(g) + 0.0722 * mapVal(b);
  }

  function calculateWCAGContrast() {
    if (!contrastValue || !contrastRating) return;

    const bgRGBA = strToRGBA(settings.wcagTextBackground);
    const textRGBA = HSVAtoRGBA(activeColor);

    const lum1 = getRelativeLuminance(bgRGBA.r, bgRGBA.g, bgRGBA.b);
    const lum2 = getRelativeLuminance(textRGBA.r, textRGBA.g, textRGBA.b);

    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    const ratio = (brightest + 0.05) / (darkest + 0.05);

    contrastValue.innerText = `${ratio.toFixed(2)}:1`;

    let rating = 'FAIL';
    contrastRating.className = 'cpu-contrast-rating';

    if (ratio >= 7.0) {
      rating = 'PASS AAA';
      contrastRating.classList.add('cpu-pass-aaa');
    } else if (ratio >= 4.5) {
      rating = 'PASS AA';
      contrastRating.classList.add('cpu-pass-aa');
    } else {
      contrastRating.classList.add('cpu-fail');
    }

    contrastRating.innerText = rating;
  }

  /**
   * Color Harmonies Generation Engine (Row 8 Accordion Panel)
   */
  function renderHarmonies() {
    if (!harmonyPanel || !settings.components.harmony) return;

    harmonyPanel.innerHTML = '';
    const h = activeColor.h;
    const s = activeColor.s;
    const v = activeColor.v;
    const a = activeColor.a;

    const schemes = {
      'Complementary': [(h + 180) % 360],
      'Analogous': [(h + 330) % 360, (h + 30) % 360],
      'Triadic': [(h + 120) % 360, (h + 240) % 360],
      'Split-Comp.': [(h + 150) % 360, (h + 210) % 360]
    };

    for (const title in schemes) {
      const section = document.createElement('div');
      section.className = 'cpu-harmony-group';

      const label = document.createElement('span');
      label.className = 'cpu-harmony-label';
      label.innerText = title;
      section.appendChild(label);

      const colorGrid = document.createElement('div');
      colorGrid.className = 'cpu-harmony-grid';

      schemes[title].forEach(hue => {
        const hexValue = RGBAToHex(HSVAtoRGBA({ h: hue, s, v, a }));
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.backgroundColor = hexValue;
        btn.title = hexValue;
        btn.className = 'cpu-harmony-swatch';
        btn.onclick = () => {
          setColorFromStr(hexValue);
          pickColor(hexValue);
        };
        colorGrid.appendChild(btn);
      });

      section.appendChild(colorGrid);
      harmonyPanel.appendChild(section);
    }
  }

  /**
   * Color History Management Module (Row 6 Accordion Panel)
   */
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem('cpu-history') || '[]');
    } catch {
      return [];
    }
  }

  function saveColorToHistory(colorStr) {
    if (!colorStr) return;
    let list = loadHistory();
    list = list.filter(item => item.toLowerCase() !== colorStr.toLowerCase());
    list.unshift(colorStr);
    if (list.length > settings.historyLimit) {
      list = list.slice(0, settings.historyLimit);
    }
    localStorage.setItem('cpu-history', JSON.stringify(list));
    renderHistory();
  }

  function renderHistory() {
    if (!historyPanel || !settings.components.history) return;

    historyPanel.innerHTML = '';
    const list = loadHistory();

    if (list.length === 0) {
      const details = getEl('cpu-history-details');
      if (details) details.style.display = 'none';
      return;
    } else {
      const details = getEl('cpu-history-details');
      if (details) details.style.display = '';
    }

    const grid = document.createElement('div');
    grid.className = 'cpu-history-grid';

    list.forEach(color => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.backgroundColor = color;
      btn.title = color;
      btn.className = 'cpu-history-swatch';
      btn.onclick = () => {
        setColorFromStr(color);
        pickColor(color);
      };
      grid.appendChild(btn);
    });

    historyPanel.appendChild(grid);
  }

  /**
   * Clipboard Utilities
   */
  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(colorValue.value).then(() => {
        copyButton.classList.add('cpu-copy-success');
        setTimeout(() => copyButton.classList.remove('cpu-copy-success'), 1000);
      });
    }
  }

  function handlePaste() {
    if (navigator.clipboard) {
      navigator.clipboard.readText().then(text => {
        if (text) {
          colorValue.value = text;
          setColorFromStr(text);
          pickColor(text);
        }
      });
    }
  }

  /**
   * Preset Palette Handler (Row 7 Swatches Grid Builder)
   */
  function buildSwatches(colorList) {
    if (!swatchesContainer) return;

    swatchesContainer.textContent = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'cpu-swatches-grid';

    colorList.forEach((swatch, i) => {
      const button = document.createElement('button');
      button.setAttribute('type', 'button');
      button.setAttribute('id', `cpu-swatch-${i}`);
      button.setAttribute('aria-labelledby', `cpu-swatch-label cpu-swatch-${i}`);
      button.style.color = swatch;
      button.textContent = swatch;
      wrapper.appendChild(button);
    });

    if (colorList.length) {
      swatchesContainer.appendChild(wrapper);
    }
  }

  function handlePaletteChange(event) {
    const selected = event.target.value;
    if (selected === 'custom') {
      buildSwatches(settings.swatches);
    } else if (builtInPalettes[selected]) {
      buildSwatches(builtInPalettes[selected]);
    }
  }

  /**
   * DOM Initializer mapping the approved 8-Row Grid configuration
   */
  function init() {
    if (getEl('cpu-picker')) {
      return; // Already initialized
    }

    container = undefined;
    colorPicker = document.createElement('div');
    colorPicker.setAttribute('id', 'cpu-picker');

    // Inject structures following grid-rows table schema
    colorPicker.innerHTML = `
      <!-- Row 1: Actions Toolbar (Copy, Paste, Eyedropper, Clear) -->
      <div id="cpu-row-1" class="cpu-row cpu-row-1">
        <button type="button" id="cpu-copy-btn" class="cpu-btn cpu-copy-btn" title="Copy Color"></button>
        <button type="button" id="cpu-paste-btn" class="cpu-btn cpu-paste-btn" title="Paste Color"></button>
        <button type="button" id="cpu-eyedropper-btn" class="cpu-btn cpu-eyedropper-btn" title="Screen Eyedropper"></button>
        <button type="button" id="cpu-clear" class="cpu-btn cpu-clear"></button>
      </div>
      
      <!-- Row 2: Spectrum Area & Big Preview Card -->
      <div id="cpu-row-2" class="cpu-row cpu-row-2">
        <div id="cpu-color-area" class="cpu-gradient" role="application">
          <div id="cpu-color-marker" class="cpu-marker" tabindex="0"></div>
        </div>
        <div id="cpu-color-preview" class="cpu-preview">
          <button type="button" id="cpu-close" class="cpu-close"></button>
          <div id="cpu-contrast-overlay" class="cpu-contrast-overlay">
            <span id="cpu-contrast-value">1:1</span>
            <span id="cpu-contrast-rating">FAIL</span>
          </div>
        </div>
      </div>
      
      <!-- Row 3: Color Input & Format Selector Dropdown -->
      <div id="cpu-row-3" class="cpu-row cpu-row-3">
        <input id="cpu-color-value" name="cpu-color-value" class="cpu-color" type="text" value="" spellcheck="false">
        <select id="cpu-format-select" class="cpu-select cpu-format-select">
          <option value="hex">HEX</option>
          <option value="rgb">RGB</option>
          <option value="hsl">HSL</option>
        </select>
      </div>

      <!-- Row 4: Hue Color Slider Bar -->
      <div id="cpu-row-4" class="cpu-row cpu-row-4">
        <div class="cpu-hue">
          <input id="cpu-hue-slider" name="cpu-hue-slider" type="range" min="0" max="360" step="1">
          <div id="cpu-hue-marker"></div>
        </div>
      </div>

      <!-- Row 5: Alpha Opacity Slider (Toggleable) -->
      <div id="cpu-row-5" class="cpu-row cpu-row-5 cpu-toggleable">
        <div class="cpu-alpha">
          <input id="cpu-alpha-slider" name="cpu-alpha-slider" type="range" min="0" max="100" step="1">
          <div id="cpu-alpha-marker"></div>
          <span></span>
        </div>
      </div>

      <!-- Row 6: Recent Colors Accordion (Toggleable) -->
      <div id="cpu-row-6" class="cpu-row cpu-row-6 cpu-toggleable">
        <details class="cpu-accordion" id="cpu-history-details">
          <summary class="cpu-accordion-summary">Recent Colors</summary>
          <div id="cpu-history-panel" class="cpu-history-panel"></div>
        </details>
      </div>

      <!-- Row 7: Palettes and Swatch Grid (Toggleable) -->
      <div id="cpu-row-7" class="cpu-row cpu-row-7 cpu-toggleable">
        <div id="cpu-swatches" class="cpu-swatches"></div>
        <select id="cpu-palette-select" class="cpu-select cpu-palette-select">
          <option value="custom">Palette</option>
          <option value="tailwind">Tailwind</option>
          <option value="material">Material</option>
          <option value="adobe">Adobe</option>
          <option value="vscode">VSCode</option>
        </select>
      </div>

      <!-- Row 8: Generated Palette Harmonies (Toggleable) -->
      <div id="cpu-row-8" class="cpu-row cpu-row-8 cpu-toggleable">
        <details class="cpu-accordion" id="cpu-harmony-details">
          <summary class="cpu-accordion-summary">Color Harmonies</summary>
          <div id="cpu-harmony-panel" class="cpu-harmony-panel"></div>
        </details>
      </div>

      <span id="cpu-open-label" hidden></span>
      <span id="cpu-swatch-label" hidden></span>
    `;

    document.body.appendChild(colorPicker);

    // Cache structural elements
    colorArea = getEl('cpu-color-area');
    colorMarker = getEl('cpu-color-marker');
    clearButton = getEl('cpu-clear');
    closeButton = getEl('cpu-close');
    colorPreview = getEl('cpu-color-preview');
    colorValue = getEl('cpu-color-value');
    hueSlider = getEl('cpu-hue-slider');
    hueMarker = getEl('cpu-hue-marker');
    alphaSlider = getEl('cpu-alpha-slider');
    alphaMarker = getEl('cpu-alpha-marker');

    contrastValue = getEl('cpu-contrast-value');
    contrastRating = getEl('cpu-contrast-rating');
    harmonyPanel = getEl('cpu-harmony-panel');
    historyPanel = getEl('cpu-history-panel');
    copyButton = getEl('cpu-copy-btn');
    pasteButton = getEl('cpu-paste-btn');
    eyedropperBtn = getEl('cpu-eyedropper-btn');
    formatSelect = getEl('cpu-format-select');
    paletteSelect = getEl('cpu-palette-select');
    swatchesContainer = getEl('cpu-swatches');

    // Run structural setups
    bindFields(settings.el);
    wrapFields(settings.el);
    applyThemeAndStyle();
    updateComponentsVisibility();
    applyAccessibilityLabels();

    // Attach local component listeners
    addListener(colorPicker, 'mousedown', event => {
      colorPicker.classList.remove('cpu-keyboard-nav');
      event.stopPropagation();
    });

    addListener(colorArea, 'mousedown', () => {
      addListener(document, 'mousemove', moveMarker);
    });

    addListener(colorArea, 'contextmenu', event => {
      event.preventDefault();
    });

    addListener(colorArea, 'touchstart', () => {
      document.addEventListener('touchmove', moveMarker, { passive: false });
    });

    addListener(colorMarker, 'mousedown', () => {
      addListener(document, 'mousemove', moveMarker);
    });

    addListener(colorMarker, 'touchstart', () => {
      document.addEventListener('touchmove', moveMarker, { passive: false });
    });

    addListener(colorValue, 'change', () => {
      const val = colorValue.value;
      if (currentEl || settings.inline) {
        const parsed = val === '' ? val : setColorFromStr(val);
        pickColor(parsed);
      }
    });

    addListener(clearButton, 'click', () => {
      pickColor('');
      closePicker();
    });

    addListener(closeButton, 'click', () => {
      pickColor();
      closePicker();
    });

    // Format Dropdown Listener (Row 3 Right)
    if (formatSelect) {
      addListener(formatSelect, 'change', event => {
        currentFormat = event.target.value;
        updateColor();
        pickColor();
      });
    }

    addListener(colorPicker, 'click', '.cpu-swatches button', event => {
      setColorFromStr(event.target.textContent);
      pickColor();
      if (settings.swatchesOnly) {
        closePicker();
      }
    });

    // Clipboard and dropper utility connectors
    addListener(copyButton, 'click', handleCopy);
    addListener(pasteButton, 'click', handlePaste);
    if (eyedropperBtn) {
      addListener(eyedropperBtn, 'click', activateEyeDropper);
    }

    if (paletteSelect) {
      addListener(paletteSelect, 'change', handlePaletteChange);
    }

    addListener(document, 'mouseup', () => {
      document.removeEventListener('mousemove', moveMarker);
    });

    addListener(document, 'touchend', () => {
      document.removeEventListener('touchmove', moveMarker);
    });

    addListener(document, 'mousedown', () => {
      keyboardNav = false;
      colorPicker.classList.remove('cpu-keyboard-nav');
      closePicker();
    });

    addListener(document, 'keydown', event => {
      const key = event.key;
      const target = event.target;
      const shiftKey = event.shiftKey;
      const navKeys = ['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

      if (key === 'Escape') {
        closePicker(true);
        return;
      } else if (key === 'Enter' && target.tagName !== 'BUTTON') {
        closePicker();
        return;
      } else if (navKeys.includes(key)) {
        keyboardNav = true;
        colorPicker.classList.add('cpu-keyboard-nav');
      }

      if (key === 'Tab' && target.matches('.cpu-picker *')) {
        const focusables = getFocusableElements();
        const firstFocusable = focusables.shift();
        const lastFocusable = focusables.pop();

        if (shiftKey && target === firstFocusable) {
          lastFocusable.focus();
          event.preventDefault();
        } else if (!shiftKey && target === lastFocusable) {
          firstFocusable.focus();
          event.preventDefault();
        }
      }
    });

    addListener(document, 'click', '.cpu-field button', event => {
      if (hasInstance) {
        resetVirtualInstance();
      }
      event.target.nextElementSibling.dispatchEvent(new Event('click', { bubbles: true }));
    });

    addListener(colorMarker, 'keydown', event => {
      const movements = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0]
      };
      if (Object.keys(movements).includes(event.key)) {
        moveMarkerOnKeydown(...movements[event.key]);
        event.preventDefault();
      }
    });

    addListener(colorArea, 'click', moveMarker);
    addListener(hueSlider, 'input', setHue);
    addListener(alphaSlider, 'input', setAlpha);
  }

  function getFocusableElements() {
    const controls = Array.from(colorPicker.querySelectorAll('input, button, select, [tabindex="0"]'));
    return controls.filter(node => !!node.offsetWidth);
  }

  /**
   * Tracks and adds event listeners to support seamless global destruction
   */
  function addListener(context, type, selector, fn, options) {
    let realListener;
    if (typeof selector === 'string') {
      const matches = Element.prototype.matches || Element.prototype.msMatchesSelector;
      realListener = function (event) {
        if (matches.call(event.target, selector)) {
          fn.call(event.target, event);
        }
      };
    } else {
      options = fn;
      realListener = selector;
    }

    context.addEventListener(type, realListener, options);
    eventRegistry.push({ context, type, listener: realListener, options });
  }

  /**
   * Removes all event listeners registered in the instance
   */
  function removeAllListeners() {
    eventRegistry.forEach(({ context, type, listener, options }) => {
      if (context) {
        context.removeEventListener(type, listener, options);
      }
    });
    eventRegistry.length = 0;
  }

  /**
   * Cleans up DOM wrapper setups, unbinds events, and removes elements to avoid memory leaks
   */
  function destroy() {
    let elements = [];
    if (settings.el instanceof HTMLElement) {
      elements = [settings.el];
    } else if (Array.isArray(settings.el)) {
      elements = settings.el;
    } else if (typeof settings.el === 'string') {
      elements = Array.from(document.querySelectorAll(settings.el));
    }

    // Unwrap any bound fields
    elements.forEach(unwrapColorField);

    // Unbind all attached listeners
    removeAllListeners();

    // Delete picker element
    if (colorPicker && colorPicker.parentNode) {
      colorPicker.parentNode.removeChild(colorPicker);
    }

    // Reset status flags
    colorPicker = null;
    currentEl = null;
    hasInstance = false;
    Object.keys(instances).forEach(key => delete instances[key]);
  }

  function DOMReady(fn, args) {
    args = args !== undefined ? args : [];
    if (document.readyState !== 'loading') {
      fn(...args);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        fn(...args);
      });
    }
  }

  if (NodeList !== undefined && NodeList.prototype && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }

  // Export module APIs globally
  window.ColorPickUp = (() => {
    const methods = {
      set: configure,
      wrap: wrapFields,
      close: closePicker,
      setInstance: setVirtualInstance,
      removeInstance: removeVirtualInstance,
      updatePosition: updatePickerPosition,
      ready: DOMReady,
      destroy: destroy
    };

    function ColorPickUp(options) {
      DOMReady(() => {
        if (options) {
          if (typeof options === 'string') {
            bindFields(options);
          } else {
            configure(options);
          }
        }
      });
    }

    for (const key in methods) {
      ColorPickUp[key] = (...args) => {
        DOMReady(methods[key], args);
      };
    }

    return ColorPickUp;
  })();

  DOMReady(init);

})(window, document, Math);