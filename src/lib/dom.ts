export function query(elOrCss, cssSelector?): Element {
    if (!cssSelector) {
        cssSelector = elOrCss;
        elOrCss = document;
    }
    return elOrCss.querySelector(cssSelector);
}

export function queryAll(elOrCss, cssSelector?): Element[] {
    if (!cssSelector) {
        cssSelector = elOrCss;
        elOrCss = document;
    }
    return [].slice.call(elOrCss.querySelectorAll(cssSelector));
}

export function createElement<T extends HTMLElement>(html: string): T {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild as T;
}

export function on(element: Node, event: string, listener: EventListenerOrEventListenerObject) {
    element.addEventListener(event, listener);
    return offFunc(element, event, listener);
}

export function off(element: Node, event: string, listener: EventListenerOrEventListenerObject) {
    element.removeEventListener(event, listener);
}

export function offFunc(element: Node, event: string, listener: EventListenerOrEventListenerObject) {
    return () => element.removeEventListener(event, listener);
}

export function getKey(e: KeyboardEvent) {
    e = e || window.event as KeyboardEvent;
    return String.fromCharCode(e.keyCode || e.which);
}

export function remove(node: Node) {
    if (node.parentNode) {
        node.parentElement.removeChild(node);
    }
}

export function setOptions(selectElement: HTMLSelectElement, options: ReadonlyArray<any>) {
    for (let i = selectElement.options.length; i > 0; i--) {
        selectElement.remove(i);
    }
    for (const option of options) {
        const optionElement = document.createElement('option');
        optionElement.value = '' + option;
        optionElement.innerHTML = '' + option;
        selectElement.appendChild(optionElement);
    }
}
