import { EventEmitter, EventHandler, EventHandlerBase } from './events';
import { parseCSV, writeCSV } from './csv';
import { query, remove, createElement, queryAll, off, on } from './dom';
import { CellUpdateOptions, CellValue, CellValueOptions, GridOptions, RowOptions, ScrollOptions } from './options';
import { Cell } from './cell';
import { CSS_CELL, CSS_CONTAINER, CSS_CONTAINER_SCROLL, CSS_GRID, CSS_HEAD, CSS_HEAD_STICKY, CSS_RESIZER, CSS_ROW } from './css';
import { Row } from './row';
import { DefaultRenderer, Renderer, VirtualRenderer } from './render';


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


export class Grid {
    private container: HTMLElement;
    private grid: HTMLElement;
    private rows: Row[] = [];
    private cells: Cell[] = [];
    private activeCell: Cell;
    private events: EventEmitter = new EventEmitter();
    private options: GridOptions;
    private cellInput: HTMLInputElement;
    private hiddenInput: HTMLElement;
    private cleanups: Array<() => any> = [];
    private render: Renderer;

    constructor(container: string | HTMLElement, options?: GridOptions) {
        this.container = typeof container === 'string' ? query<HTMLElement>(container) : container;
        if (options) {
            this.init(options);
        }
    }

    init(options: GridOptions) {
        options.scroll = getScrollOptions(options);
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
            this.cellInput = createElement<HTMLInputElement>(`<input id="celled-cell-input" type="text" >`);
        }
        this.hiddenInput = createElement(
            '<div id="celled-hidden-input" style="position:absolute; z-index:-1; left:2px; top: 2px;" contenteditable tabindex="0"></div>');

        if (options.scroll) {
            container.classList.add(CSS_CONTAINER_SCROLL);
        }
        const gridContainer = createElement(`<div class="${CSS_CONTAINER}"></div>`);

        const stickyHeader = options.scroll.stickyHeader;
        const headCss = `${CSS_ROW} ${CSS_HEAD} ${stickyHeader ? CSS_HEAD_STICKY : ''}`;
        const head = createElement(`<div class="${headCss}"></div>`);
        const grid = this.grid = createElement(`<div class="${CSS_GRID}"></div>`);

        container.appendChild(gridContainer);
        gridContainer.appendChild(this.hiddenInput);
        gridContainer.appendChild(grid);
        options.cols.forEach((c, index) => head.appendChild(this.createHeadCell(c, index)));

        const renderOptions = { container, gridContainer, grid, head };
        this.render = options.scroll.virtualScroll ? new VirtualRenderer(renderOptions) : new DefaultRenderer(renderOptions);

        this.createRows();
        this.initMouse();
        this.initKeys();
        this.initClipboard();
        this.resetColumnWidths();
    }

    destroy() {
        this.render.destroy();
        this.cleanups.forEach(c => c());
        this.cleanups.length = 0;
        remove(this.grid);
        this.cells.forEach(c => c.destroy());
        this.grid = null;
        this.hiddenInput = null;
        this.cellInput = null;
        this.rows = null;
        this.cells = null;
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

    update(rowIndex: number, colIndex: number, value: CellValue | CellUpdateOptions, emit?: boolean) {
        const row = this.rows[rowIndex];
        const cell = row.cells[colIndex];
        if (cell) {
            cell.set(value);
            this.updateValue(cell, emit);
        }
    }

    addRows(rows: RowOptions[]) {
        [].push.apply(this.options.rows, rows);
        rows.forEach(r => {
            const newRow = this.createAndAddRow(r);
            newRow.cells.forEach(c => this.emitInput(c));
        });
        this.flattenCells();
        this.renderRows();
    }

    addRow() {
        this.addRows([this.options.cols.map(c => '')]);
    }

    private resetColumnWidths() {
        const allCells = queryAll(this.container, `${css(CSS_HEAD)} ${css(CSS_CELL)}`);
        allCells.forEach((c: HTMLElement, i) => {
            c.style.width = c.offsetWidth + 'px';
        });
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
                // column resizing
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
            this.resetColumnWidths();
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
                this.focusHiddenInput();
                this.activeCell = this.rows[0].cells[i];
                this.emitSelect();
            }
            on(document, 'mouseup', mouseup);
            on(document, 'mousemove', mousemove);
            e.preventDefault();
        });

        return column;
    }

    private focusHiddenInput() {
        // Focus the hidden input element to receive paste events.
        // Prevent scrolling up if input was blurred at the end of a long table.
        this.hiddenInput.focus({ preventScroll: true });
    }

    private createAndAddRow(r: RowOptions): Row {
        const row = new Row(this.rows.length);
        row.addCells(r, this.updateValueCallback());
        this.rows.push(row);
        return row;
    }

    private updateValueCallback() {
        return cell => this.emitInput(cell);
    }

    private createRows() {
        this.rows = [];
        this.options.rows.forEach(r => this.createAndAddRow(r));
        this.flattenCells();
        this.renderRows();
    }

    private renderRows() {
        this.render.rerender(this.rows);
    }

    private flattenCells() {
        this.cells = this.rows.reduce((a, b) => a.concat(b.cells), [] as Cell[]);
    }

    private initMouse() {
        let downCellIndex: number;
        let downRowIndex: number;

        let selectionIdentifier: string = null;
        const rememberSelection = (r1, c1, r2, c2) => '' + r1 + c1 + r2 + c2;

        const findTargetCell = (cell: Element, level = 0): Cell => {
            if (!cell || !cell.parentElement) {
                return;
            }
            const cellIndexAttr = cell.getAttribute('data-ci');
            if (cellIndexAttr === null && level < 2) {
                return findTargetCell(cell.parentElement, level + 1);
            }
            const rowIndexAttr = cell.parentElement.getAttribute('data-ri');
            const cellIndex = +cellIndexAttr;
            const rowIndex = +rowIndexAttr;
            if (cellIndexAttr && rowIndexAttr && !isNaN(cellIndex) && !isNaN(rowIndex)) {
                return this.rows[rowIndex].cells[cellIndex];
            }
        };

        const getTargetCell = (e: MouseEvent) => {
            const cell = e.target as Element;
            return findTargetCell(cell);
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
        const cleanupMousedown = on(this.grid, 'mousedown', (e: MouseEvent) => {
            const cell = getTargetCell(e);
            if (cell) {
                const timeSinceLast = Date.now() - lastMouseDown;
                lastMouseDown = Date.now();
                if (cell.takesMouse()) {
                    // The cell is already in edit mode. Do nothing and continue with default event handling
                    return;
                }
                else if (cell === this.activeCell && !cell.readonly && timeSinceLast < 300) {
                    // Double click on cell to start edit mode
                    // if (Array.isArray(cell.options)) {
                    //     cell.startSelect(this.cellSelect);
                    // }
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
        this.cleanups.push(cleanupMousedown);

        const cleanupMouseup = on(document, 'mouseup', (e: MouseEvent) => {
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
        this.cleanups.push(cleanupMouseup);
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
        this.focusHiddenInput();
    }

    private moveActive(rowDelta: number, colDelta: number, addRows = false) {
        const activeCell = this.activeCell;
        if (activeCell) {
            const rows = this.rows;
            const rowIndex = activeCell.row + rowDelta;
            while (addRows && this.options.canAddRows && rowIndex >= rows.length) {
                this.addRow();
            }
            const nextRow = rows[rowIndex];
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
        const cellInput = this.cellInput;

        this.cleanups.push(on(hiddenInput, 'keydown', (e: KeyboardEvent) => {
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
        }));

        const onInput = (e: KeyboardEvent) => {
            const activeCell = this.activeCell;
            if (activeCell && !activeCell.readonly && activeCell.takesKey()) {
                this.updateValue(activeCell, true);
                this.cells.forEach(cell => {
                    if (cell.selected() && cell !== activeCell) {
                        this.setCell(cell, activeCell.value());
                    }
                });
            }
        };

        this.cleanups.push(on(cellInput, 'input', onInput));
        this.cleanups.push(on(cellInput, 'keydown', (e: KeyboardEvent) => {
            if (e.keyCode === 13) {
                // ENTER, stop edit and move to next row
                this.moveActive(0, 0);
                this.moveActive(1, 0, true);
                e.preventDefault();
            }
            if (e.keyCode === 27) {
                // ESCAPE, stop edit but stay at same cell
                this.moveActive(0, 0);
                e.preventDefault();
            }
        }));

        this.cleanups.push(on(hiddenInput, 'keypress', (e: KeyboardEvent) => {
            const activeCell = this.activeCell;
            if (activeCell && !activeCell.readonly && !activeCell.takesKey()) {
                activeCell.startEdit(cellInput, true);
                this.emitFocus();
            }
            else {
                e.preventDefault();
            }
        }));
    }

    pasteCSV(csvText: string, separator: string, startRow?: number, startCol?: number) {
        const csv = parseCSV(csvText, separator);
        const activeCell = this.activeCell;
        if (isNaN(startRow) && !activeCell) {
            return;
        }
        startRow = isNaN(startRow) ? activeCell.row : startRow;
        startCol = isNaN(startCol) ? activeCell.col : startCol;

        csv.forEach((csvRow, csvRowIndex) => {
            let tableRow = this.rows[startRow + csvRowIndex];
            if (!tableRow && this.options.canAddRows) {
                const prevRow = this.rows[startRow];
                this.addRows([prevRow.cells.map(c => '')]);
                tableRow = this.rows[startRow + csvRowIndex];
            }
            const tableCol = startCol;
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
    }

    private initClipboard() {
        on(this.hiddenInput, 'paste', (e: ClipboardEvent) => {
            // Don't actually paste to hidden input
            e.preventDefault();
            const text = (e.clipboardData || (window as any).clipboardData).getData('text');
            this.pasteCSV(text, '\t');
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
            this.updateValue(cell, true);
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

    private updateValue(cell: Cell, emit: boolean) {
        const colIndex = cell.col;
        const rowOption = this.options.rows[cell.row];
        const cellValue = rowOption[colIndex];
        if (typeof cellValue === 'string' || typeof cellValue === 'number') {
            rowOption[colIndex] = cell.value();
        }
        else {
            cellValue.value = cell.value();
        }
        if (emit) {
            this.emitInput(cell);
        }
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


function css(className) {
    return '.' + className;
}

function trueOr(value: boolean): boolean {
    return value === false ? false : true;
}

function getScrollOptions(options: GridOptions): ScrollOptions {
    const scroll = options.scroll;
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
