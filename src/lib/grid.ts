import { EventEmitter, EventHandler, EventHandlerBase } from './events';
import { parseCSV, writeCSV } from './csv';

export type CellValue = string | number;

export interface CellValueOptions {
    readonly?: boolean;
    value: CellValue;
}

export type RowOptions = Array<CellValue | CellValueOptions>;

export interface GridOptions {
    cols: Array<string | number>;
    rows: Array<RowOptions>;
    input?: HTMLInputElement | (() => HTMLInputElement);
    canAddRows?: boolean;
}

export interface InputArgs {
    grid: Grid;
    row: number;
    col: number;
    value: string;
}

export interface SelectArgs {
    grid: Grid;
    selection: Array<{ row: number, col: number }>;
}

const CSS_PREFIX = 'ced';
const CSS_CONTAINER = `${CSS_PREFIX}-grid-container`;
const CSS_GRID = `${CSS_PREFIX}-grid`;
const CSS_ROW = `${CSS_PREFIX}-row`;
const CSS_CELL = `${CSS_PREFIX}-cell`;
const CSS_HEAD = `${CSS_PREFIX}-head`;
const CSS_RESIZER = `${CSS_PREFIX}-resizer`;
const CSS_EDITING = `${CSS_PREFIX}-editing`;
const CSS_ACTIVE = `${CSS_PREFIX}-active`;
const CSS_SELECTED = `${CSS_PREFIX}-selected`;
const CSS_READONLY = `${CSS_PREFIX}-readonly`;

function css(className) {
    return '.' + className;
}

export class Grid {

    private container: Element;
    private grid: HTMLElement;
    private rows: Row[] = [];
    private cells: Cell[] = [];
    private activeCell: Cell;
    private events: EventEmitter = new EventEmitter();
    private hiddenInput: HTMLElement;
    private options: GridOptions;
    private cellInput: HTMLInputElement;

    constructor(container: string | Element) {
        this.container = typeof container === 'string' ? query(container) : container;
    }

    init(options: GridOptions) {
        this.options = options;
        const container = this.container;
        const rows = this.rows;
        container.innerHTML = '';
        rows.length = 0;

        if (options.input) {
            this.cellInput = typeof options.input === 'function' ? options.input() : options.input;
            remove(this.cellInput);
        }
        else {
            this.cellInput = createElement<HTMLInputElement>(`<input type="text" >`);
        }
        this.hiddenInput = createElement(
            '<div style="position:absolute; z-index:-1; left:2px; top: 2px;" contenteditable tabindex="0"></div>');
        const gridContainer = createElement(`<div class="${CSS_CONTAINER}"></div>`);
        const grid = this.grid = createElement(
            `<div class="${CSS_GRID}"><div class="${CSS_ROW} ${CSS_HEAD}"></div></div>`);

        container.appendChild(gridContainer);
        gridContainer.appendChild(this.hiddenInput);
        gridContainer.appendChild(grid);
        const head = query(container, css(CSS_HEAD));
        options.cols.forEach((c, index) => head.appendChild(this.createHeadCell(c, index)));
        queryAll(head, css(CSS_CELL)).forEach((c: HTMLElement) => c.style.width = c.offsetWidth + 'px');
        this.createRows();
        this.initMouse();
        this.initKeys();
        this.initClipboard();
    }

    /**
     * Adds an event listener.
     * Grid fires these events:
     * 'input', 'focus', 'select'
     */
    on(event: 'input' | 'focus', handler: EventHandler<InputArgs>);
    on(event: 'select', handler: EventHandler<SelectArgs>);
    on(event: string, handler: EventHandlerBase) {
        this.events.addHandler(event, handler);
    }

    update(row: number, col: number, value: string) {
        this.setCell(this.rows[row].cells[col], value);
    }

    addRows(rows: RowOptions[]) {
        if (this.options.canAddRows) {
            [].push.apply(this.options.rows, rows);
            rows.forEach(r => this.createRow(r));
            this.flattenCells();
        }
    }

    private createHeadCell(text: string | number, columnIndex: number) {
        const column = createElement(`<div class="${CSS_CELL}" data-ci="${columnIndex}"><span>${text}</span></div>`);
        const resizer = createElement(`<div class="${CSS_RESIZER}"></div>`);
        column.appendChild(resizer);

        let downPosition = null;
        let nextColumn = null;
        let currentWidth = null;
        let currentNextWidth = null;
        let selection = null;

        const mousemove = (e: MouseEvent) => {
            if (selection) {
                let col = e.target as Element;
                while (col) {
                    const ciAttr = col.getAttribute('data-ci');
                    const ci = +ciAttr;
                    if (ciAttr !== null && !isNaN(ci)) {
                        const minCol = Math.min(columnIndex, ci);
                        const maxCol = Math.max(columnIndex, ci);
                        if (selection[0] !== minCol || selection[1] !== maxCol) {
                            selection = [minCol, maxCol];
                            this.cells.forEach(c => c.select(c.col >= minCol && c.col <= maxCol));
                            this.emitSelect();
                        }
                        break;
                    }
                    col = col.parentElement;
                }
            }
            else {
                const diff = e.pageX - downPosition;
                if (nextColumn) {
                    nextColumn.style.width = (currentNextWidth - diff) + 'px';
                }
                column.style.width = (currentWidth + diff) + 'px';
            }
        };

        const mouseup = () => {
            downPosition = null;
            selection = null;
            off(document, 'mousemove', mousemove);
            off(document, 'mouseup', mouseup);
        };

        on(column, 'mousedown', (e: MouseEvent) => {
            if (e.target === resizer) {
                // Resize columns
                nextColumn = column.nextElementSibling;
                downPosition = e.pageX;
                currentWidth = column.offsetWidth;
                currentNextWidth = nextColumn ? nextColumn.offsetWidth : null;
            }
            else if (this.rows.length) {
                // Select column
                const i = +column.getAttribute('data-ci');
                selection = true;
                this.cells.forEach(c => c.activate(false).select(c.col === i));
                selection = [i, i];
                this.hiddenInput.focus();
                this.activeCell = this.rows[0].cells[i];
                this.emitSelect();
            }
            on(document, 'mouseup', mouseup);
            on(document, 'mousemove', mousemove);
            e.preventDefault();
        });

        return column;
    }

    private createRow(r: RowOptions) {
        const row = new Row(this.rows.length);
        row.addCells(r);
        this.rows.push(row);
        this.grid.appendChild(row.element);
    }

    private createRows() {
        this.rows = [];
        this.options.rows.forEach(r => this.createRow(r));
        this.flattenCells();
    }

    private flattenCells() {
        this.cells = this.rows.reduce((a, b) => a.concat(b.cells), [] as Cell[]);
    }

    private initMouse() {
        const rows = this.rows;
        let downCellIndex: number;
        let downRowIndex: number;

        let selectionIdentifier: string = null;
        const rememberSelection = (r1, c1, r2, c2) => '' + r1 + c1 + r2 + c2;

        const getTargetCell = (e: MouseEvent) => {
            const cell = e.target as Element;
            if (!cell || !cell.parentElement) {
                return;
            }
            const cellIndexAttr = cell.getAttribute('data-ci');
            const rowIndexAttr = cell.parentElement.getAttribute('data-ri');
            const cellIndex = +cellIndexAttr;
            const rowIndex = +rowIndexAttr;
            if (cellIndexAttr && rowIndexAttr && !isNaN(cellIndex) && !isNaN(rowIndex)) {
                return this.rows[rowIndex].cells[cellIndex];
            }
        };

        const mousemove = (moveEvent: MouseEvent) => {
            const targetCell = getTargetCell(moveEvent);
            if (targetCell) {
                const rowIndex = targetCell.row;
                const cellIndex = targetCell.col;
                const firstRow = Math.min(rowIndex, downRowIndex);
                const lastRow = Math.max(rowIndex, downRowIndex);
                const firstCol = Math.min(cellIndex, downCellIndex);
                const lastCol = Math.max(cellIndex, downCellIndex);
                const newSelectionIdentifier = rememberSelection(firstRow, firstCol, lastRow, lastCol);
                if (selectionIdentifier !== newSelectionIdentifier) {
                    selectionIdentifier = newSelectionIdentifier;
                    this.unselect();
                    for (let ri = firstRow; ri <= lastRow; ++ri) {
                        for (let ci = firstCol; ci <= lastCol; ++ci) {
                            this.rows[ri].cells[ci].select();
                        }
                    }
                    this.emitSelect();
                }
            }
        };

        const mouseup = () => {
            off(document, 'mousemove', mousemove);
            off(document, 'mouseup', mouseup);
        };

        let lastMouseDown = Date.now();
        on(this.grid, 'mousedown', (e: MouseEvent) => {
            const cell = getTargetCell(e);
            if (cell) {
                const timeSinceLast = Date.now() - lastMouseDown;
                lastMouseDown = Date.now();
                if (cell.input) {
                    return;
                }
                else if (cell === this.activeCell && !cell.readonly && timeSinceLast < 300) {
                    cell.startEdit(this.cellInput);
                    this.emitFocus();
                }
                else {
                    const rowIndex = cell.row;
                    const cellIndex = cell.col;
                    downRowIndex = rowIndex;
                    downCellIndex = cellIndex;
                    selectionIdentifier = rememberSelection(rowIndex, cellIndex, rowIndex, cellIndex);
                    this.activate(cell);
                    on(document, 'mouseup', mouseup);
                    on(document, 'mousemove', mousemove);
                }
                e.preventDefault();
            }
        });

        on(document, 'mouseup', (e: MouseEvent) => {
            if (this.activeCell) {
                // Unselect all if was click outside of the grid.
                for (let target = e.target as Node; target; target = target.parentNode) {
                    if (target === this.container) {
                        return;
                    }
                }
                this.activeCell.activate(false);
                if (this.unselect()) {
                    this.emitSelect();
                }
            }
        });
    }

    private activate(cell: Cell, doActivate = true) {
        if (this.activeCell) {
            this.activeCell.activate(false);
        }
        let selectionChanged = false;
        this.cells.forEach(c => {
            selectionChanged = c === cell ? (c.selected() !== doActivate) : (selectionChanged || c.selected());
            c.select(false);
        });
        this.activeCell = cell.select(doActivate).activate(doActivate);
        if (selectionChanged) {
            this.emitSelect();
        }
        this.hiddenInput.focus();  // focus to receive paste events
    }

    private moveActive(rowDelta: number, colDelta: number) {
        const activeCell = this.activeCell;
        if (activeCell) {
            const nextRow = this.rows[activeCell.row + rowDelta];
            if (nextRow) {
                const cell = nextRow.cells[activeCell.col + colDelta];
                if (cell) {
                    this.activate(cell);
                }
            }
        }
    }

    private initKeys() {
        const hiddenInput = this.hiddenInput;

        on(hiddenInput, 'keydown', (e: KeyboardEvent) => {
            e = e || window.event as KeyboardEvent;
            const keyCode = e.keyCode;
            if (keyCode === 46) {  // del
                this.cells.forEach(cell => {
                    if (cell.selected()) {
                        this.setCell(cell, '');
                    }
                });
                e.preventDefault();
            }
            if (keyCode === 37) {
                this.moveActive(0, -1);
            }
            if (keyCode === 38) {
                this.moveActive(-1, 0);
            }
            if (keyCode === 39) {
                this.moveActive(0, 1);
            }
            if (keyCode === 40) {
                this.moveActive(1, 0);
            }
        });

        const onInput = (e: KeyboardEvent) => {
            const activeCell = this.activeCell;
            if (activeCell && !activeCell.readonly && activeCell.input) {
                this.updatValue(activeCell);
                this.cells.forEach(cell => {
                    if (cell.selected() && cell !== activeCell) {
                        this.setCell(cell, activeCell.value());
                    }
                });
            }
        };

        on(this.cellInput, 'input', onInput);
        on(this.cellInput, 'keydown', (e: KeyboardEvent) => {
            if (e.keyCode === 13) {
                // ENTER, stop edit and move to next row
                this.moveActive(1, 0);
                e.preventDefault();
            }
            if (e.keyCode === 27) {
                // ESCAPE, stop edit but stay at same cell
                this.moveActive(0, 0);
                e.preventDefault();
            }
        });

        on(hiddenInput, 'keypress', (e: KeyboardEvent) => {
            const activeCell = this.activeCell;
            if (activeCell && !activeCell.readonly && !activeCell.input) {
                activeCell.startEdit(this.cellInput, true);
                this.emitFocus();
            }
            else {
                e.preventDefault();
            }
        });

    }

    private initClipboard() {
        on(this.hiddenInput, 'paste', (e: ClipboardEvent) => {
            // Don't actually paste to hidden input
            e.preventDefault();
            const text = (e.clipboardData || (window as any).clipboardData).getData('text');
            const csv = parseCSV(text, '\t');
            const activeCell = this.activeCell;
            if (!activeCell) {
                return;
            }
            csv.forEach((csvRow, csvRowIndex) => {
                const tableRow = this.rows[activeCell.row + csvRowIndex];
                if (!tableRow && this.options.canAddRows) {
                    const prevRow = this.rows[activeCell.row];
                    this.addRows([prevRow.cells.map(c => c.value())]);
                }
                const tableCol = activeCell.col;
                const isLastEmptyRow = csvRow.length === 1 && csvRow[0] === '';
                if (tableRow && !isLastEmptyRow) {
                    csvRow.forEach((csvCell, csvColIndex) => {
                        const cell = tableRow.cells[tableCol + csvColIndex];
                        if (cell && !cell.readonly) {
                            this.setCell(cell, csvCell);
                            cell.select();
                        }
                    });
                }
            });
        });

        on(this.hiddenInput, 'copy', (e: ClipboardEvent) => {
            e.preventDefault();
            const activeCell = this.activeCell;
            if (!activeCell) {
                return;
            }

            const csv = [];
            for (let ri = activeCell.row; ; ri++) {
                const row = this.rows[ri];
                const csvRow = [];
                if (!row || !row.cells[activeCell.col] || !row.cells[activeCell.col].selected()) {
                    break;
                }
                for (let ci = activeCell.col; ; ++ci) {
                    const cell = row.cells[ci];
                    if (!cell || !cell.selected()) {
                        break;
                    }
                    csvRow.push(cell.value());
                }
                csv.push(csvRow);
            }
            const clipboard = (e.clipboardData || (window as any).clipboardData);
            clipboard.setData('text/plain', writeCSV(csv, '\t'));
        });
    }

    private setCell(cell: Cell, value: string) {
        if (!cell.readonly) {
            cell.set(value);
            this.updatValue(cell);
        }
    }

    private unselect(): boolean {
        let selectionChanged = false;
        this.cells.forEach(c => {
            selectionChanged = selectionChanged || c.selected();
            c.select(false);
        });
        return selectionChanged;
    }

    private updatValue(cell: Cell) {
        const colIndex = cell.col;
        const rowOption = this.options.rows[cell.row];
        const cellValue = rowOption[colIndex];
        if (typeof cellValue === 'string' || typeof cellValue === 'number') {
            rowOption[colIndex] = cell.value();
        }
        else {
            cellValue.value = cell.value();
        }
        this.emitInput(cell);
    }

    private emitInput(cell: Cell) {
        this.events.emit<InputArgs>('input', {
            grid: this,
            col: cell.col,
            row: cell.row,
            value: cell.value(),
        });
    }

    private emitFocus() {
        const cell = this.activeCell;
        this.events.emit<InputArgs>('focus', {
            grid: this,
            col: cell.col,
            row: cell.row,
            value: cell.value(),
        });
    }

    private emitSelect() {
        this.events.emit<SelectArgs>('select', {
            grid: this,
            selection: this.cells.filter(c => c.selected()).map(c => ({
                row: c.row,
                col: c.col,
            })),
        });
    }
}

class Cell {
    element: HTMLElement;
    input: HTMLInputElement;
    readonly = false;

    constructor(public row: number, public col: number, value: CellValue | CellValueOptions) {
        let text: string;
        if (typeof value === 'string' || typeof value === 'number') {
            text = value.toString();
        }
        else {
            this.readonly = value.readonly;
            text = value.value.toString();
        }
        const className = CSS_CELL + (this.readonly ? ' ' + CSS_READONLY : '');
        this.element = createElement(`<div data-ci="${col}" class="${className}">${text}</div>`);
    }

    selected() {
        return this.element.className.indexOf(CSS_SELECTED) >= 0;
    }

    select(doSelect = true) {
        const classList = this.element.classList;
        if (doSelect) {
            classList.add(CSS_SELECTED);
        }
        else {
            classList.remove(CSS_SELECTED);
        }
        return this;
    }

    activate(doActivate = true) {
        const classList = this.element.classList;
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
    }

    value() {
        return this.input ? this.input.value : this.element.innerHTML;
    }

    set(value: string) {
        if (!this.readonly) {
            if (this.input) {
                this.input.value = value;
            }
            else {
                this.element.innerHTML = value;
            }
        }
    }

    startEdit(input: HTMLInputElement, clear = false, text = '') {
        if (this.readonly) {
            return;
        }
        const element = this.element;
        this.input = input;
        if (!clear) {
            input.value = element.innerHTML;
        }
        else {
            input.value = text;
        }
        input.style.width = element.offsetWidth - 2 + 'px';
        element.classList.add(CSS_EDITING);
        element.innerHTML = '';
        element.appendChild(input);
        input.focus();
    }
}

class Row {
    element: Element;
    cells: Cell[] = [];

    constructor(public index: number) {
        this.element = createElement(`<div data-ri="${index}" class="${CSS_ROW}"></div>`) as Element;
    }

    addCells(cells: Array<CellValue | CellValueOptions>) {
        cells.forEach((c, columnIndex) => {
            const cell = new Cell(this.index, columnIndex, c);
            this.cells.push(cell);
            this.element.appendChild(cell.element);
        });
    }
}

// ----
function query(elOrCss, cssSelector?): Element {
    if (!cssSelector) {
        cssSelector = elOrCss;
        elOrCss = document;
    }
    return elOrCss.querySelector(cssSelector);
}

function queryAll(elOrCss, cssSelector?): Element[] {
    if (!cssSelector) {
        cssSelector = elOrCss;
        elOrCss = document;
    }
    return [].slice.call(elOrCss.querySelectorAll(cssSelector));
}

function createElement<T extends HTMLElement>(html: string): T {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild as T;
}

function on(element: Node, event: string, listener: EventListenerOrEventListenerObject) {
    element.addEventListener(event, listener);
}

function off(element: Node, event: string, listener: EventListenerOrEventListenerObject) {
    element.removeEventListener(event, listener);
}

function getKey(e: KeyboardEvent) {
    e = e || window.event as KeyboardEvent;
    return String.fromCharCode(e.keyCode || e.which);
}

function remove(node: Node) {
    if (node.parentNode) {
        node.parentElement.removeChild(node);
    }
}
