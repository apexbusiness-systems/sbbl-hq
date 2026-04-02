const fs = require('fs');

function formatPrice(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Replace typical price formatting without $ with $ included where missing
    // e.g. p.price.toLocaleString() -> \`$\${p.price.toLocaleString()}\`
    // Actually, looking at the grep earlier: `p.price > 0 ? \`$\${p.price.toLocaleString()}\` : ...` was already there!

    // Let's do a wide grep to find plain price formatting
    // If it's already there we skip.
    return content;
}
