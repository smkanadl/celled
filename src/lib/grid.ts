import { EventEmitter, EventHandler, EventHandlerBase } from './events';
import { parseCSV, writeCSV } from './csv';

export type CellValue = string|number;

export interface CellValueOptions {
    readonly?: boolean;
    value: CellValue;
}

export interface GridOptions {
    cols: Array<string|number>;
    rows: Array<Array<CellValue|CellValueOptions>>;
    input?: HTMLInputElement|(() => HTMLInputElement);
}

export interface InputArgs {
    grid: Grid;
    row: number;
    col: number;
    value: string;
}

const CSS_PREFIX = 'ced';
const CSS_GRID     = `${CSS_PREFIX}-grid`;
const CSS_ROW      = `${CSS_PREFIX}-row`;
const CSS_CELL     = `${CSS_PREFIX}-cell`;
const CSS_HEAD     = `${CSS_PREFIX}-head`;
const CSS_RESIZER  = `${CSS_PREFIX}-resizer`;
const CSS_EDITING  = `${CSS_PREFIX}-editing`;
const CSS_ACTIVE   = `${CSS_PREFIX}-active`;
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
        const grid = this.grid = createElement(
            `<div class="${CSS_GRID}"><div class="${CSS_ROW} ${CSS_HEAD}"></div></div>`);
        container.appendChild(this.hiddenInput);
        container.appendChild(grid);
        const head = query(container, css(CSS_HEAD));
        options.cols.forEach((c, index) => head.appendChild(this.createHeadCell(c, index)));
        options.rows.forEach((r, index) => {
            const row = new Row(index);
            row.addCells(r);
            rows.push(row);
            grid.appendChild(row.element);
        });
        this.cells = this.rows.reduce((a, b) => a.concat(b.cells), [] as Cell[]);
        queryAll(head, css(CSS_CELL)).forEach((c: HTMLElement) => c.style.width = c.offsetWidth + 'px');

        this.initMouse();
        this.initKeys();
        this.initClipboard();
    }

    /**
     * Adds an event listener.
     * Grid fires these events:
     * 'input', 'focus'
     */
    on(event: 'input' | 'focus', handler: EventHandler<InputArgs>);
    on(event: string, handler: EventHandlerBase) {
        this.events.addHandler(event, handler);
    }

    update(row: number, col: number, value: string) {
        this.setCell(this.rows[row].cells[col], value);
    }

    private createHeadCell(text: string|number, columnIndex: number) {
        const column = createElement(`<div class="${CSS_CELL}" data-ci="${columnIndex}"><span>${text}</span></div>`);
        const resizer = createElement(`<div class="${CSS_RESIZER}"></div>`);
        column.appendChild(resizer);

        let downPosition = null;
        let nextColumn = null;
        let currentWidth = null;
        let currentNextWidth = null;
        let selecting = false;

        const mousemove = (e: MouseEvent) => {
            if (selecting) {
                let col = e.target as Element;
                while (col) {
                    const ciAttr = col.getAttribute('data-ci');
                    const ci = +ciAttr;
                    if (ciAttr !== null && !isNaN(ci)) {
                        const minCol = Math.min(columnIndex, ci);
                        const maxCol = Math.max(columnIndex, ci);
                        this.cells.forEach(c => c.select(c.col >= minCol && c.col <= maxCol));
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
            selecting = false;
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
                selecting = true;
                this.cells.forEach(c => c.activate(false).select(c.col === i));
                this.hiddenInput.focus();
                this.activeCell = this.rows[0].cells[i];
            }
            on(document, 'mouseup', mouseup);
            on(document, 'mousemove', mousemove);
            e.preventDefault();
        })

        return column;
    }

    private initMouse() {
        const rows = this.rows;
        let downCellIndex: number;
        let downRowIndex: number;

        const mousemove = (moveEvent: MouseEvent) => {
            const hoveredCell = moveEvent.target as Element;
            const cellIndex = +hoveredCell.getAttribute('data-ci');
            const rowIndex = +hoveredCell.parentElement.getAttribute('data-ri');
            if (!isNaN(cellIndex) && !isNaN(rowIndex)) {
                this.unselect();
                const firstRow = Math.min(rowIndex, downRowIndex);
                const lastRow  = Math.max(rowIndex, downRowIndex);
                const firstCol = Math.min(cellIndex, downCellIndex);
                const lastCol  = Math.max(cellIndex, downCellIndex);
                for (let ri = firstRow; ri <= lastRow; ++ri) {
                    for (let ci = firstCol; ci <= lastCol; ++ci) {
                        this.rows[ri].cells[ci].select();
                    }
                }
            }
        };

        const mouseup = () => {
            off(document, 'mousemove', mousemove);
            off(document, 'mouseup', mouseup);
        };

        rows.forEach((row, rowIndex) => row.cells.forEach((cell, cellIndex) => {
            const cellElement = cell.element;
            let lastMouseDown = Date.now();
            on(cellElement, 'mousedown', (e: MouseEvent) => {

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
                    this.hiddenInput.focus();  // focus to receive paste events
                    downRowIndex = rowIndex;
                    downCellIndex = cellIndex;
                    this.cells.forEach(c => c.select(false).activate(false));
                    this.activeCell = cell.activate();
                    on(document, 'mouseup', mouseup);
                    on(document, 'mousemove', mousemove);
                }
                e.preventDefault();
            });
        }));

        on(document, 'mouseup', (e: MouseEvent) => {
            if (this.activeCell) {
                // Unselect all if was click outside of the grid.
                for (let target = e.target as Node; target; target = target.parentNode) {
                    if (target === this.container) {
                        return;
                    }
                }
                this.cells.forEach(c => c.select(false).activate(false));
            }
        });
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
        });

        const onInput = () => {
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
            for (let ri = activeCell.row;; ri++) {
                const row = this.rows[ri];
                const csvRow = [];
                if (!row || !row.cells[activeCell.col] || !row.cells[activeCell.col].selected()) {
                    break;
                }
                for (let ci = activeCell.col;; ++ci) {
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

    private unselect() {
        this.cells.forEach(c => c.select(false));
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
}

class Cell {
    element: HTMLElement;
    input: HTMLInputElement;
    readonly = false;

    constructor(public row: number, public col: number, value: CellValue|CellValueOptions) {
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

    addCells(cells: Array<CellValue|CellValueOptions>) {
        cells.forEach((c, columnIndex) => {
            const cell = new Cell(this.index, columnIndex, c);
            this.cells.push(cell);
            this.element.appendChild(cell.element);
        });
    }
}



// ----
function query(elOrCss, css?): Element {
    if (!css) {
        css = elOrCss;
        elOrCss = document;
    }
    return elOrCss.querySelector(css);
}

function queryAll(elOrCss, css?): Element[] {
    if (!css) {
        css = elOrCss;
        elOrCss = document;
    }
    return [].slice.call(elOrCss.querySelectorAll(css));
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
