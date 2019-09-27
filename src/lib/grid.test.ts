import { Grid, GridOptions, InputArgs, SelectArgs } from './grid';
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

    it('should select cell on click', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        const cell1 = grid.rows[0].cells[0].element;
        const cell2 = grid.rows[0].cells[1].element;
        fireEvent(cell1, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(cell1, new MouseEvent('mouseup', { bubbles: true }));
        expect(cell1.className).toContain('ced-selected');
        expect(cell2.className).not.toContain('ced-selected');

        fireEvent(cell2, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(cell2, new MouseEvent('mouseup', { bubbles: true }));
        expect(cell1.className).not.toContain('ced-selected');
        expect(cell2.className).toContain('ced-selected');
    });

    it('should fire select events on click', () => {
        const g = createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        let selection: SelectArgs;
        g.on('select', args => selection = args);

        clickCell(0, 0);
        expect(selection.selection).toEqual([{ row: 0, col: 0}]);
        clickCell(1, 1);
        expect(selection.selection).toEqual([{ row: 1, col: 1}]);
    });

    it('should unselect when clicked away', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        clickCell(0, 0);
        expectSelected([[0, 0]]);
        fireEvent(document.body, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(document.body, new MouseEvent('mouseup', { bubbles: true }));
        expectSelected([]);
    });

    it('should fire select when clicked away', () => {
        const g = createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        const grid = getGrid();
        let selection: SelectArgs;
        g.on('select', args => selection = args);

        clickCell(0, 0);
        fireEvent(document.body, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(document.body, new MouseEvent('mouseup', { bubbles: true }));
        expect(selection.selection).toEqual([]);
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
        fireEvent(cell00, new MouseEvent('mousedown', { bubbles: true }));
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

    it('should fire select event when selecting cells by dragging', () => {
        const g = createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });

        const grid = getGrid();
        let selection: SelectArgs;
        g.on('select', args => selection = args);

        const cell00 = grid.rows[0].cells[0].element;
        const cell01 = grid.rows[0].cells[1].element;
        const cell10 = grid.rows[1].cells[0].element;
        const cell11 = grid.rows[1].cells[1].element;
        fireEvent(cell00, new MouseEvent('mousedown', { bubbles: true }));
        expect(sortSelectArgs(selection)).toEqual([{ row: 0, col: 0 }]);

        fireEvent(cell00, new MouseEvent('mousemove', { bubbles: true }));
        expect(sortSelectArgs(selection)).toEqual([{ row: 0, col: 0 }]);

        fireEvent(cell01, new MouseEvent('mousemove', { bubbles: true }));
        expect(sortSelectArgs(selection)).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);

        fireEvent(cell11, new MouseEvent('mousemove', { bubbles: true }));
        expect(sortSelectArgs(selection)).toEqual([
            { row: 0, col: 0 }, { row: 0, col: 1 },
            { row: 1, col: 0 }, { row: 1, col: 1 }
        ]);

        fireEvent(cell10, new MouseEvent('mousemove', { bubbles: true }));
        expect(sortSelectArgs(selection)).toEqual([{ row: 0, col: 0 }, { row: 1, col: 0 }]);

        fireEvent(cell00, new MouseEvent('mousemove', { bubbles: true }));
        expect(sortSelectArgs(selection)).toEqual([{ row: 0, col: 0 }]);
    });

    it('should not fire select event when selection did not change during dragging', () => {
        const g = createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });

        const grid = getGrid();
        let firedCount = 0;
        g.on('select', _ => firedCount++);

        const cell00 = grid.rows[0].cells[0].element;
        const cell01 = grid.rows[0].cells[1].element;
        const cell11 = grid.rows[1].cells[1].element;
        fireEvent(cell00, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(cell00, new MouseEvent('mousemove', { bubbles: true }));

        fireEvent(cell01, new MouseEvent('mousemove', { bubbles: true }));
        fireEvent(cell01, new MouseEvent('mousemove', { bubbles: true }));
        fireEvent(cell01, new MouseEvent('mousemove', { bubbles: true }));

        fireEvent(cell11, new MouseEvent('mousemove', { bubbles: true }));
        fireEvent(cell11, new MouseEvent('mousemove', { bubbles: true }));
        fireEvent(cell11, new MouseEvent('mousemove', { bubbles: true }));

        expect(firedCount).toBe(3);
    });


    it('should not fail if dragging outside document', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        const cell00 = grid.rows[0].cells[0].element;
        fireEvent(cell00, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(document, new MouseEvent('mousemove', { bubbles: true }));
    });

    it('should select whole column', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });

        clickColumnHead(1);
        expectSelected([[0, 1], [1, 1]]);
    });

    it('should fire select events on column select', () => {
        const g = createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        let selection: SelectArgs;
        g.on('select', args => selection = args);

        clickColumnHead(1);
        expect(selection.selection).toEqual([{ row: 0, col: 1}, { row: 1, col: 1}]);
        clickColumnHead(0);
        expect(selection.selection).toEqual([{ row: 0, col: 0}, { row: 1, col: 0}]);
    });

    it('should select whole columns by dragging from right to left', () => {
        const grid = create({
            cols: ['a', 'b', 'c'],
            rows: [ [1, 2, 3], [4, 5, 6] ],
        });
        fireEvent(grid.head.elements[2], new MouseEvent('mousedown', { bubbles: true }));
        expectSelected([[0, 2], [1, 2]]);
        fireEvent(grid.head.elements[1], new MouseEvent('mousemove', { bubbles: true }));
        expectSelected([[0, 1], [1, 1], [0, 2], [1, 2]]);
        fireEvent(grid.head.elements[0], new MouseEvent('mousemove', { bubbles: true }));
        expectSelected([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]);
    });

    it('should fire select event when selecting columns by dragging', () => {
        const g = createGrid({
            cols: ['a', 'b', 'c'],
            rows: [ [1, 2, 3], [4, 5, 6] ],
        });
        const grid = getGrid();
        let selection: SelectArgs;
        g.on('select', args => selection = args);

        fireEvent(grid.head.elements[2], new MouseEvent('mousedown', { bubbles: true }));
        expect(sortSelectArgs(selection)).toEqual([{ row: 0, col: 2}, { row: 1, col: 2}]);

        fireEvent(grid.head.elements[1], new MouseEvent('mousemove', { bubbles: true }));
        expect(sortSelectArgs(selection)).toEqual([
            { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 1 }, { row: 1, col: 2 }]);

        fireEvent(grid.head.elements[0], new MouseEvent('mousemove', { bubbles: true }));
        expect(sortSelectArgs(selection)).toEqual([
            { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
            { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }]);
    });

    const sortSelectArgs = (args: SelectArgs) => {
        return args.selection.sort((a, b) => {
            return a.row - b.row || a.col - b.col;
        });
    };

    it('should select whole columns by dragging from left to right', () => {
        const grid = create({
            cols: ['a', 'b', 'c'],
            rows: [ [1, 2, 3], [4, 5, 6] ],
        });
        fireEvent(grid.head.elements[0], new MouseEvent('mousedown', { bubbles: true }));
        expectSelected([[0, 0], [1, 0]]);
        fireEvent(grid.head.elements[1], new MouseEvent('mousemove', { bubbles: true }));
        expectSelected([[0, 0], [1, 0], [0, 1], [1, 1]]);
        fireEvent(grid.head.elements[2], new MouseEvent('mousemove', { bubbles: true }));
        expectSelected([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]);
    });

    it('should clear all selected cells by del key', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        const cell00 = grid.rows[0].cells[0].element;
        const cell10 = grid.rows[1].cells[0].element;
        fireEvent(cell00, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(cell10, new MouseEvent('mousemove', { bubbles: true }));
        keyDown('Delete', 46);

        expect(grid.rows[0].values()).toEqual(['', '2']);
        expect(grid.rows[1].values()).toEqual(['', '4']);
    });

    it('should clear whole columns by del key', () => {
        const grid = create({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        fireEvent(grid.head.elements[1], new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(grid.head.elements[1], new MouseEvent('mouseup', { bubbles: true }));
        keyDown('Delete', 46);
        expect(grid.rows[0].values()).toEqual(['1', '']);
        expect(grid.rows[1].values()).toEqual(['3', '']);
    });

    it('should fire input event on del', () => {
        const g = createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        const fired: InputArgs[] = [];
        g.on('input', args => fired.push(args));
        const grid = getGrid();
        fireEvent(grid.rows[0].cells[1].element, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(grid.rows[1].cells[1].element, new MouseEvent('mousemove', { bubbles: true }));
        fireEvent(grid.rows[1].cells[1].element, new MouseEvent('mouseup', { bubbles: true }));
        keyDown('Delete', 46);
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

    it('should navigate with arrow keys', () => {
        const g = createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });

        clickCell(0, 0);
        keyDown('ArrowRight', 39);
        expectSelected([[0, 1]]);
        keyDown('ArrowRight', 39);
        expectSelected([[0, 1]]);

        keyDown('ArrowDown', 40);
        expectSelected([[1, 1]]);
        keyDown('ArrowDown', 40);
        expectSelected([[1, 1]]);

        keyDown('ArrowLeft', 37);
        expectSelected([[1, 0]]);
        keyDown('ArrowLeft', 37);
        expectSelected([[1, 0]]);

        keyDown('ArrowUp', 38);
        expectSelected([[0, 0]]);
        keyDown('ArrowUp', 38);
        expectSelected([[0, 0]]);
    });

    it('should add rows', () => {
        const g = createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
            canAddRows: true,
        });
        g.addRows([[5, 6], [7, 8]]);
        const grid = getGrid();
        expect(grid.head.values).toEqual(['a', 'b']);
        expect(grid.rows.map(r => r.values())).toEqual([
            ['1', '2'], ['3', '4'], ['5', '6'], ['7', '8']
        ]);
    });

    it('should not add rows if canAddRows is false', () => {
        const g = createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
        });
        g.addRows([[5, 6], [7, 8]]);
        const grid = getGrid();
        expect(grid.head.values).toEqual(['a', 'b']);
        expect(grid.rows.map(r => r.values())).toEqual([
            ['1', '2'], ['3', '4']
        ]);
    });

    it('should fire input event for added rows', () => {
        const options = {
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
            canAddRows: true,
        };
        const g = createGrid(options);
        const fired: InputArgs[] = [];
        g.on('input', args => fired.push(args));

        g.addRows([[5, 6], [7, 8]]);
        expect(fired.length).toBe(4);
        expect(fired[0].row).toBe(2);
        expect(fired[0].col).toBe(0);
        expect(fired[0].value).toBe('5');
    });

    it('should select added rows', () => {
        createGrid({
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
            canAddRows: true,
        }).addRows([[5, 6], [7, 8]]);
        const grid = getGrid();
        // single clik
        clickCell(2, 1);
        expectSelected([[2, 1]]);
        clickCell(3, 0);
        expectSelected([[3, 0]]);

        // column click
        clickColumnHead(1);
        expectSelected([[0, 1], [1, 1], [2, 1], [3, 1]]);
        clickColumnHead(0);
        expectSelected([[0, 0], [1, 0], [2, 0], [3, 0]]);

        // dragging
        fireEvent(grid.rows[2].cells[1].element, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(grid.rows[2].cells[0].element, new MouseEvent('mousemove', { bubbles: true }));
        expectSelected([[2, 0], [2, 1]]);
    });

    it('should edit added rows', () => {
        const options = {
            cols: ['a', 'b'],
            rows: [ [1, 2], [3, 4] ],
            canAddRows: true,
        };
        const g = createGrid(options);
        g.addRows([[5, 6], [7, 8]]);
        const fired: InputArgs[] = [];
        g.on('input', args => fired.push(args));
        const grid = getGrid();
        clickCell(3, 0);
        keyDown('Delete', 46);
        expect(grid.rows[3].values()).toEqual(['', '8']);
        expect(options.rows[3][0]).toBe('');
        expect(fired.length).toBe(1);
        expect(fired[0].row).toBe(3);
        expect(fired[0].col).toBe(0);
        expect(fired[0].value).toBe('');
    });

    function expectSelected(cells: Array<number[]>) {
        const grid = getGrid();
        let expected = '';
        let actual = '';
        grid.rows.forEach((row, ri) => {
            row.cells.forEach((cell, ci) => {
                const a = cell.element.classList.contains('ced-selected') ? 'x' : '0';
                const e = cells.find(c => c[0] === ri && c[1] === ci) ? 'x' : '0';
                actual += a;
                expected += e;
            });
            actual += '\n';
            expected += '\n';
        });
        expect(actual).toEqual(expected);
    }

    function clickCell(row: number, col: number){
        const grid = getGrid();
        const cell = grid.rows[row].cells[col].element;
        fireEvent(cell, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(cell, new MouseEvent('mouseup', { bubbles: true }));
        return cell;
    }

    function clickColumnHead(col: number) {
        const grid = getGrid();
        const head = grid.head.elements[col];
        fireEvent(head, new MouseEvent('mousedown', { bubbles: true }));
        fireEvent(head, new MouseEvent('mouseup', { bubbles: true }));
        return head;
    }

    function keyDown(key: string, keyCode: number) {
        fireEvent.keyDown(document.activeElement, { key, keyCode});
    }

});
