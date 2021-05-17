export type CellValue = string | number;

export interface CellValueOptions {
    readonly?: boolean;
    options?: ReadonlyArray<CellValue>;
    value: CellValue;
    css?: string;
}

export type RowOptions = Array<CellValue | CellValueOptions>;

export interface ScrollOptions {
    /** Default: true */
    enabled?: boolean;
    /** Default: true */
    stickyHeader?: boolean;
    /** Default: true */
    virtualScroll?: boolean;
}

export interface GridOptions {
    cols: Array<string | number>;
    rows: Array<RowOptions>;
    input?: HTMLInputElement | (() => HTMLInputElement);
    canAddRows?: boolean;
    scroll?: ScrollOptions;
}
