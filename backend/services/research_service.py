"""
Research Service — fetches papers/docs from URLs and extracts structured insights.
"""
import re
import httpx
from typing import Dict, Any


HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; NeuronIDE/1.0; +research)"}


async def fetch_url_content(url: str, timeout: float = 30.0) -> str:
    """Fetch text content from a URL, stripping HTML if needed."""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url, headers=HEADERS)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if "html" in content_type:
            return _strip_html(resp.text)
        return resp.text[:20000]


def _strip_html(html: str) -> str:
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        return re.sub(r'\s+', ' ', text).strip()[:18000]
    except ImportError:
        pass
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    html = re.sub(r'<[^>]+>', ' ', html)
    html = re.sub(r'&[a-zA-Z]+;', ' ', html)
    html = re.sub(r'\s+', ' ', html).strip()
    return html[:18000]


def extract_metadata(text: str, source_url: str = "") -> Dict[str, Any]:
    """Extract title, abstract, and basic metadata from paper/doc text."""
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    # Title: first substantial line
    title = ""
    for line in lines[:15]:
        if len(line) > 15 and not line.lower().startswith(("http", "doi:", "arxiv")):
            title = line[:200]
            break

    # Abstract: text between "Abstract" heading and next heading
    abstract = ""
    lower = text.lower()
    abs_start = lower.find("abstract")
    if abs_start != -1:
        chunk = text[abs_start + 8:abs_start + 1500]
        # Stop at next section heading
        stop = re.search(r'\n\s*\d+\.\s+[A-Z]|\n\s*Introduction|\n\s*Keywords', chunk, re.IGNORECASE)
        abstract = chunk[:stop.start()].strip() if stop else chunk.strip()

    return {
        "title": title,
        "abstract": abstract[:800],
        "word_count": len(text.split()),
        "source": source_url,
    }


TASK_PROMPTS = {
    "summarize": """\
Analyze this research paper/document and provide a structured summary:

## Key Contribution
What is the main innovation or finding?

## Method
What approach or algorithm is used?

## Results
What are the key metrics and outcomes?

## Practical Use
How can a data scientist/ML engineer apply this?

## Limitations
What are the main constraints or caveats?

---
Content:
{content}""",

    "extract_algorithm": """\
Extract the core algorithm from this paper:

## Algorithm Name & Category
(e.g., optimization, attention mechanism, loss function)

## Inputs & Outputs
What does it take and return?

## Step-by-Step Process
Number each major step clearly.

## Key Equations
Write the most important equations in plain text.

## Pseudocode
```
Write clean pseudocode here
```

## Complexity
Time and space complexity.

---
Content:
{content}""",

    "generate_code": """\
Read this paper/document and generate a complete, runnable Python implementation:
- Use PyTorch, sklearn, or numpy as appropriate
- Add docstrings and inline comments explaining each section
- Include a short usage example at the bottom
- Keep it practical — focus on the core algorithm

---
Content:
{content}""",
}


def build_extraction_prompt(task: str, content: str) -> str:
    template = TASK_PROMPTS.get(task, TASK_PROMPTS["summarize"])
    # Limit content to ~6K chars to stay within context
    return template.format(content=content[:6000])
