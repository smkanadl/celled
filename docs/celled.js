(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.CellEd = {}));
}(this, function (exports) { 'use strict';

    var EventEmitter = /** @class */ (function () {
        function EventEmitter() {
            this.handlers = {};
        }
        EventEmitter.prototype.addHandler = function (event, handler) {
            var handlers = this.handlers;
            handlers[event] = handlers[event] || [];
            handlers[event].push(handler);
        };
        EventEmitter.prototype.removeHandler = function (event, handler) {
            var allHandlers = this.handlers;
            var handlers = allHandlers[event];
            if (handlers && handler) {
                handlers.splice(handlers.indexOf(handler), 1);
            }
        };
        EventEmitter.prototype.emit = function (event, args) {
            var handlers = this.handlers[event];
            if (handlers) {
                handlers.forEach(function (handler) {
                    try {
                        handler(args);
                    }
                    catch (_a) { }
                });
            }
        };
        return EventEmitter;
    }());

    // ref: https://stackoverflow.com/a/14991797/498298
    // This will parse a delimited string into an array of
    // arrays. The default delimiter is the comma, but this
    // can be overriden in the second argument.
    function parseCSV(str, delimiter) {
        var arr = [];
        var quote = false; // 'true' means we're inside a quoted field
        // Iterate over each character, keep track of current row and column (of the returned array)
        for (var row = 0, col = 0, i = 0; i < str.length; i++) {
            var currentChar = str[i];
            var nextChar = str[i + 1];
            arr[row] = arr[row] || []; // Create a new row if necessary
            arr[row][col] = arr[row][col] || ''; // Create a new column (start with empty string) if necessary
            // If the current character is a quotation mark, and we're inside a
            // quoted field, and the next character is also a quotation mark,
            // add a quotation mark to the current column and skip the next character
            if (currentChar === '"' && quote && nextChar === '"') {
                arr[row][col] += currentChar;
                ++i;
                continue;
            }
            // If it's just one quotation mark, begin/end quoted field
            if (currentChar === '"') {
                quote = !quote;
                continue;
            }
            // If it's a delimiter and we're not in a quoted field, move on to the next column
            if (currentChar === delimiter && !quote) {
                ++col;
                continue;
            }
            // If it's a newline (CRLF) and we're not in a quoted field, skip the next character
            // and move on to the next row and move to column 0 of that new row
            if (currentChar === '\r' && nextChar === '\n' && !quote) {
                ++row;
                col = 0;
                ++i;
                continue;
            }
            // If it's a newline (LF or CR) and we're not in a quoted field,
            // move on to the next row and move to column 0 of that new row
            if ((currentChar === '\n' || currentChar === '\r') && !quote) {
                ++row;
                col = 0;
                continue;
            }
            // Otherwise, append the current character to the current column
            arr[row][col] += currentChar;
        }
        return arr;
    }
    function writeCSV(values, separator, linebreak) {
        if (linebreak === void 0) { linebreak = '\n'; }
        var content = '';
        values.forEach(function (row, ri) {
            if (ri > 0) {
                content += linebreak;
            }
            row.forEach(function (cell, ci) {
                cell = cell.replace(/"/g, '""');
                if (cell.search(/("|,|\n)/g) >= 0) {
                    cell = '"' + cell + '"';
                }
                if (ci > 0) {
                    content += separator;
                }
                content += cell;
            });
        });
        return content;
    }

    function query(elOrCss, cssSelector) {
        if (!cssSelector) {
            cssSelector = elOrCss;
            elOrCss = document;
        }
        return elOrCss.querySelector(cssSelector);
    }
    function queryAll(elOrCss, cssSelector) {
        if (!cssSelector) {
            cssSelector = elOrCss;
            elOrCss = document;
        }
        return [].slice.call(elOrCss.querySelectorAll(cssSelector));
    }
    function createElement(html) {
        var div = document.createElement('div');
        div.innerHTML = html.trim();
        return div.firstChild;
    }
    function on(element, event, listener) {
        element.addEventListener(event, listener);
        return offFunc(element, event, listener);
    }
    function off(element, event, listener) {
        element.removeEventListener(event, listener);
    }
    function offFunc(element, event, listener) {
        return function () { return element.removeEventListener(event, listener); };
    }
    function remove(node) {
        if (node.parentNode) {
            node.parentElement.removeChild(node);
        }
    }
    function setOptions(selectElement, options) {
        for (var i = selectElement.options.length; i > 0; i--) {
            selectElement.remove(i);
        }
        for (var _i = 0, options_1 = options; _i < options_1.length; _i++) {
            var option = options_1[_i];
            var optionElement = document.createElement('option');
            optionElement.value = '' + option;
            optionElement.innerHTML = '' + option;
            selectElement.appendChild(optionElement);
        }
    }

    var CSS_PREFIX = 'ced';
    var CSS_CONTAINER = CSS_PREFIX + "-grid-container";
    var CSS_CONTAINER_SCROLL = CSS_PREFIX + "-grid-container-scroll";
    var CSS_GRID = CSS_PREFIX + "-grid";
    var CSS_ROW = CSS_PREFIX + "-row";
    var CSS_CELL = CSS_PREFIX + "-cell";
    var CSS_SELECT_CELL = CSS_PREFIX + "-select-cell";
    var CSS_HEAD = CSS_PREFIX + "-head";
    var CSS_HEAD_STICKY = CSS_PREFIX + "-head-sticky";
    var CSS_RESIZER = CSS_PREFIX + "-resizer";
    var CSS_EDITING = CSS_PREFIX + "-editing";
    var CSS_ACTIVE = CSS_PREFIX + "-active";
    var CSS_SELECTED = CSS_PREFIX + "-selected";
    var CSS_READONLY = CSS_PREFIX + "-readonly";

    /**
     * Create a new Cell instance matching the definitions in the value parameter.
     * @param callback  Can be used by the cell to notify value changes that are not
     *                  triggered from outside.
     */
    function createCell(row, col, value, callback) {
        if (typeof value !== 'string' && typeof value !== 'number' && Array.isArray(value.options)) {
            return new SelectCell(row, col, value, callback);
        }
        return new InputCell(row, col, value);
    }
    var InputCell = /** @class */ (function () {
        function InputCell(row, col, value) {
            this.row = row;
            this.col = col;
            this.readonly = false;
            this.isActive = false;
            this.isSelected = false;
            this.extraCss = '';
            var text;
            if (isPlainValue(value)) {
                text = value.toString();
            }
            else {
                this.readonly = value.readonly;
                text = value.value.toString();
                this.extraCss = value.css;
            }
            this.element = createElement("<div data-ci=\"" + col + "\">" + valueHTML(text) + "</div>");
            this.setCss();
        }
        InputCell.prototype.destroy = function () {
        };
        InputCell.prototype.selected = function () {
            return this.isSelected;
        };
        InputCell.prototype.select = function (doSelect) {
            if (doSelect === void 0) { doSelect = true; }
            this.isSelected = doSelect;
            this.setCss();
            return this;
        };
        InputCell.prototype.activate = function (doActivate) {
            if (doActivate === void 0) { doActivate = true; }
            if (doActivate) {
                this.isActive = this.isSelected = true;
            }
            else {
                this.isActive = false;
                if (this.input) {
                    this.input.blur();
                    remove(this.input);
                    this.element.innerHTML = valueHTML(this.input.value);
                    this.input = null;
                }
            }
            this.setCss();
            return this;
        };
        InputCell.prototype.value = function () {
            return this.input ? this.input.value : this.element.textContent;
        };
        InputCell.prototype.set = function (value) {
            if (isPlainValue(value)) {
                this.setValue(value);
            }
            else {
                // Update properties only if it's set in value
                if (isDefined(value.value)) {
                    this.setValue(value.value);
                }
                this.readonly = isDefined(value.readonly) ? value.readonly : this.readonly;
                this.extraCss = value.css;
                this.setCss();
            }
        };
        InputCell.prototype.setValue = function (value) {
            if (this.input) {
                this.input.value = value.toString();
            }
            else {
                this.element.innerHTML = valueHTML(value);
            }
        };
        InputCell.prototype.setCss = function () {
            var className = CSS_CELL +
                cssIf(this.readonly, CSS_READONLY) +
                cssIf(this.isActive, CSS_ACTIVE) +
                cssIf(this.isSelected, CSS_SELECTED) +
                cssIf(!!this.input, CSS_EDITING) +
                cssIf(!!this.extraCss, this.extraCss);
            this.element.className = className;
        };
        InputCell.prototype.startEdit = function (input, select) {
            if (select === void 0) { select = false; }
            if (this.readonly) {
                return;
            }
            var element = this.element;
            this.input = input;
            input.value = element.textContent;
            if (select) {
                input.select();
            }
            input.style.width = element.offsetWidth - 2 + 'px';
            element.innerHTML = '';
            element.appendChild(input);
            input.focus();
            this.setCss();
        };
        InputCell.prototype.takesKey = function () {
            return !!this.input;
        };
        InputCell.prototype.takesMouse = function () {
            return this.takesKey();
        };
        return InputCell;
    }());
    function valueHTML(value) {
        return "<span>" + value + "</span>";
    }
    var SelectCell = /** @class */ (function () {
        function SelectCell(row, col, value, callback) {
            var _this = this;
            this.row = row;
            this.col = col;
            this.readonly = false;
            this.options = null;
            this.isSelected = false;
            this.extraCss = '';
            this.readonly = value.readonly;
            this.options = value.options;
            this.element = createElement("<div data-ci=\"" + col + "\"></div>");
            this.selectElement = createElement("<select><select>");
            setOptions(this.selectElement, this.options);
            this.set('' + value.value);
            this.element.appendChild(this.selectElement);
            this.listener = function () { return callback(_this); };
            this.selectElement.addEventListener('change', this.listener);
            this.extraCss = value.css;
            this.setCss();
        }
        SelectCell.prototype.destroy = function () {
            this.selectElement.removeEventListener('change', this.listener);
        };
        SelectCell.prototype.value = function () {
            return this.selectElement.value;
        };
        SelectCell.prototype.set = function (value) {
            if (isPlainValue(value)) {
                this.setValue(value);
            }
            else {
                // Update properties only if it's set in value
                if (isDefined(value.value)) {
                    this.setValue(value.value);
                }
                this.extraCss = value.css;
                this.setCss();
            }
        };
        SelectCell.prototype.setValue = function (value) {
            this.selectElement.value = value ? value.toString() : null;
        };
        SelectCell.prototype.setCss = function () {
            var className = CSS_CELL + ' ' + CSS_SELECT_CELL +
                cssIf(this.readonly, CSS_READONLY) +
                cssIf(this.isSelected, CSS_SELECTED) +
                cssIf(!!this.extraCss, this.extraCss);
            this.element.className = className;
        };
        SelectCell.prototype.select = function (doSelect) {
            if (doSelect === void 0) { doSelect = true; }
            this.isSelected = doSelect;
            this.setCss();
            return this;
        };
        SelectCell.prototype.selected = function () {
            return this.isSelected;
        };
        SelectCell.prototype.activate = function (doActivate) {
            return this;
        };
        SelectCell.prototype.startEdit = function (input, selectContent) {
        };
        SelectCell.prototype.takesKey = function () {
            return false;
        };
        SelectCell.prototype.takesMouse = function () {
            return true;
        };
        return SelectCell;
    }());
    function isPlainValue(value) {
        return typeof value === 'string' || typeof value === 'number';
    }
    function isDefined(value) {
        return typeof value !== 'undefined';
    }
    function cssIf(useValue, css) {
        return useValue ? ' ' + css : '';
    }

    var Row = /** @class */ (function () {
        function Row(index) {
            this.index = index;
            this.cells = [];
            this.element = createElement("<div data-ri=\"" + index + "\" class=\"" + CSS_ROW + "\"></div>");
        }
        Row.prototype.addCells = function (cells, updateValueCallback) {
            var _this = this;
            cells.forEach(function (c, columnIndex) {
                var cell = createCell(_this.index, columnIndex, c, updateValueCallback);
                _this.cells.push(cell);
                _this.element.appendChild(cell.element);
            });
        };
        return Row;
    }());

    var DefaultRenderer = /** @class */ (function () {
        function DefaultRenderer(options) {
            this.options = options;
        }
        DefaultRenderer.prototype.rerender = function (rows) {
            var _a = this.options, grid = _a.grid, head = _a.head;
            grid.innerHTML = '';
            grid.appendChild(head);
            rows.forEach(function (r) {
                grid.appendChild(r.element);
            });
        };
        DefaultRenderer.prototype.destroy = function () {
            this.options = null;
        };
        return DefaultRenderer;
    }());
    var VirtualRenderer = /** @class */ (function () {
        function VirtualRenderer(options) {
            this.options = options;
        }
        VirtualRenderer.prototype.rerender = function (rows) {
            var _a = this.options, grid = _a.grid, head = _a.head, container = _a.container, gridContainer = _a.gridContainer;
            if (this.onScroll) {
                container.removeEventListener('scroll', this.onScroll);
            }
            var itemPadding = 4;
            var currentRange = {
                start: undefined,
                end: undefined,
            };
            var rowHeight = 34; // just a guess
            grid.style.position = 'absolute';
            var update = function (scrollTop) {
                var itemCount = rows.length;
                var viewportHeight = container.offsetHeight;
                var totalContentHeight = itemCount * rowHeight;
                var startIndex = Math.floor(scrollTop / rowHeight) - itemPadding;
                if (startIndex % 2 > 0) {
                    // always start with an odd index to keep alternating styles consistent
                    startIndex -= 1;
                }
                startIndex = Math.max(0, startIndex);
                var visibleNodesCount = Math.ceil(viewportHeight / rowHeight) + 2 * itemPadding;
                visibleNodesCount = Math.min(itemCount - startIndex, visibleNodesCount);
                var endIndex = startIndex + visibleNodesCount;
                var offsetY = startIndex * rowHeight;
                gridContainer.style.height = totalContentHeight + "px";
                grid.style['top'] = offsetY + "px";
                // Render
                if (currentRange.start !== startIndex || currentRange.end !== endIndex) {
                    var desiredRenderHeight = visibleNodesCount * rowHeight; // viewport + padding
                    currentRange.start = startIndex;
                    currentRange.end = endIndex;
                    grid.innerHTML = '';
                    grid.appendChild(head);
                    var headerHeight = grid.offsetHeight;
                    var renderedHeight = 0;
                    // First add items from start to end index at once
                    var fragment = document.createDocumentFragment();
                    var i = startIndex;
                    for (; i <= endIndex && i < rows.length; ++i) {
                        var row = rows[i];
                        fragment.appendChild(row.element);
                    }
                    grid.appendChild(fragment);
                    renderedHeight = grid.offsetHeight - headerHeight;
                    // Add items until we reached the desired height
                    for (; renderedHeight < desiredRenderHeight && i < rows.length; ++i) {
                        var row = rows[i];
                        grid.appendChild(row.element);
                        renderedHeight += row.element.offsetHeight;
                    }
                    var numberOfRenderedItems = i - startIndex;
                    if (numberOfRenderedItems) {
                        rowHeight = renderedHeight / numberOfRenderedItems;
                    }
                }
            };
            var updateFunc = update;
            var animationFrame;
            this.onScroll = function (e) {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }
                animationFrame = requestAnimationFrame(function () {
                    updateFunc(e.target.scrollTop);
                });
            };
            container.addEventListener('scroll', this.onScroll);
            updateFunc(container.scrollTop);
        };
        VirtualRenderer.prototype.destroy = function () {
            this.options.container.removeEventListener('scroll', this.onScroll);
            this.options = null;
            this.onScroll = null;
        };
        return VirtualRenderer;
    }());

    var Grid = /** @class */ (function () {
        function Grid(container, options) {
            this.rows = [];
            this.cells = [];
            this.events = new EventEmitter();
            this.cleanups = [];
            this.container = typeof container === 'string' ? query(container) : container;
            if (options) {
                this.init(options);
            }
        }
        Grid.prototype.init = function (options) {
            var _this = this;
            options.scroll = getScrollOptions(options);
            this.options = options;
            var container = this.container;
            var rows = this.rows;
            container.innerHTML = '';
            rows.length = 0;
            if (options.input) {
                this.cellInput = typeof options.input === 'function' ? options.input() : options.input;
                remove(this.cellInput);
            }
            else {
                this.cellInput = createElement("<input id=\"celled-cell-input\" type=\"text\" >");
            }
            this.hiddenInput = createElement('<div id="celled-hidden-input" style="position:absolute; z-index:-1; left:2px; top: 2px;" contenteditable tabindex="0"></div>');
            if (options.scroll) {
                container.classList.add(CSS_CONTAINER_SCROLL);
            }
            var gridContainer = createElement("<div class=\"" + CSS_CONTAINER + "\"></div>");
            var stickyHeader = options.scroll.stickyHeader;
            var headCss = CSS_ROW + " " + CSS_HEAD + " " + (stickyHeader ? CSS_HEAD_STICKY : '');
            var head = createElement("<div class=\"" + headCss + "\"></div>");
            var grid = this.grid = createElement("<div class=\"" + CSS_GRID + "\"></div>");
            container.appendChild(gridContainer);
            gridContainer.appendChild(this.hiddenInput);
            gridContainer.appendChild(grid);
            options.cols.forEach(function (c, index) { return head.appendChild(_this.createHeadCell(c, index)); });
            var renderOptions = { container: container, gridContainer: gridContainer, grid: grid, head: head };
            this.render = options.scroll.virtualScroll ? new VirtualRenderer(renderOptions) : new DefaultRenderer(renderOptions);
            this.createRows();
            this.initMouse();
            this.initKeys();
            this.initClipboard();
            this.resetColumnWidths();
        };
        Grid.prototype.destroy = function () {
            this.render.destroy();
            this.cleanups.forEach(function (c) { return c(); });
            this.cleanups.length = 0;
            remove(this.grid);
            this.cells.forEach(function (c) { return c.destroy(); });
            this.grid = null;
            this.hiddenInput = null;
            this.cellInput = null;
            this.rows = null;
            this.cells = null;
        };
        Grid.prototype.on = function (event, handler) {
            this.events.addHandler(event, handler);
        };
        Grid.prototype.update = function (rowIndex, colIndex, value, emit) {
            var row = this.rows[rowIndex];
            var cell = row.cells[colIndex];
            if (cell) {
                cell.set(value);
                this.updatValue(cell, emit);
            }
        };
        Grid.prototype.addRows = function (rows) {
            var _this = this;
            [].push.apply(this.options.rows, rows);
            rows.forEach(function (r) {
                var newRow = _this.createAndAddRow(r);
                newRow.cells.forEach(function (c) { return _this.emitInput(c); });
            });
            this.flattenCells();
            this.renderRows();
        };
        Grid.prototype.addRow = function () {
            this.addRows([this.options.cols.map(function (c) { return ''; })]);
        };
        Grid.prototype.resetColumnWidths = function () {
            var allCells = queryAll(this.container, css(CSS_HEAD) + " " + css(CSS_CELL));
            allCells.forEach(function (c, i) {
                c.style.width = c.offsetWidth + 'px';
            });
        };
        Grid.prototype.createHeadCell = function (text, columnIndex) {
            var _this = this;
            var column = createElement("<div class=\"" + CSS_CELL + "\" data-ci=\"" + columnIndex + "\"><span>" + text + "</span></div>");
            var resizer = createElement("<div class=\"" + CSS_RESIZER + "\"></div>");
            column.appendChild(resizer);
            var downPosition = null;
            var nextColumn = null;
            var currentWidth = null;
            var currentNextWidth = null;
            var selection = null;
            var mousemove = function (e) {
                if (selection) {
                    var col = e.target;
                    var _loop_1 = function () {
                        var ciAttr = col.getAttribute('data-ci');
                        var ci = +ciAttr;
                        if (ciAttr !== null && !isNaN(ci)) {
                            var minCol_1 = Math.min(columnIndex, ci);
                            var maxCol_1 = Math.max(columnIndex, ci);
                            if (selection[0] !== minCol_1 || selection[1] !== maxCol_1) {
                                selection = [minCol_1, maxCol_1];
                                _this.cells.forEach(function (c) { return c.select(c.col >= minCol_1 && c.col <= maxCol_1); });
                                _this.emitSelect();
                            }
                            return "break";
                        }
                        col = col.parentElement;
                    };
                    while (col) {
                        var state_1 = _loop_1();
                        if (state_1 === "break")
                            break;
                    }
                }
                else {
                    // column resizing
                    var diff = e.pageX - downPosition;
                    if (nextColumn) {
                        nextColumn.style.width = (currentNextWidth - diff) + 'px';
                    }
                    column.style.width = (currentWidth + diff) + 'px';
                }
            };
            var mouseup = function () {
                downPosition = null;
                selection = null;
                off(document, 'mousemove', mousemove);
                off(document, 'mouseup', mouseup);
                _this.resetColumnWidths();
            };
            on(column, 'mousedown', function (e) {
                if (e.target === resizer) {
                    // Resize columns
                    nextColumn = column.nextElementSibling;
                    downPosition = e.pageX;
                    currentWidth = column.offsetWidth;
                    currentNextWidth = nextColumn ? nextColumn.offsetWidth : null;
                }
                else if (_this.rows.length) {
                    // Select column
                    var i_1 = +column.getAttribute('data-ci');
                    selection = true;
                    _this.cells.forEach(function (c) { return c.activate(false).select(c.col === i_1); });
                    selection = [i_1, i_1];
                    _this.focusHiddenInput();
                    _this.activeCell = _this.rows[0].cells[i_1];
                    _this.emitSelect();
                }
                on(document, 'mouseup', mouseup);
                on(document, 'mousemove', mousemove);
                e.preventDefault();
            });
            return column;
        };
        Grid.prototype.focusHiddenInput = function () {
            // Focus the hidden input element to receive paste events.
            // Prevent scrolling up if input was blurred at the end of a long table.
            this.hiddenInput.focus({ preventScroll: true });
        };
        Grid.prototype.createAndAddRow = function (r) {
            var row = new Row(this.rows.length);
            row.addCells(r, this.updateValueCallback());
            this.rows.push(row);
            return row;
        };
        Grid.prototype.updateValueCallback = function () {
            var _this = this;
            return function (cell) { return _this.emitInput(cell); };
        };
        Grid.prototype.createRows = function () {
            var _this = this;
            this.rows = [];
            this.options.rows.forEach(function (r) { return _this.createAndAddRow(r); });
            this.flattenCells();
            this.renderRows();
        };
        Grid.prototype.renderRows = function () {
            this.render.rerender(this.rows);
        };
        Grid.prototype.flattenCells = function () {
            this.cells = this.rows.reduce(function (a, b) { return a.concat(b.cells); }, []);
        };
        Grid.prototype.initMouse = function () {
            var _this = this;
            var downCellIndex;
            var downRowIndex;
            var selectionIdentifier = null;
            var rememberSelection = function (r1, c1, r2, c2) { return '' + r1 + c1 + r2 + c2; };
            var findTargetCell = function (cell, level) {
                if (level === void 0) { level = 0; }
                if (!cell || !cell.parentElement) {
                    return;
                }
                var cellIndexAttr = cell.getAttribute('data-ci');
                if (cellIndexAttr === null && level < 2) {
                    return findTargetCell(cell.parentElement, level + 1);
                }
                var rowIndexAttr = cell.parentElement.getAttribute('data-ri');
                var cellIndex = +cellIndexAttr;
                var rowIndex = +rowIndexAttr;
                if (cellIndexAttr && rowIndexAttr && !isNaN(cellIndex) && !isNaN(rowIndex)) {
                    return _this.rows[rowIndex].cells[cellIndex];
                }
            };
            var getTargetCell = function (e) {
                var cell = e.target;
                return findTargetCell(cell);
            };
            var mousemove = function (moveEvent) {
                var targetCell = getTargetCell(moveEvent);
                if (targetCell) {
                    var rowIndex = targetCell.row;
                    var cellIndex = targetCell.col;
                    var firstRow = Math.min(rowIndex, downRowIndex);
                    var lastRow = Math.max(rowIndex, downRowIndex);
                    var firstCol = Math.min(cellIndex, downCellIndex);
                    var lastCol = Math.max(cellIndex, downCellIndex);
                    var newSelectionIdentifier = rememberSelection(firstRow, firstCol, lastRow, lastCol);
                    if (selectionIdentifier !== newSelectionIdentifier) {
                        selectionIdentifier = newSelectionIdentifier;
                        _this.unselect();
                        for (var ri = firstRow; ri <= lastRow; ++ri) {
                            for (var ci = firstCol; ci <= lastCol; ++ci) {
                                _this.rows[ri].cells[ci].select();
                            }
                        }
                        _this.emitSelect();
                    }
                }
            };
            var mouseup = function () {
                off(document, 'mousemove', mousemove);
                off(document, 'mouseup', mouseup);
            };
            var lastMouseDown = Date.now();
            var cleanupMousedown = on(this.grid, 'mousedown', function (e) {
                var cell = getTargetCell(e);
                if (cell) {
                    var timeSinceLast = Date.now() - lastMouseDown;
                    lastMouseDown = Date.now();
                    if (cell.takesMouse()) {
                        // The cell is already in edit mode. Do nothing and continue with default event handling
                        return;
                    }
                    else if (cell === _this.activeCell && !cell.readonly && timeSinceLast < 300) {
                        // Double click on cell to start edit mode
                        // if (Array.isArray(cell.options)) {
                        //     cell.startSelect(this.cellSelect);
                        // }
                        cell.startEdit(_this.cellInput);
                        _this.emitFocus();
                    }
                    else {
                        var rowIndex = cell.row;
                        var cellIndex = cell.col;
                        downRowIndex = rowIndex;
                        downCellIndex = cellIndex;
                        selectionIdentifier = rememberSelection(rowIndex, cellIndex, rowIndex, cellIndex);
                        _this.activate(cell);
                        on(document, 'mouseup', mouseup);
                        on(document, 'mousemove', mousemove);
                    }
                    e.preventDefault();
                }
            });
            this.cleanups.push(cleanupMousedown);
            var cleanupMouseup = on(document, 'mouseup', function (e) {
                if (_this.activeCell) {
                    // Unselect all if was click outside of the grid.
                    for (var target = e.target; target; target = target.parentNode) {
                        if (target === _this.container) {
                            return;
                        }
                    }
                    _this.activeCell.activate(false);
                    if (_this.unselect()) {
                        _this.emitSelect();
                    }
                }
            });
            this.cleanups.push(cleanupMouseup);
        };
        Grid.prototype.activate = function (cell, doActivate) {
            if (doActivate === void 0) { doActivate = true; }
            if (this.activeCell) {
                this.activeCell.activate(false);
            }
            var selectionChanged = false;
            this.cells.forEach(function (c) {
                selectionChanged = c === cell ? (c.selected() !== doActivate) : (selectionChanged || c.selected());
                c.select(false);
            });
            this.activeCell = cell.select(doActivate).activate(doActivate);
            if (selectionChanged) {
                this.emitSelect();
            }
            this.focusHiddenInput();
        };
        Grid.prototype.moveActive = function (rowDelta, colDelta, addRows) {
            if (addRows === void 0) { addRows = false; }
            var activeCell = this.activeCell;
            if (activeCell) {
                var rows = this.rows;
                var rowIndex = activeCell.row + rowDelta;
                while (addRows && this.options.canAddRows && rowIndex >= rows.length) {
                    this.addRow();
                }
                var nextRow = rows[rowIndex];
                if (nextRow) {
                    var cell = nextRow.cells[activeCell.col + colDelta];
                    if (cell) {
                        this.activate(cell);
                    }
                }
            }
        };
        Grid.prototype.initKeys = function () {
            var _this = this;
            var hiddenInput = this.hiddenInput;
            var cellInput = this.cellInput;
            this.cleanups.push(on(hiddenInput, 'keydown', function (e) {
                e = e || window.event;
                var keyCode = e.keyCode;
                if (keyCode === 46) { // del
                    _this.cells.forEach(function (cell) {
                        if (cell.selected()) {
                            _this.setCell(cell, '');
                        }
                    });
                    e.preventDefault();
                }
                if (keyCode === 37) {
                    _this.moveActive(0, -1);
                }
                if (keyCode === 38) {
                    _this.moveActive(-1, 0);
                }
                if (keyCode === 39) {
                    _this.moveActive(0, 1);
                }
                if (keyCode === 40) {
                    _this.moveActive(1, 0);
                }
            }));
            var onInput = function (e) {
                var activeCell = _this.activeCell;
                if (activeCell && !activeCell.readonly && activeCell.takesKey()) {
                    _this.updatValue(activeCell, true);
                    _this.cells.forEach(function (cell) {
                        if (cell.selected() && cell !== activeCell) {
                            _this.setCell(cell, activeCell.value());
                        }
                    });
                }
            };
            this.cleanups.push(on(cellInput, 'input', onInput));
            this.cleanups.push(on(cellInput, 'keydown', function (e) {
                if (e.keyCode === 13) {
                    // ENTER, stop edit and move to next row
                    _this.moveActive(0, 0);
                    _this.moveActive(1, 0, true);
                    e.preventDefault();
                }
                if (e.keyCode === 27) {
                    // ESCAPE, stop edit but stay at same cell
                    _this.moveActive(0, 0);
                    e.preventDefault();
                }
            }));
            this.cleanups.push(on(hiddenInput, 'keypress', function (e) {
                var activeCell = _this.activeCell;
                if (activeCell && !activeCell.readonly && !activeCell.takesKey()) {
                    activeCell.startEdit(cellInput, true);
                    _this.emitFocus();
                }
                else {
                    e.preventDefault();
                }
            }));
        };
        Grid.prototype.pasteCSV = function (csvText, separator, startRow, startCol) {
            var _this = this;
            var csv = parseCSV(csvText, separator);
            var activeCell = this.activeCell;
            if (isNaN(startRow) && !activeCell) {
                return;
            }
            startRow = isNaN(startRow) ? activeCell.row : startRow;
            startCol = isNaN(startCol) ? activeCell.col : startCol;
            csv.forEach(function (csvRow, csvRowIndex) {
                var tableRow = _this.rows[startRow + csvRowIndex];
                if (!tableRow && _this.options.canAddRows) {
                    var prevRow = _this.rows[startRow];
                    _this.addRows([prevRow.cells.map(function (c) { return ''; })]);
                    tableRow = _this.rows[startRow + csvRowIndex];
                }
                var tableCol = startCol;
                var isLastEmptyRow = csvRow.length === 1 && csvRow[0] === '';
                if (tableRow && !isLastEmptyRow) {
                    csvRow.forEach(function (csvCell, csvColIndex) {
                        var cell = tableRow.cells[tableCol + csvColIndex];
                        if (cell && !cell.readonly) {
                            _this.setCell(cell, csvCell);
                            cell.select();
                        }
                    });
                }
            });
        };
        Grid.prototype.initClipboard = function () {
            var _this = this;
            on(this.hiddenInput, 'paste', function (e) {
                // Don't actually paste to hidden input
                e.preventDefault();
                var text = (e.clipboardData || window.clipboardData).getData('text');
                _this.pasteCSV(text, '\t');
            });
            on(this.hiddenInput, 'copy', function (e) {
                e.preventDefault();
                var activeCell = _this.activeCell;
                if (!activeCell) {
                    return;
                }
                var csv = [];
                for (var ri = activeCell.row;; ri++) {
                    var row = _this.rows[ri];
                    var csvRow = [];
                    if (!row || !row.cells[activeCell.col] || !row.cells[activeCell.col].selected()) {
                        break;
                    }
                    for (var ci = activeCell.col;; ++ci) {
                        var cell = row.cells[ci];
                        if (!cell || !cell.selected()) {
                            break;
                        }
                        csvRow.push(cell.value());
                    }
                    csv.push(csvRow);
                }
                var clipboard = (e.clipboardData || window.clipboardData);
                clipboard.setData('text/plain', writeCSV(csv, '\t'));
            });
        };
        Grid.prototype.setCell = function (cell, value) {
            if (!cell.readonly) {
                cell.set(value);
                this.updatValue(cell, true);
            }
        };
        Grid.prototype.unselect = function () {
            var selectionChanged = false;
            this.cells.forEach(function (c) {
                selectionChanged = selectionChanged || c.selected();
                c.select(false);
            });
            return selectionChanged;
        };
        Grid.prototype.updatValue = function (cell, emit) {
            var colIndex = cell.col;
            var rowOption = this.options.rows[cell.row];
            var cellValue = rowOption[colIndex];
            if (typeof cellValue === 'string' || typeof cellValue === 'number') {
                rowOption[colIndex] = cell.value();
            }
            else {
                cellValue.value = cell.value();
            }
            if (emit) {
                this.emitInput(cell);
            }
        };
        Grid.prototype.emitInput = function (cell) {
            this.events.emit('input', {
                grid: this,
                col: cell.col,
                row: cell.row,
                value: cell.value(),
            });
        };
        Grid.prototype.emitFocus = function () {
            var cell = this.activeCell;
            this.events.emit('focus', {
                grid: this,
                col: cell.col,
                row: cell.row,
                value: cell.value(),
            });
        };
        Grid.prototype.emitSelect = function () {
            this.events.emit('select', {
                grid: this,
                selection: this.cells.filter(function (c) { return c.selected(); }).map(function (c) { return ({
                    row: c.row,
                    col: c.col,
                }); }),
            });
        };
        return Grid;
    }());
    function css(className) {
        return '.' + className;
    }
    function trueOr(value) {
        return value === false ? false : true;
    }
    function getScrollOptions(options) {
        var scroll = options.scroll;
        if (!scroll) {
            return {};
        }
        return {
            enabled: trueOr(scroll.enabled),
            virtualScroll: trueOr(scroll.virtualScroll),
            stickyHeader: trueOr(scroll.stickyHeader),
        };
    }
    // ----

    exports.Grid = Grid;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=celled.js.map
