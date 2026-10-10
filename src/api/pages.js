function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// A small standalone page for errors and notices, styled like the landing page.
function messagePage(title, message) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} | CycleCare</title>
    <style>
        body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: #0f0a1e; color: #f3f4f6; font-family: system-ui, -apple-system, sans-serif; }
        main { max-width: 480px; text-align: center; }
        h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
        p { color: #c4b5fd; line-height: 1.6; }
        a { display: inline-block; margin-top: 1.5rem; padding: 12px 24px; border-radius: 999px; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: #fff; text-decoration: none; font-weight: 600; }
    </style>
</head>
<body>
    <main>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <a href="/">Back to CycleCare</a>
    </main>
</body>
</html>`;
}

module.exports = { messagePage };
