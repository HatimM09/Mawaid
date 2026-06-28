#!/usr/bin/env python3
# Fix template literal syntax: change '1.5px solid ${t.border}' -> `1.5px solid ${t.border}`

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the single-quoted template literals that should be backtick template literals
# Pattern: '1.5px solid ${t.border}' -> `1.5px solid ${t.border}`
# Pattern: '1px solid ${t.accentBorder}' -> `1px solid ${t.accentBorder}`

content = content.replace("'1.5px solid ${t.border}'", "`1.5px solid ${t.border}`")
content = content.replace("'1px solid ${t.accentBorder}'", "`1px solid ${t.accentBorder}`")

count_border = content.count("`1.5px solid ${t.border}`")
count_accent = content.count("`1px solid ${t.accentBorder}`")

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Fixed {count_border} border references and {count_accent} accentBorder references")
