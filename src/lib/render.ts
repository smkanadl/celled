import { Row } from './row';

export interface RenderOptions {
    container: HTMLElement;
    gridContainer: HTMLElement;  // child of container
    grid: HTMLElement;           // child of gridContainer
    head: HTMLElement;
}

export interface Renderer {
    rerender(rows: Row[]);
    destroy();
}

export class DefaultRenderer implements Renderer {
    constructor(private options: RenderOptions) {
    }
    rerender(rows: Row[]) {
        const { grid, head } = this.options;
        grid.innerHTML = '';
        grid.appendChild(head);
        rows.forEach(r => {
            grid.appendChild(r.element);
        });
    }

    destroy() {
        this.options = null;
    }
}


export class VirtualRenderer implements Renderer {

    private onScroll;

    constructor(private options: RenderOptions) {
    }

    rerender(rows: Row[]) {
        const { grid, head, container, gridContainer } = this.options;

        if (this.onScroll) {
            container.removeEventListener('scroll', this.onScroll);
        }
        const itemPadding = 4;

        const currentRange = {
            start: undefined,
            end: undefined,
        };

        let rowHeight = 34;  // just a guess
        grid.style.position = 'absolute';

        const update = (scrollTop: number) => {
            const itemCount = rows.length;
            const viewportHeight = container.offsetHeight;

            const totalContentHeight = itemCount * rowHeight;

            let startIndex = Math.floor(scrollTop / rowHeight) - itemPadding;
            if (startIndex % 2 > 0) {
                // always start with an odd index to keep alternating styles consistent
                startIndex -= 1;
            }
            startIndex = Math.max(0, startIndex);

            let visibleNodesCount = Math.ceil(viewportHeight / rowHeight) + 2 * itemPadding;
            visibleNodesCount = Math.min(itemCount - startIndex, visibleNodesCount);
            const endIndex = startIndex + visibleNodesCount;

            const offsetY = startIndex * rowHeight;
            gridContainer.style.height = `${totalContentHeight}px`;
            grid.style['top'] = `${offsetY}px`;

            // Render
            if (currentRange.start !== startIndex || currentRange.end !== endIndex) {
                const desiredRenderHeight = visibleNodesCount * rowHeight;
                currentRange.start = startIndex;
                currentRange.end = endIndex;
                grid.innerHTML = '';
                grid.appendChild(head);
                let renderedHeight = 0;
                let count = 0;
                for (let i = startIndex; (i <= endIndex || renderedHeight < desiredRenderHeight) && i < rows.length; ++i) {
                    const row = rows[i];
                    grid.appendChild(row.element);
                    renderedHeight += row.element.offsetHeight;
                    ++count;
                }
                if (count) {
                    rowHeight = renderedHeight / count;
                }
            }
        };


        const updateFunc = update;
        let animationFrame;
        this.onScroll = (e) => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
            animationFrame = requestAnimationFrame(() => {
                updateFunc(e.target.scrollTop);
            });
        };

        container.addEventListener('scroll', this.onScroll);
        updateFunc(container.scrollTop);
    }

    destroy() {
        this.options.container.removeEventListener('scroll', this.onScroll);
        this.options = null;
        this.onScroll = null;
    }
}
