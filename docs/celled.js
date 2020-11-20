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

    // ref: http://stackoverflow.com/a/1293163/2343
    // This will parse a delimited string into an array of
    // arrays. The default delimiter is the comma, but this
    // can be overriden in the second argument.
    function parseCSV(strData, strDelimiter) {
        // Check to see if the delimiter is defined. If not,
        // then default to comma.
        strDelimiter = (strDelimiter || ',');
        // Create a regular expression to parse the CSV values.
        var objPattern = new RegExp((
        // Delimiters.
        '(\\' + strDelimiter + '|\\r?\\n|\\r|^)' +
            // Quoted fields.
            '(?:"([^"]*(?:""[^"]*)*)"|' +
            // Standard fields.
            '([^"\\' + strDelimiter + '\\r\\n]*))'), 'gi');
        // Create an array to hold our data. Give the array
        // a default empty first row.
        var arrData = [[]];
        // Create an array to hold our individual pattern
        // matching groups.
        var arrMatches = null;
        // Keep looping over the regular expression matches
        // until we can no longer find a match.
        while (arrMatches = objPattern.exec(strData)) {
            // Get the delimiter that was found.
            var strMatchedDelimiter = arrMatches[1];
            // Check to see if the given delimiter has a length
            // (is not the start of string) and if it matches
            // field delimiter. If id does not, then we know
            // that this delimiter is a row delimiter.
            if (strMatchedDelimiter.length &&
                strMatchedDelimiter !== strDelimiter) {
                // Since we have reached a new row of data,
                // add an empty row to our data array.
                arrData.push([]);
            }
            var strMatchedValue = void 0;
            // Now that we have our delimiter out of the way,
            // let's check to see which kind of value we
            // captured (quoted or unquoted).
            if (arrMatches[2]) {
                // We found a quoted value. When we capture
                // this value, unescape any double quotes.
                strMatchedValue = arrMatches[2].replace(new RegExp('""', 'g'), '"');
            }
            else {
                // We found a non-quoted value.
                strMatchedValue = arrMatches[3];
            }
            // Now that we have our value string, let's add
            // it to the data array.
            arrData[arrData.length - 1].push(strMatchedValue);
        }
        // Return the parsed data.
        return arrData;
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

    var CSS_PREFIX = 'ced';
    var CSS_CONTAINER = CSS_PREFIX + "-grid-container";
    var CSS_GRID = CSS_PREFIX + "-grid";
    var CSS_ROW = CSS_PREFIX + "-row";
    var CSS_CELL = CSS_PREFIX + "-cell";
    var CSS_HEAD = CSS_PREFIX + "-head";
    var CSS_RESIZER = CSS_PREFIX + "-resizer";
    var CSS_EDITING = CSS_PREFIX + "-editing";
    var CSS_ACTIVE = CSS_PREFIX + "-active";
    var CSS_SELECTED = CSS_PREFIX + "-selected";
    var CSS_READONLY = CSS_PREFIX + "-readonly";
    function css(className) {
        return '.' + className;
    }
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
            var gridContainer = createElement("<div class=\"" + CSS_CONTAINER + "\"></div>");
            var grid = this.grid = createElement("<div class=\"" + CSS_GRID + "\"><div class=\"" + CSS_ROW + " " + CSS_HEAD + "\"></div></div>");
            container.appendChild(gridContainer);
            gridContainer.appendChild(this.hiddenInput);
            gridContainer.appendChild(grid);
            var head = query(container, css(CSS_HEAD));
            options.cols.forEach(function (c, index) { return head.appendChild(_this.createHeadCell(c, index)); });
            this.createRows();
            this.initMouse();
            this.initKeys();
            this.initClipboard();
            queryAll(head, css(CSS_CELL)).forEach(function (c) { return c.style.width = c.offsetWidth + 'px'; });
        };
        Grid.prototype.destroy = function () {
            this.cleanups.forEach(function (c) { return c(); });
            this.cleanups.length = 0;
            remove(this.grid);
            this.grid = null;
            this.hiddenInput = null;
            this.cellInput = null;
            this.rows = null;
            this.cells = null;
        };
        Grid.prototype.on = function (event, handler) {
            this.events.addHandler(event, handler);
        };
        Grid.prototype.update = function (row, col, value) {
            this.setCell(this.rows[row].cells[col], value);
        };
        Grid.prototype.addRows = function (rows) {
            var _this = this;
            if (this.options.canAddRows) {
                [].push.apply(this.options.rows, rows);
                rows.forEach(function (r) {
                    var newRow = _this.createRow(r);
                    newRow.cells.forEach(function (c) { return _this.emitInput(c); });
                });
                this.flattenCells();
            }
        };
        Grid.prototype.addRow = function () {
            this.addRows([this.options.cols.map(function (c) { return ''; })]);
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
                    _this.hiddenInput.focus();
                    _this.activeCell = _this.rows[0].cells[i_1];
                    _this.emitSelect();
                }
                on(document, 'mouseup', mouseup);
                on(document, 'mousemove', mousemove);
                e.preventDefault();
            });
            return column;
        };
        Grid.prototype.createRow = function (r) {
            var row = new Row(this.rows.length);
            row.addCells(r);
            this.rows.push(row);
            this.grid.appendChild(row.element);
            return row;
        };
        Grid.prototype.createRows = function () {
            var _this = this;
            this.rows = [];
            this.options.rows.forEach(function (r) { return _this.createRow(r); });
            this.flattenCells();
        };
        Grid.prototype.flattenCells = function () {
            this.cells = this.rows.reduce(function (a, b) { return a.concat(b.cells); }, []);
        };
        Grid.prototype.initMouse = function () {
            var _this = this;
            var rows = this.rows;
            var downCellIndex;
            var downRowIndex;
            var selectionIdentifier = null;
            var rememberSelection = function (r1, c1, r2, c2) { return '' + r1 + c1 + r2 + c2; };
            var getTargetCell = function (e) {
                var cell = e.target;
                if (!cell || !cell.parentElement) {
                    return;
                }
                var cellIndexAttr = cell.getAttribute('data-ci');
                var rowIndexAttr = cell.parentElement.getAttribute('data-ri');
                var cellIndex = +cellIndexAttr;
                var rowIndex = +rowIndexAttr;
                if (cellIndexAttr && rowIndexAttr && !isNaN(cellIndex) && !isNaN(rowIndex)) {
                    return _this.rows[rowIndex].cells[cellIndex];
                }
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
                    if (cell.input) {
                        return;
                    }
                    else if (cell === _this.activeCell && !cell.readonly && timeSinceLast < 300) {
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
            this.hiddenInput.focus(); // focus to receive paste events
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
                if (activeCell && !activeCell.readonly && activeCell.input) {
                    _this.updatValue(activeCell);
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
                if (activeCell && !activeCell.readonly && !activeCell.input) {
                    activeCell.startEdit(cellInput, true);
                    _this.emitFocus();
                }
                else {
                    e.preventDefault();
                }
            }));
        };
        Grid.prototype.initClipboard = function () {
            var _this = this;
            on(this.hiddenInput, 'paste', function (e) {
                // Don't actually paste to hidden input
                e.preventDefault();
                var text = (e.clipboardData || window.clipboardData).getData('text');
                var csv = parseCSV(text, '\t');
                var activeCell = _this.activeCell;
                if (!activeCell) {
                    return;
                }
                csv.forEach(function (csvRow, csvRowIndex) {
                    var tableRow = _this.rows[activeCell.row + csvRowIndex];
                    if (!tableRow && _this.options.canAddRows) {
                        var prevRow = _this.rows[activeCell.row];
                        _this.addRows([prevRow.cells.map(function (c) { return c.value(); })]);
                        tableRow = _this.rows[activeCell.row + csvRowIndex];
                    }
                    var tableCol = activeCell.col;
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
                this.updatValue(cell);
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
        Grid.prototype.updatValue = function (cell) {
            var colIndex = cell.col;
            var rowOption = this.options.rows[cell.row];
            var cellValue = rowOption[colIndex];
            if (typeof cellValue === 'string' || typeof cellValue === 'number') {
                rowOption[colIndex] = cell.value();
            }
            else {
                cellValue.value = cell.value();
            }
            this.emitInput(cell);
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
    var Cell = /** @class */ (function () {
        function Cell(row, col, value) {
            this.row = row;
            this.col = col;
            this.readonly = false;
            var text;
            if (typeof value === 'string' || typeof value === 'number') {
                text = value.toString();
            }
            else {
                this.readonly = value.readonly;
                text = value.value.toString();
            }
            var className = CSS_CELL + (this.readonly ? ' ' + CSS_READONLY : '');
            this.element = createElement("<div data-ci=\"" + col + "\" class=\"" + className + "\">" + text + "</div>");
        }
        Cell.prototype.selected = function () {
            return this.element.className.indexOf(CSS_SELECTED) >= 0;
        };
        Cell.prototype.select = function (doSelect) {
            if (doSelect === void 0) { doSelect = true; }
            var classList = this.element.classList;
            if (doSelect) {
                classList.add(CSS_SELECTED);
            }
            else {
                classList.remove(CSS_SELECTED);
            }
            return this;
        };
        Cell.prototype.activate = function (doActivate) {
            if (doActivate === void 0) { doActivate = true; }
            var classList = this.element.classList;
            if (doActivate) {
                classList.add(CSS_ACTIVE);
                classList.add(CSS_SELECTED);
            }
            else {
                classList.remove(CSS_ACTIVE);
                classList.remove(CSS_EDITING);
                if (this.input) {
                    this.input.blur();
                    remove(this.input);
                    this.element.innerHTML = this.input.value;
                    this.input = null;
                }
            }
            return this;
        };
        Cell.prototype.value = function () {
            return this.input ? this.input.value : this.element.innerHTML;
        };
        Cell.prototype.set = function (value) {
            if (!this.readonly) {
                if (this.input) {
                    this.input.value = value;
                }
                else {
                    this.element.innerHTML = value;
                }
            }
        };
        Cell.prototype.startEdit = function (input, select) {
            if (select === void 0) { select = false; }
            if (this.readonly) {
                return;
            }
            var element = this.element;
            this.input = input;
            input.value = element.innerHTML;
            if (select) {
                input.select();
            }
            input.style.width = element.offsetWidth - 2 + 'px';
            element.classList.add(CSS_EDITING);
            element.innerHTML = '';
            element.appendChild(input);
            input.focus();
        };
        return Cell;
    }());
    var Row = /** @class */ (function () {
        function Row(index) {
            this.index = index;
            this.cells = [];
            this.element = createElement("<div data-ri=\"" + index + "\" class=\"" + CSS_ROW + "\"></div>");
        }
        Row.prototype.addCells = function (cells) {
            var _this = this;
            cells.forEach(function (c, columnIndex) {
                var cell = new Cell(_this.index, columnIndex, c);
                _this.cells.push(cell);
                _this.element.appendChild(cell.element);
            });
        };
        return Row;
    }());
    // ----
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

    exports.Grid = Grid;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=celled.js.map
