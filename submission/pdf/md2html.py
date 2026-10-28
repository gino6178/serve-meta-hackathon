"""The technical report as a printable HTML page (then Chrome prints it to PDF: submission/pdf/build.sh).

Covers the Markdown the report uses: headings, paragraphs, nested lists, tables, fenced code, images, links, bold,
italic, inline code and HTML comments (dropped). Images are inlined as data URIs, so the PDF needs no other file.
    python md2html.py ../technical_report.md out.html
"""
import base64, html, mimetypes, os, re, sys

src, out = sys.argv[1], sys.argv[2]
base = os.path.dirname(os.path.abspath(src))
text = re.sub(r"<!--.*?-->", "", open(src, encoding="utf-8").read(), flags=re.S)
lines = text.split("\n")


def data_uri(path):
    p = os.path.normpath(os.path.join(base, path))
    mime = mimetypes.guess_type(p)[0] or "application/octet-stream"
    if p.endswith(".svg"):
        mime = "image/svg+xml"
    return f"data:{mime};base64," + base64.b64encode(open(p, "rb").read()).decode()


def inline(s):
    codes = []
    s = re.sub(r"`([^`]+)`", lambda m: codes.append(m.group(1)) or f"\x00{len(codes) - 1}\x00", s)
    s = html.escape(s, quote=False)
    s = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", lambda m: f'<img alt="{m.group(1)}" src="{data_uri(m.group(2))}">', s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    s = re.sub(r"(https?://[^\s<)]+[^\s<).,;:])(?![^<]*</a>)(?![^<]*\">)", r'<a href="\1">\1</a>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    return re.sub(r"\x00(\d+)\x00", lambda m: f"<code>{html.escape(codes[int(m.group(1))])}</code>", s)


def cells(row):
    row = row.strip().strip("|")
    parts, cur, tick = [], "", False
    for ch in row:
        if ch == "`":
            tick = not tick
        if ch == "|" and not tick:
            parts.append(cur); cur = ""
        else:
            cur += ch
    return [c.strip() for c in parts + [cur]]


body, i, para = [], 0, []


def flush():
    if para:
        body.append("<p>" + inline(" ".join(para)) + "</p>")
        para.clear()


def list_block(start):
    """Nested lists from indentation; returns (html, next line)."""
    out, stack, j, item = [], [], start, None
    while j < len(lines):
        ln = lines[j]
        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", ln)
        if m:
            ind, kind = len(m.group(1)), ("ol" if m.group(2)[0].isdigit() else "ul")
            while stack and ind < stack[-1][0]:
                out.append(f"</li></{stack.pop()[1]}>")
            if not stack or ind > stack[-1][0]:
                stack.append((ind, kind)); out.append(f"<{kind}><li>")
            else:
                out.append("</li><li>")
            out.append(inline(m.group(3)))
            j += 1
        elif ln.strip() and stack and (ln.startswith(" ") or ln.startswith("\t")):
            out.append(" " + inline(ln.strip())); j += 1
        else:
            break
    while stack:
        out.append(f"</li></{stack.pop()[1]}>")
    return "".join(out), j


while i < len(lines):
    ln = lines[i]
    if ln.startswith("```"):
        flush(); j = i + 1; code = []
        while j < len(lines) and not lines[j].startswith("```"):
            code.append(lines[j]); j += 1
        body.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>"); i = j + 1; continue
    m = re.match(r"^(#{1,4})\s+(.*)$", ln)
    if m:
        flush(); n = len(m.group(1)); body.append(f"<h{n}>{inline(m.group(2))}</h{n}>"); i += 1; continue
    if ln.lstrip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]):
        flush(); head = cells(ln); rows = []; j = i + 2
        while j < len(lines) and lines[j].lstrip().startswith("|"):
            rows.append(cells(lines[j])); j += 1
        t = "<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
        t += "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows)
        body.append(t + "</tbody></table>"); i = j; continue
    if re.match(r"^\s*([-*]|\d+\.)\s+", ln):
        flush(); h, i = list_block(i); body.append(h); continue
    if re.match(r"^\s*!\[[^\]]*\]\([^)]+\)\s*$", ln):
        flush(); m = re.match(r"^\s*!\[([^\]]*)\]\(([^)]+)\)", ln)
        body.append(f'<figure><img alt="{html.escape(m.group(1))}" src="{data_uri(m.group(2))}"><figcaption>{inline(m.group(1))}</figcaption></figure>')
        i += 1; continue
    if not ln.strip():
        flush(); i += 1; continue
    para.append(ln.strip()); i += 1
flush()

css = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "report.css"), encoding="utf-8").read()
title = re.search(r"^# (.*)$", text, re.M).group(1)
open(out, "w", encoding="utf-8").write(
    f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{html.escape(title)}</title>'
    f"<style>{css}</style></head><body>{''.join(body)}</body></html>")
