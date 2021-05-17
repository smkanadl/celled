import { Cell, createCell } from './cell';
import { CSS_ROW } from './css';
import { createElement } from './dom';
import { CellValue, CellValueOptions } from './options';

export class Row {
    element: HTMLElement;
    cells: Cell[] = [];

    constructor(public index: number) {
        this.element = createElement(`<div data-ri="${index}" class="${CSS_ROW}"></div>`);
    }

    addCells(cells: Array<CellValue | CellValueOptions>, updateValueCallback: (cell: Cell) => unknown) {
        cells.forEach((c, columnIndex) => {
            const cell = createCell(this.index, columnIndex, c, updateValueCallback);
            this.cells.push(cell);
            this.element.appendChild(cell.element);
        });
    }

    setCell(columnIndex: number, value: CellValue | CellValueOptions, updateValueCallback: (cell: Cell) => unknown): Cell {
        const oldCell = this.cells[columnIndex];
        const cell = createCell(this.index, columnIndex, value, updateValueCallback);
        this.cells[columnIndex] = cell;
        oldCell.element.replaceWith(cell.element);
        oldCell.destroy();
        return cell;
    }
}
