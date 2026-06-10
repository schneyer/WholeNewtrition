const repoContentsBase = "https://api.github.com/repos/schneyer/WholeNewtrition/contents/Post-Pancreatectomy-Nutrition-Plan/";

export async function fetchMarkdown(fileName) {
  const response = await fetch(`${repoContentsBase}${fileName}?ref=main`, {
    cache: "no-store",
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!response.ok) throw new Error(`Could not load ${fileName}`);
  const payload = await response.json();
  const binary = atob(payload.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const document = { title: "", intro: [], sections: [] };
  let current = null;
  let pendingParagraph = [];

  const flushParagraph = () => {
    if (!pendingParagraph.length) return;
    const text = pendingParagraph.join(" ").trim();
    if (text) {
      if (current) current.blocks.push({ type: "p", text });
      else document.intro.push(text);
    }
    pendingParagraph = [];
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      flushParagraph();
      document.title = line.slice(2).trim();
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      current = { title: line.slice(3).trim(), blocks: [] };
      document.sections.push(current);
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      if (!current) {
        current = { title: "Notes", blocks: [] };
        document.sections.push(current);
      }
      current.blocks.push({ type: "h3", text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      if (!current) {
        current = { title: "Notes", blocks: [] };
        document.sections.push(current);
      }
      const previous = current.blocks[current.blocks.length - 1];
      if (previous && previous.type === "ul") {
        previous.items.push(line.slice(2).trim());
      } else {
        current.blocks.push({ type: "ul", items: [line.slice(2).trim()] });
      }
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    pendingParagraph.push(line.trim());
  }

  flushParagraph();
  return document;
}

export function renderInline(text) {
  return escapeHtml(text).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function renderMarkdownDocument(document, target, options = {}) {
  target.innerHTML = "";
  target.classList.add("markdown");

  document.sections.forEach((section) => {
    const sectionEl = documentNode("section", { id: slugify(section.title) });
    sectionEl.append(documentNode("h2", {}, section.title));

    section.blocks.forEach((block) => {
      if (block.type === "p") {
        sectionEl.append(documentNode("p", { html: renderInline(block.text) }));
      }
      if (block.type === "h3") {
        sectionEl.append(documentNode("h3", {}, block.text));
      }
      if (block.type === "ul") {
        const list = documentNode("ul", { className: options.choiceLists && section.title === "Easy Choices" ? "choice-list" : "" });
        block.items.forEach((item) => {
          list.append(documentNode("li", { html: renderInline(formatChoiceItem(item, options.choiceLists)) }));
        });
        sectionEl.append(list);
      }
    });

    target.append(sectionEl);
  });
}

function formatChoiceItem(item, useChoiceFormat) {
  if (!useChoiceFormat) return item;
  return item.replace(/^<strong>([^<]+):<\/strong>\s*/, "<strong>$1</strong>");
}

export function documentNode(tag, options = {}, text = "") {
  const node = document.createElement(tag);
  if (options.id) node.id = options.id;
  if (options.className) node.className = options.className;
  if (options.html !== undefined) node.innerHTML = options.html;
  else node.textContent = text;
  return node;
}
