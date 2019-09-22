import { Grid, GridOptions, InputArgs } from './grid';
import { getByText, fireEvent } from '@testing-library/dom';

function queryAll<T extends Element>(elementOrCss: ParentNode|string, cssOrEmpty?: string): T[] {
    let element: ParentNode = document;
    let css = elementOrCss as string;
    if (typeof elementOrCss !== 'string') {
        css = cssOrEmpty;
        element = elementOrCss;
    }
    return [].slice.apply(element.querySelectorAll(css));
}

function getGrid() {
    const grid = document.querySelector('.ced-grid');
    const headRow = grid.querySelector('.ced-head');
    const headCells = queryAll(headRow, '.ced-cell');
    const rows = queryAll(grid, '.ced-row').slice(1);

    return {
        head: {
            elements: headCells,
            values: headCells.map(c => c.textContent.trim()),
        },
        rows: rows.map(r => ({
            row: r,
            cells: queryAll(r, '.ced-cell').map(c => ({
                element: c
            })),
            values() { return this.cells.map(c => c.element.textContent.trim()); }
        })),
    };
}


describe('Grid', () => {

    beforeEach(() => {
        document.body.innerHTML = '<div id="test"></div>';
    });

    const createGrid = (options: GridOptions) => {
        const g = new Grid('#test');
        g.init(options);
        return g;
    };

    const create = (options: GridOptions) => {
        createGrid(options);
        return getGrid();
    };

    it('should create headers without rows', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [],
        });
        expect(grid.head.values).toEqual(['a', 'b']);
        expect(grid.rows).toEqual([]);
    });

    it('should create rows from strings', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [
                ['1', '2'],
                ['3', '4']
            ],
        });
        expect(grid.head.values).toEqual(['a', 'b']);
        expect(grid.rows.length).toBe(2);
        expect(grid.rows[0].values()).toEqual(['1', '2']);
        expect(grid.rows[1].values()).toEqual(['3', '4']);
    });

    it('should create rows from numbers', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [
                [1, 2],
                [3, 4]
            ],
        });
        expect(grid.head.values).toEqual(['a', 'b']);
        expect(grid.rows.length).toBe(2);
        expect(grid.rows[0].values()).toEqual(['1', '2']);
        expect(grid.rows[1].values()).toEqual(['3', '4']);
    });

    it('should create rows width readonly cells', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [
                [1, { value: '2', readonly: true }],
                [{ value: 3, readonly: false }, '4']
            ],
        });
        expect(grid.head.values).toEqual(['a', 'b']);
        expect(grid.rows.length).toBe(2);
        expect(grid.rows[0].values()).toEqual(['1', '2']);
        expect(grid.rows[1].values()).toEqual(['3', '4']);
    });

    it('should highlight selected cell', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        const cell1 = grid.rows[0].cells[0].element;
        const cell2 = grid.rows[0].cells[1].element;
        fireEvent(cell1, new MouseEvent('mousedown'));
        fireEvent(cell1, new MouseEvent('mouseup'));
        expect(cell1.className).toContain('ced-selected');
        expect(cell2.className).not.toContain('ced-selected');

        fireEvent(cell2, new MouseEvent('mousedown'));
        fireEvent(cell2, new MouseEvent('mouseup'));
        expect(cell1.className).not.toContain('ced-selected');
        expect(cell2.className).toContain('ced-selected');
    });

    it('should select cells by dragging', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        const cell00 = grid.rows[0].cells[0].element;
        const cell01 = grid.rows[0].cells[1].element;
        const cell10 = grid.rows[1].cells[0].element;
        const cell11 = grid.rows[1].cells[1].element;
        fireEvent(cell00, new MouseEvent('mousedown'));
        expectSelected([[0, 0]]);
        fireEvent(cell00, new MouseEvent('mousemove', { bubbles: true }));
        expectSelected([[0, 0]]);
        fireEvent(cell01, new MouseEvent('mousemove', { bubbles: true }));
        expectSelected([[0, 0], [0, 1]]);
        fireEvent(cell11, new MouseEvent('mousemove', { bubbles: true }));
        expectSelected([[0, 0], [0, 1], [1, 0], [1, 1]]);
        fireEvent(cell10, new MouseEvent('mousemove', { bubbles: true }));
        expectSelected([[0, 0], [1, 0]]);
        fireEvent(cell00, new MouseEvent('mousemove', { bubbles: true }));
        expectSelected([[0, 0]]);
    });

    it('should clear all selected cells by del key', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        const cell00 = grid.rows[0].cells[0].element;
        const cell10 = grid.rows[1].cells[0].element;
        fireEvent(cell00, new MouseEvent('mousedown'));
        fireEvent(cell10, new MouseEvent('mousemove', { bubbles: true }));
        fireEvent.keyDown(document.activeElement, { key: 'Delete', keyCode: 46 });

        expect(grid.rows[0].values()).toEqual(['', '2']);
        expect(grid.rows[1].values()).toEqual(['', '4']);
    });

    it('should fire input event on del', () => {
        const g = createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        const fired: InputArgs[] = [];
        g.on('input', args => fired.push(args));
        const grid = getGrid();
        fireEvent(grid.rows[0].cells[1].element, new MouseEvent('mousedown'));
        fireEvent(grid.rows[1].cells[1].element, new MouseEvent('mousemove', { bubbles: true }));
        fireEvent(grid.rows[1].cells[1].element, new MouseEvent('mouseup'));
        fireEvent.keyDown(document.activeElement, { key: 'Delete', keyCode: 46 });
        expect(fired.length).toBe(2);
        expect(fired[0].grid).toBe(g);
        expect(fired[0].row).toBe(0);
        expect(fired[0].col).toBe(1);
        expect(fired[0].value).toBe('');
        expect(fired[1].grid).toBe(g);
        expect(fired[1].row).toBe(1);
        expect(fired[1].col).toBe(1);
        expect(fired[1].value).toBe('');
    });

    const expectSelected = (cells: Array<number[]>) => {
        const grid = getGrid();
        let expected = '';
        let actual = '';
        grid.rows.forEach((row, ri) => {
            row.cells.forEach((cell, ci) => {
                const a = cell.element.classList.contains('ced-selected') ? 'x' : '0';
                const e = cells.find(c => c[0] == ri && c[1] == ci) ? 'x' : '0';
                actual += a;
                expected += e;
            });
            actual += '\n';
            expected += '\n';
        });
        expect(actual).toEqual(expected);
    }

});