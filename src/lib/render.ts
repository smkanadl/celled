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

        const current = {
            viewportHeight: undefined,
            itemCount: undefined,
            start: undefined,
            end: undefined,  // last rendered item (including)
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
            const endIndex = startIndex + visibleNodesCount - 1;  // last rendered item (including)
            const maxOffsetY = totalContentHeight - viewportHeight - itemPadding * rowHeight;  // do not go beyond this
            const offsetY = Math.min(maxOffsetY, startIndex * rowHeight);

            // At the end of the list we will not rerender in order to avoid jumping scrollbar.
            const lastItemIndex = itemCount - 1;
            const lastWasAdded = current.end === lastItemIndex;
            const lastWillBeAdded = endIndex === lastItemIndex;
            const noMoreItemsAvailable = lastWasAdded && lastWillBeAdded;
            const newRangeDiffers = current.start !== startIndex || current.end !== endIndex;
            const heightChanged = viewportHeight !== current.viewportHeight;
            const itemCountChanged = itemCount !== current.itemCount;
            const shouldRerender = itemCountChanged || heightChanged || (newRangeDiffers && !noMoreItemsAvailable);

            // Render
            if (shouldRerender) {
                const desiredRenderHeight = visibleNodesCount * rowHeight; // viewport + padding
                current.start = startIndex;
                current.end = endIndex;
                current.viewportHeight = viewportHeight;
                current.itemCount = itemCount;
                grid.innerHTML = '';
                grid.appendChild(head);
                const headerHeight = grid.offsetHeight;
                let renderedHeight = 0;

                // First add items from start to end index at once
                const fragment = document.createDocumentFragment();
                let i = startIndex;
                for (; i <= endIndex && i < rows.length; ++i) {
                    const row = rows[i];
                    fragment.appendChild(row.element);
                }
                grid.appendChild(fragment);
                renderedHeight = grid.offsetHeight - headerHeight;

                // Add items until we reached the desired height
                for (; renderedHeight < desiredRenderHeight && i < rows.length; ++i) {
                    const row = rows[i];
                    grid.appendChild(row.element);
                    renderedHeight += row.element.offsetHeight;
                }

                const numberOfRenderedItems = i - startIndex;
                if (numberOfRenderedItems) {
                    rowHeight = renderedHeight / numberOfRenderedItems;
                }

                gridContainer.style.height = `${totalContentHeight}px`;
                grid.style['top'] = `${offsetY}px`;
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
