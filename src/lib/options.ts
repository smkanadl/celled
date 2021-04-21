export type CellValue = string | number;

export interface CellValueOptions {
    readonly?: boolean;
    options?: ReadonlyArray<CellValue>;
    value: CellValue;
}

export type RowOptions = Array<CellValue | CellValueOptions>;

export interface ScrollOptions {
    stickyHeader?: boolean;
}

export interface GridOptions {
    cols: Array<string | number>;
    rows: Array<RowOptions>;
    input?: HTMLInputElement | (() => HTMLInputElement);
    canAddRows?: boolean;
    scroll?: ScrollOptions;
}
