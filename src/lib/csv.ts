// ref: https://stackoverflow.com/a/14991797/498298
// This will parse a delimited string into an array of
// arrays. The default delimiter is the comma, but this
// can be overriden in the second argument.
export function parseCSV(str: string, delimiter: string) {
    const arr: string[][] = [];
    let quote = false;  // 'true' means we're inside a quoted field

    // Iterate over each character, keep track of current row and column (of the returned array)
    for (let row = 0, col = 0, i = 0; i < str.length; i++) {
        const currentChar = str[i];
        const nextChar = str[i + 1];
        arr[row] = arr[row] || [];             // Create a new row if necessary
        arr[row][col] = arr[row][col] || '';   // Create a new column (start with empty string) if necessary

        // If the current character is a quotation mark, and we're inside a
        // quoted field, and the next character is also a quotation mark,
        // add a quotation mark to the current column and skip the next character
        if (currentChar === '"' && quote && nextChar === '"') {
            arr[row][col] += currentChar;
            ++i;
            continue;
        }

        // If it's just one quotation mark, begin/end quoted field
        if (currentChar === '"') {
            quote = !quote;
            continue;
        }

        // If it's a delimiter and we're not in a quoted field, move on to the next column
        if (currentChar === delimiter && !quote) {
            ++col;
            continue;
        }

        // If it's a newline (CRLF) and we're not in a quoted field, skip the next character
        // and move on to the next row and move to column 0 of that new row
        if (currentChar === '\r' && nextChar === '\n' && !quote) {
            ++row;
            col = 0;
            ++i;
            continue;
        }

        // If it's a newline (LF or CR) and we're not in a quoted field,
        // move on to the next row and move to column 0 of that new row
        if ((currentChar === '\n' || currentChar === '\r') && !quote) {
            ++row;
            col = 0;
            continue;
        }

        // Otherwise, append the current character to the current column
        arr[row][col] += currentChar;
    }
    return arr;
}


export function writeCSV(values: Array<string[]>, separator: string, linebreak = '\n') {

    let content = '';
    values.forEach((row, ri) => {
        if (ri > 0) {
            content += linebreak;
        }
        row.forEach((cell, ci) => {
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
                cell = '"' + cell + '"';
            }
            if (ci > 0) {
                content += separator;
            }
            content += cell;
        });
    });
    return content;

}
