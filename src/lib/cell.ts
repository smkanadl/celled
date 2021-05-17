import { CSS_CELL, CSS_READONLY, CSS_SELECTED, CSS_ACTIVE, CSS_EDITING, CSS_SELECT_CELL } from './css';
import { createElement, remove, setOptions } from './dom';
import { CellUpdateOptions, CellValue, CellValueOptions } from './options';

export type UpdateCallback = (cell: Cell) => unknown;

export interface Cell {
    readonly element: HTMLElement;
    readonly readonly: boolean;
    row: number;
    col: number;

    /**
     * Cleanup any resources, listeners...
     */
    destroy(): void;

    /**
     * The currently displayed value.
     */
    value(): string;

    /**
     * Show a new value.
     */
    set(value: CellValue | CellUpdateOptions): void;

    /**
     * Mark the cell as selected. This will apply css classes
     * to visualize the cell as a selected cell.
     */
    select(doSelect?: boolean): this;

    /**
     * Cell was selected with select(true).
     */
    selected(): boolean;

    /**
     * This will apply css classes to visualize the cell as a selected and active cell.
     * The active cell is the leading cell in a multi edit situation. It will contain
     * the editing control.
     * If doActivate is false, the editing control will be removed.
     */
    activate(doActivate?: boolean): this;

    /**
     * Start the editing process. The cell can use the passed input element to let
     * the user enter free text.
     */
    startEdit(input: HTMLInputElement, selectContent?: boolean);

    /**
     * This cell is ready to consume key events
     */
    takesKey(): boolean;

    /**
     * This cell is ready to consume mouse click events
     */
    takesMouse(): boolean;
}

/**
 * Create a new Cell instance matching the definitions in the value parameter.
 * @param callback  Can be used by the cell to notify value changes that are not
 *                  triggered from outside.
 */
export function createCell(row: number, col: number, value: CellValue | CellValueOptions, callback: UpdateCallback) {
    if (typeof value !== 'string' && typeof value !== 'number' && Array.isArray(value.options)) {
        return new SelectCell(row, col, value, callback);
    }
    return new InputCell(row, col, value);
}


class InputCell implements Cell {
    element: HTMLElement;
    input: HTMLInputElement;  // If the cell is active, this is the assigned input element
    readonly = false;

    private isActive = false;
    private isSelected = false;
    private extraCss = '';

    constructor(public row: number, public col: number, value: CellValue | CellValueOptions) {
        let text: string;
        if (isPlainValue(value)) {
            text = value.toString();
        }
        else {
            this.readonly = value.readonly;
            text = value.value.toString();
            this.extraCss = value.css;
        }
        this.element = createElement(`<div data-ci="${col}">${valueHTML(text)}</div>`);
        this.setCss();
    }

    destroy() {
    }

    selected() {
        return this.isSelected;
    }

    select(doSelect = true) {
        this.isSelected = doSelect;
        this.setCss();
        return this;
    }

    activate(doActivate = true) {
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
    }

    value() {
        return this.input ? this.input.value : this.element.textContent;
    }

    set(value: CellValue | CellUpdateOptions) {
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
    }

    private setValue(value: CellValue) {
        if (this.input) {
            this.input.value = value.toString();
        }
        else {
            this.element.innerHTML = valueHTML(value);
        }
    }

    private setCss() {
        const className = CSS_CELL +
            cssIf(this.readonly, CSS_READONLY) +
            cssIf(this.isActive, CSS_ACTIVE) +
            cssIf(this.isSelected, CSS_SELECTED) +
            cssIf(!!this.input, CSS_EDITING) +
            cssIf(!!this.extraCss, this.extraCss);
        this.element.className = className;
    }

    startEdit(input: HTMLInputElement, select = false) {
        if (this.readonly) {
            return;
        }
        const element = this.element;
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
    }

    takesKey(): boolean {
        return !!this.input;
    }

    takesMouse(): boolean {
        return this.takesKey();
    }
}

function valueHTML(value) {
    return `<span>${value}</span>`;
}

class SelectCell implements Cell {
    element: HTMLElement;
    selectElement: HTMLSelectElement;
    readonly = false;
    options: ReadonlyArray<CellValue> = null;
    listener;

    private isSelected = false;
    private extraCss = '';

    constructor(public row: number, public col: number, value: CellValueOptions, callback: UpdateCallback) {

        this.readonly = value.readonly;
        this.options = value.options;
        this.element = createElement(`<div data-ci="${col}"></div>`);
        this.selectElement = createElement<HTMLSelectElement>(`<select><select>`);
        setOptions(this.selectElement, this.options);
        this.set('' + value.value);
        this.element.appendChild(this.selectElement);
        this.listener = () => callback(this);
        this.selectElement.addEventListener('change', this.listener);
        this.extraCss = value.css;
        this.setCss();
    }

    destroy() {
        this.selectElement.removeEventListener('change', this.listener);
    }

    value(): string {
        return this.selectElement.value;
    }

    set(value: CellValue | CellUpdateOptions) {
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
    }

    private setValue(value: CellValue) {
        this.selectElement.value = value ? value.toString() : null;
    }

    private setCss() {
        const className = CSS_CELL + ' ' + CSS_SELECT_CELL +
            cssIf(this.readonly, CSS_READONLY) +
            cssIf(this.isSelected, CSS_SELECTED) +
            cssIf(!!this.extraCss, this.extraCss);
        this.element.className = className;
    }

    select(doSelect = true) {
        this.isSelected = doSelect;
        this.setCss();
        return this;
    }

    selected(): boolean {
        return this.isSelected;
    }

    activate(doActivate?: boolean) {
        return this;
    }

    startEdit(input: HTMLInputElement, selectContent?: boolean) {
    }

    takesKey(): boolean {
        return false;
    }

    takesMouse(): boolean {
        return true;
    }
}

// function setSelectCSS(element: HTMLElement, doSelect: boolean) {
//     const classList = element.classList;
//     if (doSelect) {
//         classList.add(CSS_SELECTED);
//     }
//     else {
//         classList.remove(CSS_SELECTED);
//     }
// }

function isSelectCss(element: HTMLElement) {
    return element.className.indexOf(CSS_SELECTED) >= 0;
}

function isPlainValue(value: CellValue | CellUpdateOptions): value is CellValue {
    return typeof value === 'string' || typeof value === 'number';
}

function isDefined(value: any) {
    return typeof value !== 'undefined';
}


function cssIf(useValue: boolean, css: string) {
    return useValue ? ' ' + css : '';
}
